# 📝 Changelog

All notable changes to the **Micro Saler POS** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-27

### 🚀 Added
- **Ledger Export & Import Infrastructure (`webapp-react/`)**:
  - Manual backup export of all 10 IndexedDB object stores packaged into a single timestamped JSON file (`micro-saler-backup-<date>.json`).
  - Ledger import/restore with schema version validation ($\le \text{v4}$), overwrite confirmation warning, and primary key preservation using `put`.
  - Added `💾 Backup / Restore` UI controls in the top navigation header and Audit Log screen.
  - Startup data integrity auditing checking completed sale line-item totals against recorded payment totals (within $\pm 1\text{\cent}$ tolerance).

### 🛠️ Changed
- **IndexedDB Schema Version**: Bumped database version to `v4` (`DB_VERSION = 4`) with no-op upgrade handling establishing the pattern for future schema migrations.

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
