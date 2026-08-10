# Micro Saler — Logic Review

Went through `db.js`, `repository.js` in full, and how `ModalManager.jsx` / `PosContext.jsx` wire into it, cross-checked against `repository.test.js`. v1.4.0, DB_VERSION 10. Four real issues, ordered by how much money/data they touch, then the pattern tying them together.

---

## 1. Merchant fees are captured but never subtracted from profit

Every digital sale stores a real `merchant_fee_cents` (2.9% + 30¢) on its `sale_payments` record — `repository.js:858`. But grep the whole repo: **nothing ever reads `merchant_fee_cents` back out.** `calculateBusinessInsights` computes:

```js
grossRevenueCents = sum(sale.total_amount_cents)
grossProfitCents  = grossRevenueCents - totalCogsCents
```

No fee term anywhere. Same in `ReportsScreen.jsx`'s Net Operating Profit / P&L. So every KPI, every margin %, every "what I actually made" number is overstated by the processing fee on every Square/Venmo/Zelle sale you've ever rung up. This is the one I'd fix first — it's silently wrong money, not an edge case.

Fix direction: subtract `sum(payments.merchant_fee_cents)` somewhere in the profit chain in `calculateBusinessInsights` (and expose it as its own line item — "Processing Fees" — rather than burying it).

Related: the fee itself is hardcoded `(amount * 0.029) + 30` in **four places** (`ModalManager.jsx:819, 865, 940, 967`), applied identically regardless of `digital_provider`. Square/Venmo/Zelle don't actually cost the same — worth pulling into one helper and making it provider-aware while you're in there.

---

## 2. Customer balance has two fields that can silently drift

v1.4.0 introduced `customer.balance` (signed: +credit / -debt) with a `customer_ledger` audit trail, kept in sync with the legacy `customer.current_balance_cents` (positive = debt) through one helper, `_applyLedgerEntryInTx` (`repository.js:1073`). Every real balance mutation goes through it — `completeSale`, `voidSale`, `recordCustomerPayment`, `adjustCustomerBalance`, `createCustomer`, `updateCustomer` — all correctly keep both fields locked together. Good discipline.

One path doesn't: `reconcileSaleRecord`'s `CORRECT_PAYMENT` branch (`repository.js:2263-2269`), used by the Integrity Repair modal to fix a sale whose recorded payments don't match its total:

```js
customer.current_balance_cents = Math.max(0, (customer.current_balance_cents || 0) + tabDeltaCents);
await this.db.put('customers', customer);
```

This mutates `current_balance_cents` directly — doesn't touch `customer.balance`, doesn't write a `customer_ledger` entry, and the `Math.max(0, ...)` clamp can silently eat a legitimate downward correction instead of turning it into store credit.

Concretely: **`CustomerScreen` reads `.balance`** (via `calculateCustomerBalance`), while **`ReportsScreen`'s AR total, `InsightsScreen`'s receivables aging, and the tab badges in `CustomerAutocomplete`/`CustomerNameInput`/checkout modals all read `current_balance_cents` directly.** The first time you correct a HOUSE_TAB amount through Integrity Repair, that customer will show a different balance on the Customers tab than on Reports. No test in `repository.test.js` exercises this path (search `CORRECT_PAYMENT` — nothing), unlike every other balance mutation, which is well covered.

Fix direction: route the tab rebalance through `_applyLedgerEntryInTx` like everywhere else, so it writes a ledger entry and updates both fields atomically.

---

## 3. Store credit can be earned but never spent

`completeSale` has a ready-made branch for it (`repository.js:870`):

```js
} else if ((payment.payment_type === 'STORE_CREDIT' || payment.payment_type === 'PREPAID_DELIVERY') && customerObj) {
```

But nothing ever constructs a payment with `payment_type: 'STORE_CREDIT'`. Checked all three checkout paths in `ModalManager.jsx` (`handleDigitalPayment`, `handleTabPayment`, `handleSplitPayment`) and the quick-cash path in `PosContext.jsx:408` — they only ever emit `CASH`, `DIGITAL`, or `HOUSE_TAB`. A customer can accumulate store credit (manual credit adjustment, or overpaying a tab settlement per the 1.4.0 changelog), but there's no tender option at checkout to actually apply it toward a new sale. The backend half of this feature already exists and is just waiting for a UI hook — probably the highest-value small feature to build next.

---

## 4. Voiding a fulfilled prepayment doesn't restore it

`fulfillCustomerPrepayment` turns a `customer_prepayments` record into a real sale and marks it `FULFILLED`. If you later void that sale (wrong item, customer dispute, whatever), `voidSale`'s transaction (`repository.js:966`) opens `['sales', 'sale_items', 'sale_payments', 'pigments', 'customers', 'customer_ledger', 'returns', 'audit_log']` — **no `customer_prepayments`.** Inventory gets restocked correctly, but the prepayment stays permanently `FULFILLED` with no way to un-fulfill it. The customer's deposit effectively vanishes unless you manually patch it with a balance adjustment.

Also worth knowing, same subsystem: when a prepayment deposit is *taken* (`ModalManager.jsx:764`, `handleCreateCustomerPrepayment`), there's no field for how the customer paid — cash/digital isn't captured at all until fulfillment, when it finally shows up as a `PREPAID_DELIVERY` sale payment. So real cash taken today for a backorder is invisible to Reports/Insights until whenever it's fulfilled, which could be weeks later or a different reporting period.

---

## The pattern underneath 2–4

You've effectively got **two parallel "who owes who" systems** that don't know about each other:

- **Tab debt / store credit** — `customer.balance` + `customer_ledger`, the mature, well-tested v1.4.0 system.
- **Prepayments / backorders** — `customer_prepayments`, older, and never retrofitted onto the ledger.

They don't cross-reference for credit exposure: `completeSale`'s HOUSE_TAB credit-limit check (`repository.js:731`) only weighs `current_balance_cents` against `credit_limit_cents` — it has no idea a customer might already be carrying $200 in pending prepayment obligations. A customer can max out their tab limit *and* be sitting on unfulfilled backorders at the same time, and the app won't blink.

You already have the right tool to close this gap: `verifyCustomerBalance` (`repository.js:1421`) plus the Integrity Repair UI is exactly the "detect drift, offer a fix" pattern. Two extensions using that same machinery:
- Add a check for `.balance` vs `-current_balance_cents` drift directly (would have caught bug #2).
- Fold `prepaidCreditCents` into the `availableCreditCents` calc so pending backorders actually count against credit exposure.

---

## Smaller things

- `completeSale`'s credit-limit check (`repository.js:731`) reads `customer.current_balance_cents` *before* the atomic transaction opens, and off the legacy field specifically — harmless while #2 stays fixed, silently wrong for any customer it's ever drifted on.
- `unit_cogs_cents` for cart lines is computed client-side at add-to-cart time and trusted as-is inside `completeSale`. Stock quantity is re-validated live inside the transaction; cost basis isn't recomputed against the pigment's current WAC at commit time. Low risk single-device, but margin figures could drift a little if a restock lands mid-cart.
- `restockPigment` doesn't guard against a zero/negative `receivedMg` or `totalCostCents` at the repository layer — presumably caught in the form, but nothing stops a bad call from corrupting WAC if it's ever invoked another way.
