# Technical & Functional Integration Blueprint: The Bake Alley Webstore ↔ Cloud POS (Neon.tech & Express API)

## Executive Summary
This document defines the technical architecture, security protocols, database schemas, API integration paths, and implementation code for connecting **The Bake Alley** public web storefront () to its **Cloud-Based Point of Sale (POS)** ecosystem ().

The core objective is to deliver a seamless, real-time customer experience—allowing online inventory browsing, multi-channel inquiries, and advance item reservations—while maintaining strict data security, server-authoritative pricing, and First-Expired, First-Out (FEFO) inventory integrity across both online and physical store operations.

---

## 1. System Architecture & Component Mapping

### 1.1 Architecture Topology


---

## 2. Core Security & Architectural Principles

### 2.1 The "No Direct DB Access" Policy
Connecting a public web browser directly to Neon.tech PostgreSQL is strictly prohibited due to three critical security and operational risks:
1. **Credential & Secret Exposure:** Client JS bundles can be inspected by anyone, leaking connection tokens or database permissions.
2. **Business Rule Bypass:** A direct database client could bypass server-side validation—modifying retail prices, overriding stock levels, or accessing sensitive financial data such as supplier costs (`initial_cost`) and profit margins.
3. **Connection Exhaustion:** Unpredictable public web traffic can rapidly exhaust database connection limits, leading to service downtime and unnecessary serverless compute costs.

### 2.2 Security Guardrails Implemented at the API Layer
By placing the Node.js / Express REST API (`server/app.js`) as an intermediary, all requests are securely controlled:
* **Data Sanitization:** Public endpoints strip away supplier costs, warehouse lot numbers, employee shift logs, and internal accounting details before returning JSON responses.
* **CORS Whitelist Protection:** Configured via `CORS_ALLOWED_ORIGINS` to accept cross-origin requests exclusively from authorized storefront domains.
* **Rate Limiting:** Managed by `express-rate-limit` to prevent denial-of-service and scraping attempts (120 req/min for catalog browsing; 10 req/15min for reservations).
* **Schema Input Validation:** Inbound JSON payloads are strictly validated using `Zod` schemas before interacting with PostgreSQL.

---

## 3. Data Schema & Domain Rules

### 3.1 Domain Constraints
* **Primary Keys:** Every domain entity across PostgreSQL and local storage uses UUID v4 strings (`gen_random_uuid()`). Auto-incrementing integer primary keys are strictly prohibited.
* **Monetary Precision:** All prices, subtotals, deposits, and totals use `NUMERIC(12, 2)` formatted to Philippine Pesos (`₱`) with exactly two decimal places.
* **Quantity & Weight Precision:** Product quantities, weights, and rates use `NUMERIC(12, 4)` to handle fractional unit measurements (e.g., `0.5000 kg` cocoa powder).
* **Food Safety & FEFO Lot Tracking:** Perishable supplies marked `requires_lot_tracking = true` track expiration dates in `inventory_lots`. Order deductions enforce **First-Expired, First-Out (FEFO)** allocation (`ORDER BY expiration_date ASC NULLS LAST`).

---

## 4. Node.js / Express API Implementation Code (`server/routes/publicApi.js`)

Below is the complete implementation code for adding public catalog retrieval and web reservation routes to your POS backend:



---

## 5. Webstore Integration Wrapper (`script.js`)



---

## 6. Deployment & Integration Checklist

- [x] **Express Router Registration:** In `server/app.js`, register route: `app.use('/api/v1/public', require('./routes/publicApi'));`.
- [x] **CORS Configuration:** Ensure `CORS_ALLOWED_ORIGINS` includes storefront domain on Railway.
- [x] **Database Pool Attachment:** Confirm `app.set('dbPool', pool)` is initialized in `server/app.js`.

---
*Document generated for The Bake Alley Website & Cloud POS Integration (v2).*
