# ⚖️ Micro Saler — Local-First Artisan Pigment POS & Inventory System

[![Deploy Web App](https://github.com/drewdroid86/Micro-Saler-/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/drewdroid86/Micro-Saler-/actions/workflows/deploy-pages.yml)
[![Live Web App](https://img.shields.io/badge/live--demo-GitHub%20Pages-4F46E5.svg)](https://drewdroid86.github.io/Micro-Saler-/)
[![Version](https://img.shields.io/badge/version-1.6.0-059669.svg)](https://github.com/drewdroid86/Micro-Saler-)
[![Offline First](https://img.shields.io/badge/pwa-100%25--offline--local-2563EB.svg)](https://github.com/drewdroid86/Micro-Saler-)
[![Tests](https://img.shields.io/badge/tests-76%20passing-10B981.svg)](https://github.com/drewdroid86/Micro-Saler-)

**Micro Saler** is a high-precision, offline-first Point-of-Sale (POS), Inventory Management, and Double-Verified Ledger system engineered for artisan, market-stall, and wholesale mica pigment sales by weight.

👉 **[Launch Live Web App (GitHub Pages)](https://drewdroid86.github.io/Micro-Saler-/)**

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **UI & State** | React 18 (Functional Components, Context API, Custom Hooks) |
| **Design System** | Modern SaaS Slate/Indigo CSS Token Architecture with Light & Dark Mode (`[data-theme="dark"]`) |
| **Build & Bundler** | Vite 5 (with vendor code-splitting & PWA Service Worker `v1.6`) |
| **Database** | IndexedDB (`MicroSalerDB`, Schema `v11` — 15 client-side object stores) |
| **Testing** | Node.js Native Test Runner (`node:test` — 76 unit & integration tests) |
| **Analytics** | Vercel Speed Insights |

---

## ✨ What's New in v1.6.0

- 🎨 **Modern SaaS UI & Light/Dark Theme Engine**: Crisp Slate & Indigo palette with tabular numerals (`tabular-nums`), elevated cards, glassmorphic modals, and an instant **☀️ Light / 🌙 Dark** mode toggle persisted in `localStorage`.
- 🧭 **Categorized Desktop Sidebar & Mobile Bottom Dock**: Organizes all 9 modules into 4 logical groups (**Point of Sale**, **Catalog & Stock**, **Accounts & Tabs**, **Analytics & System**) with live status badges (cart item count, low-stock alerts, open prepayments) and a thumb-friendly mobile dock.
- 🛒 **Guided 3-Step Checkout Register**:
  - **Step 1 — Select Pigment**: Instant search bar and finish-type filter pills (`Matte`, `Shimmer`, `Pearl`, `Metallic`, etc.) with selected checkmarks and live per-gram rate badges.
  - **Step 2 — Tap Weight Tier**: Responsive grid of tactile preset cards (`¼g`, `½g`, `¾g`, `1g`, `1.5g`, `1.75g`, `3.5g`, `5g`, `7g`, `14g`, `28g`, plus `+ Custom`) displaying live calculated prices and fixed tier override indicators.
  - **Step 3 — Receipt-Style Cart with Inline Steppers**: One-tap `−` / `+` weight steppers directly inside cart line items, perforated receipt summary with COGS, Recommended MSRP, customer savings banner, and 1-tap Cash or Multi-Tender checkout.
- 🛡️ **Single-Writer Ledger & Audit Hardening**: Strict single-writer discipline on `customer_ledger` (`customer.balance`) and `suppliers` (`current_balance_cents`), proportional `HOUSE_TAB` debt reversal (`REFUND_TAB_REVERSAL`) and `STORE_CREDIT` restoration on partial/multi-item returns, and net return deductions across P&L and Business Insights.

---

## 🌟 Core Capabilities

- ⚖️ **Milligram Precision Weight Accounting**: Tracks pigment inventory in **milligrams (`mg`)** (`1g = 1,000 mg`) to eliminate fractional gram drift.
- 💵 **Integer Cents Financial Math**: All prices, COGS, fees, and ledger balances are stored as integer cents (`$1.00 = 100¢`) to prevent floating-point rounding errors.
- 🏷️ **Dual Pricing Modes & Fixed Tier Overrides**: Switch seamlessly between **RETAIL** and **WHOLESALE** rates, configure per-pigment fixed weight-tier prices, and compare against **Recommended MSRP**.
- 📥 **Customer Ledger, Store Credit & Prepayments**: Track customer House Tab debt (`balance < 0`), Store Credit (`balance > 0`), and open Prepayments/Backorders with an immutable chronological `customer_ledger` and unified credit-exposure guard.
- 📤 **Accounts Payable & Supplier Ledger**: Manage vendor contacts, receive stock on supplier credit (`UNPAID_TAB`), edit restock terms, void receipts, and record vendor settlements.
- 📦 **Weighted Average Cost (WAC) Engine**: Dynamically recalculates Cost of Goods Sold (COGS) upon every incoming shipment and restock.
- 📊 **Reports, P&L & Business Insights**: Time-range filtered financial statements, per-pigment sell-through velocity, reorder alerts, merchant processing fee deductions, and shrinkage tracking.
- ♻️ **Cumulative Partial Returns**: Return partial or full item weights back into inventory with automatic WAC restoration, `STORE_CREDIT` refunds, and `HOUSE_TAB` debt reversals.
- 🧾 **80mm/58mm Thermal Receipt Printing & CSV Export**: Print formatted receipts or export RFC-compliant CSV sales reports.
- 🔒 **Built-In Interactive User Guide & Data Integrity Repair**: Press `?` or `F1` anywhere to open the searchable User Guide, or run the automated Ledger & Payment Integrity scanner.

---

## 📐 Business Logic & Data Specifications

| Domain | Unit | Rule / Specification |
| :--- | :--- | :--- |
| **Weight Units** | Milligrams (`mg`) | `1g = 1,000 mg` • `1 oz = 28,350 mg` |
| **Monetary Units** | Integer Cents (`¢`) | `$1.00 = 100¢` (zero floating-point drift) |
| **Customer Balance** | Signed Cents | `balance > 0` = Store Credit • `balance < 0` = House Tab Debt Owed |
| **Restocking (WAC)** | Weighted Formula | `New WAC = (Current Total Cost + Received Cost) / (Current Stock mg + Received mg)` |
| **Pricing Modes** | Dual Rates + Tiers | `RETAIL` vs. `WHOLESALE` per-gram rates, fixed weight-tier overrides, and packaging fees |
| **Payment Tenders** | Multi-Tender | `CASH`, `DIGITAL` (Square, Venmo, Zelle, CashApp), `HOUSE_TAB`, `STORE_CREDIT`, `PREPAID_DELIVERY` |
| **Split Payments** | `±1¢` Tolerance | Payment sum must match sale total within `±1¢` (auto-reconciled inline) |
| **Returns** | Cumulative Net | `Max Returnable mg = Sold Weight mg − Prior Returned mg` |

### 🗄️ 15 IndexedDB Object Stores (`MicroSalerDB` v11)
`pigments` • `pigment_price_tiers` • `stock_receipts` • `suppliers` • `supplier_payments` • `customers` • `customer_ledger` • `customer_prepayments` • `sales` • `sale_payments` • `sale_items` • `returns` • `tab_payments` • `shrinkage_logs` • `audit_log`

---

## 💾 Local Data & Backup Strategy

Micro Saler stores all data **100% locally on-device** in IndexedDB. There is no external database server or cloud lock-in.

- **Manual & Automated Backups**: Export all 15 object stores to a timestamped `.json` file (`micro-saler-backup-<timestamp>.json`) at any time, with an automated 30-minute backup timer and >24h overdue reminder badge.
- **Atomic Restore**: Restoring a backup validates all store arrays, downloads a safety backup of current data, and imports all 15 stores inside a single atomic readwrite transaction.
- **Startup Integrity Verification**: Automatically checks completed sales and customer ledger balances on startup, with 1-click reconciliation in the **Integrity Repair** tool.

---

## 🚀 Getting Started & Local Development

### Prerequisites
- **Node.js** `v18+`
- **npm** `v9+`

### Commands
```bash
npm install      # Install dependencies
npm run dev      # Start Vite dev server with HMR (http://localhost:3000)
npm test         # Run all 76 unit & ledger integrity tests (node:test)
npm run build    # Build production bundle into dist/
npm run preview  # Preview production build locally
```

---

## 🏗️ Architecture Overview

```text
React UI Components (src/components/)
       │
       ▼
Global POS Context & Theme Engine (src/context/PosContext.jsx)
       │
       ▼
Repository & Financial Engine (src/repository.js)
       │
       ▼
Atomic IndexedDB Wrapper (src/db.js — MicroSalerDB v11)
```

---

## 🏷️ Release History

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes and version history.
