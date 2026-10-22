# 📝 Changelog

All notable changes to the **Micro Saler POS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-10-22

### 🚀 Added
- **Full Atomic Sale Correction Workflow (`PosRepository.correctSale` & `CorrectSaleModal.jsx`)**:
  - Edit any completed sale in place from **Sales History**, **Security Audit Log**, or **Business Insights** (`✏️ Correct Sale`).
  - Supports changing the assigned customer, switching pricing mode (`RETAIL` / `WHOLESALE`) with 1-tap price recalculation, editing/adding/removing line items (pigment, weight in grams, price charged, or proportional total override), and updating single or split payment tenders (`CASH`, `DIGITAL` with provider & fee calculation, `HOUSE_TAB`, `STORE_CREDIT`).
  - Atomically restores and deducts net inventory weights (`stock_mg`) and WAC cost basis (`total_cost_cents`), preserves `sale_item_id` references for prior returns, reconciles `HOUSE_TAB` and `STORE_CREDIT` ledger balances via `_applyLedgerEntryInTx` (including customer reassignments), and logs a `CORRECT_SALE` audit record with full `before` and `after` snapshots.
- **Complete & Retroactive Security Audit Trail (`AuditScreen.jsx` & `repository.js`)**:
  - `completeSale`, `processReturn`, `restockPigment`, and `logShrinkage` now write structured `COMPLETE_SALE`, `PROCESS_RETURN`, `RESTOCK_PIGMENT`, and `LOG_SHRINKAGE` entries to `audit_log`.
  - `AuditScreen.jsx` merges `audit_log` entries with retroactively synthesized records for any historical sales or returns created before v1.7.0, and adds quick inspector actions (**🖨️ Receipt**, **✏️ Correct Sale**, **🚫 Void**).
- **Android App (WebAPK) & Auto-Update Engine (`PwaAppModal.jsx`, `vite.config.js`, `sw.js`, `manifest.json`)**:
  - Added `swAutoVersionPlugin` in `vite.config.js` to stamp a deterministic SHA-256 build hash (`microsaler-v1.7.0-<hash>`) and built asset manifest into `dist/sw.js` on every build.
  - Added Android WebAPK `manifest.json` shortcuts (**POS Register**, **Inventory & Stock**, **Customer Accounts**) with `?tab=` deep-link routing in `PosContext.jsx`.
  - Added **📲 App / Install App** and live **🔄 Update Ready** controls in `Header.jsx` and `PwaAppModal.jsx` to trigger native Android app installation, check for GitHub Pages updates, and apply updates with 1 tap while keeping IndexedDB data intact.
- **Repository Housekeeping & Tests**:
  - Removed legacy August handoff/review notes from the repository root and expanded unit test coverage to **78 passing tests**.

---

## [1.6.0] - 2026-10-19

### 🚀 Added
- **Modern SaaS UI & Light/Dark Theme Engine**:
  - Redesigned visual system (`src/styles.css`) with a crisp Slate & Indigo color architecture, tabular numerals (`tabular-nums`), elevated cards, and full **Light / Dark Mode** support (`[data-theme="dark"]`) persisted in `localStorage`.
  - Added instant **☀️ Light / 🌙 Dark** theme toggle in the top header (`Header.jsx`).
- **Categorized Desktop Sidebar & Mobile Bottom Navigation Dock (`NavTabs.jsx`)**:
  - Grouped all 9 screens into 4 intuitive categories (**Point of Sale**, **Catalog & Stock**, **Accounts & Tabs**, **Analytics & System**) with live badge counters (cart item count, low-stock alerts, open prepayments).
  - Added a fixed thumb-friendly mobile bottom navigation dock with a slide-up **⚡ More** sheet for mobile POS ergonomics.
- **Guided 3-Step Checkout Register (`CheckoutScreen.jsx`)**:
  - **Step 1 (Select Pigment)**: Added real-time pigment search input and dynamic finish-type filter pills (`All Finishes`, `Matte`, `Shimmer`, `Pearl`, `Metallic`, etc.).
  - **Step 2 (Tap Weight Tier)**: Redesigned weight presets into a responsive tactile card grid showing both weight and live calculated price.
  - **Step 3 (Order Receipt & Inline Weight Steppers)**: Added one-tap `−` / `+` weight steppers directly inside cart line items (`0.25g` steps up to `1g`, `1g` steps above `1g`) with automatic tier/per-gram price recalculation and stock ceiling validation.

### 🛡️ Fixed & Hardened (Codebase Audit Remediation)
- **Customer Ledger & Balance Integrity**:
  - Enforced strict single-writer customer balance updates via `_applyLedgerEntryInTx` and unified receivables calculations around `calculateCustomerBalance`.
  - Fixed `processReturn` on multi-item sales to use `sale.total_amount_cents` as the denominator and added proportional `HOUSE_TAB` debt reversal (`REFUND_TAB_REVERSAL`).
  - Excluded `FULFILLED`, `DELIVERED`, `CANCELLED`, and `VOIDED` prepayments from `getCustomerTotalExposure` and `calculateCustomerBalance`.
  - Aligned Customer Ledger modal filters and signed amount formatting (`ModalManager.jsx`).
- **Analytics, Inventory & Reporting Accuracy**:
  - Updated `calculateBusinessInsights` to deduct returned weight, revenue, and proportional COGS from per-pigment sell-through stats, net revenue, and gross profit.
  - Fixed `completeSale` to compute live WAC `total_cogs_cents` prior to persisting the sale record and saved `pigment_name` on `sale_items`.
  - Enforced single-writer supplier balance updates via `_updateSupplierBalanceInTx` across `voidStockReceipt`, `updateRestockTerms`, and `paySupplier`.
  - Updated `HistoryScreen.jsx` to display cumulative returned weights per line item, disable the Return button when fully returned, and export CSVs using standard `Blob` URLs.
  - Updated `EditCartItemModal.jsx` auto-calculation to use `calculatePricingBreakdown` so preset `priceTiers` and packaging fees are respected.
- **Build & Test Suite**:
  - Added vendor chunk splitting (`react`, `react-dom`) in `vite.config.js` and expanded unit test suite to **76 passing tests**.

---

## [1.5.0] - 2026-08-16

### 🚀 Added
- **5g Weight Tier**:
  - Added standard `5g` (5,000 mg) weight preset to Checkout register quick-add buttons.
  - Added `5g` fixed tier pricing override support in pigment editor (`ModalManager.jsx` `PRESET_TIERS`).
  - Added `5g` matrix row in Pricing Calculator screen (`PricingCalculatorScreen.jsx`).
  - Updated User Guide and Help walkthroughs with 5g preset reference.
- **Recommended MSRP (Manufacturer's Suggested Retail Price) Display**:
  - New `calculateRecommendedMsrpCents` repository function computing standard retail pricing with fixed tier overrides and packaging costs.
  - **Checkout Screen**:
    - Selected pigment banner displays real-time Recommended MSRP (`Rec. MSRP: $X.XX/g`) and Wholesale rate comparison.
    - Quick weight preset buttons display calculated price/MSRP for selected pigment with detailed tooltips.
    - Cart items display `Rec. MSRP` and green savings callout if selling below retail/MSRP (e.g. wholesale or custom discount).
    - Cart breakdown displays `Rec. MSRP Total` alongside COGS and Estimated Margin with total transaction savings vs MSRP.
  - **Custom Weight Modal**: Real-time Recommended MSRP quote and one-click "Use MSRP" button when entering custom gram weights.
  - **Edit Cart Item Modal**: Real-time Recommended MSRP quote and "Use MSRP" button.
  - **Edit Cart Total Modal**: Displays standard Recommended MSRP Total and quick "Use MSRP" preset button.
  - **Inventory & Pricing Calculator Screens**: Clarified MSRP/Retail labels on pricing tables and quick quote estimators.

---

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
