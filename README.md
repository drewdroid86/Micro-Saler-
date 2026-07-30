# ⚖️ Micro Saler — Local-First POS & Inventory System

[![Deploy Web App](https://github.com/drewdroid86/Micro-Saler-/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/drewdroid86/Micro-Saler-/actions/workflows/deploy-pages.yml)
[![Live Web App](https://img.shields.io/badge/live--demo-GitHub%20Pages-brightgreen.svg)](https://drewdroid86.github.io/Micro-Saler-/)
[![Version](https://img.shields.io/badge/version-1.3.0-brightgreen.svg)](https://github.com/drewdroid86/Micro-Saler-)
[![Offline First](https://img.shields.io/badge/pwa-100%25--offline--local-blue.svg)](https://github.com/drewdroid86/Micro-Saler-)

**Micro Saler** is a high-performance, offline-first Point-of-Sale (POS) and Inventory Management system engineered specifically for market-stall, street vendor, and small-batch mica pigment sales by weight.

👉 **[Launch Live Web App (GitHub Pages)](https://drewdroid86.github.io/Micro-Saler-/)**

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
- 📶 **100% Offline-First Architecture**: Operates without any cloud latency or internet dependency.

---

## 🏗️ Dual-Platform Architecture

Micro Saler is implemented across two standalone platforms sharing the exact same business logic specifications:

```mermaid
graph TD
    A[Micro Saler POS] --> B[Android Native App]
    A --> C[React PWA Web App]
    
    B --> B1[Kotlin / Jetpack Compose]
    B --> B2[Room Database SQLite]
    B --> B3[StateFlow & Coroutines]

    C --> C1[React 18 + Vite]
    C --> C2[IndexedDB Promise Layer]
    C --> C3[React Context & Custom Hooks]
    C --> C4[ServiceWorker Offline Cache]
```

### 1. Web Application (`webapp-react/`)
- **Framework**: React 18, Vite
- **Storage**: Browser IndexedDB (10 object stores matching Room entities)
- **Styling**: Premium custom CSS design system (`styles.css`) with zero external frameworks
- **PWA Support**: Registered Service Worker (`sw.js`) and Web App Manifest for home screen installation
- **Deployment**: Automatic GitHub Actions deployment to [GitHub Pages](https://drewdroid86.github.io/Micro-Saler-/)

### 2. Android Native Application (`app/`)
- **Language**: Kotlin 2.x
- **UI Framework**: Jetpack Compose & Material 3
- **Database**: Room Database (SQLite)
- **Architecture**: MVVM with `PosViewModel` & `PosRepository`

---

## 📐 Business Logic & Data Specifications

| Domain | Unit | Rule / Specification |
| :--- | :--- | :--- |
| **Weight Units** | Milligrams (mg) | 1 Gram = 1,000 mg (e.g. 84.5g = 84,500 mg) |
| **Monetary Units** | Cents ($) | $1.00 = 100 Cents to avoid floating point errors |
| **Restocking (WAC)** | Formula | $\text{New WAC} = \frac{\text{Current Total Cost} + \text{Received Cost}}{\text{Current Stock mg} + \text{Received mg}}$ |
| **Pricing Modes** | Dual Rates | **RETAIL** vs. **WHOLESALE** per-gram prices + packaging fee |
| **Payment Types** | Flexible | `CASH`, `DIGITAL` (Square, Venmo, Zelle), `HOUSE_TAB` |
| **Split Payments** | Tolerance | Payment total must equal sale total within $\pm 1\text{\textcent}$ |
| **Returns** | Cumulative | Max returnable weight per item cannot exceed $\text{Sold Weight} - \text{Already Returned Weight}$ |

---

## 💾 Data & Backup

Micro Saler stores all data **locally on-device** — IndexedDB (`MicroSalerDB`, schema v4) for the web app or SQLite for Android. There is no server and no cloud sync. As of v1.1.0, you can back up and restore your ledger manually:

- **Export**: downloads a single timestamped JSON file (`micro-saler-backup-<date>.json`) containing every store — pigments, stock receipts, customers, sales, payments, sale items, returns, tab payments, shrinkage logs, and audit trail.
- **Import**: restores from a previously exported file. **This overwrites all current data** — you'll be asked to confirm before applying.
- **Recommendation**: export a backup at the end of each sales day/event and store it safely off-device (email to yourself, cloud drive, etc.).
- **Integrity check**: on startup, the app verifies every completed sale's line item total matches its recorded payments (within a 1¢ tolerance). Any mismatch is logged to the browser console — worth checking periodically if you suspect data corruption.

---

## ⚠️ Known Limitations

- Split payments are UI-stubbed only ("coming soon") — not yet functional.
- No multi-user or multi-device real-time sync.
- The `webapp/` directory (original vanilla JS version) is kept for reference only and no longer maintained — all active development is in `webapp-react/`.

---



## 🚀 Getting Started & Local Setup

### Running the React Web Application (`webapp-react/`)

#### Prerequisites
- Node.js (`v18+`)
- npm (`v9+`)

#### Instructions
```bash
# Navigate to webapp-react directory
cd webapp-react

# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Build for production
npm run build
```

The production bundle will be generated in `webapp-react/dist/`.

---

### Running the Android Application (`app/`)

#### Prerequisites
- Android Studio Ladybug or newer
- JDK 17+

#### Instructions
```bash
# Clean and build the Android project
./gradlew assembleDebug

# Run unit tests
./gradlew test
```

---

## 🏷️ Release History

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes and version history.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
