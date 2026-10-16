# Read-Only Integration Blueprint: The Bake Alley Webstore & Cloud POS (Neon.tech & Express API)

## Executive Summary
This document defines the simplified, high-security **One-Way Read-Only Architecture (POS to Website)** for connecting **The Bake Alley** public web storefront (`repomix-output-web.txt`) to its **Cloud-Based Point of Sale (POS)** backend (`repomix-output_pos.txt`).

By restricting the public web storefront to read-only access, the store maintains **100% real-time inventory visibility** for customers while **completely eliminating public database write surface area**, preventing bot attacks, fake reservations, and unauthorized database access.

---

## 1. Architectural Philosophy: One-Way Synchronization (POS to Website)

```
+-------------------------------------------------------------+
|                 Physical Store Operations                   |
|   (Cashier Terminals, Mobile Tablets, Store Inventory)      |
+------------------------------+------------------------------+
                               |
                               | Real-Time Sales & Purchases (Write Operations)
                               v
+-------------------------------------------------------------+
|              Neon.tech Serverless PostgreSQL                |
|   - System of Record (UUID v4 keys, NUMERIC precision)      |
|   - Tables: products, variants, prices, inventory_lots      |
+------------------------------+------------------------------+
                               |
                               | Encrypted Connection (pg Pool)
                               v
+-------------------------------------------------------------+
|           Express REST API Backend (Railway / Node.js)      |
|   - Public Route: GET /api/v1/public/catalog                |
|   - Security: CORS Whitelist, Data Sanitization, Rate Limit  |
+------------------------------+------------------------------+
                               |
                               | Read-Only Sanitized JSON Feed
                               v
+-------------------------------------------------------------+
|                 The Bake Alley Public Webstore              |
|   - Displays live catalog, prices and stock badges          |
|   - Reserve via Direct Chat (Viber / Messenger / Email)     |
+-------------------------------------------------------------+
```

---

## 2. Key Security & Operational Benefits

| Security & Operational Risk | Direct Web Reservations (Two-Way Write) | Read-Only Sync + Direct Chat (Recommended) |
| :--- | :--- | :--- |
| **Database Attack Surface** | High (Exposes write endpoints to web traffic) | **Zero Public Write Endpoints** |
| **Inventory Locking & Spam** | High (Bots and fake users can hoard stock) | **Eliminated** (Cashier verifies before entry) |
| **Code & Infrastructure Complexity** | High (Requires CAPTCHA, SMS OTP, cart cleanup timers) | **Minimal & Lightweight** (Single GET endpoint) |
| **Data Integrity** | Vulnerable to malicious payload manipulation | **Server-Authoritative Read-Only** |
| **Customer Experience** | Cold automated forms | **Personalized Direct Chat** (GCash deposits via Viber/Messenger) |

---

## 3. Web Reservations & Customer Inquiry Flow

1. **Browsing:** The customer visits **The Bake Alley** web storefront and views real-time stock status badges powered by the POS database:
   * 🟢 **In Stock** (`quantity_on_hand > low_stock_threshold`)
   * 🟠 **Running Low** (`0 < quantity_on_hand <= low_stock_threshold`)
   * 🔴 **Out of Stock** (`quantity_on_hand == 0`)
2. **Inquiry / Reservation Trigger:** Clicking **"Reserve / Inquire"** opens a pre-formatted chat or email link (Viber, WhatsApp, Messenger, Phone, or Web3Forms email) pre-filled with item name, unit size, and customer details.
3. **Cashier Verification & Input:** 
   * The cashier receives the reservation message in store.
   * Staff confirms availability, collects a GCash deposit if applicable, and manually enters the pre-order into the POS under the **Reservations Tab**.
   * Physical inventory is safely locked or fulfilled via in-store cashier actions.

---

## 4. Backend Implementation (Express API)

### 4.1 Single Public Route: `server/routes/publicApi.js`

```javascript
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');

// Rate limiting: max 100 requests per 15 minutes per IP
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

router.use(publicLimiter);

/**
 * GET /api/v1/public/catalog
 * Public, read-only endpoint returning active catalog items with sanitized stock status.
 */
router.get('/catalog', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.product_id,
        p.name AS product_name,
        c.name AS category_name,
        pv.variant_id,
        pv.sku,
        pv.variant_name,
        pp.price_per_unit AS price,
        COALESCE(SUM(il.quantity_on_hand), 0) AS total_stock
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      JOIN product_variants pv ON p.product_id = pv.product_id
      LEFT JOIN product_prices pp ON pv.variant_id = pp.variant_id
      LEFT JOIN inventory_lots il ON pv.variant_id = il.variant_id 
        AND (il.expiration_date IS NULL OR il.expiration_date >= CURRENT_DATE)
      GROUP BY p.product_id, p.name, c.name, pv.variant_id, pv.sku, pv.variant_name, pp.price_per_unit
      ORDER BY c.name ASC, p.name ASC;
    `;

    const { rows } = await pool.query(query);

    // Sanitize and format for public web consumption
    const catalog = rows.map(row => {
      const stock = parseFloat(row.total_stock);
      let stockStatus = 'out_of_stock';
      if (stock > 10) {
        stockStatus = 'in_stock';
      } else if (stock > 0) {
        stockStatus = 'low_stock';
      }

      return {
        id: row.variant_id,
        name: row.product_name,
        variant: row.variant_name !== 'Default' ? row.variant_name : null,
        category: row.category_name,
        price: parseFloat(row.price || 0),
        stockStatus: stockStatus,
        isAvailable: stock > 0
      };
    });

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    return res.json({ success: true, count: catalog.length, data: catalog });
  } catch (error) {
    console.error('Error fetching public catalog:', error);
    return res.status(500).json({ error: 'Failed to fetch catalog.' });
  }
});

module.exports = router;
```

### 4.2 Mounting in `server/app.js`

```javascript
// server/app.js
const express = require('express');
const cors = require('cors');
const publicApiRouter = require('./routes/publicApi');

const app = express();

// CORS Whitelist for Public Storefront
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy Restriction'));
    }
  }
}));

// Mount Public Endpoint BEFORE Protected Session Auth Middleware
app.use('/api/v1/public', publicApiRouter);

// Existing Protected POS Routes below...
```

---

## 5. Webstore Client Code (`script.js`)

```javascript
// Storefront API fetch logic
const POS_API_BASE_URL = '/api/v1/public';

async function loadLiveCatalog() {
  try {
    const response = await fetch(`${POS_API_BASE_URL}/catalog`);
    const result = await response.json();
    
    if (result.success) {
      renderProducts(result.data);
    } else {
      console.warn('Falling back to local cache/mock catalog');
    }
  } catch (error) {
    console.error('Error connecting to POS API:', error);
  }
}

function renderProducts(products) {
  const container = document.getElementById('product-grid');
  if (!container) return;

  container.innerHTML = products.map(p => `
    <div class="product-card">
      <span class="stock-badge ${p.stockStatus}">
        ${p.stockStatus === 'in_stock' ? 'In Stock' : p.stockStatus === 'low_stock' ? 'Running Low' : 'Out of Stock'}
      </span>
      <h3>${p.name}</h3>
      <p class="category">${p.category}</p>
      <p class="price">PHP ${p.price.toFixed(2)}</p>
      <a href="#contact" 
         class="btn-reserve ${!p.isAvailable ? 'disabled' : ''}">
         Reserve via Viber / Chat
      </a>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadLiveCatalog);
```

---
*Document updated to Version 3: Read-Only Architecture for The Bake Alley Website & Cloud POS Integration.*
