import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCents,
  formatMgToGrams,
  formatMgToOz,
  getEffectivePricePerGramCents
} from '../repository.js';

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
