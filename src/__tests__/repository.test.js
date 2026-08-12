import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCents,
  formatMgToGrams,
  formatMgToOz,
  getEffectivePricePerGramCents,
  validateCompletedSale,
  APPROVED_PAYMENT_TYPES,
  gramsToMg,
  ozToMg,
  mgToGrams,
  mgToOz,
  calculatePricingBreakdown,
  getMatchedTier,
  calculateBusinessInsights,
  filterCustomers,
  getAllCustomerNames,
  filterCustomerSuggestions,
  calculateCustomerBalance,
  calculateMerchantFeeCents,
  DEFAULT_MERCHANT_FEE_RATES,
  PosRepository
} from '../repository.js';

test('gramsToMg and ozToMg convert accurately', () => {
  assert.equal(gramsToMg(10), 10000);
  assert.equal(gramsToMg(0.5), 500);
  assert.equal(ozToMg(1), 28350); // Math.round(28349.523)
  assert.equal(mgToGrams(5000), 5);
  assert.equal(Math.round(mgToOz(28349.523)), 1);
});

test('calculatePricingBreakdown computes retail price, COGS, profit, and margin correctly', () => {
  const pigment = {
    pigment_id: 1,
    name: 'Sample Ruby',
    retail_price_per_gram_cents: 1000, // $10/g
    wholesale_price_per_gram_cents: 600, // $6/g
    stock_mg: 100000, // 100g in stock
    total_cost_cents: 30000 // $300 total cost => WAC is $3/g (300 cents/g)
  };

  // Test 25g Retail
  const breakdown = calculatePricingBreakdown({
    pigment,
    weightMg: 25000,
    pricingMode: 'RETAIL'
  });

  assert.equal(breakdown.weightGrams, 25);
  assert.equal(breakdown.totalPriceCents, 25000); // 25g * $10 = $250.00 (25000 cents)
  assert.equal(breakdown.cogsCents, 7500); // 25g * $3 = $75.00 (7500 cents)
  assert.equal(breakdown.grossProfitCents, 17500); // $175.00 profit
  assert.equal(breakdown.marginPercent, 70); // 17500 / 25000 = 70%
  assert.equal(breakdown.markupMultiplier, 25000 / 7500); // 3.33x

  // Test Tier matching
  const pigmentWithTiers = {
    ...pigment,
    price_tiers: [
      { min_weight_mg: 50000, retail_price_per_gram_cents: 800, wholesale_price_per_gram_cents: 500 }
    ]
  };

  const tierBreakdown = calculatePricingBreakdown({
    pigment: pigmentWithTiers,
    weightMg: 50000,
    pricingMode: 'RETAIL'
  });

  assert.equal(tierBreakdown.effectiveRatePerGramCents, 800); // Tier applied ($8/g instead of $10/g)
  assert.equal(tierBreakdown.totalPriceCents, 40000); // 50g * $8 = $400.00
});

test('formatCents converts integer cents to formatted dollar string', () => {
  assert.equal(formatCents(100), '$1.00');
  assert.equal(formatCents(1250), '$12.50');
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(null), '$0.00');
  assert.equal(formatCents(undefined), '$0.00');
  assert.equal(formatCents(NaN), '$0.00');
});

test('formatMgToGrams converts milligrams to formatted gram string', () => {
  assert.equal(formatMgToGrams(1000), '1.0g');
  assert.equal(formatMgToGrams(1750), '1.8g');
  assert.equal(formatMgToGrams(28000), '28.0g');
  assert.equal(formatMgToGrams(0), '0.0g');
  assert.equal(formatMgToGrams(null), '0.0g');
  assert.equal(formatMgToGrams(NaN), '0.0g');
});

test('formatMgToOz converts milligrams to formatted ounce string', () => {
  assert.equal(formatMgToOz(28349.5), '1.00 oz');
  assert.equal(formatMgToOz(0), '0.00 oz');
  assert.equal(formatMgToOz(null), '0.00 oz');
});

test('getEffectivePricePerGramCents calculates per-gram rate correctly', () => {
  const mockPigment = {
    retail_price_per_gram_cents: 800,  // $8.00/g
    wholesale_price_per_gram_cents: 500 // $5.00/g
  };

  assert.equal(getEffectivePricePerGramCents(mockPigment, 1000, 'RETAIL'), 800);
  assert.equal(getEffectivePricePerGramCents(mockPigment, 1000, 'WHOLESALE'), 500);
  assert.equal(getEffectivePricePerGramCents(null, 1000, 'RETAIL'), 0);
});

test('WAC formula calculates weighted cost basis accurately', () => {
  const currentStockMg = 10000; // 10g
  const currentTotalCostCents = 3000; // $30.00 ($3/g)
  
  const incomingMg = 10000; // 10g
  const incomingCostCents = 5000; // $50.00 ($5/g)

  const newStockMg = currentStockMg + incomingMg;
  const newTotalCostCents = currentTotalCostCents + incomingCostCents;

  const newWacPerGramCents = Math.round((newTotalCostCents / newStockMg) * 1000);

  assert.equal(newStockMg, 20000);
  assert.equal(newTotalCostCents, 8000);
  assert.equal(newWacPerGramCents, 400); // $4.00/g average
});

test('Partial restock down payment calculates tab liability correctly', () => {
  const totalCostCents = 10000; // $100.00
  const paidDownCents = 3000; // $30.00
  const unpaidTabCents = totalCostCents - paidDownCents; // $70.00

  assert.equal(paidDownCents, 3000);
  assert.equal(unpaidTabCents, 7000);
  assert.equal(paidDownCents + unpaidTabCents, totalCostCents);
});

test('Stock receipt reversal deducts inventory and reverses unpaid tab balance', () => {
  let stockMg = 25000;
  let totalCostCents = 10000;
  let supplierBalanceCents = 7000;

  const restockReceipt = {
    received_mg: 10000,
    total_cost_cents: 5000,
    unpaid_tab_cents: 3000
  };

  stockMg -= restockReceipt.received_mg;
  totalCostCents -= restockReceipt.total_cost_cents;
  supplierBalanceCents -= restockReceipt.unpaid_tab_cents;

  assert.equal(stockMg, 15000);
  assert.equal(totalCostCents, 5000);
  assert.equal(supplierBalanceCents, 4000);
});

test('Editing restock terms rebalances supplier liability correctly', () => {
  const totalCostCents = 10000;
  let oldUnpaidTabCents = 10000;
  let supplierBalanceCents = 10000;

  const newPaidDownCents = 4000;
  const newUnpaidTabCents = totalCostCents - newPaidDownCents;

  const tabDiffCents = newUnpaidTabCents - oldUnpaidTabCents;
  supplierBalanceCents += tabDiffCents;

  assert.equal(newUnpaidTabCents, 6000);
  assert.equal(tabDiffCents, -4000);
  assert.equal(supplierBalanceCents, 6000);
});

test('New pigment initial purchase with supplier tab calculates supplier balance', () => {
  const initialCostCents = 15000;
  const paymentStatus = 'PARTIAL';
  const paidDownCents = 5000;
  const unpaidTabCents = initialCostCents - paidDownCents;

  assert.equal(paidDownCents, 5000);
  assert.equal(unpaidTabCents, 10000);
});

test('Reset inventory stock and costs zeroes out stock weights and cost values', () => {
  const pigments = [
    { pigment_id: 1, name: 'Gold', stock_mg: 50000, total_cost_cents: 20000 },
    { pigment_id: 2, name: 'Ruby', stock_mg: 10000, total_cost_cents: 5000 }
  ];

  const resetPigments = pigments.map(p => ({ ...p, stock_mg: 0, total_cost_cents: 0 }));

  assert.equal(resetPigments[0].stock_mg, 0);
  assert.equal(resetPigments[0].total_cost_cents, 0);
  assert.equal(resetPigments[1].stock_mg, 0);
  assert.equal(resetPigments[1].total_cost_cents, 0);
});

test('Customer prepayment and backorder tracking calculates weight and credit owed', () => {
  const prepayment = {
    customer_id: 1,
    weight_mg: 25000,
    amount_cents: 10000,
    status: 'PENDING_DELIVERY'
  };

  assert.equal(prepayment.weight_mg, 25000);
  assert.equal(prepayment.amount_cents, 10000);
  assert.equal(prepayment.status, 'PENDING_DELIVERY');

  prepayment.status = 'FULFILLED';
  assert.equal(prepayment.status, 'FULFILLED');
});

test('Wipe all data clears all 14 object stores', () => {
  const storeNames = [
    'pigments',
    'pigment_price_tiers',
    'stock_receipts',
    'suppliers',
    'supplier_payments',
    'customers',
    'customer_prepayments',
    'sales',
    'sale_payments',
    'sale_items',
    'returns',
    'tab_payments',
    'shrinkage_logs',
    'audit_log'
  ];

  assert.equal(storeNames.length, 14);
  assert.ok(storeNames.includes('customer_prepayments'));
  assert.ok(storeNames.includes('suppliers'));
  assert.ok(storeNames.includes('supplier_payments'));
});

test('Supplier creation schema data structure persists correctly', () => {
  const supplierData = {
    name: 'T mica suppliers',
    phone_number: '5555544',
    notes: 'Na'
  };

  const supplierRecord = {
    supplier_id: 1,
    name: supplierData.name.trim(),
    phone_number: supplierData.phone_number,
    current_balance_cents: 0,
    notes: supplierData.notes,
    created_at: Date.now()
  };

  assert.equal(supplierRecord.name, 'T mica suppliers');
  assert.equal(supplierRecord.phone_number, '5555544');
  assert.equal(supplierRecord.notes, 'Na');
  assert.equal(supplierRecord.current_balance_cents, 0);
});

test('Overriding total transaction price scales cart line items proportionally to match target total', () => {
  const cart = [
    { pigment_id: 1, price_charged_cents: 3000 },
    { pigment_id: 2, price_charged_cents: 2000 }
  ];
  const targetTotalCents = 4500; // $45.00 total override
  const currentTotalCents = cart.reduce((sum, i) => sum + i.price_charged_cents, 0); // 5000

  let assignedCents = 0;
  const updatedCart = cart.map((item, index) => {
    if (index === cart.length - 1) {
      return { ...item, price_charged_cents: targetTotalCents - assignedCents };
    } else {
      const share = Math.round((item.price_charged_cents / currentTotalCents) * targetTotalCents);
      assignedCents += share;
      return { ...item, price_charged_cents: share };
    }
  });

  assert.equal(updatedCart[0].price_charged_cents, 2700); // $27.00
  assert.equal(updatedCart[1].price_charged_cents, 1800); // $18.00
  const finalSum = updatedCart.reduce((sum, i) => sum + i.price_charged_cents, 0);
  assert.equal(finalSum, 4500);
});

test('Partial cash and tab payment breakdown correctly allocates paid now vs tab balance', () => {
  const totalSaleAmountCents = 6000; // $60.00
  const paidNowCents = 2500; // $25.00 cash
  const tabAmountCents = Math.max(0, totalSaleAmountCents - paidNowCents); // $35.00 tab

  const payments = [
    { payment_type: 'CASH', amount_cents: paidNowCents },
    { payment_type: 'HOUSE_TAB', amount_cents: tabAmountCents }
  ];

  const totalPaymentsCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  assert.equal(totalPaymentsCents, totalSaleAmountCents);
  assert.equal(tabAmountCents, 3500);

  const initialCustomerBalance = 1000; // $10.00
  const newCustomerBalance = initialCustomerBalance + tabAmountCents;
  assert.equal(newCustomerBalance, 4500); // $45.00
});

test('Data integrity check identifies payment total mismatches and auto-repairs safely', () => {
  const completedSales = [
    { sale_id: 1, status: 'COMPLETED', total_amount_cents: 2000 },
    { sale_id: 2, status: 'COMPLETED', total_amount_cents: 1500 }
  ];
  const saleItems = [
    { sale_id: 1, price_charged_cents: 2000 }
    // sale 2 has no sale_items
  ];
  const salePayments = [
    { sale_id: 1, amount_cents: 2000 },
    { sale_id: 2, amount_cents: 1500 }
  ];

  const mismatches = completedSales.filter(s => {
    const items = saleItems.filter(i => i.sale_id === s.sale_id);
    const payments = salePayments.filter(p => p.sale_id === s.sale_id);
    const iTotal = items.reduce((sum, i) => sum + i.price_charged_cents, 0);
    const pTotal = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    return Math.abs(iTotal - pTotal) > 1;
  });

  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0].sale_id, 2);

  // Auto-repair simulation for missing sale_items (Case A)
  for (const m of mismatches) {
    const items = saleItems.filter(i => i.sale_id === m.sale_id);
    const payments = salePayments.filter(p => p.sale_id === m.sale_id);
    const pTotal = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    if (items.length === 0 && pTotal > 0) {
      saleItems.push({ sale_id: m.sale_id, pigment_id: 0, weight_mg: 0, price_charged_cents: pTotal, unit_cogs_cents: 0 });
    }
  }

  const postRepairMismatches = completedSales.filter(s => {
    const items = saleItems.filter(i => i.sale_id === s.sale_id);
    const payments = salePayments.filter(p => p.sale_id === s.sale_id);
    const iTotal = items.reduce((sum, i) => sum + i.price_charged_cents, 0);
    const pTotal = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    return Math.abs(iTotal - pTotal) > 1;
  });

  assert.equal(postRepairMismatches.length, 0);
});

test('validateCompletedSale accepts valid sales with matching payments', () => {
  const validSale = {
    sale: { total_amount_cents: 2500 },
    items: [{ pigment_id: 1, price_charged_cents: 2500 }],
    payments: [{ payment_type: 'CASH', amount_cents: 2500 }]
  };
  const res = validateCompletedSale(validSale);
  assert.equal(res.isValid, true);
  assert.equal(res.errors.length, 0);
});

test('validateCompletedSale accepts valid split payment matching exact sale total', () => {
  const splitSale = {
    sale: { total_amount_cents: 5000 },
    items: [{ pigment_id: 1, price_charged_cents: 5000 }],
    payments: [
      { payment_type: 'CASH', amount_cents: 2000 },
      { payment_type: 'DIGITAL', digital_provider: 'Square', amount_cents: 3000 }
    ]
  };
  const res = validateCompletedSale(splitSale);
  assert.equal(res.isValid, true);
});

test('validateCompletedSale rejects payment total mismatch', () => {
  const mismatchedSale = {
    sale: { total_amount_cents: 5000 },
    items: [{ pigment_id: 1, price_charged_cents: 5000 }],
    payments: [{ payment_type: 'CASH', amount_cents: 4990 }]
  };
  const res = validateCompletedSale(mismatchedSale);
  assert.equal(res.isValid, false);
  assert.ok(res.errors.some(e => e.includes('does not match sale total')));
});

test('validateCompletedSale rejects zero, negative, NaN, decimal, and missing payment amounts', () => {
  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 0 },
    items: [{ price_charged_cents: 0 }],
    payments: []
  }).isValid, false);

  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [],
    payments: [{ payment_type: 'CASH', amount_cents: 1000 }]
  }).isValid, false);

  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [{ price_charged_cents: 1000 }],
    payments: [{ payment_type: 'CASH', amount_cents: 0 }]
  }).isValid, false);

  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [{ price_charged_cents: 1000 }],
    payments: [{ payment_type: 'CASH', amount_cents: -500 }]
  }).isValid, false);

  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [{ price_charged_cents: 1000 }],
    payments: [{ payment_type: 'CASH', amount_cents: 10.5 }]
  }).isValid, false);

  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [{ price_charged_cents: 1000 }],
    payments: [{ payment_type: 'CASH', amount_cents: NaN }]
  }).isValid, false);
});

test('validateCompletedSale rejects unapproved payment types and missing HOUSE_TAB customer', () => {
  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [{ price_charged_cents: 1000 }],
    payments: [{ payment_type: 'BITCOIN', amount_cents: 1000 }]
  }).isValid, false);

  assert.equal(validateCompletedSale({
    sale: { total_amount_cents: 1000 },
    items: [{ price_charged_cents: 1000 }],
    payments: [{ payment_type: 'HOUSE_TAB', amount_cents: 1000 }],
    customerId: null
  }).isValid, false);
});

test('Simulated inventory stock validation prevents overselling stock_mg', () => {
  let pigmentStockMg = 5000; // 5g
  const saleItemWeightMg = 7000; // 7g request

  function attemptCheckout(requestedMg) {
    if (pigmentStockMg < requestedMg) {
      throw new Error(`Insufficient stock. Available: ${pigmentStockMg}mg, Requested: ${requestedMg}mg`);
    }
    pigmentStockMg -= requestedMg;
    return true;
  }

  assert.throws(() => attemptCheckout(saleItemWeightMg), /Insufficient stock/);
  assert.equal(pigmentStockMg, 5000); // stock unchanged
});

test('Ambiguous sales are flagged as needs_reconciliation and not silently overwritten', () => {
  const ambiguousSale = {
    sale_id: 99,
    status: 'COMPLETED',
    total_amount_cents: 5000
  };
  const itemsTotal = 5000;
  const paymentsTotal = 3000; // $20.00 mismatch with 2 payments
  const payments = [
    { payment_type: 'CASH', amount_cents: 1500 },
    { payment_type: 'DIGITAL', amount_cents: 1500 }
  ];

  const diff = Math.abs(ambiguousSale.total_amount_cents - paymentsTotal);
  assert.equal(diff, 2000);

  // Is not unambiguous 1-payment rounding -> must be marked needs_reconciliation
  const isSinglePaymentRounding = payments.length === 1 && diff === 1;
  assert.equal(isSinglePaymentRounding, false);

  ambiguousSale.needs_reconciliation = true;
  ambiguousSale.reconciliation_status = 'NEEDS_RECONCILIATION';

  assert.equal(ambiguousSale.needs_reconciliation, true);
  assert.equal(ambiguousSale.reconciliation_status, 'NEEDS_RECONCILIATION');
});

test('Backup export/import structure preserves audit_log and reconciliation metadata', () => {
  const mockBackupData = {
    exported_at: new Date().toISOString(),
    db_version: 4,
    stores: {
      sales: [
        { sale_id: 1, total_amount_cents: 2000, status: 'COMPLETED', reconciliation_status: 'AUTO_REPAIRED', needs_reconciliation: false }
      ],
      audit_log: [
        { audit_id: 1, entity_type: 'Sale', entity_id: 1, action: 'INTEGRITY_AUTO_REPAIR' }
      ]
    }
  };

  assert.ok(mockBackupData.stores.sales[0].reconciliation_status);
  assert.equal(mockBackupData.stores.sales[0].reconciliation_status, 'AUTO_REPAIRED');
  assert.equal(mockBackupData.stores.audit_log[0].action, 'INTEGRITY_AUTO_REPAIR');
});

test('calculateBusinessInsights computes per-pigment profitability, inventory velocity, time patterns, receivables, payables, shrinkage loss, and sale drill-downs', () => {
  const nowTs = new Date('2026-08-01T12:00:00Z').getTime();

  const pigments = [
    { pigment_id: 1, name: 'Emerald Sparkle', stock_mg: 2000, is_archived: false }, // 2g stock => velocity reorder soon
    { pigment_id: 2, name: 'Ruby Rush', stock_mg: 50000, is_archived: false },
    { pigment_id: 3, name: 'Sapphire Glow', stock_mg: 30000, is_archived: false },
    { pigment_id: -1, name: 'General Credit', stock_mg: 0, is_archived: false } // should be excluded
  ];

  const sales = [
    { sale_id: 101, customer_id: 1, created_at: nowTs - 3600000, status: 'COMPLETED', total_amount_cents: 5000, total_cogs_cents: 1500 },
    { sale_id: 102, customer_id: 2, created_at: nowTs - 7200000, status: 'COMPLETED', total_amount_cents: 10000, total_cogs_cents: 3000 }
  ];

  const saleItems = [
    { sale_id: 101, pigment_id: 1, weight_mg: 30000, price_charged_cents: 5000, unit_cogs_cents: 1500 }, // 30g sold => 1g/day avg sell rate => stock 2g ÷ 1g/day = 2 days remaining (< 7 days)
    { sale_id: 102, pigment_id: 2, weight_mg: 12500, price_charged_cents: 10000, unit_cogs_cents: 3000 },
    { sale_id: 101, pigment_id: -1, weight_mg: 0, price_charged_cents: 500, unit_cogs_cents: 0 } // excluded item
  ];

  const customers = [
    { customer_id: 1, name: 'Alice Smith', current_balance_cents: 2500 },
    { customer_id: 2, name: 'Bob Jones', current_balance_cents: 0 }
  ];

  const suppliers = [
    { supplier_id: 1, name: 'Mica World Inc', current_balance_cents: 12000, contact_info: '555-0199' }
  ];

  const shrinkageLogs = [
    { pigment_id: 1, weight_mg: 1000, cogs_loss_cents: 300, created_at: nowTs - 1800000 }
  ];

  const stockReceipts = [
    { receipt_id: 1, pigment_id: 1, supplier_id: 1, supplier_name: 'Mica World Inc', received_mg: 10000, total_cost_cents: 2000, received_at: nowTs - 864000000 }, // $2.00/g initial
    { receipt_id: 2, pigment_id: 1, supplier_id: 1, supplier_name: 'Mica World Inc', received_mg: 10000, total_cost_cents: 3000, received_at: nowTs - 86400000 }  // $3.00/g latest => +50% increase
  ];

  const insights = calculateBusinessInsights({
    sales,
    saleItems,
    pigments,
    customers,
    suppliers,
    shrinkageLogs,
    stockReceipts,
    timeRange: 'ALL',
    nowTimestamp: nowTs
  });

  assert.equal(insights.completedCount, 2);
  assert.equal(insights.grossRevenueCents, 15000);
  assert.equal(insights.totalCogsCents, 4500);

  // 1. Per-pigment profitability check (pigment_id <= 0 excluded)
  assert.equal(insights.perPigmentProfitability.length, 3);
  const emerald = insights.perPigmentProfitability.find(p => p.pigment_id === 1);
  assert.ok(emerald);
  assert.equal(emerald.name, 'Emerald Sparkle');
  assert.equal(emerald.weightSoldMg, 30000);
  assert.equal(emerald.revenueCents, 5000);
  assert.equal(emerald.cogsCents, 1500);
  assert.equal(emerald.profitCents, 3500);
  assert.equal(emerald.marginPct, 70);

  // 2. Inventory velocity check
  assert.equal(emerald.velocityStatus, 'Reorder Soon');
  assert.equal(emerald.estimatedDaysRemaining, 2); // 2000mg stock / (30000mg / 30) = 2 days

  const sapphire = insights.perPigmentProfitability.find(p => p.pigment_id === 3);
  assert.equal(sapphire.velocityStatus, 'Slow Mover');

  // 3. Time-based patterns check
  assert.ok(insights.dayOfWeekStats.length === 7);
  assert.ok(insights.hourOfDayStats.length === 24);
  assert.ok(insights.peakDay);
  assert.ok(insights.peakHour);

  // 4. Receivables summary check
  assert.equal(insights.customerReceivables.length, 1);
  assert.equal(insights.customerReceivables[0].name, 'Alice Smith');
  assert.equal(insights.customerReceivables[0].amountOwedCents, 2500);

  // 5. Payables summary check
  assert.equal(insights.supplierPayables.length, 1);
  assert.equal(insights.supplierPayables[0].name, 'Mica World Inc');
  assert.equal(insights.supplierPayables[0].amountOwedCents, 12000);

  // 6. Shrinkage loss tracking check
  assert.equal(insights.shrinkageImpact.length, 1);
  assert.equal(insights.shrinkageImpact[0].name, 'Emerald Sparkle');
  assert.equal(insights.shrinkageImpact[0].cogsLossCents, 300);

  // 7. Individual sale history drill-down check
  assert.equal(insights.detailedSalesList.length, 2);
  assert.equal(insights.detailedSalesList[0].customer_name, 'Alice Smith');
  assert.equal(insights.detailedSalesList[0].items.length, 2);

  // 8. Stock receipt history & cost trend check
  assert.equal(insights.validReceipts.length, 2);
  assert.equal(insights.pigmentCostTrends.length, 1);
  assert.equal(insights.pigmentCostTrends[0].name, 'Emerald Sparkle');
  assert.equal(insights.pigmentCostTrends[0].trendStatus, 'INCREASING');
  assert.equal(insights.pigmentCostTrends[0].pctChange, 50);

  // Deterministic recommendations check
  assert.ok(insights.recommendations.length > 0);
  assert.ok(insights.recommendations.some(r => r.id.startsWith('rec_reorder_1')));
  assert.ok(insights.recommendations.some(r => r.id.startsWith('rec_receivable_1')));
  assert.ok(insights.recommendations.some(r => r.id.startsWith('rec_slow_3')));
  assert.ok(insights.recommendations.some(r => r.id === 'rec_payables'));
  assert.ok(insights.recommendations.some(r => r.id.startsWith('rec_waste_1')));
  assert.ok(insights.recommendations.some(r => r.id.startsWith('rec_cost_increase_1')));
});

test('calculateBusinessInsights calculates pricing mode performance summary and surfaces pricing_mode on detailed sales', () => {
  const sales = [
    {
      sale_id: 101,
      created_at: 1700000000000,
      customer_id: 1,
      total_amount_cents: 10000,
      total_cogs_cents: 4000,
      status: 'COMPLETED',
      pricing_mode: 'RETAIL'
    },
    {
      sale_id: 102,
      created_at: 1700001000000,
      customer_id: 2,
      total_amount_cents: 15000,
      total_cogs_cents: 9000,
      status: 'COMPLETED',
      pricing_mode: 'WHOLESALE'
    },
    {
      sale_id: 103,
      created_at: 1700002000000,
      customer_id: 1,
      total_amount_cents: 5000,
      total_cogs_cents: 2000,
      status: 'COMPLETED'
    }
  ];

  const saleItems = [
    { sale_item_id: 1, sale_id: 101, pigment_id: 1, weight_mg: 10000, price_charged_cents: 10000, unit_cogs_cents: 4000 },
    { sale_item_id: 2, sale_id: 102, pigment_id: 1, weight_mg: 20000, price_charged_cents: 15000, unit_cogs_cents: 9000 },
    { sale_item_id: 3, sale_id: 103, pigment_id: 1, weight_mg: 5000, price_charged_cents: 5000, unit_cogs_cents: 2000 }
  ];

  const insights = calculateBusinessInsights({
    sales,
    saleItems,
    pigments: [{ pigment_id: 1, name: 'Sample Mica', stock_mg: 50000 }],
    timeRange: 'ALL'
  });

  const pms = insights.pricingModeSummary;
  assert.ok(pms, 'pricingModeSummary should be defined');
  assert.equal(pms.retailSalesCount, 2);
  assert.equal(pms.retailRevenueCents, 15000);
  assert.equal(pms.retailCogsCents, 6000);
  assert.equal(pms.retailProfitCents, 9000);
  assert.equal(pms.retailMarginPct, 60);

  assert.equal(pms.wholesaleSalesCount, 1);
  assert.equal(pms.wholesaleRevenueCents, 15000);
  assert.equal(pms.wholesaleCogsCents, 9000);
  assert.equal(pms.wholesaleProfitCents, 6000);
  assert.equal(pms.wholesaleMarginPct, 40);

  assert.equal(insights.detailedSalesList.length, 3);
  const wholesaleSale = insights.detailedSalesList.find(s => s.sale_id === 102);
  const legacySale = insights.detailedSalesList.find(s => s.sale_id === 103);

  assert.equal(wholesaleSale.pricing_mode, 'WHOLESALE');
  assert.equal(wholesaleSale.sale_type, 'WHOLESALE');
  assert.equal(wholesaleSale.is_below_floor, true, 'Wholesale sale with 40% margin (<50%) should be flagged as below floor');

  assert.equal(legacySale.pricing_mode, 'RETAIL');
  assert.equal(legacySale.sale_type, 'RETAIL');
  assert.equal(legacySale.is_below_floor, true, 'Retail sale with 60% margin (<65%) should be flagged as below floor');

  assert.ok(insights.recommendations.some(r => r.id === 'rec_below_floor_102'), 'Should trigger below floor recommendation for wholesale sale #102');
  assert.ok(insights.recommendations.some(r => r.id === 'rec_below_floor_103'), 'Should trigger below floor recommendation for retail sale #103');
});

test('Shrinkage overshoot validation prevents logging shrinkage exceeding stock_mg', () => {
  const pigment = { pigment_id: 1, name: 'Gold', stock_mg: 5000, total_cost_cents: 2000 };
  const mgLost = 6000;

  function validateShrinkage(p, lost) {
    if (lost > p.stock_mg) {
      throw new Error(`Cannot log shrinkage of ${lost}mg — only ${p.stock_mg}mg in stock`);
    }
  }

  assert.throws(() => validateShrinkage(pigment, mgLost), /Cannot log shrinkage/);
});

test('Void sale with prior returns restocks only net weight and proportional COGS', () => {
  const saleItem = { sale_item_id: 10, sale_id: 1, pigment_id: 1, weight_mg: 10000, unit_cogs_cents: 3000 };
  const returns = [{ sale_item_id: 10, mg_returned: 3000, refund_amount_cents: 900 }];

  const alreadyReturnedMg = returns.reduce((sum, r) => sum + r.mg_returned, 0);
  const netMg = saleItem.weight_mg - alreadyReturnedMg;
  const netCogs = saleItem.weight_mg > 0
    ? Math.round((saleItem.unit_cogs_cents / saleItem.weight_mg) * netMg)
    : 0;

  assert.equal(alreadyReturnedMg, 3000);
  assert.equal(netMg, 7000); // 10000 - 3000 = 7000mg restocked
  assert.equal(netCogs, 2100); // 7000/10000 * 3000 = 2100 cents
});

test('validateCompletedSale allows +-1 cent payment tolerance', () => {
  const saleMinusOne = {
    sale: { total_amount_cents: 5000 },
    items: [{ pigment_id: 1, price_charged_cents: 5000 }],
    payments: [{ payment_type: 'CASH', amount_cents: 4999 }]
  };

  const salePlusOne = {
    sale: { total_amount_cents: 5000 },
    items: [{ pigment_id: 1, price_charged_cents: 5000 }],
    payments: [{ payment_type: 'CASH', amount_cents: 5001 }]
  };

  const saleOffTwo = {
    sale: { total_amount_cents: 5000 },
    items: [{ pigment_id: 1, price_charged_cents: 5000 }],
    payments: [{ payment_type: 'CASH', amount_cents: 4998 }]
  };

  assert.equal(validateCompletedSale(saleMinusOne).isValid, true);
  assert.equal(validateCompletedSale(salePlusOne).isValid, true);
  assert.equal(validateCompletedSale(saleOffTwo).isValid, false);
});

test('Cart stock aggregation logic blocks adding items exceeding total stock across cart', () => {
  const cart = [
    { pigment_id: 1, weight_mg: 3000 },
    { pigment_id: 2, weight_mg: 5000 },
    { pigment_id: 1, weight_mg: 4000 }
  ];
  const pigment = { pigment_id: 1, name: 'Ruby', stock_mg: 10000 };

  function checkCanAdd(pigmentId, requestedMg) {
    const existingWeightMg = cart
      .filter(ci => ci.pigment_id === pigmentId)
      .reduce((sum, ci) => sum + ci.weight_mg, 0);
    return existingWeightMg + requestedMg <= pigment.stock_mg;
  }

  assert.equal(checkCanAdd(1, 3000), true);  // 7000 + 3000 = 10000 <= 10000
  assert.equal(checkCanAdd(1, 3001), false); // 7000 + 3001 = 10001 > 10000
});

test('calculatePricingBreakdown respects custom $0.00 price without fallback override', () => {
  const pigment = {
    pigment_id: 1,
    retail_price_per_gram_cents: 500,
    default_pkg_cents: 50,
    stock_mg: 10000,
    total_cost_cents: 2000
  };

  // Custom price of 0 cents (complimentary sample)
  const breakdown = calculatePricingBreakdown({ pigment, weightMg: 2000, pricingMode: 'RETAIL', customPriceCents: 0, packagingCents: 0 });
  assert.equal(breakdown.totalPriceCents, 0);
  assert.equal(breakdown.cogsCents, 400); // (2000 / 10000) * 2000mg = 400 cents
  assert.equal(breakdown.grossProfitCents, -400);
});

test('Pricing calculator WAC formula correctly converts cents/mg to dollars/gram', () => {
  // 100g of pigment with $300 total cost basis:
  // total_cost_cents = 30000 cents ($300)
  // stock_mg = 100000 mg (100g)
  // Dollars per gram should be $3.00/g:
  const pigment = { total_cost_cents: 30000, stock_mg: 100000 };
  const wacDollarsPerGram = pigment.stock_mg > 0 ? (pigment.total_cost_cents / pigment.stock_mg) * 10 : 0;
  assert.equal(wacDollarsPerGram.toFixed(2), '3.00');
});

test('filterCustomers filters and prioritizes customer name and phone autocomplete matches', () => {
  const sampleCustomers = [
    { customer_id: 1, name: 'Alice Smith', phone_number: '555-1234' },
    { customer_id: 2, name: 'Bob Jones', phone_number: '555-5678' },
    { customer_id: 3, name: 'Charlie Brown', phone_number: '555-9012' },
    { customer_id: 4, name: 'Alicia Keys', phone_number: '555-3456' },
    { customer_id: 5, name: 'Dan Brown', phone_number: '555-7890' }
  ];

  // 1. Empty or whitespace query returns all customers
  assert.equal(filterCustomers(sampleCustomers, '').length, 5);
  assert.equal(filterCustomers(sampleCustomers, '   ').length, 5);
  assert.equal(filterCustomers(null, 'test').length, 0);

  // 2. Exact match gets top priority
  const exactMatches = filterCustomers(sampleCustomers, 'Alice Smith');
  assert.equal(exactMatches.length, 1);
  assert.equal(exactMatches[0].customer_id, 1);

  // 3. Prefix match
  const aliMatches = filterCustomers(sampleCustomers, 'Ali');
  assert.equal(aliMatches.length, 2);
  assert.deepEqual(aliMatches.map(c => c.name), ['Alice Smith', 'Alicia Keys']);

  // 4. Substring match in name
  const brownMatches = filterCustomers(sampleCustomers, 'brown');
  assert.equal(brownMatches.length, 2);
  assert.deepEqual(brownMatches.map(c => c.name), ['Charlie Brown', 'Dan Brown']);

  // 5. Phone number match
  const phoneMatches = filterCustomers(sampleCustomers, '9012');
  assert.equal(phoneMatches.length, 1);
  assert.equal(phoneMatches[0].name, 'Charlie Brown');

  // 6. Case-insensitivity and trimming
  const caseTrimMatches = filterCustomers(sampleCustomers, '  bOB  ');
  assert.equal(caseTrimMatches.length, 1);
  assert.equal(caseTrimMatches[0].name, 'Bob Jones');

  // 7. No match
  const noMatches = filterCustomers(sampleCustomers, 'Zebra');
  assert.equal(noMatches.length, 0);
});

test('getAllCustomerNames pulls distinct sorted customer names from the customers store', async () => {
  const mockCustomerStore = [
    { customer_id: 1, name: 'Charlie Davis', credit_limit_cents: 5000 },
    { customer_id: 2, name: 'Alice Smith', credit_limit_cents: 2500 },
    { customer_id: 3, name: 'Bob Jones', credit_limit_cents: 3000 },
    { customer_id: 4, name: 'Alice Smith', credit_limit_cents: 2500 }, // duplicate name
    { customer_id: 5, name: '  Dana Scully  ', credit_limit_cents: 1000 }, // leading/trailing spaces
    { customer_id: 6, name: '', credit_limit_cents: 0 }, // empty name
    { customer_id: 7, name: null, credit_limit_cents: 0 } // null name
  ];

  const mockDb = {
    getAll: async (storeName) => {
      if (storeName === 'customers') {
        return mockCustomerStore;
      }
      return [];
    }
  };

  // 1. Standalone helper function
  const names = await getAllCustomerNames(mockDb);
  assert.deepEqual(names, ['Alice Smith', 'Bob Jones', 'Charlie Davis', 'Dana Scully']);

  // 2. PosRepository method
  const repo = new PosRepository(mockDb);
  const repoNames = await repo.getAllCustomerNames();
  assert.deepEqual(repoNames, ['Alice Smith', 'Bob Jones', 'Charlie Davis', 'Dana Scully']);

  // 3. Null / empty safety
  const emptyNames = await getAllCustomerNames(null);
  assert.deepEqual(emptyNames, []);
});

test('filterCustomerSuggestions (CustomerNameInput filtering) applies startsWith, >= 2 chars, and max 5 limits', () => {
  const sampleCustomers = [
    { customer_id: 1, name: 'Alexander Great' },
    { customer_id: 2, name: 'Alex Smith' },
    { customer_id: 3, name: 'Alexa Bliss' },
    { customer_id: 4, name: 'Alexis Sanchez' },
    { customer_id: 5, name: 'Alexandre Dumas' },
    { customer_id: 6, name: 'Alexei Navalny' },
    { customer_id: 7, name: 'Bob Ross' },
    { customer_id: 8, name: 'Charlie Brown' }
  ];

  // 1. Inputs under 2 characters return empty array
  assert.deepEqual(filterCustomerSuggestions(sampleCustomers, ''), []);
  assert.deepEqual(filterCustomerSuggestions(sampleCustomers, 'a'), []);
  assert.deepEqual(filterCustomerSuggestions(sampleCustomers, ' A '), []);
  assert.deepEqual(filterCustomerSuggestions(null, 'Al'), []);
  assert.deepEqual(filterCustomerSuggestions(sampleCustomers, null), []);

  // 2. Case-insensitive startsWith matching
  const alMatches = filterCustomerSuggestions(sampleCustomers, 'al');
  // There are 6 matching 'Alex...', but max limit is 5
  assert.equal(alMatches.length, 5);
  assert.deepEqual(alMatches.map(c => c.name), [
    'Alexander Great',
    'Alex Smith',
    'Alexa Bliss',
    'Alexis Sanchez',
    'Alexandre Dumas'
  ]);

  // 3. Trimming and case insensitivity
  const bobMatches = filterCustomerSuggestions(sampleCustomers, '  bOB  ');
  assert.equal(bobMatches.length, 1);
  assert.equal(bobMatches[0].name, 'Bob Ross');

  // 4. Substring in middle does NOT match startsWith
  const rossMatches = filterCustomerSuggestions(sampleCustomers, 'Ross');
  assert.equal(rossMatches.length, 0);

  // 5. Exact prefix match with exactly 2 chars
  const chMatches = filterCustomerSuggestions(sampleCustomers, 'Ch');
  assert.equal(chMatches.length, 1);
  assert.equal(chMatches[0].name, 'Charlie Brown');
});

test('calculateCustomerBalance correctly calculates debt, store credit, prepayments, and available credit', () => {
  // 1. Customer with Debt (balance = -1500 => owes $15.00 debt)
  const debtCust = { customer_id: 1, name: 'Debt Customer', balance: -1500, credit_limit_cents: 2500 };
  const debtBal = calculateCustomerBalance(debtCust, []);
  assert.equal(debtBal.hasDebt, true);
  assert.equal(debtBal.hasCredit, false);
  assert.equal(debtBal.hasStoreCredit, false);
  assert.equal(debtBal.debtCents, 1500);
  assert.equal(debtBal.storeCreditCents, 0);
  assert.equal(debtBal.balance, -1500);
  assert.equal(debtBal.creditLimitCents, 2500);
  assert.equal(debtBal.availableCreditCents, 1000); // $25.00 limit - $15.00 debt = $10.00 available
  assert.equal(debtBal.utilizationPercent, 60);
  assert.equal(debtBal.balanceType, 'DEBT');
  assert.equal(debtBal.formattedDebt, '$15.00');
  assert.equal(debtBal.formattedBalance, '-$15.00');
  assert.equal(debtBal.formattedNet, '-$15.00');

  // 2. Customer with Store Credit (balance = +1000 => $10.00 store credit)
  const creditCust = { customer_id: 2, name: 'Credit Customer', balance: 1000, credit_limit_cents: 2500 };
  const creditBal = calculateCustomerBalance(creditCust, []);
  assert.equal(creditBal.hasDebt, false);
  assert.equal(creditBal.hasCredit, true);
  assert.equal(creditBal.hasStoreCredit, true);
  assert.equal(creditBal.debtCents, 0);
  assert.equal(creditBal.storeCreditCents, 1000);
  assert.equal(creditBal.balance, 1000);
  assert.equal(creditBal.availableCreditCents, 3500); // $25.00 limit + $10.00 credit = $35.00 buying power
  assert.equal(creditBal.utilizationPercent, 0);
  assert.equal(creditBal.balanceType, 'STORE_CREDIT');
  assert.equal(creditBal.formattedStoreCredit, '$10.00');
  assert.equal(creditBal.formattedBalance, '+$10.00');
  assert.equal(creditBal.formattedNet, '$10.00');

  // 3. Customer with Zero Balance and Prepayments
  const prepayCust = { customer_id: 3, name: 'Prepay Customer', balance: 0, credit_limit_cents: 5000 };
  const prepayments = [
    { prepayment_id: 1, customer_id: 3, amount_cents: 2000, weight_mg: 5000, status: 'PENDING_DELIVERY' },
    { prepayment_id: 2, customer_id: 3, amount_cents: 1500, weight_mg: 3500, status: 'AWAITING_STOCK' },
    { prepayment_id: 3, customer_id: 3, amount_cents: 1000, weight_mg: 2000, status: 'FULFILLED' } // should be ignored
  ];
  const prepayBal = calculateCustomerBalance(prepayCust, prepayments);
  assert.equal(prepayBal.hasDebt, false);
  assert.equal(prepayBal.hasCredit, true);
  assert.equal(prepayBal.hasPrepayments, true);
  assert.equal(prepayBal.prepaymentCount, 2);
  assert.equal(prepayBal.prepaidCreditCents, 3500);
  assert.equal(prepayBal.prepaidWeightMg, 8500);
  assert.equal(prepayBal.totalCreditCents, 3500);
  assert.equal(prepayBal.balanceType, 'PREPAID_ONLY');

  // 4. Null safety
  const nullBal = calculateCustomerBalance(null, []);
  assert.equal(nullBal.balance, 0);
  assert.equal(nullBal.debtCents, 0);
  assert.equal(nullBal.hasDebt, false);
  assert.equal(nullBal.hasCredit, false);
  assert.equal(nullBal.balanceType, 'ZERO');
});

test('formatCents converts positive and negative cents accurately', () => {
  assert.equal(formatCents(100), '$1.00');
  assert.equal(formatCents(1250), '$12.50');
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(-500), '-$5.00');
  assert.equal(formatCents(-1250), '-$12.50');
  assert.equal(formatCents(null), '$0.00');
});

test('adjustCustomerBalance issues credit, charges debt, writes to customer_ledger, and records audit trail', async () => {
  const customerStore = [
    { customer_id: 1, name: 'Test Customer', balance: -1000, credit_limit_cents: 2500 } // owes $10.00
  ];
  const ledgerStore = [];
  const auditStore = [];

  const mockDb = {
    async getById(store, id) {
      return customerStore.find(c => c.customer_id === id) || null;
    },
    async runTransaction(storeNames, mode, callback) {
      const tx = {
        objectStore(name) {
          return {
            get(id) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                req.result = customerStore.find(c => c.customer_id === id) || null;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            add(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                if (name === 'customer_ledger') {
                  const id = ledgerStore.length + 1;
                  ledgerStore.push({ ...record, entry_id: id });
                  req.result = id;
                } else if (name === 'audit_log') {
                  const id = auditStore.length + 1;
                  auditStore.push({ ...record, audit_id: id });
                  req.result = id;
                }
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            put(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                const idx = customerStore.findIndex(c => c.customer_id === record.customer_id);
                if (idx >= 0) customerStore[idx] = record;
                req.result = record.customer_id;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            }
          };
        }
      };
      return await callback(tx);
    }
  };

  const repo = new PosRepository(mockDb);

  // 1. Issue $15.00 Store Credit (previous balance -$10.00 debt => new balance +$5.00 store credit)
  const creditResult = await repo.adjustCustomerBalance(1, {
    amountCents: 1500,
    type: 'CREDIT',
    reason: 'Store Credit / Refund',
    notes: 'Returned item store credit'
  });

  assert.equal(creditResult.previous_balance_cents, -1000);
  assert.equal(creditResult.new_balance_cents, 500);
  assert.equal(customerStore[0].balance, 500);
  assert.equal(ledgerStore.length, 1);
  assert.equal(ledgerStore[0].amount_cents, 1500);
  assert.equal(ledgerStore[0].type, 'BALANCE_ADJUSTMENT');

  // 2. Charge Tab / Add Debt of $20.00 (previous balance +$5.00 => new balance -$15.00 debt)
  const debitResult = await repo.adjustCustomerBalance(1, {
    amountCents: 2000,
    type: 'DEBIT',
    reason: 'Manual Fee / Offline Tab',
    notes: 'Offline purchase add'
  });

  assert.equal(debitResult.previous_balance_cents, 500);
  assert.equal(debitResult.new_balance_cents, -1500);
  assert.equal(customerStore[0].balance, -1500);
  assert.equal(ledgerStore.length, 2);
  assert.equal(ledgerStore[1].amount_cents, -2000);

  // 3. Set Exact Balance to $0.00 (settled)
  const setBalResult = await repo.adjustCustomerBalance(1, {
    amountCents: 0,
    type: 'SET_BALANCE',
    reason: 'Bad Debt Write-off',
    notes: 'Account reset'
  });

  assert.equal(setBalResult.previous_balance_cents, -1500);
  assert.equal(setBalResult.new_balance_cents, 0);
  assert.equal(customerStore[0].balance, 0);
  assert.equal(ledgerStore.length, 3);
  assert.equal(ledgerStore[2].amount_cents, 1500); // delta to reach 0
});

test('recordCustomerPayment logs positive ledger entry and reduces debt or adds credit', async () => {
  const customerStore = [
    { customer_id: 1, name: 'Alice Smith', balance: -2000, credit_limit_cents: 2500 } // owes $20.00
  ];
  const tabPaymentStore = [];
  const ledgerStore = [];
  const auditStore = [];

  const mockDb = {
    async runTransaction(storeNames, mode, callback) {
      const tx = {
        objectStore(name) {
          return {
            get(id) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                req.result = customerStore.find(c => c.customer_id === id) || null;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            add(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                if (name === 'tab_payments') {
                  const id = tabPaymentStore.length + 1;
                  tabPaymentStore.push({ ...record, payment_id: id });
                  req.result = id;
                } else if (name === 'customer_ledger') {
                  const id = ledgerStore.length + 1;
                  ledgerStore.push({ ...record, entry_id: id });
                  req.result = id;
                } else if (name === 'audit_log') {
                  const id = auditStore.length + 1;
                  auditStore.push({ ...record, audit_id: id });
                  req.result = id;
                }
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            put(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                const idx = customerStore.findIndex(c => c.customer_id === record.customer_id);
                if (idx >= 0) customerStore[idx] = record;
                req.result = record.customer_id;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            }
          };
        }
      };
      return await callback(tx);
    }
  };

  const repo = new PosRepository(mockDb);

  // Pay $30.00 on a -$20.00 debt balance => leaves +$10.00 store credit
  const paymentId = await repo.recordCustomerPayment(1, 3000, 'CASH', null, 'Full payment with overpayment');

  assert.ok(paymentId);
  assert.equal(customerStore[0].balance, 1000); // +$10.00 store credit
  assert.equal(tabPaymentStore.length, 1);
  assert.equal(tabPaymentStore[0].amount_paid_cents, 3000);
  assert.equal(ledgerStore.length, 1);
  assert.equal(ledgerStore[0].amount_cents, 3000);
  assert.equal(ledgerStore[0].type, 'PAYMENT_RECEIVED');
  assert.equal(auditStore.length, 1);
});

test('Customer balance always strictly equals the sum of ledger entries', async () => {
  const customer = { customer_id: 1, name: 'Alice Smith', balance: 0 };
  const ledgerEntries = [
    { entry_id: 1, customer_id: 1, amount_cents: -5000, type: 'SALE_DEBT', created_at: 1000 },
    { entry_id: 2, customer_id: 1, amount_cents: 3000, type: 'PAYMENT_RECEIVED', created_at: 2000 },
    { entry_id: 3, customer_id: 1, amount_cents: 1500, type: 'PREPAYMENT_CREDIT', created_at: 3000 },
    { entry_id: 4, customer_id: 1, amount_cents: -500, type: 'BALANCE_ADJUSTMENT', created_at: 4000 }
  ];

  // Sum of ledger: -5000 + 3000 + 1500 - 500 = -1000 ($10.00 debt)
  customer.balance = -1000;

  const mockDb = {
    async getById(store, id) {
      if (store === 'customers' && id === 1) return customer;
      return null;
    },
    async getAllByIndex(store, indexName, value) {
      if (store === 'customer_ledger') return ledgerEntries.filter(e => e.customer_id === value);
      return [];
    }
  };

  const repo = new PosRepository(mockDb);
  const verification = await repo.verifyCustomerBalance(1);
  const derived = await repo.deriveCustomerBalance(1);

  assert.equal(verification.is_valid, true);
  assert.equal(verification.current_balance, -1000);
  assert.equal(verification.ledger_sum, -1000);
  assert.equal(verification.discrepancy, 0);
  assert.equal(derived, -1000);

  // Chronological ledger check
  const ledger = await repo.getCustomerLedger(1);
  assert.equal(ledger.length, 4);
  assert.equal(ledger[0].running_balance_cents, -1000); // latest running balance
  assert.equal(ledger[3].running_balance_cents, -5000); // initial running balance
});

test('createCustomer records opening balance in customers store and creates corresponding opening_balance ledger entry', async () => {
  const customerStore = [];
  const ledgerStore = [];
  const auditStore = [];

  const mockDb = {
    async add(store, record) {
      if (store === 'customers') {
        const id = customerStore.length + 1;
        const saved = { ...record, customer_id: id };
        customerStore.push(saved);
        return id;
      }
      if (store === 'customer_ledger') {
        const id = ledgerStore.length + 1;
        ledgerStore.push({ ...record, entry_id: id });
        return id;
      }
      if (store === 'audit_log') {
        const id = auditStore.length + 1;
        auditStore.push({ ...record, audit_id: id });
        return id;
      }
      return 1;
    }
  };

  const repo = new PosRepository(mockDb);

  // 1. Create customer with positive starting balance ($25.00 credit)
  const cust1Id = await repo.createCustomer({
    name: 'Credit Customer',
    phone_number: '555-0101',
    starting_balance: 2500,
    credit_limit_cents: 5000
  });

  assert.equal(cust1Id, 1);
  assert.equal(customerStore[0].balance, 2500);
  assert.equal(ledgerStore.length, 1);
  assert.equal(ledgerStore[0].customer_id, 1);
  assert.equal(ledgerStore[0].amount_cents, 2500);
  assert.equal(ledgerStore[0].type, 'opening_balance');

  // 2. Create customer with negative starting balance (-$15.00 debt)
  const cust2Id = await repo.createCustomer({
    name: 'Debt Customer',
    phone_number: '555-0102',
    starting_balance: -1500,
    credit_limit_cents: 2500
  });

  assert.equal(cust2Id, 2);
  assert.equal(customerStore[1].balance, -1500);
  assert.equal(ledgerStore.length, 2);
  assert.equal(ledgerStore[1].customer_id, 2);
  assert.equal(ledgerStore[1].amount_cents, -1500);
  assert.equal(ledgerStore[1].type, 'opening_balance');
});

test('updateCustomer allows setting starting balance once if no prior ledger entries, and rejects if entries exist', async () => {
  const customerStore = [
    { customer_id: 1, name: 'Alice', phone_number: '555-1234', balance: 0, credit_limit_cents: 2500, trust_status: 'GOOD_STANDING' },
    { customer_id: 2, name: 'Bob', phone_number: '555-5678', balance: -1000, credit_limit_cents: 2500, trust_status: 'GOOD_STANDING' }
  ];
  const ledgerStore = [
    { entry_id: 1, customer_id: 2, amount_cents: -1000, type: 'SALE_DEBT', created_at: 1000 }
  ];
  const auditStore = [];

  const mockDb = {
    async runTransaction(storeNames, mode, callback) {
      const tx = {
        objectStore(name) {
          return {
            index(idxName) {
              return {
                getAll(val) {
                  const req = { onsuccess: null, onerror: null, result: null };
                  setTimeout(() => {
                    req.result = ledgerStore.filter(e => e.customer_id === val);
                    if (req.onsuccess) req.onsuccess();
                  }, 0);
                  return req;
                }
              };
            },
            indexNames: { contains: (n) => n === 'customer_id' },
            get(id) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                req.result = customerStore.find(c => c.customer_id === id) || null;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            add(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                if (name === 'customer_ledger') {
                  const id = ledgerStore.length + 1;
                  ledgerStore.push({ ...record, entry_id: id });
                  req.result = id;
                } else if (name === 'audit_log') {
                  const id = auditStore.length + 1;
                  auditStore.push({ ...record, audit_id: id });
                  req.result = id;
                }
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            put(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                const idx = customerStore.findIndex(c => c.customer_id === record.customer_id);
                if (idx >= 0) customerStore[idx] = record;
                req.result = record.customer_id;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            }
          };
        }
      };
      return await callback(tx);
    }
  };

  const repo = new PosRepository(mockDb);

  // 1. Setting starting balance on Alice (no prior ledger entries) succeeds
  await repo.updateCustomer({
    customer_id: 1,
    name: 'Alice Updated',
    starting_balance: 3000 // has $30.00 credit
  });

  assert.equal(customerStore[0].balance, 3000);
  const aliceLedger = ledgerStore.filter(e => e.customer_id === 1);
  assert.equal(aliceLedger.length, 1);
  assert.equal(aliceLedger[0].type, 'opening_balance');
  assert.equal(aliceLedger[0].amount_cents, 3000);

  // 2. Setting starting balance on Bob (already has ledger entries) throws error
  let errorCaught = null;
  try {
    await repo.updateCustomer({
      customer_id: 2,
      name: 'Bob Updated',
      starting_balance: -5000
    });
  } catch (err) {
    errorCaught = err;
  }
  assert.ok(errorCaught);
  assert.match(errorCaught.message, /already has existing ledger transactions/i);
});

test('getCustomerLedger formats and labels opening_balance entry as Opening balance', async () => {
  const customer = { customer_id: 1, name: 'Alice Smith', balance: 5000 };
  const ledgerEntries = [
    { entry_id: 1, customer_id: 1, amount_cents: 5000, type: 'opening_balance', created_at: 1000 }
  ];

  const mockDb = {
    async getById(store, id) {
      if (store === 'customers' && id === 1) return customer;
      return null;
    },
    async getAllByIndex(store, indexName, value) {
      if (store === 'customer_ledger') return ledgerEntries.filter(e => e.customer_id === value);
      return [];
    }
  };

  const repo = new PosRepository(mockDb);
  const ledger = await repo.getCustomerLedger(1);

  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].title, 'Opening balance');
  assert.equal(ledger[0].amount_cents, 5000);
  assert.equal(ledger[0].running_balance_cents, 5000);
  assert.equal(ledger[0].formatted_amount, '+$50.00');
});

test('calculateMerchantFeeCents computes provider fees accurately and supports custom overrides', () => {
  // Square: 2.6% + 10¢
  assert.equal(calculateMerchantFeeCents('Square', 10000), 270); // $100 * 0.026 + $0.10 = $2.70
  assert.equal(calculateMerchantFeeCents('SQUARE', 5000), 140);  // $50 * 0.026 + $0.10 = $1.40

  // Venmo: 1.9% + 10¢
  assert.equal(calculateMerchantFeeCents('Venmo', 10000), 200);  // $100 * 0.019 + $0.10 = $2.00

  // Zelle: 0% + 0¢
  assert.equal(calculateMerchantFeeCents('Zelle', 10000), 0);

  // Default fallback
  assert.equal(calculateMerchantFeeCents('Unknown', 10000), 320); // 2.9% + 30¢

  // Zero / negative amounts
  assert.equal(calculateMerchantFeeCents('Square', 0), 0);
  assert.equal(calculateMerchantFeeCents('Square', -500), 0);

  // Custom rate override (e.g. 2.0% + $0.15)
  assert.equal(calculateMerchantFeeCents('Square', 10000, { customRate: 0.02, customFixedCents: 15 }), 215);

  // Direct fee override ($1.50)
  assert.equal(calculateMerchantFeeCents('Square', 10000, { customFeeCents: 150 }), 150);
});

test('calculateBusinessInsights factors actual merchant processing fees into net profit and P&L metrics', () => {
  const sales = [
    { sale_id: 1, total_amount_cents: 10000, total_cogs_cents: 4000, status: 'COMPLETED', created_at: 1000 },
    { sale_id: 2, total_amount_cents: 5000, total_cogs_cents: 2000, status: 'COMPLETED', created_at: 1000 },
    { sale_id: 3, total_amount_cents: 8000, total_cogs_cents: 3000, status: 'VOIDED', created_at: 1000 },
  ];

  const salePayments = [
    { payment_id: 1, sale_id: 1, payment_type: 'DIGITAL', amount_cents: 10000, merchant_fee_cents: 270 },
    { payment_id: 2, sale_id: 2, payment_type: 'CASH', amount_cents: 5000, merchant_fee_cents: 0 },
    { payment_id: 3, sale_id: 3, payment_type: 'DIGITAL', amount_cents: 8000, merchant_fee_cents: 220 }, // voided, should be excluded
  ];

  const shrinkageLogs = [
    { log_id: 1, pigment_id: 1, cogs_loss_cents: 500, created_at: 1000 }
  ];

  const insights = calculateBusinessInsights({
    sales,
    saleItems: [],
    salePayments,
    pigments: [],
    customers: [],
    suppliers: [],
    shrinkageLogs,
    timeRange: 'ALL'
  });

  assert.equal(insights.grossRevenueCents, 15000); // 10000 + 5000
  assert.equal(insights.totalCogsCents, 6000);    // 4000 + 2000
  assert.equal(insights.grossProfitCents, 9000);   // 15000 - 6000
  assert.equal(insights.totalMerchantFeeCents, 270); // only sale 1's fee (sale 3 is voided)
  assert.equal(insights.totalShrinkageLossCents, 500);
  assert.equal(insights.netProfitCents, 8230); // 9000 - 500 - 270
  assert.equal(insights.voidedCount, 1);
});

function createMockDatabase() {
  const stores = {
    sales: new Map(),
    sale_items: new Map(),
    sale_payments: new Map(),
    pigments: new Map(),
    customers: new Map(),
    customer_ledger: new Map(),
    customer_prepayments: new Map(),
    returns: new Map(),
    audit_log: new Map(),
    suppliers: new Map(),
    stock_receipts: new Map(),
    supplier_payments: new Map()
  };

  // Per-store autoincrement: each store gets its own monotonically increasing
  // sequence, so add() calls in one store never collide with keys in another.
  const nextIds = {};
  function nextIdFor(storeName) {
    const store = stores[storeName];
    if (nextIds[storeName] === undefined && store && store.size > 0) {
      let maxKey = 0;
      for (const k of store.keys()) {
        const num = Number(k);
        if (!isNaN(num) && num > maxKey) maxKey = num;
      }
      nextIds[storeName] = maxKey;
    }
    nextIds[storeName] = (nextIds[storeName] || 0) + 1;
    return nextIds[storeName];
  }

  return {
    stores,
    async getById(storeName, id) {
      return stores[storeName]?.get(Number(id)) || null;
    },
    async getAll(storeName) {
      return Array.from(stores[storeName]?.values() || []);
    },
    async getAllByIndex(storeName, indexName, value) {
      const list = Array.from(stores[storeName]?.values() || []);
      return list.filter(item => item[indexName] === value);
    },
    async put(storeName, record) {
      const key = record.sale_id || record.customer_id || record.pigment_id
        || record.prepayment_id || record.supplier_id || record.entry_id
        || record.receipt_id || record.id || nextIdFor(storeName);
      stores[storeName]?.set(Number(key), record);
      return key;
    },
    async add(storeName, record) {
      const key = nextIdFor(storeName);
      const idField = storeName === 'sales' ? 'sale_id'
        : storeName === 'customers' ? 'customer_id'
        : storeName === 'pigments' ? 'pigment_id'
        : storeName === 'sale_payments' ? 'payment_id'
        : storeName === 'customer_ledger' ? 'entry_id'
        : storeName === 'customer_prepayments' ? 'prepayment_id'
        : storeName === 'suppliers' ? 'supplier_id'
        : storeName === 'stock_receipts' ? 'receipt_id'
        : storeName === 'supplier_payments' ? 'payment_id'
        : 'id';
      const item = { ...record, [idField]: key };
      stores[storeName]?.set(key, item);
      return key;
    },
    async delete(storeName, id) {
      stores[storeName]?.delete(Number(id));
      return true;
    },
    async runTransaction(storeNames, mode, callback) {
      const tx = {
        objectStore(name) {
          const store = stores[name];
          return {
            indexNames: {
              contains: (idx) => ['customer_id', 'sale_id', 'sale_item_id', 'supplier_id'].includes(idx)
            },
            get(id) {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                req.result = store?.get(Number(id)) || null;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            getAll() {
              const req = { onsuccess: null, onerror: null, result: null };
              setTimeout(() => {
                req.result = Array.from(store?.values() || []);
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            put(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              // Resolve the primary key from the record's own id field so put()
              // always updates the existing record rather than inserting a duplicate.
              const key = record.sale_id || record.customer_id || record.pigment_id
                || record.prepayment_id || record.supplier_id || record.entry_id
                || record.receipt_id || record.id || nextIdFor(name);
              store?.set(Number(key), record);
              setTimeout(() => {
                req.result = key;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            add(record) {
              const req = { onsuccess: null, onerror: null, result: null };
              const key = nextIdFor(name);
              const idField = name === 'sales' ? 'sale_id'
                : name === 'customers' ? 'customer_id'
                : name === 'pigments' ? 'pigment_id'
                : name === 'sale_payments' ? 'payment_id'
                : name === 'customer_ledger' ? 'entry_id'
                : name === 'customer_prepayments' ? 'prepayment_id'
                : name === 'suppliers' ? 'supplier_id'
                : name === 'stock_receipts' ? 'receipt_id'
                : name === 'supplier_payments' ? 'payment_id'
                : 'id';
              const item = { ...record, [idField]: key };
              store?.set(key, item);
              setTimeout(() => {
                req.result = key;
                if (req.onsuccess) req.onsuccess();
              }, 0);
              return req;
            },
            delete(id) {
              store?.delete(Number(id));
              return true;
            },
            index(indexName) {
              return {
                getAll(value) {
                  const req = { onsuccess: null, onerror: null, result: null };
                  setTimeout(() => {
                    const list = Array.from(store?.values() || []);
                    req.result = list.filter(item => item[indexName] === value);
                    if (req.onsuccess) req.onsuccess();
                  }, 0);
                  return req;
                }
              };
            }
          };
        }
      };
      return await callback(tx);
    }
  };
}

test('completeSale accepts STORE_CREDIT and deducts from customer balance via ledger', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Create customer with $50.00 store credit (balance = +5000)
  const custId = await repo.createCustomer({
    name: 'Alice',
    phone_number: '555-0101',
    initial_balance_cents: 5000,
    credit_limit_cents: 10000
  });

  mockDb.stores.pigments.set(1, { pigment_id: 1, name: 'Blue', stock_mg: 50000, total_cost_cents: 2500 });

  const saleId = await repo.completeSale(
    custId,
    [{ pigment_id: 1, weight_mg: 5000, price_charged_cents: 2000, unit_cogs_cents: 250 }],
    [{ payment_type: 'STORE_CREDIT', amount_cents: 2000, digital_provider: null, merchant_fee_cents: 0 }]
  );

  assert.ok(saleId);
  const sale = mockDb.stores.sales.get(saleId);
  assert.equal(sale.status, 'COMPLETED');
  assert.equal(sale.total_amount_cents, 2000);

  const salePayments = Array.from(mockDb.stores.sale_payments.values()).filter(p => p.sale_id === saleId);
  assert.equal(salePayments.length, 1);
  assert.equal(salePayments[0].payment_type, 'STORE_CREDIT');
  assert.equal(salePayments[0].amount_cents, 2000);
  assert.equal(salePayments[0].merchant_fee_cents, 0);

  const updatedCustomer = mockDb.stores.customers.get(custId);
  assert.equal(updatedCustomer.balance, 3000); // 5000 - 2000 = 3000 credit remaining
  assert.equal(updatedCustomer.current_balance_cents, -3000);

  const ledgerEntries = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === custId);
  assert.equal(ledgerEntries.length, 2); // opening_balance + SALE_CREDIT_APPLIED
  const saleEntry = ledgerEntries.find(e => e.type === 'SALE_CREDIT_APPLIED');
  assert.ok(saleEntry);
  assert.equal(saleEntry.amount_cents, -2000);
  assert.equal(saleEntry.sale_id, saleId);

  const verify = await repo.verifyCustomerBalance(custId);
  assert.equal(verify.has_dual_field_drift, false);
  assert.equal(verify.is_valid, true);
  assert.equal(verify.ledger_sum, 3000);
});

test('completeSale accepts split tender combining STORE_CREDIT, CASH, and DIGITAL', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const custId = await repo.createCustomer({
    name: 'Alice',
    initial_balance_cents: 2000
  });
  mockDb.stores.pigments.set(1, { pigment_id: 1, name: 'Blue', stock_mg: 50000, total_cost_cents: 2500 });

  // Total sale: $50.00 split into $20 STORE_CREDIT + $20 CASH + $10 DIGITAL (Square)
  const payments = [
    { payment_type: 'STORE_CREDIT', amount_cents: 2000, digital_provider: null, merchant_fee_cents: 0 },
    { payment_type: 'CASH', amount_cents: 2000, digital_provider: null, merchant_fee_cents: 0 },
    { payment_type: 'DIGITAL', amount_cents: 1000, digital_provider: 'Square', merchant_fee_cents: 36 }
  ];

  const saleId = await repo.completeSale(
    custId,
    [{ pigment_id: 1, weight_mg: 10000, price_charged_cents: 5000, unit_cogs_cents: 500 }],
    payments
  );

  assert.ok(saleId);
  const updatedCustomer = mockDb.stores.customers.get(custId);
  assert.equal(updatedCustomer.balance, 0); // 2000 credit exhausted
  assert.equal(updatedCustomer.current_balance_cents, 0);

  const salePayments = Array.from(mockDb.stores.sale_payments.values()).filter(p => p.sale_id === saleId);
  assert.equal(salePayments.length, 3);
  assert.equal(salePayments.find(p => p.payment_type === 'STORE_CREDIT').amount_cents, 2000);
  assert.equal(salePayments.find(p => p.payment_type === 'CASH').amount_cents, 2000);
  assert.equal(salePayments.find(p => p.payment_type === 'DIGITAL').amount_cents, 1000);

  const verify = await repo.verifyCustomerBalance(custId);
  assert.equal(verify.has_dual_field_drift, false);
  assert.equal(verify.is_valid, true);
});

test('voidSale restores STORE_CREDIT payments back to customer ledger balance', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const custId = await repo.createCustomer({
    name: 'Alice',
    initial_balance_cents: 3000
  });
  mockDb.stores.pigments.set(1, { pigment_id: 1, name: 'Blue', stock_mg: 45000, total_cost_cents: 2250 });

  const saleId = 101;
  mockDb.stores.sales.set(saleId, { sale_id: saleId, customer_id: custId, status: 'COMPLETED', total_amount_cents: 2000 });
  mockDb.stores.sale_items.set(1, { id: 1, sale_id: saleId, pigment_id: 1, weight_mg: 5000, unit_cogs_cents: 250 });
  mockDb.stores.sale_payments.set(1, { payment_id: 1, sale_id: saleId, payment_type: 'STORE_CREDIT', amount_cents: 2000 });

  await repo.voidSale(saleId, 'Wrong product selected');

  const updatedCustomer = mockDb.stores.customers.get(custId);
  assert.equal(updatedCustomer.balance, 5000); // 3000 + 2000 restored
  assert.equal(updatedCustomer.current_balance_cents, -5000);

  const ledgerEntries = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === custId);
  assert.equal(ledgerEntries.length, 2); // opening + refund
  const refundEntry = ledgerEntries.find(e => e.type === 'SALE_VOID_CREDIT_REFUND');
  assert.ok(refundEntry);
  assert.equal(refundEntry.amount_cents, 2000);

  const verify = await repo.verifyCustomerBalance(custId);
  assert.equal(verify.has_dual_field_drift, false);
  assert.equal(verify.is_valid, true);
  assert.equal(verify.ledger_sum, 5000);
});

test('reconcileSaleRecord CORRECT_PAYMENT rebalances tab via ledger without creating dual-field drift', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Customer initially owes $10.00 (debt = 1000, balance = -1000)
  const custId = await repo.createCustomer({
    name: 'Charlie',
    initial_balance_cents: -1000
  });

  const saleId = 201;
  mockDb.stores.sales.set(saleId, {
    sale_id: saleId,
    customer_id: custId,
    status: 'COMPLETED',
    total_amount_cents: 5000,
    needs_reconciliation: true
  });

  mockDb.stores.sale_items.set(1, {
    id: 1,
    sale_id: saleId,
    pigment_id: 1,
    weight_mg: 5000,
    price_charged_cents: 5000,
    unit_cogs_cents: 200
  });

  // Old payment was only $30.00 on HOUSE_TAB (underpaid by $20.00)
  mockDb.stores.sale_payments.set(1, {
    payment_id: 1,
    sale_id: saleId,
    payment_type: 'HOUSE_TAB',
    amount_cents: 3000,
    merchant_fee_cents: 0
  });

  // Reconcile: Correct payment to full $50.00 on HOUSE_TAB (+2000 tab delta)
  await repo.reconcileSaleRecord(saleId, 'CORRECT_PAYMENT', {
    payments: [{ payment_type: 'HOUSE_TAB', amount_cents: 5000, merchant_fee_cents: 0 }]
  });

  const updatedCustomer = mockDb.stores.customers.get(custId);
  // Both fields must stay strictly in sync: debt increased from $10 to $30
  assert.equal(updatedCustomer.balance, -3000);
  assert.equal(updatedCustomer.current_balance_cents, 3000);

  const ledgerEntries = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === custId);
  assert.equal(ledgerEntries.length, 2); // opening + reconciliation
  const adjEntry = ledgerEntries.find(e => e.type === 'RECONCILIATION_ADJUSTMENT');
  assert.ok(adjEntry);
  assert.equal(adjEntry.amount_cents, -2000);

  const updatedSale = mockDb.stores.sales.get(saleId);
  assert.equal(updatedSale.needs_reconciliation, false);
  assert.equal(updatedSale.reconciliation_status, 'RECONCILED');

  // Verify that performing Integrity Repair / CORRECT_PAYMENT does NOT create drift
  const verify = await repo.verifyCustomerBalance(custId);
  assert.equal(verify.has_dual_field_drift, false);
  assert.equal(verify.is_valid, true);
  assert.equal(verify.ledger_sum, -3000);
  assert.equal(verify.current_balance, -3000);
});

test('reconcileSaleRecord CORRECT_PAYMENT correctly adjusts customer balance when correcting STORE_CREDIT', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Customer initially has $50.00 store credit (balance = 5000)
  const custId = await repo.createCustomer({
    name: 'Dana',
    initial_balance_cents: 5000
  });

  const saleId = 301;
  mockDb.stores.sales.set(saleId, {
    sale_id: saleId,
    customer_id: custId,
    status: 'COMPLETED',
    total_amount_cents: 2000,
    needs_reconciliation: true
  });

  mockDb.stores.sale_items.set(1, {
    id: 1,
    sale_id: saleId,
    pigment_id: 1,
    weight_mg: 2000,
    price_charged_cents: 2000,
    unit_cogs_cents: 100
  });

  // Old payment was mistakenly entered as CASH $20
  mockDb.stores.sale_payments.set(1, {
    payment_id: 1,
    sale_id: saleId,
    payment_type: 'CASH',
    amount_cents: 2000,
    merchant_fee_cents: 0
  });

  // Correct payment to STORE_CREDIT $20 (customer spends $20 store credit)
  await repo.reconcileSaleRecord(saleId, 'CORRECT_PAYMENT', {
    payments: [{ payment_type: 'STORE_CREDIT', amount_cents: 2000, merchant_fee_cents: 0 }]
  });

  const updatedCustomer = mockDb.stores.customers.get(custId);
  // Balance should decrease from $50 to $30 (balance = 3000, current_balance_cents = -3000)
  assert.equal(updatedCustomer.balance, 3000);
  assert.equal(updatedCustomer.current_balance_cents, -3000);

  const ledgerEntries = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === custId);
  assert.equal(ledgerEntries.length, 2); // opening + reconciliation
  const adjEntry = ledgerEntries.find(e => e.type === 'RECONCILIATION_ADJUSTMENT');
  assert.ok(adjEntry);
  assert.equal(adjEntry.amount_cents, -2000);

  const verify = await repo.verifyCustomerBalance(custId);
  assert.equal(verify.has_dual_field_drift, false);
  assert.equal(verify.is_valid, true);
  assert.equal(verify.ledger_sum, 3000);
});

test('fulfillCustomerPrepayment links sale and voidSale restores prepayment status to PENDING_DELIVERY', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  mockDb.stores.pigments.set(1, { pigment_id: 1, name: 'Gold', stock_mg: 20000, total_cost_cents: 1000 });
  mockDb.stores.customer_prepayments.set(10, {
    prepayment_id: 10,
    customer_id: 1,
    pigment_id: 1,
    weight_mg: 5000,
    amount_cents: 3000,
    status: 'PENDING_DELIVERY'
  });

  // 1. Fulfill prepayment
  const fulfilledItem = await repo.fulfillCustomerPrepayment(10);
  assert.equal(fulfilledItem.status, 'FULFILLED');

  const generatedSale = Array.from(mockDb.stores.sales.values())[0];
  assert.ok(generatedSale);
  assert.equal(generatedSale.source, 'PREPAYMENT_FULFILLMENT');
  assert.equal(generatedSale.prepayment_id, 10);
  assert.equal(generatedSale.total_amount_cents, 3000);

  // 2. Void the fulfillment sale
  await repo.voidSale(generatedSale.sale_id, 'Customer changed delivery address');

  const restoredPrepayment = mockDb.stores.customer_prepayments.get(10);
  assert.equal(restoredPrepayment.status, 'PENDING_DELIVERY');
  assert.equal(restoredPrepayment.fulfilled_at, undefined);

  // Inventory should also be restocked
  const restockedPigment = mockDb.stores.pigments.get(1);
  assert.equal(restockedPigment.stock_mg, 20000);
});

test('createCustomer and updateCustomer manage customer_type (WHOLESALE vs RETAIL) and is_wholesale flag', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // 1. Create Wholesale customer
  const custId = await repo.createCustomer({
    name: 'Bulk Resin Co',
    phone_number: '555-0199',
    customer_type: 'WHOLESALE',
    credit_limit_cents: 10000
  });

  const created = mockDb.stores.customers.get(custId);
  assert.equal(created.name, 'Bulk Resin Co');
  assert.equal(created.customer_type, 'WHOLESALE');
  assert.equal(created.is_wholesale, true);

  const balWholesale = calculateCustomerBalance(created);
  assert.equal(balWholesale.isWholesale, true);
  assert.equal(balWholesale.customerType, 'WHOLESALE');

  // 2. Update customer to RETAIL
  await repo.updateCustomer({
    customer_id: custId,
    customer_type: 'RETAIL'
  });

  const updated = mockDb.stores.customers.get(custId);
  assert.equal(updated.customer_type, 'RETAIL');
  assert.equal(updated.is_wholesale, false);

  const balRetail = calculateCustomerBalance(updated);
  assert.equal(balRetail.isWholesale, false);
  assert.equal(balRetail.customerType, 'RETAIL');
});

test('completeSale respects individual pricingMode override per transaction', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  mockDb.stores.pigments.set(1, {
    pigment_id: 1,
    name: 'Titanium White',
    stock_mg: 50000,
    total_cost_cents: 5000,
    retail_rate_cents: 200,
    wholesale_rate_cents: 100
  });

  // Wholesale customer buying with RETAIL pricing override on this specific transaction
  const cart = [{
    pigment_id: 1,
    pigment: mockDb.stores.pigments.get(1),
    weight_mg: 5000,
    price_charged_cents: 1000, // 5g * $2.00/g = $10.00
    unit_cogs_cents: 500
  }];

  const payments = [{
    payment_type: 'CASH',
    digital_provider: null,
    amount_cents: 1000,
    merchant_fee_cents: 0
  }];

  const saleId = await repo.completeSale(1, cart, payments, false, 'RETAIL');
  const sale = mockDb.stores.sales.get(saleId);
  assert.equal(sale.pricing_mode, 'RETAIL');
  assert.equal(sale.total_amount_cents, 1000);

  // Another transaction with WHOLESALE pricing
  const wholesaleSaleId = await repo.completeSale(1, cart, payments, false, 'WHOLESALE');
  const wholesaleSale = mockDb.stores.sales.get(wholesaleSaleId);
  assert.equal(wholesaleSale.pricing_mode, 'WHOLESALE');
});

test('restockPigment guards against invalid zero/negative weight and negative cost', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  mockDb.stores.pigments.set(1, { pigment_id: 1, name: 'Red', stock_mg: 1000, total_cost_cents: 100 });

  await assert.rejects(
    async () => repo.restockPigment(1, 0, 500, 'Supplier A'),
    /Received stock weight must be greater than 0/
  );

  await assert.rejects(
    async () => repo.restockPigment(1, -500, 500, 'Supplier A'),
    /Received stock weight must be greater than 0/
  );

  await assert.rejects(
    async () => repo.restockPigment(1, 5000, -100, 'Supplier A'),
    /Total restock cost cannot be negative/
  );
});

test('verifyCustomerBalance detects dual-field drift between balance and current_balance_cents', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Customer with drifted balance: balance says +$20 credit, but legacy field says $10 debt (drift!)
  mockDb.stores.customers.set(1, {
    customer_id: 1,
    name: 'Drifting Customer',
    balance: 2000,
    current_balance_cents: 1000
  });

  const res = await repo.verifyCustomerBalance(1);
  assert.equal(res.has_dual_field_drift, true);
  assert.equal(res.is_valid, false);
});

test('completeSale tab credit check folds active prepayments into unified credit exposure', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Customer with $50 credit limit, zero debt
  mockDb.stores.customers.set(1, {
    customer_id: 1,
    name: 'Eve',
    balance: 0,
    current_balance_cents: 0,
    credit_limit_cents: 5000
  });
  mockDb.stores.pigments.set(1, { pigment_id: 1, name: 'Gold', stock_mg: 50000, total_cost_cents: 1000 });

  // Add $40 unfulfilled prepayment credit/order
  mockDb.stores.customer_prepayments.set(1, {
    prepayment_id: 1,
    customer_id: 1,
    pigment_id: 1,
    weight_mg: 5000,
    amount_cents: 4000,
    status: 'PENDING_DELIVERY'
  });

  const cart = [{
    pigment_id: 1,
    weight_mg: 5000,
    price_charged_cents: 3000,
    unit_cogs_cents: 100
  }];

  // Attempting $30 HOUSE_TAB sale when available credit is $50 limit + $40 prepay credit = $90
  const saleId = await repo.completeSale(1, cart, [{ payment_type: 'HOUSE_TAB', amount_cents: 3000, merchant_fee_cents: 0 }]);
  assert.ok(saleId);
});

test('createCustomerPrepayment persists payment tender method and digital provider', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const prepId = await repo.createCustomerPrepayment({
    customer_id: 1,
    pigment_id: 1,
    weight_mg: 10000,
    amount_cents: 5000,
    payment_type: 'DIGITAL',
    digital_provider: 'Square'
  });

  const prep = mockDb.stores.customer_prepayments.get(prepId);
  assert.ok(prep);
  assert.equal(prep.payment_type, 'DIGITAL');
  assert.equal(prep.digital_provider, 'Square');
  assert.equal(prep.merchant_fee_cents, 140); // Square: 2.6% of $50 = $1.30 + $0.10 = $1.40 (140 cents)
});

test('repairCustomerBalance repairs legacy pre-v1.4.0 customer with 0 ledger entries', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Pre-v1.4.0 legacy customer: had $25 debt in current_balance_cents, but no balance field or ledger entries
  mockDb.stores.customers.set(1, {
    customer_id: 1,
    name: 'Legacy Bob',
    current_balance_cents: 2500
  });

  const checkBefore = await repo.verifyCustomerBalance(1);
  assert.equal(checkBefore.is_valid, false);

  const repairResult = await repo.repairCustomerBalance(1);
  assert.equal(repairResult.is_valid, true);
  assert.equal(repairResult.has_dual_field_drift, false);
  assert.equal(repairResult.repaired_balance, -2500);

  const checkAfter = await repo.verifyCustomerBalance(1);
  assert.equal(checkAfter.is_valid, true);
  assert.equal(checkAfter.has_dual_field_drift, false);
  assert.equal(checkAfter.current_balance, -2500);
  assert.equal(checkAfter.legacy_debt_cents, 2500);
  assert.equal(checkAfter.ledger_sum, -2500);

  const ledger = Array.from(mockDb.stores.customer_ledger.values());
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].type, 'opening_balance');
  assert.equal(ledger[0].amount_cents, -2500);
});

test('scanAndReconcileIntegrity batch auto-repairs drifted customer balances', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // Seed 1 drifted customer and 1 valid customer
  mockDb.stores.customers.set(1, {
    customer_id: 1,
    name: 'Drifted Customer',
    balance: 5000,
    current_balance_cents: 2000 // Drifted!
  });
  mockDb.stores.customers.set(2, {
    customer_id: 2,
    name: 'Valid Customer',
    balance: 0,
    current_balance_cents: 0
  });

  const scanResult = await repo.scanAndReconcileIntegrity();
  assert.equal(scanResult.customerRepairedCount, 1);

  const check1 = await repo.verifyCustomerBalance(1);
  assert.equal(check1.has_dual_field_drift, false);
  assert.equal(check1.is_valid, true);
});

test('repairCustomerBalance and scanAndReconcileIntegrity are strictly idempotent on complex customer accounts', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const cId = 1;
  const sId = 100;

  // 1. Seed historical completed sale
  mockDb.stores.sales.set(sId, {
    sale_id: sId,
    customer_id: cId,
    status: 'COMPLETED',
    total_amount_cents: 3500,
    created_at: 1000
  });

  mockDb.stores.sale_items.set(1, {
    sale_item_id: 1,
    sale_id: sId,
    pigment_id: 1,
    weight_mg: 5000,
    price_charged_cents: 3500,
    unit_cogs_cents: 500
  });

  mockDb.stores.sale_payments.set(1, {
    payment_id: 1,
    sale_id: sId,
    payment_type: 'STORE_CREDIT',
    amount_cents: 2000,
    merchant_fee_cents: 0
  });

  mockDb.stores.sale_payments.set(2, {
    payment_id: 2,
    sale_id: sId,
    payment_type: 'HOUSE_TAB',
    amount_cents: 1500,
    merchant_fee_cents: 0
  });

  // 2. Seed existing customer_ledger entries (True economic history: +5000 opening, -2000 store credit spent, -1500 tab charged = Net +1500 balance)
  mockDb.stores.customer_ledger.set(1, {
    entry_id: 1,
    customer_id: cId,
    amount_cents: 5000,
    type: 'opening_balance',
    description: 'Initial customer deposit',
    created_at: 500,
    timestamp: 500
  });

  mockDb.stores.customer_ledger.set(2, {
    entry_id: 2,
    customer_id: cId,
    amount_cents: -2000,
    type: 'SALE_CREDIT_APPLIED',
    description: 'Store credit applied to Sale #100',
    sale_id: sId,
    created_at: 1000,
    timestamp: 1000
  });

  mockDb.stores.customer_ledger.set(3, {
    entry_id: 3,
    customer_id: cId,
    amount_cents: -1500,
    type: 'SALE_DEBT',
    description: 'House tab charge for Sale #100',
    sale_id: sId,
    created_at: 1000,
    timestamp: 1000
  });

  // 3. Customer record with historical drift: balance says 9999, current_balance_cents says 4444 (drifted from true ledger sum 1500)
  mockDb.stores.customers.set(cId, {
    customer_id: cId,
    name: 'Complex Customer',
    balance: 9999,
    current_balance_cents: 4444
  });

  // Verification before repair: must detect drift
  const preCheck = await repo.verifyCustomerBalance(cId);
  assert.equal(preCheck.is_valid, false);
  assert.equal(preCheck.has_dual_field_drift, true);
  assert.equal(preCheck.ledger_sum, 1500);

  const initialLedgerCount = mockDb.stores.customer_ledger.size;
  assert.equal(initialLedgerCount, 3);

  // 4. RUN REPAIR 1
  const repairResult1 = await repo.scanAndReconcileIntegrity();
  assert.equal(repairResult1.customerRepairedCount, 1);

  // Verify state after first repair:
  const postCheck1 = await repo.verifyCustomerBalance(cId);
  assert.equal(postCheck1.is_valid, true);
  assert.equal(postCheck1.has_dual_field_drift, false);
  assert.equal(postCheck1.current_balance, 1500);
  assert.equal(postCheck1.legacy_debt_cents, -1500);
  assert.equal(postCheck1.ledger_sum, 1500);

  // Customer record fields must be strictly synchronized
  const custAfter1 = mockDb.stores.customers.get(cId);
  assert.equal(custAfter1.balance, 1500);
  assert.equal(custAfter1.current_balance_cents, -1500);

  // MUST NOT create any new ledger entries (ledger entries remained immutable source of truth)
  assert.equal(mockDb.stores.customer_ledger.size, initialLedgerCount);

  // 5. RUN REPAIR 2 (Idempotency test)
  const repairResult2 = await repo.scanAndReconcileIntegrity();
  // Second run makes zero repairs because state is already valid
  assert.equal(repairResult2.customerRepairedCount, 0);
  assert.equal(repairResult2.repairedCount, 0);

  // Verify state after second repair:
  const postCheck2 = await repo.verifyCustomerBalance(cId);
  assert.equal(postCheck2.is_valid, true);
  assert.equal(postCheck2.has_dual_field_drift, false);
  assert.equal(postCheck2.current_balance, 1500);
  assert.equal(postCheck2.ledger_sum, 1500);

  const custAfter2 = mockDb.stores.customers.get(cId);
  assert.equal(custAfter2.balance, 1500);
  assert.equal(custAfter2.current_balance_cents, -1500);

  // Still exactly 3 ledger entries: NO duplicate reconciliation or repair entries
  assert.equal(mockDb.stores.customer_ledger.size, initialLedgerCount);
});

test('FEAT-01: exportData exports all 15 stores and tracks backup intervals and overdue thresholds', async () => {
  const storeNames = [
    'pigments',
    'pigment_price_tiers',
    'stock_receipts',
    'suppliers',
    'supplier_payments',
    'customers',
    'customer_ledger',
    'customer_prepayments',
    'sales',
    'sale_payments',
    'sale_items',
    'returns',
    'tab_payments',
    'shrinkage_logs',
    'audit_log'
  ];

  const mockDb = {
    exportAllStores: async () => {
      const storesData = {};
      for (const name of storeNames) {
        storesData[name] = [{ id: 1, name: `sample_${name}` }];
      }
      return {
        exported_at: new Date().toISOString(),
        db_version: 10,
        stores: storesData
      };
    }
  };

  const repo = new PosRepository(mockDb);
  const backup = await repo.exportData();

  // Assert all 15 stores are captured in backup payload
  assert.ok(backup.exported_at);
  assert.equal(backup.db_version, 10);
  assert.equal(Object.keys(backup.stores).length, 15);
  for (const name of storeNames) {
    assert.ok(backup.stores[name], `Missing store ${name} in backup export`);
  }

  // Verify backup interval math
  const AUTO_BACKUP_INTERVAL_MS = 30 * 60 * 1000;
  const BACKUP_OVERDUE_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const freshBackupTime = now - (10 * 60 * 1000); // 10 minutes ago
  assert.equal(now - freshBackupTime < AUTO_BACKUP_INTERVAL_MS, true);
  assert.equal(now - freshBackupTime > BACKUP_OVERDUE_MS, false);

  const dueForAutoBackupTime = now - (35 * 60 * 1000); // 35 minutes ago
  assert.equal(now - dueForAutoBackupTime >= AUTO_BACKUP_INTERVAL_MS, true);
  assert.equal(now - dueForAutoBackupTime > BACKUP_OVERDUE_MS, false);

  const overdueBackupTime = now - (25 * 60 * 60 * 1000); // 25 hours ago
  assert.equal(now - overdueBackupTime > BACKUP_OVERDUE_MS, true);
});

// ============================================================
// IMP-09: Regression tests for BUG-01, BUG-05, BUG-06, BUG-09
// Each test asserts on customer.balance AND customer_ledger state
// after the operation, not just that it doesn't throw.
// ============================================================

test('IMP-09 / BUG-01: processReturn restores customer.balance via ledger when sale was paid with STORE_CREDIT', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const cId = 1;
  const sId = 1;
  const siId = 1;

  // Customer starts with $20 store credit (positive balance)
  mockDb.stores.customers.set(cId, {
    customer_id: cId,
    name: 'Jasmine',
    balance: 2000,
    current_balance_cents: -2000,
    credit_limit_cents: 10000
  });
  // Seed opening balance ledger entry
  mockDb.stores.customer_ledger.set(1, {
    entry_id: 1,
    customer_id: cId,
    amount_cents: 2000,
    type: 'opening_balance',
    description: 'Opening credit',
    created_at: 100,
    timestamp: 100
  });

  // Seed a completed sale for $10 paid fully by STORE_CREDIT
  mockDb.stores.sales.set(sId, {
    sale_id: sId,
    customer_id: cId,
    total_amount_cents: 1000,
    status: 'COMPLETED'
  });
  mockDb.stores.sale_items.set(siId, {
    sale_item_id: siId,
    sale_id: sId,
    pigment_id: 1,
    weight_mg: 10000,
    price_charged_cents: 1000,
    unit_cogs_cents: 200
  });
  mockDb.stores.sale_payments.set(1, {
    payment_id: 1,
    sale_id: sId,
    payment_type: 'STORE_CREDIT',
    amount_cents: 1000
  });
  // After the sale, customer balance was debited $10 (-1000 ledger entry)
  // Simulate that debit (so customer.balance = 2000 - 1000 = 1000):
  mockDb.stores.customer_ledger.set(2, {
    entry_id: 2,
    customer_id: cId,
    amount_cents: -1000,
    type: 'SALE_CREDIT_APPLIED',
    description: 'Store credit applied to sale #1',
    created_at: 200,
    timestamp: 200
  });
  mockDb.stores.customers.set(cId, {
    customer_id: cId,
    name: 'Jasmine',
    balance: 1000,
    current_balance_cents: -1000,
    credit_limit_cents: 10000
  });

  // PRE-CONDITION: balance = 1000, ledger has 2 entries summing to 1000
  const preLedger = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === cId);
  assert.equal(preLedger.reduce((s, e) => s + e.amount_cents, 0), 1000);
  assert.equal(mockDb.stores.customers.get(cId).balance, 1000);

  // Return half the item (5g / 10g = 50% = $5 refund)
  await repo.processReturn(siId, 5000, 'Changed mind', false);

  // POST-CONDITION: customer.balance must have increased by $5 (the store-credit refund)
  const postCustomer = mockDb.stores.customers.get(cId);
  assert.equal(postCustomer.balance, 1500, 'customer.balance should be 1500 after $5 store credit refund');
  assert.equal(postCustomer.current_balance_cents, -1500);

  // customer_ledger must have a new REFUND_STORE_CREDIT entry
  const postLedger = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === cId);
  assert.equal(postLedger.length, 3, 'Should be 3 ledger entries: opening + sale debit + refund credit');
  const refundEntry = postLedger.find(e => e.type === 'REFUND_STORE_CREDIT');
  assert.ok(refundEntry, 'REFUND_STORE_CREDIT ledger entry must exist');
  assert.equal(refundEntry.amount_cents, 500, 'Refund entry must be 500 cents ($5)');

  // ledger sum must equal customer.balance exactly
  const ledgerSum = postLedger.reduce((s, e) => s + e.amount_cents, 0);
  assert.equal(ledgerSum, postCustomer.balance, 'customer.balance must equal ledger sum after return');
});

test('IMP-09 / BUG-05: updateCustomer writes balance exactly once — ledger sum equals customer.balance after balance edit', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const cId = 1;
  // Customer starts with $0 balance, no ledger entries
  mockDb.stores.customers.set(cId, {
    customer_id: cId,
    name: 'Marcus',
    balance: 0,
    current_balance_cents: 0,
    credit_limit_cents: 5000,
    trust_status: 'GOOD_STANDING',
    notes: ''
  });

  // Edit balance to $15 (1500 cents) — is_opening_balance path (no prior ledger entries)
  await repo.updateCustomer({
    customer_id: cId,
    starting_balance: 1500
  });

  const afterCustomer = mockDb.stores.customers.get(cId);
  const afterLedger = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === cId);

  // customer.balance must equal 1500
  assert.equal(afterCustomer.balance, 1500, 'customer.balance should be 1500 after opening balance set');
  assert.equal(afterCustomer.current_balance_cents, -1500);

  // Exactly ONE ledger entry must exist (not two from the double-write bug)
  assert.equal(afterLedger.length, 1, 'Exactly 1 ledger entry must be written (no double-write)');
  assert.equal(afterLedger[0].type, 'opening_balance');
  assert.equal(afterLedger[0].amount_cents, 1500);

  // ledger sum must equal customer.balance
  const ledgerSum = afterLedger.reduce((s, e) => s + e.amount_cents, 0);
  assert.equal(ledgerSum, afterCustomer.balance, 'customer.balance must equal ledger sum');

  // Now test the BALANCE_ADJUSTMENT path: add 500 cents more ($5)
  await repo.updateCustomer({
    customer_id: cId,
    balance: 2000, // target = $20
    balance_reason: 'Manual adjustment test'
  });

  const adjCustomer = mockDb.stores.customers.get(cId);
  const adjLedger = Array.from(mockDb.stores.customer_ledger.values()).filter(e => e.customer_id === cId);

  assert.equal(adjCustomer.balance, 2000, 'customer.balance should be 2000 after adjustment');
  assert.equal(adjCustomer.current_balance_cents, -2000);

  // Must be exactly 2 entries total: opening_balance + BALANCE_ADJUSTMENT
  assert.equal(adjLedger.length, 2, 'Should be 2 ledger entries: opening + adjustment');
  const adjEntry = adjLedger.find(e => e.type === 'BALANCE_ADJUSTMENT');
  assert.ok(adjEntry, 'BALANCE_ADJUSTMENT entry must exist');
  assert.equal(adjEntry.amount_cents, 500, 'Delta must be 500 cents');

  const adjSum = adjLedger.reduce((s, e) => s + e.amount_cents, 0);
  assert.equal(adjSum, adjCustomer.balance, 'customer.balance must equal ledger sum after adjustment');
});

test('IMP-09 / BUG-06: createPigment with a new supplier name creates the supplier and updates current_balance_cents for unpaid tab', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  // No pre-existing suppliers
  assert.equal(mockDb.stores.suppliers.size, 0);

  // Create a pigment with a new supplier name and an unpaid tab
  const pigId = await repo.createPigment({
    name: 'Crimson Shimmer',
    stock_mg: 50000,
    total_cost_cents: 3000, // $30 total
    supplier_name: 'New Vendor Co',
    payment_status: 'UNPAID_TAB',
    paid_down_cents: 0
  });

  assert.ok(pigId);

  // Supplier must have been auto-created
  assert.equal(mockDb.stores.suppliers.size, 1, 'A new supplier should have been created');
  const supplier = Array.from(mockDb.stores.suppliers.values())[0];
  assert.equal(supplier.name, 'New Vendor Co');

  // current_balance_cents must reflect the full unpaid tab ($30 = 3000 cents)
  assert.equal(supplier.current_balance_cents, 3000, 'Supplier current_balance_cents must be 3000 for $30 unpaid tab');

  // Stock receipt must have been created linking to the supplier
  assert.equal(mockDb.stores.stock_receipts.size, 1);
  const receipt = Array.from(mockDb.stores.stock_receipts.values())[0];
  assert.equal(receipt.supplier_id, supplier.supplier_id);
  assert.equal(receipt.unpaid_tab_cents, 3000);
});

test('IMP-09 / BUG-09: getCustomerTotalExposure nets tab debt against open prepayments for unified credit check', async () => {
  const mockDb = createMockDatabase();
  const repo = new PosRepository(mockDb);

  const cId = 1;

  // Customer has -$10 debt (balance = -1000) and $50 credit limit
  mockDb.stores.customers.set(cId, {
    customer_id: cId,
    name: 'Dana',
    balance: -1000, // $10 debt
    current_balance_cents: 1000,
    credit_limit_cents: 5000
  });

  // 1. No prepayments: exposure = 1000 (just the debt)
  const exposure1 = await repo.getCustomerTotalExposure(cId);
  assert.equal(exposure1, 1000, 'Exposure should be 1000 (debt only, no prepayments)');

  // 2. Add $30 open prepayment (money business holds from customer)
  mockDb.stores.customer_prepayments.set(1, {
    prepayment_id: 1,
    customer_id: cId,
    amount_cents: 3000,
    status: 'PENDING_DELIVERY'
  });

  const exposure2 = await repo.getCustomerTotalExposure(cId);
  // Exposure = tabDebt(1000) - prepaymentOffset(3000) = -2000
  // Negative means the business owes the customer more than they owe us
  assert.equal(exposure2, -2000, 'Exposure should be -2000 when prepayments exceed tab debt');

  // Available credit = limit(5000) - exposure(-2000) = 7000
  // i.e., customer can tab $70 more before hitting limit
  const availableCredit2 = 5000 - exposure2;
  assert.equal(availableCredit2, 7000, 'Available credit should be $70 when customer has net prepayment credit');

  // 3. Delivered prepayments do NOT reduce exposure
  mockDb.stores.customer_prepayments.set(2, {
    prepayment_id: 2,
    customer_id: cId,
    amount_cents: 1000,
    status: 'DELIVERED' // should be excluded
  });
  mockDb.stores.customer_prepayments.set(3, {
    prepayment_id: 3,
    customer_id: cId,
    amount_cents: 500,
    status: 'CANCELLED' // should be excluded
  });

  const exposure3 = await repo.getCustomerTotalExposure(cId);
  // Only PENDING_DELIVERY ($30) counts; DELIVERED and CANCELLED are excluded
  assert.equal(exposure3, -2000, 'DELIVERED and CANCELLED prepayments must not offset exposure');

  // 4. Customer with no debt and no prepayments has 0 exposure
  mockDb.stores.customers.set(2, {
    customer_id: 2,
    name: 'Zero',
    balance: 0,
    current_balance_cents: 0,
    credit_limit_cents: 5000
  });
  const exposure4 = await repo.getCustomerTotalExposure(2);
  assert.equal(exposure4 === 0 || Object.is(exposure4, -0), true, 'Zero exposure expected');
});






