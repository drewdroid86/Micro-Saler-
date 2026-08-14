/**
 * Structured User Guide Data extracted and parsed from src/UserGuide.md
 * Provides fast indexed search, categorized sections, quick start walkthroughs,
 * payment reference, financial calculators, and glossary definitions.
 */

export const USER_GUIDE_SECTIONS = [
  {
    id: 'quick-start',
    category: 'Getting Started',
    icon: '⚡',
    title: 'Quick Start (the 90% case)',
    shortTitle: 'Quick Start',
    summary: 'Everything you need to quickly ring up a sale on the register.',
    keywords: ['checkout', 'sale', 'cart', 'preset', 'fast', 'cash', 'register', 'weight'],
    steps: [
      { step: 1, title: 'Checkout tab (🛒)', desc: "Tap the pigment you're selling." },
      { step: 2, title: 'Pick a weight preset', desc: 'Select ¼g, ½g, ¾g, 1g, 1.5g, 1.75g, 3.5g... or enter a custom weight.' },
      { step: 3, title: 'Add more items', desc: 'Repeat for additional pigments — items stack directly in the cart.' },
      { step: 4, title: 'Tap Checkout', desc: 'Choose how they are paying (Cash / Digital / Tab / Store Credit / Prepaid — or split across multiple), then confirm.' },
      { step: 5, title: 'Done!', desc: 'Stock, sale records, and customer balance/ledger update automatically in one atomic step.' }
    ],
    note: "If that's all you need today, you're set. Everything else is for advanced workflows and financial edge cases."
  },
  {
    id: 'tabs-overview',
    category: 'Navigation',
    icon: '📑',
    title: 'The 9 Tabs, What Each One Is For',
    shortTitle: '9 Tabs Overview',
    summary: 'A complete overview of the 9 navigation tabs in Micro Saler.',
    keywords: ['tabs', 'navigation', 'modules', 'overview', 'p&l', 'audit', 'insights', 'history', 'suppliers', 'customers'],
    tabsTable: [
      { tab: 'Checkout', icon: '🛒', purpose: 'Ring up a sale with weight presets, split tender, and customer tabs.' },
      { tab: 'Inventory', icon: '📦', purpose: 'See stock levels, restock a pigment, and log shrinkage/loss.' },
      { tab: 'Pricing Calculator', icon: '🧮', purpose: 'Work out a price by margin % or markup %, weight-tier pricing.' },
      { tab: 'Customers', icon: '👥', purpose: 'Add/edit customers, see who owes what, prepayments, and ledger history.' },
      { tab: 'Suppliers', icon: '🏭', purpose: 'Track vendor payables for restocks, pay them down.' },
      { tab: 'Reports & P&L', icon: '📊', purpose: 'Operating profit & loss over a custom date period.' },
      { tab: 'Business Insights', icon: '📈', purpose: 'KPIs, inventory velocity, top-selling items, receivables/payables, and shrinkage.' },
      { tab: 'History', icon: '📋', purpose: 'Past sales — look one up, print receipts, void a sale, or process a return.' },
      { tab: 'Audit', icon: '🔒', purpose: "Immutable log of everything that's happened — trace balance edits and data repairs." }
    ]
  },
  {
    id: 'payment-types',
    category: 'Checkout',
    icon: '💳',
    title: 'Checkout — Payment Types Explained',
    shortTitle: 'Payment Types',
    summary: 'Understand tender types, fees, credit limits, and split payments.',
    keywords: ['cash', 'digital', 'tab', 'house tab', 'store credit', 'prepaid', 'split', 'credit limit', 'fee'],
    paymentMethods: [
      {
        name: 'Cash',
        icon: '💵',
        desc: 'Self-explanatory standard cash tender. Zero merchant fee.'
      },
      {
        name: 'Digital',
        icon: '📱',
        desc: 'Card or app payments (Square, Venmo, Zelle, CashApp). Processing fee is calculated and tracked automatically.'
      },
      {
        name: 'Tab (House Tab)',
        icon: '📝',
        desc: "Customer pays later. Increases what they owe you (negative balance). Requires selecting a customer account."
      },
      {
        name: 'Store Credit',
        icon: '🎁',
        desc: 'Customer pays using positive credit already on their account (from an overpayment, return, etc.).'
      },
      {
        name: 'Prepaid Delivery',
        icon: '📦',
        desc: 'For a customer who already paid you in advance for goods you are delivering now.'
      },
      {
        name: 'Split Payment',
        icon: '⚖️',
        desc: 'Combine two or more payment methods on one sale (e.g. $10 Cash + $15 House Tab).'
      }
    ],
    alert: {
      type: 'warning',
      title: 'Credit Limit Guard',
      text: "Every customer has a credit limit (defaults to $25 if unset). If a Tab sale would put them over their limit, checkout will flag the overage before you complete the sale."
    }
  },
  {
    id: 'customer-balances',
    category: 'Customers',
    icon: '👥',
    title: 'Customers & Credit — How Balances Work',
    shortTitle: 'Customer Balances',
    summary: 'Store credit, tab debt, prepayments, and the immutable customer ledger.',
    keywords: ['customer', 'balance', 'credit', 'debt', 'ledger', 'prepayment', 'tab', 'limit'],
    balanceRules: [
      {
        type: 'positive',
        label: 'Positive balance (+)',
        meaning: 'Store Credit',
        desc: 'Customer has store credit (you owe them goods/credit) — can be spent on future purchases.'
      },
      {
        type: 'negative',
        label: 'Negative balance (-)',
        meaning: 'Tab Debt',
        desc: 'Customer is in debt to you (unpaid house tab).'
      }
    ],
    details: [
      "Every change to a balance — a tab sale, a payment against a tab, store credit being spent or earned — gets written to that customer's permanent ledger.",
      "The ledger is the single source of truth to check against if a balance ever looks unusual.",
      "Prepayments are tracked separately from balance/credit — representing money a customer paid in advance for orders delivered later."
    ]
  },
  {
    id: 'pricing-calculator',
    category: 'Pricing',
    icon: '🧮',
    title: 'Pricing Calculator — Two Modes',
    shortTitle: 'Pricing Calculator',
    summary: 'Mastering Margin Mode vs Markup Mode and weight tier pricing.',
    keywords: ['pricing', 'calculator', 'margin', 'markup', 'cogs', 'wac', 'tiers', 'cost'],
    modes: [
      {
        name: 'Margin Mode',
        formula: 'Margin = % of sale price that is gross profit',
        presets: '20 / 30 / 40 / 50 / 60 / 70 / 75 / 80 / 90%',
        example: '50% margin on a $5 cost = $10.00 retail price ($5 profit).'
      },
      {
        name: 'Markup Mode',
        formula: 'Markup = % charged above cost basis',
        presets: '25 / 50 / 75 / 100 / 150 / 200 / 300 / 400%',
        example: '50% markup on a $5 cost = $7.50 retail price ($2.50 profit).'
      }
    ],
    alert: {
      type: 'info',
      title: 'Margin vs Markup',
      text: 'Margin and markup answer different questions! 50% margin and 50% markup are NOT the same price. If numbers seem off, check which mode toggle is active.'
    }
  },
  {
    id: 'inventory-shrinkage',
    category: 'Inventory',
    icon: '📦',
    title: 'Inventory — Restocking & Shrinkage',
    shortTitle: 'Inventory & Shrinkage',
    summary: 'Weighted average cost (WAC), restocks on supplier tabs, and logging shrinkage.',
    keywords: ['inventory', 'restock', 'shrinkage', 'wac', 'spillage', 'loss', 'cost basis'],
    items: [
      {
        title: 'Restock Pigments',
        desc: 'Log new stock weight and cost. Tracks who you bought it from and whether it was paid upfront or placed on a supplier tab. Your WAC (weighted average cost) updates automatically.'
      },
      {
        title: 'Shrinkage & Loss',
        desc: 'Log non-sale losses: spillage, container residue, testing samples, or count corrections. Keeps stock honest and surfaces in Business Insights so losses do not eat margins unnoticed.'
      }
    ]
  },
  {
    id: 'suppliers',
    category: 'Suppliers',
    icon: '🏭',
    title: 'Suppliers & Accounts Payable',
    shortTitle: 'Suppliers',
    summary: 'Managing vendor liabilities and paying down supplier restock tabs.',
    keywords: ['supplier', 'vendor', 'payables', 'restock tab', 'pay supplier'],
    text: 'Tracks who you buy pigment from and what you owe them — same concept as customer tabs, but in the other direction. Restocking on credit adds to your supplier liability; paying them down reduces what you owe.'
  },
  {
    id: 'insights-reports',
    category: 'Reporting',
    icon: '📈',
    title: 'Business Insights, Reports & Audit',
    shortTitle: 'Insights & Audit',
    summary: 'P&L, velocity reorder flags, receivables, voiding sales, and audit logs.',
    keywords: ['insights', 'kpi', 'reports', 'profit', 'void', 'return', 'audit', 'velocity'],
    sections: [
      { title: 'Business Insights', desc: 'KPIs, inventory velocity (with "reorder soon" alerts), receivables/payables at a glance, shrinkage, and profitability ranking.' },
      { title: 'Reports & P&L', desc: 'Profit and loss statements across selectable date ranges with merchant fee accounting.' },
      { title: 'History & Returns', desc: 'Look up past sales, print official receipts, void erroneous sales, or process customer returns.' },
      { title: 'Audit Trail', desc: 'Locked, append-only chronological record of every system event for immutable discrepancy tracing.' }
    ]
  },
  {
    id: 'backups',
    category: 'Data Safety',
    icon: '💾',
    title: 'Backups — Don’t Skip This',
    shortTitle: 'Backups & Storage',
    summary: '100% offline storage, backup JSON exports, and data recovery.',
    keywords: ['backup', 'restore', 'export', 'json', 'offline', 'storage', 'local'],
    alert: {
      type: 'warning',
      title: 'Local Browser Storage Warning',
      text: "Micro Saler is 100% offline. Everything lives inside this device's browser database (IndexedDB). There is no cloud copy. If browser data is cleared or device is lost, unbacked data is gone! Back up regularly via 💾 Backup / Restore."
    }
  },
  {
    id: 'faq',
    category: 'Help & FAQ',
    icon: '❓',
    title: 'FAQ / Common Register Situations',
    shortTitle: 'FAQ & Situations',
    summary: 'Answers to common register questions and edge-case workflows.',
    keywords: ['faq', 'common', 'questions', 'void', 'return', 'offline', 'cache', 'credit'],
    faqList: [
      {
        q: 'A customer wants to pay later.',
        a: 'Pick them as the customer for the sale, choose Tab as the payment type. The app flags if they exceed their credit limit.'
      },
      {
        q: 'A customer wants to pay down what they owe.',
        a: 'Go to Customers, select the customer, tap Settle Tab to record their payment against their tab.'
      },
      {
        q: 'A customer overpaid or is owed credit.',
        a: 'That raises their positive balance (store credit), which they can spend on future purchases by selecting Store Credit at checkout.'
      },
      {
        q: 'Someone wants to return an item.',
        a: 'Find the sale in History and process a return there to restore stock and refund payment method.'
      },
      {
        q: 'I rang something up wrong.',
        a: 'Void the sale in History rather than manually adjusting inventory — voiding automatically restores stock and reverses ledger/payment effects.'
      },
      {
        q: 'A number in Insights or Reports looks unusual.',
        a: 'Check the Audit log for that customer/sale — it is immutable and logs the exact state changes.'
      },
      {
        q: 'Do I need internet to use this?',
        a: 'No. It is fully offline and runs entirely on the device local storage.'
      },
      {
        q: 'The app is missing something added recently.',
        a: 'Perform a hard refresh or open in an incognito window to clear cached browser assets.'
      }
    ]
  },
  {
    id: 'glossary',
    category: 'Reference',
    icon: '📖',
    title: 'Glossary of POS & Financial Terms',
    shortTitle: 'Glossary',
    summary: 'Standard terms and definitions used across Micro Saler.',
    keywords: ['glossary', 'terms', 'tab', 'store credit', 'prepaid', 'wac', 'shrinkage', 'margin', 'markup', 'ledger'],
    terms: [
      { term: 'Tab / House Tab', def: 'Customer owes shop, pays later.' },
      { term: 'Store Credit', def: 'Customer has credit balance on account to spend.' },
      { term: 'Prepaid Delivery', def: 'Customer already paid in advance; goods owed to them.' },
      { term: 'Balance', def: 'Net customer standing: positive = credit, negative = tab debt.' },
      { term: 'Ledger', def: 'Permanent line-by-line immutable transaction history behind a balance.' },
      { term: 'WAC', def: 'Weighted Average Cost — your running weighted cost basis per pigment.' },
      { term: 'Shrinkage', def: 'Inventory lost to anything other than a sale (spills, residue, breakage).' },
      { term: 'Margin', def: 'Gross profit as a percentage of sale price.' },
      { term: 'Markup', def: 'Price charged as a percentage above cost basis.' }
    ]
  }
];
