/**
 * @fileoverview Business logic repository layer for Micro Saler POS (React version).
 */

export function formatCents(cents) {
  const c = (cents === null || cents === undefined || isNaN(cents)) ? 0 : Number(cents);
  return `$${(c / 100).toFixed(2)}`;
}

export function formatMgToGrams(mg) {
  const m = (mg === null || mg === undefined || isNaN(mg)) ? 0 : Number(mg);
  return `${(m / 1000).toFixed(1)}g`;
}

export const APPROVED_PAYMENT_TYPES = new Set(['CASH', 'DIGITAL', 'HOUSE_TAB', 'PREPAID_DELIVERY']);

export function validateCompletedSale({ sale, items = [], payments = [], customerId = null }) {
  const errors = [];

  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    errors.push('Completed sale must have at least one payment record.');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    errors.push('Completed sale must have at least one line item.');
  }

  let calculatedItemsTotal = 0;
  if (items && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== 'object') {
        errors.push(`Item #${i + 1} is invalid.`);
        continue;
      }
      if (!Number.isInteger(item.price_charged_cents) || item.price_charged_cents < 0) {
        errors.push(`Item #${i + 1} price charged must be a non-negative integer in cents (got: ${item?.price_charged_cents}).`);
      } else {
        calculatedItemsTotal += item.price_charged_cents;
      }
    }
  }

  const saleTotalCents = (sale && sale.total_amount_cents !== undefined && sale.total_amount_cents !== null)
    ? sale.total_amount_cents
    : calculatedItemsTotal;

  if (!Number.isInteger(saleTotalCents) || saleTotalCents < 0) {
    errors.push(`Sale total amount must be a non-negative integer in cents (got: ${saleTotalCents}).`);
  }

  let calculatedPaymentsTotal = 0;
  if (payments && Array.isArray(payments)) {
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      if (!p || typeof p !== 'object') {
        errors.push(`Payment #${i + 1} is invalid.`);
        continue;
      }
      if (!Number.isInteger(p.amount_cents) || p.amount_cents <= 0) {
        errors.push(`Payment #${i + 1} amount must be a positive integer in cents (got: ${p?.amount_cents}).`);
      } else {
        calculatedPaymentsTotal += p.amount_cents;
      }
      if (!p.payment_type || !APPROVED_PAYMENT_TYPES.has(p.payment_type)) {
        errors.push(`Payment #${i + 1} has unapproved payment type '${p?.payment_type}'. Approved types: ${Array.from(APPROVED_PAYMENT_TYPES).join(', ')}.`);
      }
      if (p.payment_type === 'HOUSE_TAB' && !customerId) {
        errors.push(`Payment #${i + 1} (HOUSE_TAB) requires a valid customer ID.`);
      }
    }
  }

  if (calculatedPaymentsTotal !== saleTotalCents) {
    errors.push(`Payment total (${formatCents(calculatedPaymentsTotal)}) does not match sale total (${formatCents(saleTotalCents)}).`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    saleTotalCents,
    calculatedPaymentsTotal,
    calculatedItemsTotal
  };
}

export function formatMgToOz(mg) {
  const m = (mg === null || mg === undefined || isNaN(mg)) ? 0 : Number(mg);
  return `${(m / 28349.5).toFixed(2)} oz`;
}

export const GRAM_TO_MG = 1000;
export const OZ_TO_MG = 28349.523125;

export function gramsToMg(grams) {
  const g = (grams === null || grams === undefined || isNaN(grams)) ? 0 : Number(grams);
  return Math.round(g * GRAM_TO_MG);
}

export function ozToMg(oz) {
  const o = (oz === null || oz === undefined || isNaN(oz)) ? 0 : Number(oz);
  return Math.round(o * OZ_TO_MG);
}

export function mgToGrams(mg) {
  const m = (mg === null || mg === undefined || isNaN(mg)) ? 0 : Number(mg);
  return m / GRAM_TO_MG;
}

export function mgToOz(mg) {
  const m = (mg === null || mg === undefined || isNaN(mg)) ? 0 : Number(mg);
  return m / OZ_TO_MG;
}

export function getMatchedTier(pigment, weightMg) {
  if (!pigment) return null;
  let tiers = [];
  if (pigment.tier_pricing_json) {
    try {
      tiers = typeof pigment.tier_pricing_json === 'string'
        ? JSON.parse(pigment.tier_pricing_json)
        : pigment.tier_pricing_json;
    } catch (e) {
      tiers = [];
    }
  } else if (Array.isArray(pigment.price_tiers)) {
    tiers = pigment.price_tiers;
  }

  if (!Array.isArray(tiers) || tiers.length === 0) return null;

  const sortedTiers = [...tiers].sort((a, b) => Number(b.min_weight_mg) - Number(a.min_weight_mg));
  return sortedTiers.find(t => weightMg >= Number(t.min_weight_mg)) || null;
}

export function calculatePricingBreakdown({
  pigment,
  weightMg = 0,
  pricingMode = 'RETAIL',
  customPriceCents = null,
  customCostPerGramCents = null,
  packagingCents = 0,
  priceTiers = []
}) {
  const safeWeightMg = Math.max(0, Number(weightMg) || 0);
  const weightGrams = safeWeightMg / GRAM_TO_MG;
  const weightOz = safeWeightMg / OZ_TO_MG;
  const pkgCents = Math.max(0, Number(packagingCents) || 0);

  let effectiveRatePerGramCents = 0;
  let matchedTier = null;
  let totalPriceCents = 0;

  if (pigment) {
    matchedTier = getMatchedTier(pigment, safeWeightMg);
    const presetTier = priceTiers?.find(
      t => Number(t.pigment_id) === Number(pigment.pigment_id) && Number(t.weight_mg) === Number(safeWeightMg)
    );

    if (customPriceCents !== null && customPriceCents !== undefined && !isNaN(customPriceCents)) {
      totalPriceCents = Math.round(Number(customPriceCents));
      effectiveRatePerGramCents = weightGrams > 0 ? Math.round((totalPriceCents - pkgCents) / weightGrams) : 0;
    } else if (presetTier) {
      const presetPrice = pricingMode === 'RETAIL' ? presetTier.retail_price_cents : presetTier.wholesale_price_cents;
      if (presetPrice !== null && presetPrice !== undefined && !isNaN(presetPrice) && Number(presetPrice) > 0) {
        totalPriceCents = Number(presetPrice);
        effectiveRatePerGramCents = weightGrams > 0 ? Math.round((totalPriceCents - pkgCents) / weightGrams) : 0;
      }
    }

    if (totalPriceCents === 0 && safeWeightMg > 0) {
      effectiveRatePerGramCents = getEffectivePricePerGramCents(pigment, safeWeightMg, pricingMode);
      const rawPkg = pkgCents || (pigment.default_pkg_cents || 0);
      totalPriceCents = Math.round(weightGrams * effectiveRatePerGramCents) + rawPkg;
    }
  } else if (customPriceCents !== null && customPriceCents !== undefined) {
    totalPriceCents = Math.round(Number(customPriceCents));
    effectiveRatePerGramCents = weightGrams > 0 ? Math.round(totalPriceCents / weightGrams) : 0;
  }

  let costPerGramCents = 0;
  if (customCostPerGramCents !== null && customCostPerGramCents !== undefined && !isNaN(customCostPerGramCents)) {
    costPerGramCents = Number(customCostPerGramCents);
  } else if (pigment && pigment.stock_mg > 0) {
    costPerGramCents = (pigment.total_cost_cents / pigment.stock_mg) * 1000;
  }

  const rawCogsCents = (costPerGramCents / 1000) * safeWeightMg;
  const cogsCents = Math.round(rawCogsCents + pkgCents);
  const grossProfitCents = totalPriceCents - cogsCents;
  const marginPercent = totalPriceCents > 0 ? (grossProfitCents / totalPriceCents) * 100 : 0;
  const markupMultiplier = cogsCents > 0 ? totalPriceCents / cogsCents : 0;
  const breakevenPerGramCents = weightGrams > 0 ? Math.ceil(cogsCents / weightGrams) : 0;
  const effectiveRatePerOzCents = weightOz > 0 ? Math.round(totalPriceCents / weightOz) : 0;

  return {
    weightMg: safeWeightMg,
    weightGrams,
    weightOz,
    effectiveRatePerGramCents,
    effectiveRatePerOzCents,
    matchedTier,
    totalPriceCents,
    cogsCents,
    grossProfitCents,
    marginPercent,
    markupMultiplier,
    breakevenPerGramCents,
    costPerGramCents,
    pkgCents
  };
}

export function getEffectivePricePerGramCents(pigment, weightMg, pricingMode = 'RETAIL') {
  if (!pigment) return 0;

  const baseRate = pricingMode === 'RETAIL'
    ? (pigment.retail_price_per_gram_cents || 0)
    : (pigment.wholesale_price_per_gram_cents || 0);

  let tiers = [];
  if (pigment.tier_pricing_json) {
    try {
      tiers = typeof pigment.tier_pricing_json === 'string'
        ? JSON.parse(pigment.tier_pricing_json)
        : pigment.tier_pricing_json;
    } catch (e) {
      tiers = [];
    }
  } else if (Array.isArray(pigment.price_tiers)) {
    tiers = pigment.price_tiers;
  }

  if (!Array.isArray(tiers) || tiers.length === 0) {
    return baseRate;
  }

  const sortedTiers = [...tiers].sort((a, b) => Number(b.min_weight_mg) - Number(a.min_weight_mg));
  const matchedTier = sortedTiers.find(t => weightMg >= Number(t.min_weight_mg));

  if (matchedTier) {
    const tierRate = pricingMode === 'RETAIL'
      ? matchedTier.retail_price_per_gram_cents
      : matchedTier.wholesale_price_per_gram_cents;

    if (tierRate !== undefined && tierRate !== null && !isNaN(tierRate) && Number(tierRate) > 0) {
      return Number(tierRate);
    }
  }

  return baseRate;
}

export class PosRepository {
  constructor(db) {
    this.db = db;
  }

  async restockPigment(pigmentId, receivedMg, totalCostCents, supplierName, paymentStatus = 'PAID', supplierId = null, paidDownCents = 0) {
    const pigment = await this.db.getById('pigments', Number(pigmentId));
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

    const newStockMg = pigment.stock_mg + receivedMg;
    const newTotalCostCents = pigment.total_cost_cents + totalCostCents;

    await this.db.updateStockAndCost(Number(pigmentId), newStockMg, newTotalCostCents);

    let sId = supplierId ? Number(supplierId) : null;
    if (!sId && supplierName && supplierName.trim()) {
      const allSuppliers = await this.db.getAllSuppliers();
      const existing = allSuppliers.find(s => s.name.toLowerCase() === supplierName.trim().toLowerCase());
      if (existing) {
        sId = existing.supplier_id;
      }
    }

    const safePaidDown = paymentStatus === 'PAID'
      ? totalCostCents
      : Math.min(totalCostCents, Math.max(0, paidDownCents || 0));

    const unpaidTabCents = paymentStatus === 'PAID' ? 0 : Math.max(0, totalCostCents - safePaidDown);

    if (unpaidTabCents > 0 && sId) {
      await this.db.updateSupplierBalance(sId, unpaidTabCents);
    }

    const statusLabel = paymentStatus === 'PAID'
      ? 'PAID'
      : safePaidDown > 0
        ? `PARTIAL ($${(safePaidDown / 100).toFixed(2)} Paid / $${(unpaidTabCents / 100).toFixed(2)} Owed)`
        : 'UNPAID_TAB';

    const receiptId = await this.db.add('stock_receipts', {
      pigment_id: Number(pigmentId),
      received_mg: receivedMg,
      total_cost_cents: totalCostCents,
      paid_down_cents: safePaidDown,
      unpaid_tab_cents: unpaidTabCents,
      supplier_name: supplierName || '',
      supplier_id: sId,
      payment_status: statusLabel,
      received_at: Date.now(),
    });

    if (safePaidDown > 0 && sId && paymentStatus !== 'PAID') {
      await this.db.add('supplier_payments', {
        supplier_id: sId,
        amount_cents: safePaidDown,
        payment_type: 'DOWN_PAYMENT',
        notes: `Restock down payment for receipt #${receiptId}`,
        created_at: Date.now(),
      });
    }

    return receiptId;
  }

  async voidStockReceipt(receiptId, reason = 'Entry Error') {
    const receipt = await this.db.getById('stock_receipts', Number(receiptId));
    if (!receipt) throw new Error(`Stock receipt #${receiptId} not found`);
    if (receipt.payment_status === 'VOIDED') throw new Error(`Receipt #${receiptId} is already voided`);

    const pigment = await this.db.getById('pigments', Number(receipt.pigment_id));
    if (pigment) {
      const newStockMg = Math.max(0, pigment.stock_mg - (receipt.received_mg || 0));
      const newTotalCostCents = Math.max(0, pigment.total_cost_cents - (receipt.total_cost_cents || 0));
      await this.db.updateStockAndCost(Number(receipt.pigment_id), newStockMg, newTotalCostCents);
    }

    const unpaidTabCents = receipt.unpaid_tab_cents || (receipt.payment_status === 'UNPAID_TAB' ? receipt.total_cost_cents : 0);
    if (unpaidTabCents > 0 && receipt.supplier_id) {
      const supplier = await this.db.getById('suppliers', Number(receipt.supplier_id));
      if (supplier) {
        await this.db.updateSupplierBalance(Number(receipt.supplier_id), -unpaidTabCents);
      }
    }

    receipt.payment_status = 'VOIDED';
    receipt.void_reason = reason;
    receipt.voided_at = Date.now();
    await this.db.update('stock_receipts', receipt);

    const now = Date.now();
    await this.db.add('audit_log', {
      entity_type: 'StockReceipt',
      entity_id: Number(receiptId),
      action: 'VOID_STOCK_RECEIPT',
      details_json: JSON.stringify({ receipt_id: Number(receiptId), reason, pigment_id: receipt.pigment_id }),
      created_at: now,
      timestamp: now,
    });

    return true;
  }

  async updateRestockTerms(receiptId, paymentStatus, paidDownCents) {
    const receipt = await this.db.getById('stock_receipts', Number(receiptId));
    if (!receipt) throw new Error(`Stock receipt #${receiptId} not found`);
    if (receipt.payment_status === 'VOIDED') throw new Error(`Cannot edit terms for a voided receipt`);

    const totalCostCents = receipt.total_cost_cents || 0;
    const safePaidDown = paymentStatus === 'PAID'
      ? totalCostCents
      : Math.min(totalCostCents, Math.max(0, paidDownCents || 0));

    const newUnpaidTabCents = paymentStatus === 'PAID' ? 0 : Math.max(0, totalCostCents - safePaidDown);
    const oldUnpaidTabCents = receipt.unpaid_tab_cents !== undefined
      ? receipt.unpaid_tab_cents
      : (receipt.payment_status === 'UNPAID_TAB' ? totalCostCents : 0);

    const tabDiffCents = newUnpaidTabCents - oldUnpaidTabCents;

    if (tabDiffCents !== 0 && receipt.supplier_id) {
      const supplier = await this.db.getById('suppliers', Number(receipt.supplier_id));
      if (supplier) {
        await this.db.updateSupplierBalance(Number(receipt.supplier_id), tabDiffCents);
      }
    }

    const statusLabel = paymentStatus === 'PAID'
      ? 'PAID'
      : safePaidDown > 0
        ? `PARTIAL ($${(safePaidDown / 100).toFixed(2)} Paid / $${(newUnpaidTabCents / 100).toFixed(2)} Owed)`
        : 'UNPAID_TAB';

    receipt.paid_down_cents = safePaidDown;
    receipt.unpaid_tab_cents = newUnpaidTabCents;
    receipt.payment_status = statusLabel;
    receipt.updated_at = Date.now();

    await this.db.update('stock_receipts', receipt);

    const now = Date.now();
    await this.db.add('audit_log', {
      entity_type: 'StockReceipt',
      entity_id: Number(receiptId),
      action: 'EDIT_RESTOCK_PURCHASE_TERMS',
      details_json: JSON.stringify({
        receipt_id: Number(receiptId),
        old_unpaid_cents: oldUnpaidTabCents,
        new_unpaid_cents: newUnpaidTabCents,
        tab_diff_cents: tabDiffCents
      }),
      created_at: now,
      timestamp: now,
    });

    return receipt;
  }

  async resetAllInventoryStockAndCosts() {
    const pigments = await this.db.getAll('pigments');
    for (const p of pigments) {
      p.stock_mg = 0;
      p.total_cost_cents = 0;
      await this.db.put('pigments', p);
    }
    const now = Date.now();
    await this.db.add('audit_log', {
      entity_type: 'Inventory',
      entity_id: 0,
      action: 'RESET_INVENTORY_STOCK',
      details_json: JSON.stringify({ count: pigments.length }),
      created_at: now,
      timestamp: now,
    });
    return true;
  }

  async clearAllInventoryCatalog() {
    await this.db.clearStore('pigments');
    await this.db.clearStore('stock_receipts');
    const now = Date.now();
    await this.db.add('audit_log', {
      entity_type: 'Inventory',
      entity_id: 0,
      action: 'CLEAR_INVENTORY_CATALOG',
      details_json: JSON.stringify({ action: 'cleared_all_pigments_and_receipts' }),
      created_at: now,
      timestamp: now,
    });
    return true;
  }

  async wipeAllData() {
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
    for (const name of storeNames) {
      await this.db.clearStore(name);
    }
    return true;
  }

  async logShrinkage(pigmentId, mgLost, reason) {
    const pigment = await this.db.getById('pigments', Number(pigmentId));
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

    const cogsLossCents = pigment.stock_mg > 0
      ? Math.floor((pigment.total_cost_cents / pigment.stock_mg) * mgLost)
      : 0;

    const newStockMg = pigment.stock_mg - mgLost;
    const newCostCents = pigment.total_cost_cents - cogsLossCents;

    await this.db.updateStockAndCost(Number(pigmentId), newStockMg, newCostCents);

    return await this.db.add('shrinkage_logs', {
      pigment_id: Number(pigmentId),
      mg_lost: mgLost,
      cogs_loss_cents: cogsLossCents,
      reason,
      created_at: Date.now(),
    });
  }

  async completeSale(customerId, items, payments, isCreditOverride = false) {
    const totalSaleAmountCents = items.reduce((sum, i) => sum + (i.price_charged_cents || 0), 0);
    const totalPaymentsCents = payments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    const totalCogsCents = items.reduce((sum, i) => sum + (i.unit_cogs_cents || 0), 0);

    const validation = validateCompletedSale({
      sale: { total_amount_cents: totalSaleAmountCents },
      items,
      payments,
      customerId
    });

    if (!validation.isValid) {
      throw new Error(`Sale validation failed: ${validation.errors.join(' ')}`);
    }

    const hasHouseTab = payments.some(p => p.payment_type === 'HOUSE_TAB');
    if (hasHouseTab) {
      if (!customerId) throw new Error('Customer is required for HOUSE_TAB payment');
      const customer = await this.db.getById('customers', Number(customerId));
      if (!customer) throw new Error(`Customer ${customerId} not found`);

      const tabAmount = payments
        .filter(p => p.payment_type === 'HOUSE_TAB')
        .reduce((sum, p) => sum + p.amount_cents, 0);
      const availableCredit = Math.max(0, customer.credit_limit_cents - customer.current_balance_cents);

      if (tabAmount > availableCredit && !isCreditOverride) {
        throw new Error(`Credit limit exceeded. Available: $${(availableCredit/100).toFixed(2)}, Requested: $${(tabAmount/100).toFixed(2)}. Enable Handshake Override.`);
      }
    }

    // Atomic IndexedDB multi-store transaction with in-transaction inventory reads & stock validation
    const storeNames = ['sales', 'sale_items', 'sale_payments', 'pigments', 'customers', 'audit_log'];
    const now = Date.now();
    let createdSaleId = null;

    await this.db.runTransaction(storeNames, 'readwrite', async (tx) => {
      const salesStore = tx.objectStore('sales');
      const saleItemsStore = tx.objectStore('sale_items');
      const salePaymentsStore = tx.objectStore('sale_payments');
      const pigmentsStore = tx.objectStore('pigments');
      const customersStore = tx.objectStore('customers');
      const auditStore = tx.objectStore('audit_log');

      // 1. Read & validate all pigments inside the transaction lock
      const pigmentUpdates = [];
      for (const item of items) {
        const pId = Number(item.pigment_id);
        if (pId > 0) {
          const pigment = await new Promise((resolve, reject) => {
            const req = pigmentsStore.get(pId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          if (!pigment) {
            tx.abort();
            throw new Error(`Pigment #${pId} not found in database.`);
          }
          if (pigment.stock_mg < item.weight_mg) {
            tx.abort();
            throw new Error(`Insufficient stock for ${pigment.name}. Available: ${formatMgToGrams(pigment.stock_mg)}, Requested: ${formatMgToGrams(item.weight_mg)}.`);
          }

          pigmentUpdates.push({ pigment, item });
        }
      }

      // 2. Read customer inside transaction lock if customerId present
      let customerObj = null;
      if (customerId) {
        customerObj = await new Promise((resolve, reject) => {
          const req = customersStore.get(Number(customerId));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }

      // 3. Write sale record
      createdSaleId = await new Promise((resolve, reject) => {
        const req = salesStore.add({
          customer_id: customerId ? Number(customerId) : null,
          total_amount_cents: totalSaleAmountCents,
          total_cogs_cents: totalCogsCents,
          status: 'COMPLETED',
          is_credit_override: isCreditOverride,
          needs_reconciliation: false,
          reconciliation_status: 'RECONCILED',
          created_at: now,
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      // 4. Write sale_items and update pigment stock
      for (const { pigment, item } of pigmentUpdates) {
        saleItemsStore.add({
          sale_id: createdSaleId,
          pigment_id: Number(item.pigment_id),
          weight_mg: item.weight_mg,
          price_charged_cents: item.price_charged_cents,
          unit_cogs_cents: item.unit_cogs_cents,
        });

        pigment.stock_mg = Math.max(0, pigment.stock_mg - item.weight_mg);
        pigment.total_cost_cents = Math.max(0, pigment.total_cost_cents - item.unit_cogs_cents);
        pigmentsStore.put(pigment);
      }

      // Handle items with pigment_id <= 0 (e.g. general credit prepayments)
      for (const item of items) {
        if (Number(item.pigment_id) <= 0) {
          saleItemsStore.add({
            sale_id: createdSaleId,
            pigment_id: Number(item.pigment_id),
            weight_mg: item.weight_mg,
            price_charged_cents: item.price_charged_cents,
            unit_cogs_cents: item.unit_cogs_cents,
          });
        }
      }

      // 5. Write payments and update customer balance
      for (const payment of payments) {
        salePaymentsStore.add({
          sale_id: createdSaleId,
          payment_type: payment.payment_type,
          digital_provider: payment.digital_provider || null,
          amount_cents: payment.amount_cents,
          merchant_fee_cents: payment.merchant_fee_cents || 0,
        });

        if (payment.payment_type === 'HOUSE_TAB' && customerObj) {
          customerObj.current_balance_cents += payment.amount_cents;
          customersStore.put(customerObj);
        }
      }

      if (isCreditOverride) {
        auditStore.add({
          entity_type: 'Sale',
          entity_id: createdSaleId,
          action: 'HANDSHAKE_CREDIT_OVERRIDE',
          details_json: JSON.stringify({ sale_id: createdSaleId, customer_id: customerId }),
          created_at: now,
          timestamp: now,
        });
      }
    });

    return createdSaleId;
  }

  async processReturn(saleItemId, mgReturned, reason, restockToInventory) {
    if (!mgReturned || isNaN(mgReturned) || mgReturned <= 0) {
      throw new Error('Return weight must be greater than zero');
    }
    const saleItem = await this.db.getById('sale_items', Number(saleItemId));
    if (!saleItem) throw new Error(`SaleItem ${saleItemId} not found`);

    const alreadyReturnedMg = await this.db.getTotalReturnedMgForSaleItem(Number(saleItemId));
    const maxEligible = saleItem.weight_mg - alreadyReturnedMg;

    if (mgReturned > maxEligible) {
      throw new Error(`Cannot return ${formatMgToGrams(mgReturned)} — max eligible is ${formatMgToGrams(maxEligible)}`);
    }

    const proportionalRefundCents = saleItem.weight_mg > 0
      ? Math.round((saleItem.price_charged_cents / saleItem.weight_mg) * mgReturned)
      : 0;

    const returnId = await this.db.add('returns', {
      sale_item_id: Number(saleItemId),
      mg_returned: mgReturned,
      refund_amount_cents: proportionalRefundCents,
      restock_to_inventory: restockToInventory,
      reason,
      created_at: Date.now(),
    });

    if (restockToInventory) {
      const pigment = await this.db.getById('pigments', Number(saleItem.pigment_id));
      if (pigment) {
        const proportionalCogs = saleItem.weight_mg > 0
          ? Math.floor((saleItem.unit_cogs_cents / saleItem.weight_mg) * mgReturned)
          : 0;
        await this.db.updateStockAndCost(
          Number(saleItem.pigment_id),
          pigment.stock_mg + mgReturned,
          pigment.total_cost_cents + proportionalCogs
        );
      }
    }

    return returnId;
  }

  async voidSale(saleId, reason) {
    const sId = Number(saleId);
    const sale = await this.db.getById('sales', sId);
    if (!sale) throw new Error(`Sale ${saleId} not found`);
    if (sale.status === 'VOIDED') throw new Error(`Sale ${saleId} is already voided`);

    const items = await this.db.getAllByIndex('sale_items', 'sale_id', sId);
    for (const item of items) {
      const pigment = await this.db.getById('pigments', Number(item.pigment_id));
      if (pigment) {
        await this.db.updateStockAndCost(
          Number(item.pigment_id),
          pigment.stock_mg + item.weight_mg,
          pigment.total_cost_cents + item.unit_cogs_cents
        );
      }
    }

    const payments = await this.db.getAllByIndex('sale_payments', 'sale_id', sId);
    for (const payment of payments) {
      if (payment.payment_type === 'HOUSE_TAB' && sale.customer_id) {
        await this.db.updateCustomerBalance(Number(sale.customer_id), -payment.amount_cents);
      }
    }

    await this.db.updateSaleStatus(sId, 'VOIDED');

    await this.db.add('audit_log', {
      entity_type: 'Sale',
      entity_id: sId,
      action: 'VOID_SALE',
      details_json: JSON.stringify({ sale_id: sId, reason }),
      created_at: Date.now(),
    });
  }

  async settleTabPayment(customerId, amountPaidCents, paymentType, digitalProvider = null) {
    const cId = Number(customerId);
    const id = await this.db.add('tab_payments', {
      customer_id: cId,
      amount_paid_cents: amountPaidCents,
      payment_type: paymentType,
      digital_provider: digitalProvider,
      created_at: Date.now(),
    });

    await this.db.updateCustomerBalance(cId, -amountPaidCents);
    return id;
  }

  async updatePigmentPricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents) {
    const pId = Number(pigmentId);
    await this.db.updatePricing(pId, retailPricePerGramCents, wholesalePricePerGramCents);

    await this.db.add('audit_log', {
      entity_type: 'Pigment',
      entity_id: pId,
      action: 'PRICING_UPDATE',
      details_json: JSON.stringify({ pigment_id: pId, retail: retailPricePerGramCents, wholesale: wholesalePricePerGramCents }),
      created_at: Date.now(),
    });
  }

  async getPriceTiersForPigment(pigmentId) {
    return await this.db.getPriceTiersForPigment(pigmentId);
  }

  async upsertPriceTier(pigmentId, weightMg, retailCents, wholesaleCents) {
    return await this.db.upsertPriceTier(pigmentId, weightMg, retailCents, wholesaleCents);
  }

  async updatePigmentDetails(pigmentId, details) {
    const pId = Number(pigmentId);
    const pigment = await this.db.getById('pigments', pId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

    if (details.name !== undefined) pigment.name = details.name;
    if (details.color_code !== undefined) pigment.color_code = details.color_code;
    if (details.finish_type !== undefined) pigment.finish_type = details.finish_type;
    if (details.default_pkg_cents !== undefined) pigment.default_pkg_cents = details.default_pkg_cents;
    if (details.retail_price_per_gram_cents !== undefined) pigment.retail_price_per_gram_cents = details.retail_price_per_gram_cents;
    if (details.wholesale_price_per_gram_cents !== undefined) pigment.wholesale_price_per_gram_cents = details.wholesale_price_per_gram_cents;
    if (details.is_archived !== undefined) pigment.is_archived = Boolean(details.is_archived);
    if (details.tier_pricing_json !== undefined) pigment.tier_pricing_json = details.tier_pricing_json;

    await this.db.put('pigments', pigment);

    await this.db.add('audit_log', {
      entity_type: 'Pigment',
      entity_id: pId,
      action: 'PIGMENT_EDIT',
      details_json: JSON.stringify({
        pigment_id: pId,
        name: pigment.name,
        color_code: pigment.color_code,
        finish_type: pigment.finish_type,
        default_pkg_cents: pigment.default_pkg_cents,
        retail_price_per_gram_cents: pigment.retail_price_per_gram_cents,
        wholesale_price_per_gram_cents: pigment.wholesale_price_per_gram_cents,
        is_archived: pigment.is_archived,
        tier_pricing_json: pigment.tier_pricing_json,
      }),
      created_at: Date.now(),
    });

    return pigment;
  }

  async updatePigment(pigmentData) {
    if (!pigmentData || !pigmentData.pigment_id) throw new Error('Pigment ID is required');
    return await this.updatePigmentDetails(pigmentData.pigment_id, pigmentData);
  }

  async createPigment(data) {
    const pigmentId = await this.db.add('pigments', {
      name: data.name,
      color_code: data.color_code || '#888888',
      finish_type: data.finish_type || 'Mica Pearl',
      stock_mg: data.stock_mg || 0,
      total_cost_cents: data.total_cost_cents || 0,
      default_pkg_cents: data.default_pkg_cents || 35,
      retail_price_per_gram_cents: data.retail_price_per_gram_cents || 250,
      wholesale_price_per_gram_cents: data.wholesale_price_per_gram_cents || 150,
      is_archived: false,
      tier_pricing_json: data.tier_pricing_json || null,
    });

    if (data.stock_mg > 0 || data.total_cost_cents > 0) {
      let sId = data.supplier_id ? Number(data.supplier_id) : null;
      if (!sId && data.supplier_name && data.supplier_name.trim()) {
        const allSuppliers = await this.db.getAllSuppliers();
        const existing = allSuppliers.find(s => s.name.toLowerCase() === data.supplier_name.trim().toLowerCase());
        if (existing) {
          sId = existing.supplier_id;
        }
      }

      const totalCostCents = data.total_cost_cents || 0;
      const paymentStatus = data.payment_status || 'PAID';
      const paidDownCents = data.paid_down_cents || 0;

      const safePaidDown = paymentStatus === 'PAID'
        ? totalCostCents
        : Math.min(totalCostCents, Math.max(0, paidDownCents || 0));

      const unpaidTabCents = paymentStatus === 'PAID' ? 0 : Math.max(0, totalCostCents - safePaidDown);

      if (unpaidTabCents > 0 && sId) {
        await this.db.updateSupplierBalance(sId, unpaidTabCents);
      }

      const statusLabel = paymentStatus === 'PAID'
        ? 'PAID'
        : safePaidDown > 0
          ? `PARTIAL ($${(safePaidDown / 100).toFixed(2)} Paid / $${(unpaidTabCents / 100).toFixed(2)} Owed)`
          : 'UNPAID_TAB';

      const receiptId = await this.db.add('stock_receipts', {
        pigment_id: Number(pigmentId),
        received_mg: data.stock_mg || 0,
        total_cost_cents: totalCostCents,
        paid_down_cents: safePaidDown,
        unpaid_tab_cents: unpaidTabCents,
        supplier_name: data.supplier_name || '',
        supplier_id: sId,
        payment_status: statusLabel,
        received_at: Date.now(),
      });

      if (safePaidDown > 0 && sId && paymentStatus !== 'PAID') {
        await this.db.add('supplier_payments', {
          supplier_id: sId,
          amount_cents: safePaidDown,
          payment_type: 'DOWN_PAYMENT',
          notes: `Initial stock purchase down payment for receipt #${receiptId}`,
          created_at: Date.now(),
        });
      }
    }

    return pigmentId;
  }

  async createCustomer(data) {
    return await this.db.add('customers', {
      name: data.name,
      phone_number: data.phone_number || data.phone || '',
      credit_limit_cents: data.credit_limit_cents || 2500,
      current_balance_cents: 0,
      trust_status: data.trust_status || 'GOOD_STANDING',
    });
  }

  async updateCustomer(data) {
    await this.db.put('customers', data);
  }

  async createCustomerPrepayment(data) {
    if (!data.customer_id) throw new Error('Customer is required');
    const now = Date.now();
    const record = {
      customer_id: Number(data.customer_id),
      pigment_id: data.pigment_id ? Number(data.pigment_id) : null,
      pigment_name: data.pigment_name || '',
      weight_mg: data.weight_mg || 0,
      amount_cents: data.amount_cents || 0,
      status: data.status || 'PENDING_DELIVERY',
      notes: data.notes || '',
      created_at: now,
    };
    const prepaymentId = await this.db.add('customer_prepayments', record);

    await this.db.add('audit_log', {
      entity_type: 'CustomerPrepayment',
      entity_id: Number(prepaymentId),
      action: 'CREATE_PREPAYMENT',
      details_json: JSON.stringify({ customer_id: data.customer_id, weight_mg: data.weight_mg, amount_cents: data.amount_cents }),
      created_at: now,
      timestamp: now,
    });

    return prepaymentId;
  }

  async fulfillCustomerPrepayment(prepaymentId, notes = '') {
    const item = await this.db.getById('customer_prepayments', Number(prepaymentId));
    if (!item) throw new Error(`Prepayment #${prepaymentId} not found`);
    if (item.status === 'FULFILLED') return item;

    const now = Date.now();

    // 1. If pigment & weight reserved, deduct inventory stock & WAC cost basis
    if (item.pigment_id && item.weight_mg > 0) {
      const pigment = await this.db.getById('pigments', Number(item.pigment_id));
      if (pigment) {
        const unitCogsCents = pigment.stock_mg > 0
          ? Math.round((pigment.total_cost_cents / pigment.stock_mg) * item.weight_mg)
          : 0;

        const newStock = Math.max(0, pigment.stock_mg - item.weight_mg);
        const newCost = Math.max(0, pigment.total_cost_cents - unitCogsCents);

        await this.db.updateStockAndCost(Number(item.pigment_id), newStock, newCost);

        // 2. Create Completed Sale record in Sales History
        const saleId = await this.db.add('sales', {
          customer_id: item.customer_id ? Number(item.customer_id) : null,
          total_amount_cents: item.amount_cents || 0,
          total_cogs_cents: unitCogsCents,
          status: 'COMPLETED',
          created_at: now,
        });

        await this.db.add('sale_items', {
          sale_id: saleId,
          pigment_id: Number(item.pigment_id),
          weight_mg: item.weight_mg,
          price_charged_cents: item.amount_cents || 0,
          unit_cogs_cents: unitCogsCents,
        });

        await this.db.add('sale_payments', {
          sale_id: saleId,
          payment_type: 'PREPAID_DELIVERY',
          digital_provider: null,
          amount_cents: item.amount_cents || 0,
          merchant_fee_cents: 0,
        });
      }
    } else if (item.amount_cents > 0) {
      // General credit store fulfillment
      const saleId = await this.db.add('sales', {
        customer_id: item.customer_id ? Number(item.customer_id) : null,
        total_amount_cents: item.amount_cents,
        total_cogs_cents: 0,
        status: 'COMPLETED',
        created_at: now,
      });

      await this.db.add('sale_items', {
        sale_id: saleId,
        pigment_id: 0,
        weight_mg: 0,
        price_charged_cents: item.amount_cents,
        unit_cogs_cents: 0,
      });

      await this.db.add('sale_payments', {
        sale_id: saleId,
        payment_type: 'PREPAID_DELIVERY',
        digital_provider: null,
        amount_cents: item.amount_cents,
        merchant_fee_cents: 0,
      });
    }

    // 3. Mark prepayment status as FULFILLED
    item.status = 'FULFILLED';
    item.fulfilled_at = now;
    if (notes) item.fulfillment_notes = notes;
    await this.db.put('customer_prepayments', item);

    await this.db.add('audit_log', {
      entity_type: 'CustomerPrepayment',
      entity_id: Number(prepaymentId),
      action: 'FULFILL_PREPAYMENT',
      details_json: JSON.stringify({ prepayment_id: Number(prepaymentId), weight_mg: item.weight_mg, amount_cents: item.amount_cents }),
      created_at: now,
      timestamp: now,
    });

    return item;
  }

  async getAllCustomerPrepayments() {
    const all = await this.db.getAll('customer_prepayments');
    return all.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }

  async createSupplier(data) {
    if (!data.name || !data.name.trim()) throw new Error('Supplier name is required');
    return await this.db.add('suppliers', {
      name: data.name.trim(),
      phone_number: data.phone_number || data.phone || '',
      current_balance_cents: 0,
      notes: data.notes || '',
      created_at: Date.now(),
    });
  }

  async updateSupplier(data) {
    await this.db.put('suppliers', data);
  }

  async paySupplier(supplierId, amountPaidCents, paymentType, notes = '') {
    const sId = Number(supplierId);
    if (isNaN(amountPaidCents) || amountPaidCents <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    const supplier = await this.db.getById('suppliers', sId);
    if (!supplier) throw new Error(`Supplier ${supplierId} not found`);

    const now = Date.now();
    const paymentId = await this.db.add('supplier_payments', {
      supplier_id: sId,
      amount_paid_cents: amountPaidCents,
      payment_type: paymentType,
      notes,
      created_at: now,
    });

    await this.db.updateSupplierBalance(sId, -amountPaidCents);

    await this.db.add('audit_log', {
      entity_type: 'Supplier',
      entity_id: sId,
      action: 'SUPPLIER_PAYMENT',
      details_json: JSON.stringify({
        supplier_id: sId,
        supplier_name: supplier.name,
        amount_paid_cents: amountPaidCents,
        payment_type: paymentType,
        notes
      }),
      created_at: now,
      timestamp: now,
    });

    return paymentId;
  }

  async exportData() {
    return await this.db.exportAllStores();
  }

  async importData(backupData) {
    await this.db.importAllStores(backupData);
    await this.db.add('audit_log', {
      entity_type: 'System',
      entity_id: 0,
      action: 'DATABASE_RESTORE',
      details: JSON.stringify({
        restored_at: new Date().toISOString(),
        pigments_count: backupData.stores?.pigments?.length || 0,
        sales_count: backupData.stores?.sales?.length || 0,
        customers_count: backupData.stores?.customers?.length || 0
      }),
      timestamp: Date.now()
    });
  }

  async getIntegrityMismatches() {
    const allSales = await this.db.getAll('sales');
    const completedSales = allSales.filter(s => s.status === 'COMPLETED');
    const allItems = await this.db.getAll('sale_items');
    const allPayments = await this.db.getAll('sale_payments');

    const mismatches = [];

    for (const sale of completedSales) {
      const saleId = Number(sale.sale_id);
      const itemsForSale = allItems.filter(i => Number(i.sale_id) === saleId);
      const paymentsForSale = allPayments.filter(p => Number(p.sale_id) === saleId);

      const itemsTotal = itemsForSale.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
      const paymentsTotal = paymentsForSale.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
      const saleTotal = sale.total_amount_cents !== undefined ? sale.total_amount_cents : itemsTotal;

      const diff = Math.abs(saleTotal - paymentsTotal);
      if (diff !== 0 || sale.needs_reconciliation) {
        mismatches.push({
          sale_id: saleId,
          sale,
          itemsTotal,
          paymentsTotal,
          diffCents: diff,
          needs_reconciliation: sale.needs_reconciliation || diff !== 0,
          reconciliation_status: sale.reconciliation_status || (diff === 0 ? 'RECONCILED' : 'NEEDS_RECONCILIATION'),
          items: itemsForSale,
          payments: paymentsForSale,
          created_at: sale.created_at
        });
      }
    }

    return mismatches;
  }

  async scanAndReconcileIntegrity() {
    const allSales = await this.db.getAll('sales');
    const completedSales = allSales.filter(s => s.status === 'COMPLETED');
    const allItems = await this.db.getAll('sale_items');
    const allPayments = await this.db.getAll('sale_payments');
    const allAudits = await this.db.getAll('audit_log');

    const auditedSaleIds = new Set(
      allAudits
        .filter(a => a.entity_type === 'Sale' && (a.action === 'INTEGRITY_AUTO_REPAIR' || a.action === 'INTEGRITY_NEEDS_RECONCILIATION'))
        .map(a => Number(a.entity_id))
    );

    let repairedCount = 0;
    let flaggedCount = 0;

    for (const sale of completedSales) {
      const saleId = Number(sale.sale_id);
      const itemsForSale = allItems.filter(i => Number(i.sale_id) === saleId);
      const paymentsForSale = allPayments.filter(p => Number(p.sale_id) === saleId);

      const itemsTotal = itemsForSale.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
      const paymentsTotal = paymentsForSale.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
      const saleTotal = sale.total_amount_cents !== undefined ? sale.total_amount_cents : itemsTotal;

      const diff = Math.abs(saleTotal - paymentsTotal);
      if (diff === 0 && !sale.needs_reconciliation) {
        continue;
      }

      if (auditedSaleIds.has(saleId) && sale.reconciliation_status) {
        continue;
      }

      const now = Date.now();

      // Case A: Missing sale_items (prepayment fulfillment) where saleTotal === paymentsTotal
      if (itemsForSale.length === 0 && paymentsTotal > 0 && saleTotal === paymentsTotal) {
        await this.db.add('sale_items', {
          sale_id: saleId,
          pigment_id: 0,
          weight_mg: 0,
          price_charged_cents: paymentsTotal,
          unit_cogs_cents: 0,
        });
        sale.needs_reconciliation = false;
        sale.reconciliation_status = 'AUTO_REPAIRED';
        await this.db.put('sales', sale);

        await this.db.add('audit_log', {
          entity_type: 'Sale',
          entity_id: saleId,
          action: 'INTEGRITY_AUTO_REPAIR',
          details_json: JSON.stringify({
            sale_id: saleId,
            original_sale_total: saleTotal,
            calculated_payment_total: paymentsTotal,
            difference_cents: diff,
            timestamp: now,
            repair_status: 'AUTO_REPAIRED',
            reason: 'Created missing placeholder line item for credit store prepayment'
          }),
          created_at: now,
          timestamp: now,
        });
        auditedSaleIds.add(saleId);
        repairedCount++;
      }
      // Case B: Exactly 1 payment, single line item, unambiguous 1-cent rounding difference
      else if (paymentsForSale.length === 1 && itemsForSale.length > 0 && diff === 1) {
        const singlePayment = paymentsForSale[0];
        singlePayment.amount_cents = saleTotal;
        await this.db.put('sale_payments', singlePayment);

        sale.needs_reconciliation = false;
        sale.reconciliation_status = 'AUTO_REPAIRED';
        await this.db.put('sales', sale);

        await this.db.add('audit_log', {
          entity_type: 'Sale',
          entity_id: saleId,
          action: 'INTEGRITY_AUTO_REPAIR',
          details_json: JSON.stringify({
            sale_id: saleId,
            original_sale_total: saleTotal,
            calculated_payment_total: paymentsTotal,
            difference_cents: diff,
            timestamp: now,
            repair_status: 'AUTO_REPAIRED',
            reason: 'Reconciled 1-cent rounding variance on single payment'
          }),
          created_at: now,
          timestamp: now,
        });
        auditedSaleIds.add(saleId);
        repairedCount++;
      }
      // Ambiguous Case: Flag for manual UI reconciliation
      else {
        sale.needs_reconciliation = true;
        sale.reconciliation_status = 'NEEDS_RECONCILIATION';
        await this.db.put('sales', sale);

        if (!auditedSaleIds.has(saleId)) {
          await this.db.add('audit_log', {
            entity_type: 'Sale',
            entity_id: saleId,
            action: 'INTEGRITY_NEEDS_RECONCILIATION',
            details_json: JSON.stringify({
              sale_id: saleId,
              original_sale_total: saleTotal,
              calculated_payment_total: paymentsTotal,
              difference_cents: diff,
              timestamp: now,
              repair_status: 'NEEDS_RECONCILIATION'
            }),
            created_at: now,
            timestamp: now,
          });
          auditedSaleIds.add(saleId);
        }
        flaggedCount++;
      }
    }

    return { repairedCount, flaggedCount };
  }

  async repairDataIntegrity() {
    return await this.scanAndReconcileIntegrity();
  }

  async reconcileSaleRecord(saleId, actionType, payload = {}) {
    const sId = Number(saleId);
    const sale = await this.db.getById('sales', sId);
    if (!sale) throw new Error(`Sale #${saleId} not found.`);

    const now = Date.now();

    if (actionType === 'CORRECT_PAYMENT') {
      const { payments } = payload;
      const items = await this.db.getAllByIndex('sale_items', 'sale_id', sId);
      const validation = validateCompletedSale({ sale, items, payments, customerId: sale.customer_id });
      if (!validation.isValid) {
        throw new Error(`Validation error: ${validation.errors.join(', ')}`);
      }

      const oldPayments = await this.db.getAllByIndex('sale_payments', 'sale_id', sId);
      for (const op of oldPayments) {
        if (op.payment_id) {
          await this.db.delete('sale_payments', op.payment_id);
        }
      }

      for (const p of payments) {
        await this.db.add('sale_payments', {
          sale_id: sId,
          payment_type: p.payment_type,
          digital_provider: p.digital_provider || null,
          amount_cents: p.amount_cents,
          merchant_fee_cents: p.merchant_fee_cents || 0
        });
      }

      sale.needs_reconciliation = false;
      sale.reconciliation_status = 'RECONCILED';
      await this.db.put('sales', sale);

      await this.db.add('audit_log', {
        entity_type: 'Sale',
        entity_id: sId,
        action: 'MANUAL_RECONCILIATION_CORRECT_PAYMENT',
        details_json: JSON.stringify({ sale_id: sId, corrected_payments: payments }),
        created_at: now,
        timestamp: now
      });
    } else if (actionType === 'EXTERNAL_RECONCILE') {
      const { note } = payload;
      if (!note || !note.trim()) {
        throw new Error('A note is required to mark as externally reconciled.');
      }
      sale.needs_reconciliation = false;
      sale.reconciliation_status = 'EXTERNALLY_RECONCILED';
      sale.reconciliation_note = note.trim();
      await this.db.put('sales', sale);

      await this.db.add('audit_log', {
        entity_type: 'Sale',
        entity_id: sId,
        action: 'MANUAL_RECONCILIATION_EXTERNAL',
        details_json: JSON.stringify({ sale_id: sId, note: note.trim() }),
        created_at: now,
        timestamp: now
      });
    } else if (actionType === 'VOID_SALE') {
      const { note } = payload;
      if (!note || !note.trim()) {
        throw new Error('A note is required to void the sale.');
      }
      await this.voidSale(sId, note.trim());
      sale.needs_reconciliation = false;
      sale.reconciliation_status = 'VOIDED';
      await this.db.put('sales', sale);
    } else {
      throw new Error(`Unknown reconciliation action '${actionType}'.`);
    }

    return true;
  }
}

/**
 * Calculates comprehensive business intelligence metrics, inventory velocity, time patterns,
 * customer receivables, and deterministic recommendations.
 * @param {Object} params
 * @param {Array} params.sales
 * @param {Array} params.saleItems
 * @param {Array} params.pigments
 * @param {Array} params.customers
 * @param {Array} params.suppliers
 * @param {Array} params.shrinkageLogs
 * @param {string} params.timeRange - 'TODAY' | 'WEEK' | 'MONTH' | 'QUARTER' | 'YTD' | 'ALL'
 * @param {number} [params.nowTimestamp] - Optional override for current timestamp in tests
 * @returns {Object} Calculated metrics, per-pigment profitability, inventory velocity, time patterns, customer receivables & recommendations
 */
export function calculateBusinessInsights({
  sales = [],
  saleItems = [],
  pigments = [],
  customers = [],
  suppliers = [],
  shrinkageLogs = [],
  timeRange = 'ALL',
  nowTimestamp = null
}) {
  const now = nowTimestamp ? new Date(nowTimestamp) : new Date();
  const nowMs = now.getTime();

  let filterTimestamp = 0;
  if (timeRange === 'TODAY') {
    filterTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  } else if (timeRange === 'WEEK') {
    filterTimestamp = nowMs - (7 * 24 * 60 * 60 * 1000);
  } else if (timeRange === 'MONTH') {
    filterTimestamp = nowMs - (30 * 24 * 60 * 60 * 1000);
  } else if (timeRange === 'QUARTER') {
    filterTimestamp = nowMs - (90 * 24 * 60 * 60 * 1000);
  } else if (timeRange === 'YTD') {
    filterTimestamp = new Date(now.getFullYear(), 0, 1).getTime();
  }

  // 1. Filter completed sales
  const completedSales = (sales || []).filter(s => {
    const isCompleted = (s.status === 'COMPLETED' || !s.status || s.status === 'PAID');
    const ts = s.created_at || s.timestamp || s.date || 0;
    return isCompleted && (filterTimestamp === 0 || ts >= filterTimestamp);
  });

  const completedSaleIds = new Set(completedSales.map(s => s.sale_id));
  const completedSaleItems = (saleItems || []).filter(item => completedSaleIds.has(item.sale_id));

  // 30 days window sales for velocity computation
  const thirtyDaysAgoMs = nowMs - (30 * 24 * 60 * 60 * 1000);
  const salesLast30Days = (sales || []).filter(s => {
    const isCompleted = (s.status === 'COMPLETED' || !s.status || s.status === 'PAID');
    const ts = s.created_at || s.timestamp || s.date || 0;
    return isCompleted && ts >= thirtyDaysAgoMs;
  });
  const salesLast30DaysIds = new Set(salesLast30Days.map(s => s.sale_id));
  const itemsLast30Days = (saleItems || []).filter(item => salesLast30DaysIds.has(item.sale_id));

  // 2. Per-Pigment Profitability Table
  // Join sale_items -> pigments by pigment_id. Exclude pigment_id <= 0
  const productMap = new Map();

  // Initialize active pigments (excluding pigment_id <= 0)
  (pigments || []).filter(p => p.pigment_id > 0 && !p.is_archived).forEach(p => {
    productMap.set(p.pigment_id, {
      pigment_id: p.pigment_id,
      name: p.name,
      stock_mg: p.stock_mg || 0,
      is_archived: Boolean(p.is_archived),
      weightSoldMg: 0,
      revenueCents: 0,
      cogsCents: 0,
      profitCents: 0,
      marginPct: 0,
      weightSold30DaysMg: 0,
      dailySellRateMg: 0,
      estimatedDaysRemaining: Infinity,
      velocityStatus: 'Normal' // 'Reorder Soon' | 'Slow Mover' | 'Normal' | 'Out of Stock'
    });
  });

  // Aggregate timeframe sales for pigments
  completedSaleItems.forEach(item => {
    if (!item.pigment_id || item.pigment_id <= 0) return;
    let prod = productMap.get(item.pigment_id);
    if (!prod) {
      const matchPigment = (pigments || []).find(p => p.pigment_id === item.pigment_id);
      prod = {
        pigment_id: item.pigment_id,
        name: matchPigment?.name || item.pigment_name || `Pigment #${item.pigment_id}`,
        stock_mg: matchPigment?.stock_mg || 0,
        is_archived: Boolean(matchPigment?.is_archived),
        weightSoldMg: 0,
        revenueCents: 0,
        cogsCents: 0,
        profitCents: 0,
        marginPct: 0,
        weightSold30DaysMg: 0,
        dailySellRateMg: 0,
        estimatedDaysRemaining: Infinity,
        velocityStatus: 'Normal'
      };
      productMap.set(item.pigment_id, prod);
    }

    const cogs = item.unit_cogs_cents !== undefined ? item.unit_cogs_cents : (item.cogs_cents || 0);
    const rev = item.price_charged_cents || 0;

    prod.weightSoldMg += (item.weight_mg || 0);
    prod.revenueCents += rev;
    prod.cogsCents += cogs;
    prod.profitCents += (rev - cogs);
  });

  // Aggregate 30-day sales for velocity
  itemsLast30Days.forEach(item => {
    if (!item.pigment_id || item.pigment_id <= 0) return;
    const prod = productMap.get(item.pigment_id);
    if (prod) {
      prod.weightSold30DaysMg += (item.weight_mg || 0);
    }
  });

  // Compute margins and velocity for all active pigments
  const perPigmentProfitability = Array.from(productMap.values()).map(prod => {
    const marginPct = prod.revenueCents > 0 ? Number(((prod.profitCents / prod.revenueCents) * 100).toFixed(1)) : 0;
    const dailySellRateMg = prod.weightSold30DaysMg / 30; // avg weight sold per day over last 30 days
    let estimatedDaysRemaining = Infinity;
    if (dailySellRateMg > 0) {
      estimatedDaysRemaining = Math.round(prod.stock_mg / dailySellRateMg);
    }

    let velocityStatus = 'Normal';
    if (prod.stock_mg === 0) {
      velocityStatus = 'Out of Stock';
    } else if (dailySellRateMg > 0 && estimatedDaysRemaining < 7) {
      velocityStatus = 'Reorder Soon';
    } else if (estimatedDaysRemaining > 90 || (dailySellRateMg === 0 && prod.stock_mg > 0)) {
      velocityStatus = 'Slow Mover';
    }

    return {
      ...prod,
      marginPct,
      dailySellRateMg,
      estimatedDaysRemaining,
      velocityStatus
    };
  });

  // Financial Summary Totals
  const grossRevenueCents = completedSales.reduce((sum, s) => sum + (s.total_amount_cents || 0), 0);
  const totalCogsCents = completedSales.reduce((sum, s) => sum + (s.total_cogs_cents || 0), 0);
  const grossProfitCents = grossRevenueCents - totalCogsCents;
  const grossMarginPct = grossRevenueCents > 0 ? Math.round((grossProfitCents / grossRevenueCents) * 100) : 0;
  const completedCount = completedSales.length;
  const averageOrderValueCents = completedCount > 0 ? Math.round(grossRevenueCents / completedCount) : 0;

  // 3. Time-Based Patterns (Day of Week & Hour of Day)
  const dayOfWeekNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekStats = dayOfWeekNames.map(day => ({ day, count: 0, revenueCents: 0 }));
  const hourOfDayStats = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h === 0 ? 12 : h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`,
    count: 0,
    revenueCents: 0
  }));

  completedSales.forEach(s => {
    const ts = s.created_at || s.timestamp || s.date;
    if (!ts) return;
    const d = new Date(ts);
    const dayIdx = d.getDay();
    const hour = d.getHours();
    const rev = s.total_amount_cents || 0;

    if (dayOfWeekStats[dayIdx]) {
      dayOfWeekStats[dayIdx].count += 1;
      dayOfWeekStats[dayIdx].revenueCents += rev;
    }
    if (hourOfDayStats[hour]) {
      hourOfDayStats[hour].count += 1;
      hourOfDayStats[hour].revenueCents += rev;
    }
  });

  const peakDay = [...dayOfWeekStats].sort((a, b) => b.revenueCents - a.revenueCents)[0];
  const peakHour = [...hourOfDayStats].sort((a, b) => b.revenueCents - a.revenueCents)[0];

  // 4. Receivables Summary
  // Customers with current_balance_cents > 0, with days since oldest unpaid sale
  const customerReceivables = (customers || [])
    .filter(c => (c.current_balance_cents || 0) > 0)
    .map(c => {
      // Find customer's sales
      const custSales = (sales || []).filter(s => Number(s.customer_id) === Number(c.customer_id) && (s.status === 'COMPLETED' || !s.status || s.status === 'PAID'));
      const oldestSale = custSales.length > 0 ? Math.min(...custSales.map(s => s.created_at || s.timestamp || s.date || nowMs)) : null;
      const oldestDays = oldestSale ? Math.max(0, Math.floor((nowMs - oldestSale) / (24 * 60 * 60 * 1000))) : 0;

      return {
        customer_id: c.customer_id,
        name: c.name,
        amountOwedCents: c.current_balance_cents,
        oldestSaleDate: oldestSale ? new Date(oldestSale).toLocaleDateString() : 'N/A',
        daysOutstanding: oldestDays
      };
    })
    .sort((a, b) => b.amountOwedCents - a.amountOwedCents);

  const totalArCents = customerReceivables.reduce((sum, c) => sum + c.amountOwedCents, 0);

  // 5. Deterministic Rule-Based Recommendations
  const recommendations = [];

  // Rule 1: High Margin but Low Sales Volume
  const sortedByMargin = [...perPigmentProfitability].filter(p => p.revenueCents > 0).sort((a, b) => b.marginPct - a.marginPct);
  const sortedByVolume = [...perPigmentProfitability].filter(p => p.revenueCents > 0).sort((a, b) => b.weightSoldMg - a.weightSoldMg);

  if (sortedByMargin.length > 0) {
    const highestMarginPigment = sortedByMargin[0];
    const volumeRank = sortedByVolume.findIndex(p => p.pigment_id === highestMarginPigment.pigment_id) + 1;
    if (volumeRank > 1 && highestMarginPigment.marginPct >= 40) {
      recommendations.push({
        id: `rec_margin_${highestMarginPigment.pigment_id}`,
        type: 'OPPORTUNITY',
        icon: '💎',
        title: 'High Margin Promotion Opportunity',
        message: `"${highestMarginPigment.name}" has the highest margin (${highestMarginPigment.marginPct}%) but ranks #${volumeRank} in sales volume — consider promoting it.`
      });
    }
  }

  // Rule 2: Inventory Velocity Reorder Warning (<7 days remaining)
  perPigmentProfitability
    .filter(p => p.velocityStatus === 'Reorder Soon')
    .forEach(p => {
      recommendations.push({
        id: `rec_reorder_${p.pigment_id}`,
        type: 'CRITICAL',
        icon: '⚠️',
        title: 'Stock Exhaustion Warning',
        message: `"${p.name}" will run out in ~${p.estimatedDaysRemaining} day(s) at current sell rate.`
      });
    });

  // Rule 3: Customer Receivables Warning
  customerReceivables.forEach(c => {
    recommendations.push({
      id: `rec_receivable_${c.customer_id}`,
      type: c.daysOutstanding > 30 ? 'CRITICAL' : 'WARNING',
      icon: '📥',
      title: 'Outstanding Receivable',
      message: `"${c.name}" owes ${formatCents(c.amountOwedCents)}, outstanding for ${c.daysOutstanding} day(s).`
    });
  });

  // Rule 4: Slow Mover Recommendation (>90 days remaining or 0 sales with stock)
  perPigmentProfitability
    .filter(p => p.velocityStatus === 'Slow Mover' && p.stock_mg > 0)
    .forEach(p => {
      const daysStr = Number.isFinite(p.estimatedDaysRemaining) ? `~${p.estimatedDaysRemaining} days` : 'zero sales in 30 days';
      recommendations.push({
        id: `rec_slow_${p.pigment_id}`,
        type: 'OPPORTUNITY',
        icon: '📦',
        title: 'Slow Moving Stock Discount',
        message: `"${p.name}" has ${formatMgToGrams(p.stock_mg)} in stock with ${daysStr} sell-through. Consider bundling or pricing discount.`
      });
    });

  return {
    timeRange,
    completedCount,
    grossRevenueCents,
    totalCogsCents,
    grossProfitCents,
    grossMarginPct,
    averageOrderValueCents,
    perPigmentProfitability,
    dayOfWeekStats,
    hourOfDayStats,
    peakDay,
    peakHour,
    customerReceivables,
    totalArCents,
    recommendations
  };
}



