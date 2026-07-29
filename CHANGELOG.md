# 📝 Changelog

All notable changes to the **Micro Saler POS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
