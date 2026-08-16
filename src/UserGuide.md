# Micro Saler — How to Use It
*A guide for anyone running the register: quick reference if you already
know it, full walkthrough if you don't.*

---

## Quick Start (the 90% case)

1. **Checkout tab** (🛒) — tap the pigment you're selling.
2. Pick a weight preset (¼g, ½g, ¾g, 1g, 1.5g, 1.75g, 3.5g, 5g...) or enter a
   custom weight.
3. Repeat for more items — they stack in the cart.
4. Tap **Checkout**, choose how they're paying (Cash / Digital / Tab /
   Store Credit / Prepaid — or split across more than one), confirm.
5. Done. Stock, sale record, and (if it's a customer with an account)
   their balance all update automatically.

If that's all you need today, you're set. Everything below is for the
less-common stuff.

---

## The 9 Tabs, What Each One Is For

| Tab | Icon | What you use it for |
|---|---|---|
| **Checkout** | 🛒 | Ring up a sale |
| **Inventory** | 📦 | See stock levels, restock a pigment, log shrinkage/loss |
| **Pricing Calculator** | 🧮 | Work out a price by margin % or markup %, weight-tier pricing |
| **Customers** | 👥 | Add/edit customers, see who owes what, prepayments |
| **Suppliers** | 🏭 | Track who you owe for restocks, pay them down |
| **Reports & P&L** | 📊 | Profit & loss over a period |
| **Business Insights** | 📈 | KPIs, what's selling, what's owed to/by you, shrinkage |
| **History** | 📋 | Past sales — look one up, void or return |
| **Audit** | 🔒 | Immutable log of everything that's happened — for when you need to know exactly what occurred |

---

## Checkout — Payment Types Explained

When you tap Checkout, you'll choose one (or a mix) of these:

- **Cash** — self-explanatory.
- **Digital** — card/app payment. A processing fee gets tracked
  automatically against the sale.
- **Tab (House Tab)** — customer pays later. Increases what they owe you.
  Only available if you've picked a customer for the sale (can't put an
  anonymous sale "on tab").
- **Store Credit** — customer pays using credit they already have on
  their account (from an overpayment, a return, etc.).
- **Prepaid Delivery** — for a customer who already paid you in advance
  for goods you're delivering now.
- **Split** — combine two or more of the above on one sale (e.g. half
  cash, half tab).

**Credit limit:** every customer has a credit limit (defaults to $25 if
you don't set one). If a Tab sale would put them over it, checkout will
flag it before you complete the sale.

---

## Customers & Credit — How Balances Work

Every customer has a **balance**:
- **Positive balance = they have store credit** (you owe them, in a
  sense — they can spend it on future purchases).
- **Negative balance = they're in debt to you** (unpaid tab).

Every change to a balance — a tab sale, a payment against a tab, store
credit being spent or earned — gets written to that customer's **ledger**,
which is a permanent line-by-line history. If a balance ever looks wrong,
the ledger is the source of truth to check against.

**Prepayments** are a separate thing from balance/credit — that's money a
customer gave you *in advance* for goods you haven't handed over yet
(useful for the mica orders that get delivered later rather than sold on
the spot). You'll see these tracked separately from tab debt/store
credit in the Customers tab.

---

## Pricing Calculator — Two Modes

Toggle between:
- **Margin mode** — "I want to make X% gross margin on this sale."
  Presets: 20 / 30 / 40 / 50 / 60 / 70 / 75 / 80 / 90%.
- **Markup mode** — "I want to charge X% more than what this cost me."
  Presets: 25 / 50 / 75 / 100 / 150 / 200 / 300 / 400%.

Tap a preset pill to snap to that percentage, or type in a custom one.
The calculator shows you what to charge per weight tier based on your
current cost for that pigment.

*(Margin and markup answer different questions — margin is "% of the
sale price that's profit," markup is "% above cost you're charging."
50% margin and 50% markup are not the same price. If a number ever looks
off, check which mode you're in.)*

---

## Inventory — Restocking & Shrinkage

- **Restock** a pigment when new stock comes in — this also tracks who
  you bought it from and whether you paid them or it's going on their
  tab (see Suppliers below). Your cost basis (WAC — weighted average
  cost) updates automatically so profit numbers stay accurate.
- **Shrinkage** — log any loss that isn't a sale: spillage, breakage,
  giveaways, inventory count corrections. This keeps your "what should
  be in stock" number honest and shows up in Business Insights so
  losses don't just silently eat into your margins unnoticed.

---

## Suppliers

Tracks who you buy pigment from and what you owe them — same idea as
customer tabs, but in the other direction. Restocking on credit adds to
what you owe a supplier; paying them down reduces it.

---

## Business Insights — What's In There

- **KPIs** — top-line numbers for how the business is doing.
- **Inventory velocity** — which pigments are moving fast vs. sitting,
  and a "reorder soon" flag when something's running low relative to how
  fast it sells.
- **Receivables / Payables** — who owes you (tab debt) and who you owe
  (suppliers), at a glance.
- **Shrinkage tracking** — losses logged from Inventory, totaled up.
- **Profitability** — sales sorted by profit, margin %, revenue, or
  weight sold, so you can see what's actually making money vs. just
  moving volume.

---

## Reports & P&L / History / Audit

- **Reports & P&L** — profit and loss for a date range.
- **History** — look up a past sale. This is also where you'd **void** a
  sale (mistake, wrong item) or **process a return** (customer brings
  something back).
- **Audit** — a locked, unchangeable record of every event in the system.
  You won't need this day-to-day, but if a balance or a stock count ever
  looks wrong, this is where to trace exactly what happened and when.

---

## Backups — Don't Skip This

Tap **💾 Backup / Restore** in the header. This exports everything
(sales, customers, inventory, the works) as a JSON file you can save
somewhere safe, and can restore from if needed.

**Important:** everything lives only on this one device/browser. There's
no cloud copy. If the browser data gets cleared or the device is lost,
anything since your last backup is gone. **Get in the habit of backing
up regularly** — right now this is a manual step, not automatic, so it's
on you (or whoever's running the register) to actually do it.

---

## FAQ / Common Situations

**A customer wants to pay later.**
Pick them as the customer for the sale, choose **Tab** as the payment
type. Make sure they're under their credit limit — the app will warn you
if not.

**A customer wants to pay down what they owe.**
Go to Customers, find them, there's a way to log a payment against their
tab — this reduces their negative balance.

**A customer overpaid or you're giving them credit for something.**
That raises their balance (store credit) — they can spend it on a future
sale by choosing Store Credit at checkout.

**Someone wants to return an item.**
Find the sale in History and process a return there. If they originally
paid with store credit, the refund path is a known rough edge right now
— double check their balance actually updated after (see Root Cause note
in the architect brief if this comes up).

**I rang something up wrong.**
Void the sale in History rather than trying to manually fix inventory —
voiding is what correctly restores stock and reverses any payment
effects.

**A number in Insights or Reports looks wrong.**
Check the Audit log for that customer/sale — it's the one place that
can't be edited after the fact, so it's the most trustworthy source when
something doesn't add up.

**Do I need internet to use this?**
No — it's fully offline, runs entirely on the device's local storage.
That also means it doesn't sync between devices; whatever device you're
on is the only copy (hence: back up regularly).

**The app looks like it's missing something I know was added recently.**
Try a hard refresh, or open it in a private/incognito tab. This has
happened before because of stale cached versions of the app sticking
around in the regular browser tab.

**What's the difference between Margin and Markup mode in Pricing
Calculator?**
Margin = % of the sale price that's profit. Markup = % above your cost
you're charging. Same price, different math — see the Pricing Calculator
section above.

---

## Glossary

| Term | Meaning |
|---|---|
| **Tab / House Tab** | Customer owes you, pays later |
| **Store Credit** | Customer has credit on account to spend |
| **Prepaid Delivery** | Customer already paid, goods owed to them |
| **Balance** | Net customer standing: positive = credit, negative = debt |
| **Ledger** | Permanent line-by-line history behind a balance |
| **WAC** | Weighted average cost — your running cost basis per pigment |
| **Shrinkage** | Inventory lost to anything other than a sale |
| **Margin** | Profit as a % of sale price |
| **Markup** | Price as a % above cost |
