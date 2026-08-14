# Agy Handoff — Micro Saler — 2026-08-13

Three code fixes + one manual data correction, in order. Full review context: `Micro-Saler-Review-2026-08-13.md` (not required reading — this doc is self-contained).

---

## 0. Manual data fix first (do this before touching code)

Customer **Dory (customer_id: 6)** has a $10 gap between her real balance and her ledger history — a $10 house-tab charge from an old sale never got logged. Add this directly as a `customer_ledger` record (matching the shape of her existing entries) before anything else runs:

```json
{
  "customer_id": 6,
  "amount_cents": -1000,
  "type": "SALE_DEBT",
  "description": "Backfill: house tab charge for Sale #15 (missing from original split payment)",
  "sale_id": 15,
  "tab_payment_id": null,
  "prepayment_id": null,
  "created_at": <now>,
  "timestamp": <now>
}
```

This makes her ledger sum to -$55.00, matching her actual `balance`/`current_balance_cents`. Doing this first means BUG-10 below can't accidentally erase the $10 while you're fixing the underlying logic.

---

## 1. BUG-10 — Integrity repair can silently forgive real debt

**File:** `src/repository.js`, function `repairCustomerBalance` (~line 1733)

When a customer has existing ledger entries that don't sum to `customer.balance`, the repair currently does:
```js
targetBalance = entries.reduce((sum, e) => sum + (Number(e.amount_cents) || 0), 0);
```
and overwrites `customer.balance` to match — always trusting the ledger, even when the ledger is what's incomplete. Fix:
- Don't silently auto-apply when `entries.length > 0` and the drift is more than a trivial rounding amount (e.g. > few cents). Instead return the mismatch as a **flagged** item for manual review (same pattern as `flaggedCount` in the sale-side scan), rather than folding it into `customerRepairedCount` automatically.
- In the `CUSTOMER_BALANCE_INTEGRITY_REPAIR` audit entry, add `previous_balance_cents` (every other balance-changing action in this codebase already logs this — this one doesn't).

## 2. IMP-10 — Customer-side repairs are invisible in the UI

**File:** `src/components/IntegrityRepairModal.jsx`, `handleAutoRepair` (~line 20-33)

`repairDataIntegrity()` returns `{ repairedCount, flaggedCount, customerRepairedCount }` but the toast only shows the first two:
```js
showToast(`Auto-repair complete: ${result.repairedCount || 0} record(s) repaired, ${result.flaggedCount || 0} need manual review.`, 'success');
```
Add `customerRepairedCount` (and once BUG-10 lands, whatever the new "flagged for manual review" count is called) to that same message.

## 3. IMP-11 — Checkout's customer field can't substring-search

**File:** `src/components/CustomerNameInput.jsx`

It currently imports and calls `filterCustomerSuggestions` (prefix-only match). Switch it to `filterCustomers` (the ranked exact/prefix/substring matcher already used by `CustomerScreen.jsx` and the modal customer-picker) so typing "smith" finds "John Smith" here too, consistent with the rest of the app.

Once this is done, check whether `src/components/CustomerAutocomplete.jsx` is still unused anywhere (it wasn't as of this review) — if so, delete it, and delete `filterCustomerSuggestions` from `src/repository.js` if nothing else calls it.

---

Run the existing test suite (`npm test`) and `npm run build` after each of the three code fixes before moving to the next.
