# 📝 Changelog

All notable changes to the **Micro Saler POS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-08-09

### 🚀 Added
- **Customer Balance Tracking (Credit & Debt)**:
  - Comprehensive customer financial balance engine tracking House Tab debt (`current_balance_cents > 0`), Store Credit balances (`current_balance_cents < 0`), active prepayments/backorders, available credit line, and utilization percentage.
  - New `calculateCustomerBalance` helper function returning structured debt, store credit, prepaid credit, available credit line, utilization, and formatted currency.
  - **Customer Balance Adjustments (`adjustCustomerBalance`)**: Issue store credit, charge tab debt, or set exact target balances with structured reason categories and audit logging.
  - **Customer Opening Balance & Direct Balance Setup**:
    - Add opening balance configuration when creating a new customer (Settled `$0.00`, Prepaid Credit `+`, or Debt Owed `-`) with optional audit memo, automatically generating opening `customer_ledger` and `audit_log` entries.
    - Added inline customer balance editor inside Edit Customer Profile modal with atomic multi-store ledger reconciliation.
  - **Full Financial Customer Ledger (`customerLedger`)**: Chronological audit trail aggregating sales with tab charges, tab settlements, prepayments, and manual adjustments with real-time running debt/credit calculations.
  - **Upgraded Customer Screen**: Top financial summary KPI metrics (Total Receivables / Debt, Store Credit Held, Pending Prepayments, Net Account Position), search and filter chips (`All`, `Owes Debt`, `Store Credit`, `Prepayments`, `Settled`), rich customer cards with visual balance boxes and available credit indicators.
  - **Enhanced Settle Tab & Autocomplete**: Overpayment support automatically allocating excess settlement funds to Store Credit, and dual Debt/Credit pill indicators across checkout and autocomplete.

---

## [1.3.0] - 2026-07-30

### 🚀 Added
- **Customer Name Autocomplete on Sale/Checkout Screen**: Inline reactive customer name & phone autocomplete dropdown with substring highlighting, tab balances, prepaid badges, keyboard navigation (Arrow Up/Down/Enter/Escape), quick Walk-in customer reset, and new customer quick-create.
- **Functional Multi-Tender Split Payments**: Divide any transaction across Cash, Digital (Square, Venmo, Zelle), and House Tab with real-time balance calculations.
- **PWA App Icon Assets**: Generated scale-icon PNG assets (`icon-192.png` and `icon-512.png`) in `webapp-react/public/` for 100% PWA home screen installation readiness.
- **CSV Sales History Export**: Download sales history as timestamped `.csv` files for tax filing, accounting, and spreadsheet imports.
- **Printable Thermal Transaction Receipts**: Added receipt viewer modal (`receiptModal`) with browser `@media print` support for 80mm/58mm thermal receipt printers.
- **Automated Unit Test Suite**: Integrated Node `--test` test runner (`npm run test`) with automated unit tests for `formatCents`, `formatMgToGrams`, `getEffectivePricePerGramCents`, and WAC cost formulas.

---

## [1.2.0] - 2026-07-29

### 🚀 Added
- **Accounts Payable & Supplier Ledger (`SuppliersTab`)**: Track vendor liabilities, restock on supplier tab (`UNPAID_TAB`), manage vendor contacts, and record supplier payments (`paySupplier`) via Cash, Bank Transfer, Digital, or Check.
- **Financial Reports & P&L Dashboard (`ReportsTab`)**: Dedicated reports dashboard with time-range filtering (Today, 7 Days, 30 Days, YTD, All Time), Net Operating Profit KPI, Gross Revenue, Who Owes Me (AR), What I Owe (AP), Profit & Loss Statement breakdown, and Inventory Financial Asset Valuation (Cost Basis WAC vs Retail Potential Revenue).
- **Global Error Boundary**: Implemented top-level `<ErrorBoundary>` to gracefully catch unhandled React render exceptions.

### 🛡️ Security & Integrity (Deep-Dive Audit Remediations)
- **Atomic Multi-Store Transactions**: Generic `runTransaction` helper in `db.js` ensuring atomic multi-store writes for `completeSale`, `voidSale`, `processReturn`, and `importAllStores`.
- **Safe Non-Destructive Backup Import**: Refactored `importAllStores` to execute inside a single transaction, preventing total database loss on interrupted restores.
- **Storage Persistence**: Automatic registration of `navigator.storage.persist()` on database initialization.
- **Double-Submission Guards**: Added `isSubmitting` locks on checkout actions to prevent double-charging and double inventory deductions.
- **Audit Log Index Alignment**: Harmonized `audit_log` store index fields (`created_at` and `timestamp`).

### ⚡ Performance & Stability
- **Context Memoization**: Wrapped `PosContext` value object in `useMemo` to eliminate unneeded application-wide component re-renders.
- **Key Prop Optimization**: Replaced `Math.random()` key anti-pattern in `AuditScreen` with deterministic composite keys.
- **Null & NaN Safe Formatting**: Added strict numerical guards to `formatCents` and `formatMgToGrams`.

---

## [1.1.0] - 2026-07-27

### 🚀 Added
- **Data Export/Import**: full JSON backup of all 10 IndexedDB stores (pigments, stock_receipts, customers, sales, sale_payments, sale_items, returns, tab_payments, shrinkage_logs, audit_log), downloadable as a timestamped file. Import restores from a backup with an explicit confirm-before-overwrite step.
- **Startup Integrity Check**: on startup, the app verifies every completed sale's line item total matches its recorded payments (within a 1¢ tolerance). Any mismatch is logged to the browser console.

### 🛠️ Changed
- **Database Version Migration**: bumped IndexedDB version from 3 to 4 with a no-op migration path, establishing the pattern for future schema changes.

### 🐛 Fixed
- Fixed stale form-field state in `ModalManager.jsx` and `CustomWeightModal.jsx` — modals now reset all local input state on open (keyed to the record being edited) and close, so values from a previously edited pigment/customer no longer leak into the next modal.

### 📝 Notes
This is the first version where the app is safe to trust with real transaction data — back up regularly using the new export feature until automatic/cloud sync (if ever) is added.

---




## [1.0.0] - 2026-07-27


### 🚀 Added
- **React Web Application (`webapp-react/`)**:
  - Full React 18 + Vite conversion of the web POS application.
  - IndexedDB Promise wrapper (`MicroSalerDB`) with 10 object stores matching Room DB schema.
  - React Context provider (`PosContext`) and custom hooks for global POS state management.
  - Reusable React components (`CheckoutScreen`, `InventoryScreen`, `CustomerScreen`, `HistoryScreen`, `AuditScreen`).
  - Custom weight & price modal (`CustomWeightModal`) replacing native browser `prompt()`.
  - PWA support with Web Manifest (`manifest.json`) and Service Worker offline asset caching (`sw.js`).
  - Pixel-for-pixel CSS parity using custom design tokens from `styles.css`.

- **Android Native Application (`app/`)**:
  - Jetpack Compose POS screens with Material 3 design system.
  - Room database (`AppDatabase`, `AppDaos`) with full schema entities.
  - `PosRepository` handling WAC stock deduction, tab balances, and credit override audit logs.
  - `PosViewModel` managing state flows for checkout, inventory, customers, and sales history.

### 🛡️ Security & Integrity
- Handshake Credit Override audit log tracking for tab sales exceeding customer limits.
- Milligram weight precision and integer cents financial calculations.
