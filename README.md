# ⚖️ Micro Saler — Local-First POS & Inventory System

[![Deploy Web App](https://github.com/drewdroid86/Micro-Saler-/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/drewdroid86/Micro-Saler-/actions/workflows/deploy-pages.yml)
[![Live Web App](https://img.shields.io/badge/live--demo-GitHub%20Pages-brightgreen.svg)](https://drewdroid86.github.io/Micro-Saler-/)
[![Version](https://img.shields.io/badge/version-1.3.0-brightgreen.svg)](https://github.com/drewdroid86/Micro-Saler-)
[![Offline First](https://img.shields.io/badge/pwa-100%25--offline--local-blue.svg)](https://github.com/drewdroid86/Micro-Saler-)

**Micro Saler** is a high-performance, offline-first Point-of-Sale (POS) and Inventory Management system engineered specifically for market-stall, street vendor, and small-batch mica pigment sales by weight.

👉 **[Launch Live Web App (GitHub Pages)](https://drewdroid86.github.io/Micro-Saler-/)**

---

## Stack

| Layer | Tech |
|-------|------|
| UI | React 18 (JSX, no TypeScript) |
| Build | Vite 5 |
| Database | IndexedDB (client-side, DB version 9) |
| Analytics | Vercel Speed Insights |

---

## 🌟 Key Features

- ⚖️ **Precision Weight Accounting**: Tracks pigment inventory in **milligrams (mg)** to prevent fractional gram drift and inventory discrepancy.
- 💵 **Exact Cents Financial Math**: All pricing, payments, and balances are stored as integer cents to eliminate floating-point rounding errors.
- 📈 **Profit & Loss (P&L) Dashboard**: Real-time financial reports with time-range filtering (Today, 7 Days, 30 Days, YTD, All Time), Gross Sales, COGS, Merchant Fees, Shrinkage Loss, and Net Profit Margin %.
- 📤 **Accounts Payable & Supplier Ledger**: Manage supplier contacts, restock on supplier tab (`UNPAID_TAB`), track vendor debt liabilities ("What I Owe"), and record supplier payments.
- 📥 **Accounts Receivable & Customer Tabs**: Manage customer tab debt ("Who Owes Me"), credit limits, and trust status badges (`GOOD_STANDING`, `VIP`, `PAUSED`).
- 📦 **Weighted Average Cost (WAC) Restocking**: Dynamically recalculates Cost of Goods Sold (COGS) on incoming supplier shipments.
- 🤝 **Handshake Credit Override**: Authorize tab sales exceeding credit limits with mandatory security audit logging.
- 🛡️ **Atomic Transaction Protection**: Multi-store IndexedDB atomic transaction wrapper for sales, voids, returns, and backup restores.
- ♻️ **Cumulative Partial Returns & Restocking**: Process returns per sale item with automatic inventory restocking.
- 📉 **Spillage & Shrinkage Logging**: Log lost, sampled, or spilled inventory with automatic COGS adjustment.
- 🔒 **Audit Trail**: Immutable audit log for security overrides, voided sales, and pricing updates.
- 💳 **Multi-Tender Split Payments**: Divide any transaction across Cash, Digital (Square, Venmo, Zelle), and House Tab.
- 🧾 **Printable Thermal Receipts**: 80mm/58mm receipt printing support.
- 📶 **100% Offline-First Architecture (PWA)**: Operates without any cloud latency or internet dependency; installable to a home screen.

---

## 📐 Business Logic & Data Specifications

| Domain | Unit | Rule / Specification |
| :--- | :--- | :--- |
| **Weight Units** | Milligrams (mg) | 1 Gram = 1,000 mg (e.g. 84.5g = 84,500 mg) |
| **Monetary Units** | Cents ($) | $1.00 = 100 Cents to avoid floating point errors |
| **Restocking (WAC)** | Formula | New WAC = (Current Total Cost + Received Cost) / (Current Stock mg + Received mg) |
| **Pricing Modes** | Dual Rates | **RETAIL** vs. **WHOLESALE** per-gram prices + packaging fee |
| **Payment Types** | Flexible | `CASH`, `DIGITAL` (Square, Venmo, Zelle), `HOUSE_TAB`, split across multiple types |
| **Split Payments** | Tolerance | Payment total must equal sale total within ±1 cent |
| **Returns** | Cumulative | Max returnable weight per item cannot exceed Sold Weight − Already Returned Weight |

14 IndexedDB object stores: `pigments`, `pigment_price_tiers`, `stock_receipts`, `suppliers`, `supplier_payments`, `customers`, `customer_prepayments`, `sales`, `sale_payments`, `sale_items`, `returns`, `tab_payments`, `shrinkage_logs`, `audit_log`.

---

## 💾 Data & Backup

Micro Saler stores all data **locally on-device** in IndexedDB (`MicroSalerDB`, schema v9). There is no server and no cloud sync.

- **Export**: downloads a single timestamped JSON file (`micro-saler-backup-<date>.json`) containing every store — pigments, stock receipts, customers, sales, payments, sale items, returns, tab payments, shrinkage logs, and audit trail.
- **Import**: restores from a previously exported file inside a single atomic transaction. **This overwrites all current data** — you'll be asked to confirm before applying.
- **Recommendation**: export a backup at the end of each sales day/event and store it safely off-device (email to yourself, cloud drive, etc.).
- **Integrity check**: on startup, the app verifies every completed sale's line item total matches its recorded payments (within a 1¢ tolerance), with automatic auto-repair for common mismatches and a manual reconciliation UI for the rest.

---

## ⚠️ Known Limitations

- No multi-user or multi-device real-time sync — single device, single session at a time.

---

## 🚀 Getting Started & Local Setup

#### Prerequisites
- Node.js (`v18+`)
- npm (`v9+`)

#### Instructions
```bash
npm install
npm run dev      # dev server (Vite HMR)
npm run build    # production bundle
npm run preview  # preview production build
npm test         # run unit tests (node:test)
```

The production bundle is generated in `dist/`.

---

## 🏗️ Architecture Notes

React UI → `PosContext` → Repository / business logic (`repository.js`) → IndexedDB (`db.js`).

Money is stored as integer cents and weight as integer milligrams throughout — see [`repository.js`](./src/repository.js) for the shared conversion/formatting helpers (`gramsToMg`, `mgToGrams`, `formatCents`, etc.) rather than re-deriving them elsewhere.

---

## 🏷️ Release History

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes and version history.
