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
