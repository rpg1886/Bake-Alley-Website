# Technical & Functional Integration Blueprint: The Bake Alley Webstore ↔ Cloud POS (Neon.tech & Express API)

## Executive Summary
This document defines the technical architecture, security protocols, database schemas, and API integration paths for connecting **The Bake Alley** public web storefront (`repomix-output-web.txt`) to its **Cloud-Based Point of Sale (POS)** ecosystem (`repomix-output_pos.txt`).

The core objective is to deliver a seamless, real-time customer experience—allowing online inventory browsing, multi-channel inquiries, and advance item reservations—while maintaining strict data security, server-authoritative pricing, and First-Expired, First-Out (FEFO) inventory integrity across both online and physical store operations.

---

## 1. System Architecture & Component Mapping

### 1.1 Architecture Topology
```
┌─────────────────────────────────────────────────────────────┐
│                 The Bake Alley Public Webstore              │
│   - Semantic HTML5 / React single-page storefront           │
│   - Custom aesthetic palette (#FAF6F0, #4A3525, #D97757)    │
│   - Web3Forms API for instant multi-channel inquiries       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Public HTTPS REST Requests
                               │ (Sanitised JSON, Rate-Limited)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│           Express REST API Backend (Railway / Node.js)      │
│   - Security: CORS Whitelist, Zod Validation, Rate Limiter  │
│   - Business Logic: Server-Authoritative Pricing & FEFO     │
│   - Connection Pooling: max 20, 30s idle, SSL Enabled       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Encrypted SSL Connection (`pg` Pool)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              Neon.tech Serverless PostgreSQL                │
│   - System of Record: UUID v4 primary keys                  │
│   - High Precision: NUMERIC(12,2) money, NUMERIC(12,4) qty  │
│   - Key Tables: products, variants, lots, orders, sessions  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Security & Architectural Principles

### 2.1 The "No Direct DB Access" Policy
Connecting a public web browser directly to Neon.tech PostgreSQL (e.g., using client-side database libraries or public tokens) is strictly prohibited due to three critical security and operational risks:
1. **Credential & Secret Exposure:** Client JS bundles can be inspected by anyone, leaking connection tokens or database permissions.
2. **Business Rule Bypass:** A direct database client could bypass server-side validation—modifying retail prices, overriding stock levels, or accessing sensitive financial data such as supplier costs (`initial_cost`) and profit margins.
3. **Connection Exhaustion:** Unpredictable public web traffic can rapidly exhaust database connection limits, leading to service downtime and unnecessary serverless compute costs.

### 2.2 Security Guardrails Implemented at the API Layer
By placing the Node.js / Express REST API (`server/app.js`) as an intermediary, all requests are securely controlled:
* **Data Sanitization:** Public endpoints strip away supplier costs, warehouse lot numbers, employee shift logs, and internal accounting details before returning JSON responses.
* **CORS Whitelist Protection:** Configured via `CORS_ALLOWED_ORIGINS` to accept cross-origin requests exclusively from authorized storefront domains (e.g., `https://rpg1886.github.io`, `https://bakealley.com`).
* **Rate Limiting:** Managed by `express-rate-limit` to prevent denial-of-service and scraping attempts (100 req/min for general routes; 5 req/15min for authentication).
* **Schema Input Validation:** Inbound JSON payloads are strictly validated using `Zod` schemas (`validation.js`) before interacting with PostgreSQL.

---

## 3. Data Schema & Domain Rules

### 3.1 Domain Constraints
* **Primary Keys:** Every domain entity across PostgreSQL and local storage uses UUID v4 strings (`gen_random_uuid()`). Auto-incrementing integer primary keys are strictly prohibited.
* **Monetary Precision:** All prices, subtotals, deposits, and totals use `NUMERIC(12, 2)` formatted to Philippine Pesos (`₱`) with exactly two decimal places.
* **Quantity & Weight Precision:** Product quantities, weights, and rates use `NUMERIC(12, 4)` to handle fractional unit measurements (e.g., `0.5000 kg` cocoa powder).
* **Food Safety & FEFO Lot Tracking:** Perishable supplies marked `requires_lot_tracking = true` track expiration dates in `inventory_lots`. Order deductions enforce **First-Expired, First-Out (FEFO)** allocation (`ORDER BY expiration_date ASC NULLS LAST`).

### 3.2 Key Database Schema Summary (`001_cloud_pos.sql`)

| Table Name | Primary Key | Critical Columns & Constraints |
| :--- | :--- | :--- |
| `categories` | `category_id (UUID)` | `name (TEXT UNIQUE)` |
| `products` | `product_id (UUID)` | `category_id (FK)`, `name (TEXT)`, `base_uom_id (FK)`, `is_sold_by_weight (BOOL)`, `requires_lot_tracking (BOOL)`, `initial_cost (NUMERIC 12,2)` |
| `product_variants` | `variant_id (UUID)` | `product_id (FK)`, `sku (TEXT UNIQUE)`, `barcode (TEXT)`, `variant_name (TEXT)`, `attributes (JSONB)` |
| `product_prices` | `product_price_id (UUID)` | `variant_id (FK)`, `tier_id (FK)`, `price_per_unit (NUMERIC 12,2)`, `min_quantity (NUMERIC 12,4)` |
| `inventory_lots` | `lot_id (UUID)` | `variant_id (FK)`, `lot_number (TEXT)`, `expiration_date (DATE)`, `quantity_on_hand (NUMERIC 12,4)` |
| `orders` | `order_id (UUID)` | `customer_id (FK)`, `employee_id (FK)`, `order_mode ('immediate'\|'reservation')`, `fulfillment_date (DATE)`, `deposit_amount (NUMERIC 12,2)`, `balance_due (NUMERIC 12,2)`, `reservation_status (TEXT)`, `total_amount (NUMERIC 12,2)`, `payment_method (TEXT)` |
| `order_items` | `order_item_id (UUID)` | `order_id (FK)`, `variant_id (FK)`, `lot_id (FK)`, `quantity (NUMERIC 12,4)`, `unit_price (NUMERIC 12,2)`, `total_price (NUMERIC 12,2)` |

---

## 4. Integration Workflows & API Contracts

### 4.1 Public Catalog & Real-Time Stock Feed
* **Endpoint:** `GET /api/v1/public/catalog` (or `GET /api/v1/products/search`)
* **Behavior:** 
  1. The public web application queries the API to populate the catalog grid (`#products`).
  2. The server performs SQL joins across `products`, `product_variants`, `product_prices`, and `inventory_lots`.
  3. Real-time stock status is dynamically calculated:
     * `in_stock`: `quantity_on_hand > low_stock_threshold`
     * `low_stock`: `0 < quantity_on_hand <= low_stock_threshold`
     * `out_of_stock`: `quantity_on_hand == 0`
  4. Returns a sanitized list containing product names, category tags, retail prices, unit sizes, and stock status badges.

### 4.2 Web Reservations & Advance Pre-Orders
* **Endpoint:** `POST /api/v1/public/reservations`
* **Behavior:**
  1. When a visitor reserves baking supplies or requests a custom bulk order on the website, the request posts a structured payload:
     ```json
     {
       "contactName": "Maria Santos",
       "phone": "+639171234567",
       "email": "maria@pastryshop.ph",
       "fulfillmentDate": "2026-10-25",
       "items": [
         { "variantId": "d3b07384-d113-46e4-a123-111111111111", "quantity": 5 }
       ]
     }
     ```
  2. The Express API generates a UUID v4 `order_id`, inserts the record into Neon.tech with `order_mode = 'reservation'`, status `'open'`, and `reservation_status = 'unpaid'` (or `'partially_paid'`).
  3. **Non-Destructive Stock Handling:** Stock is **not** immediately deducted from `inventory_lots` during pre-order creation to prevent inventory locking on abandoned reservations.

### 4.3 Physical Store Fulfillment & FEFO Deductions
* **Workflow:**
  1. In-store cashiers view incoming advance orders under the POS **Reservations Tab**.
  2. When the customer arrives at Teacher's Village to collect their supplies, the cashier taps **"📦 Fulfill"**.
  3. The POS sends `POST /api/v1/orders/:orderId/fulfill` along with any settled balance payment.
  4. The Express API opens a PostgreSQL transaction, locks inventory rows using `FOR UPDATE`, and deducts stock from `inventory_lots` using First-Expired, First-Out (`expiration_date ASC`).
  5. The order status updates to `'completed'`, change due is calculated server-side, and a printed receipt is generated.

---

## 5. Deployment & Configuration Checklist

### 5.1 Railway & Neon.tech Environment Configuration
```env
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://user:password@ep-cool-lake-123456.neon.tech/bakealley?sslmode=require
CORS_ALLOWED_ORIGINS=https://rpg1886.github.io,https://bakealley.com
LOG_LEVEL=info
```

### 5.2 Key Operational Tasks
- [x] **Railway Start Command:** Ensure Start Command is set to `node server/app.js` (not `seed-admin.js`).
- [x] **Database Pool Settings:** `pg.Pool` initialized with `max: 20`, `idleTimeoutMillis: 30000`, and SSL enabled for Neon.tech.
- [x] **Web3Forms Backup Route:** Multi-channel inquiry forms submit to Web3Forms API (`https://api.web3forms.com/submit`) while sync errors alert administrators via email/viber.
- [x] **Manila Timezone Synchronization:** All business reporting and EOD shift reconciliation use strict `Asia/Manila` date boundaries (`+08:00`).

---
*Document generated for The Bake Alley Website & Cloud POS Integration.*
