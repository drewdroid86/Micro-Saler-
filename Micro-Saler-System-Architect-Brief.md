# Micro Saler — System Architect Brief
**Prepared:** August 12, 2026
**Repo:** drewdroid86/Micro-Saler-
**Stack:** React + Vite + IndexedDB (fully offline, browser-native POS)
**Purpose:** Full technical handoff covering confirmed bugs, code quality
improvements, new feature proposals, and a mobile-first CSS redesign plan.

---

## Table of Contents
1. [System Architecture Overview](#1-system-architecture-overview)
2. [Confirmed Bugs](#2-confirmed-bugs)
2.5. [Root Cause Pattern](#25-root-cause-pattern)
3. [Code Quality & Logic Improvements](#3-code-quality--logic-improvements)
4. [New Feature Proposals](#4-new-feature-proposals)
5. [Mobile-First / Responsive CSS Redesign](#5-mobile-first--responsive-css-redesign)
6. [Priority Matrix](#6-priority-matrix)

---

## 1. System Architecture Overview

### Tech Stack
| Layer            | Technology                                         |
|------------------|----------------------------------------------------|
| UI Framework     | React 18 (Vite)                                    |
| Persistence      | IndexedDB via custom `PosDatabase` in `src/db.js`  |
| Business Logic   | `PosRepository` class in `src/repository.js`       |
| Styling          | Single flat CSS file `src/styles.css`              |
| State Management | React Context (`src/context/`)                     |

### Key Files
| File                               | Size    | Role                                              |
|------------------------------------|---------|---------------------------------------------------|
| `src/repository.js`                | ~128KB  | All business logic: pricing, sales, inventory, analytics |
| `src/components/ModalManager.jsx`  | ~144KB  | ALL modal UIs — monolithic, needs splitting       |
| `src/components/InsightsScreen.jsx`| ~52KB   | BI dashboard                                      |
| `src/db.js`                        | ~24KB   | IndexedDB wrapper + migrations (DB v10)           |
| `src/styles.css`                   | ~48KB   | Full design system                                |

### Database Schema (v10, 15 object stores)
```
pigments             — inventory with WAC cost tracking
pigment_price_tiers  — per-pigment/per-weight preset price overrides
stock_receipts       — restock events per pigment
suppliers            — vendor ledger
supplier_payments    — payments made to suppliers
customers            — profiles with signed balance field
customer_ledger      — double-entry ledger (positive=credit, negative=debt)
customer_prepayments — pre-paid delivery orders
sales                — completed sale records
sale_items           — line items (WAC COGS captured at sale time)
sale_payments        — CASH / DIGITAL / HOUSE_TAB / STORE_CREDIT / PREPAID_DELIVERY
tab_payments          — payments made against HOUSE_TAB debt
returns              — return/refund records
shrinkage_logs        — inventory loss events
audit_log            — immutable event log
```

### Core Transaction Flow (completeSale)
```
1. Credit limit check (pre-transaction, uses calculateCustomerBalance())
2. Open atomic multi-store IDB transaction
3. Pre-aggregate duplicate pigment lines → Map<pigmentId, totalWeightMg>
4. Read + validate stock inside lock (prevents double-spend)
5. Write sale record
6. Write sale_items with live WAC COGS: unitCogs = (total_cost_cents / stock_mg) × weightMg
7. Deduct stock from each pigment exactly once
8. Write payments; route HOUSE_TAB + STORE_CREDIT through _applyLedgerEntryInTx
9. Write audit_log entry
```

### Balance System (v1.4.0+)
- Canonical field: `customer.balance` — positive = store credit, negative = debt
- Legacy field: `customer.current_balance_cents` kept in sync as `-balance`
- Single write path (in theory): all mutations should go through `_applyLedgerEntryInTx()`
  — **in practice this is not enforced; see [Root Cause Pattern](#25-root-cause-pattern) below.**
- `customer_ledger` is a full double-entry audit trail
- **Structural note:** customer credit/debt is currently tracked by two systems that
  don't cross-reference each other — the `customer.balance` / `customer_ledger`
  tab-debt system, and the separate `customer_prepayments` backorder system. See
  BUG-09.

---

## 2. Confirmed Bugs

> None of the 62 existing repository tests caught BUG-01, BUG-05, BUG-06, or BUG-09
> below — all four involve balance/ledger paths that are exercised by the tests but
> not asserted against post-transaction. Each fix in this section should ship with
> a regression test that asserts on `customer.balance` / `customer_ledger` state
> after the operation, not just that the operation resolves without throwing.

### BUG-01 — processReturn() Missing Ledger Entry for Store Credit Refunds
**Severity:** 🔴 High
**File:** `src/repository.js` → `processReturn()`
When a customer paid via STORE_CREDIT and returns an item, the refund path
restocks inventory and writes the returns record but NEVER calls
`_applyLedgerEntryInTx` to restore the balance. The customer permanently
loses the store credit. *(Verified: the return transaction only opens
`['sale_items', 'returns', 'pigments']` — it doesn't even touch
`customers`/`customer_ledger`, so no balance restoration is possible as
written.)*
**Fix:** After writing the returns record, if any payment in the original
sale has `payment_type === 'STORE_CREDIT'`, write a positive ledger entry
for the refunded amount via `_applyLedgerEntryInTx`.

---

### BUG-02 — voidSale() Prepayment Restore Checks Wrong Field
**Severity:** 🟠 Medium
**File:** `src/repository.js` → `voidSale()`
Void logic checks `sale.prepayment_id` to restore a FULFILLED prepayment,
but `completeSale()` never sets `prepayment_id` on the sale record. Sales
voided after a manual PREPAID_DELIVERY payment will silently skip
prepayment restoration.
**Fix:** In `completeSale()`, when a PREPAID_DELIVERY payment is processed,
write the matched `prepayment_id` onto the sale record before commit.

---

### BUG-03 — getCustomerLedger() Legacy Fallback Double-Counts Prepayments
**Severity:** 🟠 Medium
**File:** `src/repository.js` → `getCustomerLedger()`
The fallback path includes prepayment records in the event list and adds
their `amount_cents` to the running balance. Prepayments are liability
placeholders, not balance credits — this inflates displayed balance
before migration.
**Fix:** Exclude prepayment events from the running balance calculation
in the fallback path, or flag them as non-balance entries in the UI.

---

### BUG-04 — scanAndReconcileIntegrity() N+1 DB Reads in Customer Loop
**Severity:** 🟠 Medium (performance)
**File:** `src/repository.js` → `scanAndReconcileIntegrity()`
Loads all customers, then calls `verifyCustomerBalance()` per customer —
each issuing 2 sequential DB reads. With a large customer list this is
O(N×2) sequential reads that blocks the UI thread.
**Fix:** Batch-load all `customer_ledger` entries once with `getAll()`,
group by `customer_id` in a Map, run all verifications in memory.

---

### BUG-05 — updateCustomer() Balance Delta Written Twice
**Severity:** 🔴 High
**File:** `src/repository.js` → `updateCustomer()`
When `data.balance` is set and `is_opening_balance` is false, a ledger
entry is written for the delta AND `customer.balance` is directly set via
object spread — bypassing `_applyLedgerEntryInTx`. This can cause
ledger/balance divergence. *(Verified: `targetBal` is written straight
into `updated.balance` / `updated.current_balance_cents` via `custStore.put()`
in the same transaction as the manual `ledgerStore.add()` — two independent
writers of the same value.)*
**Fix:** Remove the direct balance assignment from the spread. Let
`_applyLedgerEntryInTx` be the sole writer of `customer.balance`.

---

### BUG-06 — createPigment() Ignores Supplier Debt for New Suppliers
**Severity:** 🟠 Medium
**File:** `src/repository.js` → `createPigment()`
`restockPigment()` auto-creates a supplier and updates their
`current_balance_cents` for unpaid tabs. `createPigment()` only looks up
an existing supplier and silently skips unpaid tab updates if no supplier
is found.
**Fix:** Extract shared private helper `_resolveOrCreateSupplierInTx()`
and call it from both methods.

---

### BUG-07 — calculateBusinessInsights() AR Summary Uses Wrong Balance Field
**Severity:** 🟠 Medium
**File:** `src/repository.js` → `calculateBusinessInsights()`
AR summary filters by `current_balance_cents > 0` (legacy: positive=debt).
On the new ledger system `current_balance_cents` may drift to 0 while
`balance` correctly shows negative (debt). Valid debts are silently
excluded from AR reporting.
**Fix:** Change filter to `customer.balance < 0`.

---

### BUG-08 — DB_VERSION Header Comment Is Stale
**Severity:** 🟡 Low
**File:** `src/db.js` header comment (line 4)
Comment reads `"Database version: 7, 14 object stores"`. Actual values are
`DB_VERSION = 10` and **15** object stores (`tab_payments` is the store
most recently added and missing from the comment).
**Fix:** Update comment to `"Database version: 10, 15 object stores"`.

---

### BUG-09 — Dual Credit Systems Don't Cross-Reference for Credit Exposure
**Severity:** 🔴 High
**Files:** `src/repository.js` — credit limit check in `completeSale()`,
`createCustomerPrepayment()`
Customer credit/debt is tracked by two parallel systems that never talk
to each other:
1. **Tab-debt / store-credit** — `customer.balance` + `customer_ledger`
   (HOUSE_TAB sales, STORE_CREDIT payments)
2. **Prepayments / backorders** — `customer_prepayments`
   (money owed *to* the customer for undelivered goods)
The pre-transaction credit limit check in `completeSale()` only reads
`customer.balance`. A customer's true exposure — what the business
actually owes them, or what they actually owe the business once pending
prepayments are accounted for — is never computed as a single number.
A customer could be flagged over their credit limit on tab debt while
the business is separately sitting on their prepayment money, or vice
versa, and neither system would know about the other.
**Fix:** Introduce a single `getCustomerTotalExposure(customerId)` that
nets `customer.balance` against open `customer_prepayments` liabilities,
and route the credit-limit check in `completeSale()` through it instead
of reading `customer.balance` directly.

---

## 2.5 Root Cause Pattern

BUG-01, BUG-05, and BUG-06 are not three unrelated bugs — they're the same
mistake in three places: **something writes `customer.balance` /
`current_balance_cents` or a supplier's balance field directly, instead of
going through the single ledger-write helper.** BUG-09 is the same class
of problem one level up — two systems maintaining overlapping balance
state with no shared source of truth.

Patching each call site individually (as the four fixes above do) closes
today's known gaps but doesn't stop the next one from being introduced the
same way. The durable fix is architectural:

- **IMP-08** (new, see below) — audit every direct write to
  `customer.balance`, `current_balance_cents`, and supplier balance
  fields across `repository.js`; make `_applyLedgerEntryInTx` (and an
  equivalent for suppliers) the *only* writer, enforced by construction
  rather than convention.

Recommend doing IMP-08 as a single pass covering BUG-01, BUG-05, BUG-06,
and BUG-09 together, rather than four separate patches — the fix is the
same shape each time and a shared helper closes all four at once.

---

## 3. Code Quality & Logic Improvements

### IMP-01 — Extract WAC COGS Into a Shared Helper
**Priority:** High
The formula `(total_cost_cents / stock_mg) × weightMg` is copy-pasted
across multiple methods. A bug in one copy doesn't propagate to others.
**Action:** Create `calcWacCogs(pigment, weightMg)` pure function,
replace all call sites.

---

### IMP-02 — Payment Tolerance Mismatch Between Validator and Sale Path
**Priority:** High
`validateCompletedSale()` allows a 1-cent gap. This means a 1-cent
discrepancy passes validation, completes the sale, and gets auto-repaired
later — creating silent rounding drift in live data.
**Action:** Reduce tolerance to `> 0` (strict), or handle the 1-cent
correction inline in `completeSale()` before commit.

---

### IMP-03 — DB Migration Cursors May Not Complete Before Transaction Commits
**Priority:** High
v9 and v10 migrations use `openCursor().onsuccess + cursor.continue()`.
The upgrade transaction can commit before all iterations finish.
**Action:** Replace with `store.getAll()` → bulk `put()` pattern wrapped
in a Promise to guarantee atomic completion.

---

### IMP-04 — wipeAllData() Destroys Audit History
**Priority:** Medium
`wipeAllData()` clears `audit_log`. After a wipe, zero evidence remains.
**Action:** Write a final `{ event: 'DATA_WIPE', timestamp }` entry before
clearing, and/or keep `audit_log` excluded from the wipe operation.

---

### IMP-05 — Customer Search Uses startsWith Only
**Priority:** Medium
Typing "smith" for "John Smith" returns nothing.
**Action:** Change to `name.toLowerCase().includes(query)`.
Consider a simple bigram scorer for ranked results.

---

### IMP-06 — ModalManager.jsx Must Be Split
**Priority:** Medium
At ~144KB it is the largest file, parsed on every load, cannot be
tree-shaken, and is untestable in isolation.
**Action:** Split into 4 domain files with React.lazy() + Suspense:
- `InventoryModals.jsx` — restock, edit pigment, shrinkage
- `CustomerModals.jsx` — add/edit customer, ledger, prepayments
- `SaleModals.jsx` — void, return, receipt
- `SupplierModals.jsx` — supplier management, payments

---

### IMP-07 — Run Ledger Integrity Check Passively on Boot
**Priority:** Medium
`scanAndReconcileIntegrity()` requires manual trigger. Drift accumulates
silently between runs.
**Action:** On mount, run lightweight `verifyCustomerBalance()` in a
`setTimeout(2000)` after initial render. Show a non-blocking toast badge
if any drift is detected.

---

### IMP-08 — Enforce Single-Writer Discipline for Balance Fields
**Priority:** High
**New — see [Root Cause Pattern](#25-root-cause-pattern).**
`customer.balance`, `current_balance_cents`, and supplier balance
equivalents are currently writable from multiple call sites via plain
object spread, which is how BUG-01, BUG-05, BUG-06, and BUG-09 all
happened independently.
**Action:** Audit every `custStore.put()` / `suppliersStore.put()` call
in `repository.js` for direct balance field writes. Route all of them
through `_applyLedgerEntryInTx` (add a supplier-side equivalent if one
doesn't exist). Where practical, consider deriving `balance` as a
computed value from `customer_ledger` at read time instead of storing it
redundantly, to remove the possibility of divergence entirely.

---

### IMP-09 — Regression Tests for Balance-Path Bug Fixes
**Priority:** High
**New.** The existing 62 tests exercise these code paths but don't assert
on post-transaction ledger/balance state, which is how BUG-01, BUG-05,
BUG-06, and BUG-09 shipped undetected.
**Action:** For each of BUG-01, BUG-05, BUG-06, BUG-09, and IMP-08, add a
test that asserts `customer.balance` (and `customer_ledger` entry count/
sum) is correct after the operation — not just that the operation
resolves without throwing.

---

## 4. New Feature Proposals

### Recommended Next
These are cheap relative to their payoff for a single-device, cash-heavy
street-stall business, and don't depend on anything else in this doc.

#### FEAT-01 — Automated 30-Minute JSON Backup
`exportData()` already serializes the full DB. Wire to `setInterval` +
`localStorage` "last backed up" timestamp. Auto-download a timestamped
`.json` file every 30 minutes. Show header badge if > 24 hours elapsed.
**Note: IndexedDB is local-only. One corrupted browser profile = total loss.**
This is the single highest-leverage item in this whole document for that
reason — recommend doing it before any of the bug fixes above, since a
lost DB is unrecoverable and everything else here assumes the data
still exists.

#### FEAT-03 — Receipt / Invoice Generator
Add `generateReceiptHTML(saleId)` utility. Output: customer name, line
items, weights, prices, payment type, sale timestamp, QR code (via
`qrcode` npm). Expose via Web Share API on mobile, `window.print()` on
desktop. Zero external service dependencies.

#### FEAT-06 — Pigment Bundle / Recipe SKUs
Allow a "bundle" pigment that maps to a fixed-ratio recipe of base
pigments. `completeSale()` resolves bundles into component deductions
before stock write. Enables pre-mixed batches as first-class SKUs. Unlike
most items in this section, this maps to an actual product Twisted
Alchemy sells (pre-mixed colors), not a generic POS feature — worth
prioritizing over the generic ones below for that reason.

---

### Worth Building, Lower Priority

#### FEAT-02 — Discount & Coupon Engine
Add `discounts` store with rule types: FLAT_CENTS, PERCENT, PER_PIGMENT,
PER_CUSTOMER_TYPE. Integrate as a new priority step in
`calculatePricingBreakdown()` above the base rate. Track usage counts
per rule in `audit_log`.

#### FEAT-04 — Reorder Push Notifications
`velocityStatus === 'Reorder Soon'` is already computed. On app open,
check if any pigment has < 7 days remaining and fire a browser
Notifications API alert, visible before the user navigates to Insights.

---

## 5. Mobile-First / Responsive CSS Redesign

### Current Strengths (Keep)
- `100dvh` layout, `env(safe-area-inset-bottom)` on checkout bar ✅
- `scrollbar-width: none` on nav/weight presets ✅
- `backdrop-filter` on modals ✅
- Sticky header + scrollable content + sticky bottom-bar shell ✅

---

### Critical Fixes (Apply Immediately)

#### Fix 1 — iOS Auto-Zoom Bug
iOS Safari zooms viewport when focused input has font-size < 16px.
```css
.form-input, .form-select {
  font-size: 16px; /* was 15px */
}
```

#### Fix 2 — Hover States Stick on Touch
Wrap ALL transform hover effects:
```css
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .btn:hover { transform: scale(1.02); }
  .pigment-grid-card:hover { transform: translateY(-2px); }
  .header-btn:hover { transform: translateY(-1px); }
  .weight-preset-btn:hover { transform: scale(1.05); }
}
```

#### Fix 3 — Touch Target Minimums (44px)
```css
.btn-xs { min-height: 36px; padding: 6px 10px; }
.modal-close { min-width: 44px; min-height: 44px; }
.cart-item-remove { min-width: 44px; min-height: 44px; }
.customer-pill-action-btn { min-width: 36px; min-height: 36px; }
.nav-tab { min-height: 48px; }
```

#### Fix 4 — Payment Drawer Keyboard Safety
```css
.payment-drawer {
  max-height: 85dvh;
  padding-bottom: calc(var(--spacing-lg) + env(safe-area-inset-bottom, 0px));
}
```

#### Fix 5 — Missing Mobile UX Properties
```css
button, [role="button"], .nav-tab, .pigment-grid-card,
.weight-preset-btn, .chip {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.modal-body, .payment-drawer, .customer-autocomplete-dropdown {
  overscroll-behavior: contain;
}
```

#### Fix 6 — Missing Flex Utility Classes (.flex-wrap, .align-center)
JSX components used `.flex-wrap` and `.align-center` as bare utility classes, but they were never defined in `styles.css`. Without `.flex-wrap`, multi-button pill rows (such as margin/markup preset pills on `PricingCalculatorScreen`) stay on a single nowrap row and overflow horizontally off-screen, clipped by `body { overflow-x: hidden }` and rendering them untappable on mobile viewports.
```css
.flex-wrap { flex-wrap: wrap; }
.align-center { align-items: center; }
```

---

### Desktop Split-Pane Layout (New — ≥1024px)

```css
@media (min-width: 1024px) {

  /* App shell becomes sidebar + content */
  .app-container { flex-direction: row; }

  /* Vertical sidebar nav */
  .nav-tabs {
    flex-direction: column;
    width: 200px;
    min-width: 200px;
    border-bottom: none;
    border-right: 1px solid var(--market-border-light);
    padding: var(--spacing-md) var(--spacing-sm);
    overflow-x: visible;
    overflow-y: auto;
    height: 100%;
    gap: 2px;
  }
  .nav-tab {
    text-align: left;
    padding: 10px var(--spacing-md);
    border-radius: var(--radius-md);
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .nav-tab::after { display: none; }
  .nav-tab.active {
    background: var(--market-green-light);
    color: var(--market-green-primary);
  }

  /* Main content */
  .main-content { flex: 1; max-width: none; padding: var(--spacing-lg); }

  /* Checkout: two-column POS layout */
  .checkout-layout {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--spacing-lg);
    align-items: start;
    height: 100%;
  }
  .checkout-right-panel {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    max-height: calc(100dvh - 70px);
    overflow-y: auto;
  }

  /* Payment drawer becomes inline panel */
  .payment-drawer {
    position: static !important;
    transform: none !important;
    box-shadow: none;
    border: 1px solid var(--market-border-light);
    border-radius: var(--radius-lg);
    max-height: none;
    padding: var(--spacing-md);
    width: 100%;
  }

  /* Checkout bottom bar becomes inline */
  .checkout-bottom-bar {
    position: static;
    margin: 0;
    border-radius: var(--radius-lg);
    border: 1px solid var(--market-border-light);
  }

  .modal { max-width: 680px; }
}
```

#### PWA Standalone Mode
```css
@media (display-mode: standalone) {
  .top-header {
    padding-top: calc(var(--spacing-sm) + env(safe-area-inset-top, 0px));
  }
}
```

---

## 6. Priority Matrix

| ID            | Item                                    | Type        | Severity    | Effort   |
|---------------|-----------------------------------------|-------------|-------------|----------|
| FEAT-01       | Auto backup to JSON                     | Feature     | 🔴 High     | Small    |
| BUG-01        | Store credit refund missing ledger      | Bug         | 🔴 High     | Small    |
| BUG-05        | updateCustomer balance written twice    | Bug         | 🔴 High     | Small    |
| BUG-09        | Dual credit systems don't cross-reference| Bug        | 🔴 High     | Medium   |
| IMP-08        | Single-writer discipline for balances   | Improvement | 🔴 High     | Medium   |
| IMP-09        | Regression tests for balance bugs       | Improvement | 🔴 High     | Small    |
| IMP-03        | DB migration cursor race                | Improvement | 🔴 High     | Medium   |
| CSS Fix 1     | iOS auto-zoom (font-size 16px)          | CSS         | 🔴 High     | Trivial  |
| IMP-01        | Extract WAC COGS helper                 | Improvement | 🟠 Medium   | Small    |
| IMP-02        | Payment tolerance mismatch              | Improvement | 🟠 Medium   | Small    |
| BUG-02        | Void sale prepayment restore field      | Bug         | 🟠 Medium   | Small    |
| BUG-03        | Ledger fallback double-counts           | Bug         | 🟠 Medium   | Small    |
| BUG-06        | New-supplier debt path skips update     | Bug         | 🟠 Medium   | Small    |
| BUG-07        | AR summary uses wrong balance field     | Bug         | 🟠 Medium   | Small    |
| CSS Fix 2     | Hover states on touch devices           | CSS         | 🟠 Medium   | Small    |
| CSS Fix 3     | Touch target sizes (44px min)           | CSS         | 🟠 Medium   | Small    |
| CSS Fix 4-5   | Drawer safety + touch properties        | CSS         | 🟠 Medium   | Small    |
| CSS Fix 6     | Missing flex utility classes            | CSS         | 🟠 Medium   | Trivial  |
| IMP-04        | Preserve audit log on wipe              | Safety      | 🟠 Medium   | Trivial  |
| FEAT-03       | Receipt generator                       | Feature     | 🟠 Medium   | Medium   |
| FEAT-06       | Pigment bundle / recipe SKUs            | Feature     | 🟠 Medium   | Large    |
| IMP-05        | Substring customer search               | UX          | 🟡 Low      | Trivial  |
| BUG-04        | N+1 reads in integrity scan             | Performance | 🟡 Low      | Medium   |
| BUG-08        | Stale DB_VERSION comment                | Bug         | 🟡 Low      | Trivial  |
| IMP-06        | Split ModalManager.jsx                  | Improvement | 🟡 Low      | Large    |
| IMP-07        | Passive ledger integrity check on boot  | Improvement | 🟡 Low      | Small    |
| Desktop Layout| Split-pane POS layout ≥1024px           | Feature     | 🟡 Low      | Medium   |
| FEAT-04       | Reorder push notifications              | Feature     | 🟡 Low      | Small    |
| FEAT-02       | Discount engine                         | Feature     | 🟡 Low      | Large    |

---

*Generated from a direct review of src/repository.js, src/db.js,
src/styles.css, and src/components/ against the live repo
(drewdroid86/Micro-Saler-) — August 12, 2026. BUG-01, BUG-05, BUG-08,
and the object store count were independently verified against current
source. Section 2.5 and the feature-section priority calls (FEAT-01/03/06
elevated) reflect a second review pass against the app's local-first,
single-device design intent.*
