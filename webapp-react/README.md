# Micro Saler — React POS Web App

> Pigment inventory, sales, and business intelligence point-of-sale for micro-scale resellers.

## Stack

| Layer | Tech |
|-------|------|
| UI | React 18 (JSX, no TypeScript) |
| Build | Vite 5 |
| Database | IndexedDB (client-side, DB version 9) |
| Analytics | Vercel Speed Insights |

## Quick Start

```bash
npm install
npm run dev      # dev server (Vite HMR)
npm run build    # production bundle
npm run preview  # preview production build
npm test         # run unit tests (node:test)
```

## Features

- **Checkout** — Preset + custom weight tiers, retail/wholesale pricing modes, cash/digital/tab/split payments
- **Inventory** — Pigment catalog with WAC cost tracking, restock receipts, supplier tab management
- **Customers** — House tab (credit) system with limits, prepayment/backorder tracking
- **Suppliers** — Supplier ledger, payment history, balance tracking
- **Reports & Insights** — Per-pigment profitability, inventory velocity, time patterns, receivables/payables, shrinkage analysis
- **Data Integrity** — Automatic mismatch detection, auto-repair for common cases, manual reconciliation UI
- **Backup/Restore** — Full JSON export/import of all 14 object stores

## Architecture Notes

### Database (DB Version 9)

14 IndexedDB object stores: `pigments`, `pigment_price_tiers`, `stock_receipts`, `suppliers`, `supplier_payments`, `customers`, `customer_prepayments`, `sales`, `sale_payments`, `sale_items`, `returns`, `tab_payments`, `shrinkage_logs`, `audit_log`.

All money values stored as **integer cents**. All weights stored as **integer milligrams (mg)**.

### Atomic Transactions

Critical multi-store operations (`completeSale`, `voidSale`, `processReturn`, `restockPigment`, `voidStockReceipt`, `updateRestockTerms`, `settleTabPayment`, `fulfillCustomerPrepayment`, `paySupplier`, `logShrinkage`) use `db.runTransaction()` to ensure all-or-nothing commits across multiple object stores.

### Checkout Guards

- **Double-submit protection**: All payment handlers (`quickCollectCash`, digital, tab, split) share a single `isSubmitting` lock — entry guarded, buttons disabled during submission.
- **Cart stock validation**: `addToCart` and `updateCartItem` enforce that the sum of cart weight for a pigment never exceeds `pigment.stock_mg`.
- **Payment tolerance**: `validateCompletedSale` and `getIntegrityMismatches` allow ±1 cent rounding tolerance between payment total and sale total.

## Known Limitations

- No server-side persistence — all data is in the browser's IndexedDB.
- No multi-device sync.
- Split payments across cash + digital + house tab are fully functional.
- Shrinkage logging guards against logging more than available stock.
- Voiding a sale restocks only the net weight (original − already returned).
