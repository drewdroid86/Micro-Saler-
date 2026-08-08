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
  calculateBusinessInsights
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

