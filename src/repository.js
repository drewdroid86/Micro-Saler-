/**
 * @fileoverview Business logic repository layer for Micro Saler POS (React version).
 */

export function formatCents(cents) {
  const c = (cents === null || cents === undefined || isNaN(cents)) ? 0 : Number(cents);
  if (c < 0) {
    return `-$${(Math.abs(c) / 100).toFixed(2)}`;
  }
  return `$${(c / 100).toFixed(2)}`;
}

export function calculateCustomerBalance(customer, prepayments = []) {
  if (!customer) {
    return {
      balance: 0,
      balanceCents: 0,
      currentBalanceCents: 0,
      debtCents: 0,
      storeCreditCents: 0,
      prepaidCreditCents: 0,
      prepaidWeightMg: 0,
      totalCreditCents: 0,
      creditLimitCents: 0,
      availableCreditCents: 0,
      utilizationPercent: 0,
      balanceType: 'ZERO',
      hasDebt: false,
      hasCredit: false,
      hasStoreCredit: false,
      hasPrepayments: false,
      prepaymentCount: 0,
      formattedBalance: '$0.00',
      formattedNet: '$0.00',
      formattedDebt: '$0.00',
      formattedStoreCredit: '$0.00',
      formattedAvailableCredit: '$0.00'
    };
  }

  // Primary balance field: positive = credit, negative = debt
  let balance = 0;
  if (customer.balance !== undefined && customer.balance !== null) {
    balance = Number(customer.balance) || 0;
  } else if (customer.current_balance_cents !== undefined && customer.current_balance_cents !== null) {
    balance = -Number(customer.current_balance_cents) || 0;
  }

  const debtCents = balance < 0 ? Math.abs(balance) : 0;
  const storeCreditCents = balance > 0 ? balance : 0;

  const custPrepayments = (prepayments || []).filter(
    p => Number(p.customer_id) === Number(customer.customer_id) && p.status !== 'FULFILLED'
  );
  const prepaidCreditCents = custPrepayments.reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
  const prepaidWeightMg = custPrepayments.reduce((sum, p) => sum + (Number(p.weight_mg) || 0), 0);
  const totalCreditCents = storeCreditCents + prepaidCreditCents;
  const creditLimitCents = Number(customer.credit_limit_cents) || 0;

  // Available credit: credit limit minus debt plus any store credit
  const availableCreditCents = Math.max(0, creditLimitCents - debtCents) + storeCreditCents;
  const utilizationPercent = creditLimitCents > 0
    ? Math.min(100, Math.round((debtCents / creditLimitCents) * 100))
    : 0;

  let balanceType = 'ZERO';
  if (balance < 0) {
    balanceType = 'DEBT';
  } else if (balance > 0) {
    balanceType = 'STORE_CREDIT';
  } else if (prepaidCreditCents > 0) {
    balanceType = 'PREPAID_ONLY';
  }

  const formattedBalance = balance > 0
    ? `+${formatCents(balance)}`
    : balance < 0
    ? formatCents(balance)
    : '$0.00';

  const customerType = (customer.customer_type || (customer.is_wholesale ? 'WHOLESALE' : 'RETAIL')).toUpperCase();
  const isWholesale = customerType === 'WHOLESALE';

  return {
    balance,
    balanceCents: balance,
    currentBalanceCents: -balance, // Legacy compatibility
    debtCents,
    storeCreditCents,
    prepaidCreditCents,
    prepaidWeightMg,
    totalCreditCents,
    creditLimitCents,
    availableCreditCents,
    utilizationPercent,
    balanceType,
    customerType,
    isWholesale,
    hasDebt: balance < 0,
    hasCredit: totalCreditCents > 0,
    hasStoreCredit: balance > 0,
    hasPrepayments: custPrepayments.length > 0,
    prepaymentCount: custPrepayments.length,
    formattedBalance,
    formattedNet: formatCents(balance),
    formattedDebt: formatCents(debtCents),
    formattedStoreCredit: formatCents(storeCreditCents),
    formattedAvailableCredit: formatCents(availableCreditCents)
  };
}

export function formatMgToGrams(mg) {
  const m = (mg === null || mg === undefined || isNaN(mg)) ? 0 : Number(mg);
  return `${(m / 1000).toFixed(1)}g`;
}

export const APPROVED_PAYMENT_TYPES = new Set(['CASH', 'DIGITAL', 'HOUSE_TAB', 'PREPAID_DELIVERY', 'STORE_CREDIT']);

export const DEFAULT_MERCHANT_FEE_RATES = {
  SQUARE: { percentage: 0.026, fixedCents: 10, description: '2.6% + $0.10' },
  VENMO: { percentage: 0.019, fixedCents: 10, description: '1.9% + $0.10' },
  ZELLE: { percentage: 0.0, fixedCents: 0, description: 'No Fee ($0.00)' },
  DEFAULT: { percentage: 0.029, fixedCents: 30, description: '2.9% + $0.30' }
};

/**
 * Extensible helper to calculate merchant processing fees for digital payments.
 * Supports provider presets (Square, Venmo, Zelle) as well as custom rate overrides,
 * fixed fees, or direct fee overrides to preserve flexibility for changing deal terms.
 *
 * @param {string} [provider='SQUARE'] - Payment provider ('Square', 'Venmo', 'Zelle', etc.)
 * @param {number} [amountCents=0] - Transaction amount in cents
 * @param {Object} [options={}] - Custom override options
 * @param {number} [options.customRate] - Custom percentage rate (e.g. 0.026 for 2.6%)
 * @param {number} [options.customFixedCents] - Custom fixed cents (e.g. 15 for $0.15)
 * @param {number} [options.customFeeCents] - Direct override of calculated fee in cents
 * @returns {number} Calculated merchant fee in cents (rounded integer >= 0)
 */
export function calculateMerchantFeeCents(provider = 'SQUARE', amountCents = 0, options = {}) {
  const amt = Number(amountCents) || 0;
  if (amt <= 0) return 0;

  if (options && options.customFeeCents !== undefined && options.customFeeCents !== null && !isNaN(options.customFeeCents)) {
    return Math.max(0, Math.round(Number(options.customFeeCents)));
  }

  const key = (provider || 'DEFAULT').toUpperCase().trim();
  const preset = DEFAULT_MERCHANT_FEE_RATES[key] || DEFAULT_MERCHANT_FEE_RATES.DEFAULT;

  const rate = (options && options.customRate !== undefined && options.customRate !== null && !isNaN(options.customRate))
    ? Number(options.customRate)
    : preset.percentage;

  const fixed = (options && options.customFixedCents !== undefined && options.customFixedCents !== null && !isNaN(options.customFixedCents))
    ? Number(options.customFixedCents)
    : preset.fixedCents;

  const fee = (amt * rate) + fixed;
  return Math.max(0, Math.round(fee));
}

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

  if (Math.abs(calculatedPaymentsTotal - saleTotalCents) > 1) {
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
  return `${(m / OZ_TO_MG).toFixed(2)} oz`;
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

  let priceCalculated = false;
  if (pigment) {
    matchedTier = getMatchedTier(pigment, safeWeightMg);
    const presetTier = priceTiers?.find(
      t => Number(t.pigment_id) === Number(pigment.pigment_id) && Number(t.weight_mg) === Number(safeWeightMg)
    );

    if (customPriceCents !== null && customPriceCents !== undefined && !isNaN(customPriceCents)) {
      totalPriceCents = Math.max(0, Math.round(Number(customPriceCents)));
      effectiveRatePerGramCents = weightGrams > 0 ? Math.round((totalPriceCents - pkgCents) / weightGrams) : 0;
      priceCalculated = true;
    } else if (presetTier) {
      const presetPrice = pricingMode === 'RETAIL' ? presetTier.retail_price_cents : presetTier.wholesale_price_cents;
      if (presetPrice !== null && presetPrice !== undefined && !isNaN(presetPrice) && Number(presetPrice) > 0) {
        totalPriceCents = Number(presetPrice);
        effectiveRatePerGramCents = weightGrams > 0 ? Math.round((totalPriceCents - pkgCents) / weightGrams) : 0;
        priceCalculated = true;
      }
    }

    if (!priceCalculated && safeWeightMg > 0) {
      effectiveRatePerGramCents = getEffectivePricePerGramCents(pigment, safeWeightMg, pricingMode);
      const rawPkg = pkgCents || (pigment.default_pkg_cents || 0);
      totalPriceCents = Math.round(weightGrams * effectiveRatePerGramCents) + rawPkg;
    }
  } else if (customPriceCents !== null && customPriceCents !== undefined) {
    totalPriceCents = Math.max(0, Math.round(Number(customPriceCents)));
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

  /**
   * BUG-06 / IMP-08: Shared supplier resolution helper.
   * Resolves an existing supplier by id or name, or creates a new one.
   * Used by both restockPigment() and createPigment() to ensure supplier
   * auto-creation is handled identically from both code paths.
   * @param {IDBTransaction} tx - The current IDB transaction (must include 'suppliers' store)
   * @param {number|null} supplierId
   * @param {string|null} supplierName
   * @returns {Promise<number|null>} supplier_id or null
   */
  async _resolveOrCreateSupplierInTx(tx, supplierId, supplierName) {
    const suppliersStore = tx.objectStore('suppliers');
    let sId = supplierId ? Number(supplierId) : null;
    if (!sId && supplierName && supplierName.trim()) {
      const trimmedName = supplierName.trim();
      const allSuppliers = await new Promise((resolve, reject) => {
        const req = suppliersStore.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      const existingSupplier = allSuppliers.find(s => s.name.toLowerCase() === trimmedName.toLowerCase());
      if (existingSupplier) {
        sId = existingSupplier.supplier_id;
      } else {
        // Auto-create new supplier to capture debt and ledger tracking
        sId = await new Promise((resolve, reject) => {
          const req = suppliersStore.add({
            name: trimmedName,
            contact_info: '',
            current_balance_cents: 0,
            created_at: new Date().toISOString()
          });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
    }
    return sId;
  }

  /**
   * BUG-06 / IMP-08: Shared supplier balance writer.
   * All mutations to supplier.current_balance_cents must go through here;
   * direct field assignments in put() calls are forbidden.
   * @param {IDBTransaction} tx - The current IDB transaction (must include 'suppliers' store)
   * @param {number} supplierId
   * @param {number} addCents - Amount to add (positive = increases debt owed to supplier)
   */
  async _updateSupplierBalanceInTx(tx, supplierId, addCents) {
    const suppliersStore = tx.objectStore('suppliers');
    const supplier = await new Promise((resolve, reject) => {
      const req = suppliersStore.get(Number(supplierId));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (supplier) {
      supplier.current_balance_cents = (supplier.current_balance_cents || 0) + addCents;
      suppliersStore.put(supplier);
    }
  }

  /**
   * BUG-09: Unified credit exposure calculation.
   * Returns the net tab-debt minus the business's open prepayment liabilities
   * for a customer, so that the credit limit check in completeSale() accounts
   * for money the business already holds from the customer.
   *
   * Exposure = -(customer.balance) — open prepayment amounts
   * Positive exposure = net amount still owed by the customer above what we hold.
   * @param {number} customerId
   * @returns {Promise<number>} netExposureCents (positive = customer owes us)
   */
  async getCustomerTotalExposure(customerId) {
    const customer = await this.db.getById('customers', Number(customerId));
    if (!customer) return 0;
    // customer.balance: positive = store credit, negative = debt
    // Debt exposure = -(balance). If balance is -500 (debt), exposure = +500.
    const tabDebtExposure = -(Number(customer.balance) || 0);
    let prepaymentOffset = 0;
    try {
      const allPrepayments = await this.db.getAll('customer_prepayments');
      const openPrepayments = allPrepayments.filter(p =>
        p.customer_id === Number(customerId) &&
        !['DELIVERED', 'CANCELLED', 'VOIDED'].includes(p.status)
      );
      // Money business holds from customer reduces effective debt exposure
      prepaymentOffset = openPrepayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);
    } catch (_) {}
    return tabDebtExposure - prepaymentOffset;
  }

  async restockPigment(pigmentId, receivedMg, totalCostCents, supplierName, paymentStatus = 'PAID', supplierId = null, paidDownCents = 0) {
    const pId = Number(pigmentId);
    const validReceivedMg = Number(receivedMg);
    const validTotalCostCents = Number(totalCostCents);
    if (!validReceivedMg || validReceivedMg <= 0 || isNaN(validReceivedMg)) {
      throw new Error('Received stock weight must be greater than 0');
    }
    if (isNaN(validTotalCostCents) || validTotalCostCents < 0) {
      throw new Error('Total restock cost cannot be negative');
    }

    return await this.db.runTransaction(
      ['pigments', 'stock_receipts', 'suppliers', 'supplier_payments'],
      'readwrite',
      async (tx) => {
        const pigmentsStore = tx.objectStore('pigments');
        const receiptsStore = tx.objectStore('stock_receipts');
        const suppliersStore = tx.objectStore('suppliers');
        const suppPayStore = tx.objectStore('supplier_payments');

        const pigment = await new Promise((resolve, reject) => {
          const req = pigmentsStore.get(pId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

        pigment.stock_mg += receivedMg;
        pigment.total_cost_cents += totalCostCents;
        pigmentsStore.put(pigment);

        // BUG-06: Resolve or auto-create supplier via shared helper (same logic as createPigment path).
        const sId = await this._resolveOrCreateSupplierInTx(tx, supplierId, supplierName);

        const safePaidDown = paymentStatus === 'PAID'
          ? totalCostCents
          : Math.min(totalCostCents, Math.max(0, paidDownCents || 0));

        const unpaidTabCents = paymentStatus === 'PAID' ? 0 : Math.max(0, totalCostCents - safePaidDown);

        // Update supplier balance if unpaid tab via shared helper (single-writer discipline)
        if (unpaidTabCents > 0 && sId) {
          await this._updateSupplierBalanceInTx(tx, sId, unpaidTabCents);
        }

        const statusLabel = paymentStatus === 'PAID'
          ? 'PAID'
          : safePaidDown > 0
            ? `PARTIAL ($${(safePaidDown / 100).toFixed(2)} Paid / $${(unpaidTabCents / 100).toFixed(2)} Owed)`
            : 'UNPAID_TAB';

        const receiptId = await new Promise((resolve, reject) => {
          const req = receiptsStore.add({
            pigment_id: pId,
            received_mg: receivedMg,
            total_cost_cents: totalCostCents,
            paid_down_cents: safePaidDown,
            unpaid_tab_cents: unpaidTabCents,
            supplier_name: supplierName || '',
            supplier_id: sId,
            payment_status: statusLabel,
            received_at: Date.now(),
          });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        if (safePaidDown > 0 && sId && paymentStatus !== 'PAID') {
          suppPayStore.add({
            supplier_id: sId,
            amount_cents: safePaidDown,
            payment_type: 'DOWN_PAYMENT',
            notes: `Restock down payment for receipt #${receiptId}`,
            created_at: Date.now(),
          });
        }

        return receiptId;
      }
    );
  }

  async voidStockReceipt(receiptId, reason = 'Entry Error') {
    const receipt = await this.db.getById('stock_receipts', Number(receiptId));
    if (!receipt) throw new Error(`Stock receipt #${receiptId} not found`);
    const rId = Number(receiptId);
    return await this.db.runTransaction(
      ['stock_receipts', 'pigments', 'suppliers', 'audit_log'],
      'readwrite',
      async (tx) => {
        const receiptsStore = tx.objectStore('stock_receipts');
        const pigmentsStore = tx.objectStore('pigments');
        const suppliersStore = tx.objectStore('suppliers');
        const auditStore = tx.objectStore('audit_log');

        const receipt = await new Promise((resolve, reject) => {
          const req = receiptsStore.get(rId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (!receipt) throw new Error(`Stock receipt #${receiptId} not found`);
        if (receipt.payment_status === 'VOIDED') throw new Error(`Receipt #${receiptId} is already voided`);

        // Reverse pigment stock and cost
        if (receipt.pigment_id) {
          const pigment = await new Promise((resolve, reject) => {
            const req = pigmentsStore.get(Number(receipt.pigment_id));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (pigment) {
            pigment.stock_mg = Math.max(0, pigment.stock_mg - (receipt.received_mg || 0));
            pigment.total_cost_cents = Math.max(0, pigment.total_cost_cents - (receipt.total_cost_cents || 0));
            pigmentsStore.put(pigment);
          }
        }

        // Reverse supplier tab
        const unpaidTabCents = receipt.unpaid_tab_cents || (receipt.payment_status === 'UNPAID_TAB' ? receipt.total_cost_cents : 0);
        if (unpaidTabCents > 0 && receipt.supplier_id) {
          const supplier = await new Promise((resolve, reject) => {
            const req = suppliersStore.get(Number(receipt.supplier_id));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (supplier) {
            supplier.current_balance_cents = (supplier.current_balance_cents || 0) - unpaidTabCents;
            suppliersStore.put(supplier);
          }
        }

        receipt.payment_status = 'VOIDED';
        receipt.void_reason = reason;
        receipt.voided_at = Date.now();
        receiptsStore.put(receipt);

        const now = Date.now();
        auditStore.add({
          entity_type: 'StockReceipt',
          entity_id: rId,
          action: 'VOID_STOCK_RECEIPT',
          details_json: JSON.stringify({ receipt_id: rId, reason, pigment_id: receipt.pigment_id }),
          created_at: now,
          timestamp: now,
        });

        return true;
      }
    );
  }

  async updateRestockTerms(receiptId, paymentStatus, paidDownCents) {
    const rId = Number(receiptId);
    return await this.db.runTransaction(
      ['stock_receipts', 'suppliers', 'audit_log'],
      'readwrite',
      async (tx) => {
        const receiptsStore = tx.objectStore('stock_receipts');
        const suppliersStore = tx.objectStore('suppliers');
        const auditStore = tx.objectStore('audit_log');

        const receipt = await new Promise((resolve, reject) => {
          const req = receiptsStore.get(rId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
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
          const supplier = await new Promise((resolve, reject) => {
            const req = suppliersStore.get(Number(receipt.supplier_id));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (supplier) {
            supplier.current_balance_cents = (supplier.current_balance_cents || 0) + tabDiffCents;
            suppliersStore.put(supplier);
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
        receiptsStore.put(receipt);

        const now = Date.now();
        auditStore.add({
          entity_type: 'StockReceipt',
          entity_id: rId,
          action: 'EDIT_RESTOCK_PURCHASE_TERMS',
          details_json: JSON.stringify({
            receipt_id: rId,
            old_unpaid_cents: oldUnpaidTabCents,
            new_unpaid_cents: newUnpaidTabCents,
            tab_diff_cents: tabDiffCents
          }),
          created_at: now,
          timestamp: now,
        });

        return receipt;
      }
    );
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
    for (const name of storeNames) {
      await this.db.clearStore(name);
    }
    return true;
  }

  async logShrinkage(pigmentId, mgLost, reason) {
    const pId = Number(pigmentId);
    return await this.db.runTransaction(['pigments', 'shrinkage_logs'], 'readwrite', async (tx) => {
      const pigmentsStore = tx.objectStore('pigments');
      const shrinkageStore = tx.objectStore('shrinkage_logs');

      const pigment = await new Promise((resolve, reject) => {
        const req = pigmentsStore.get(pId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

      if (mgLost > pigment.stock_mg) {
        throw new Error(`Cannot log shrinkage of ${mgLost}mg — only ${pigment.stock_mg}mg in stock`);
      }

      const cogsLossCents = pigment.stock_mg > 0
        ? Math.floor((pigment.total_cost_cents / pigment.stock_mg) * mgLost)
        : 0;

      pigment.stock_mg = Math.max(0, pigment.stock_mg - mgLost);
      pigment.total_cost_cents = Math.max(0, pigment.total_cost_cents - cogsLossCents);
      pigmentsStore.put(pigment);

      const logId = await new Promise((resolve, reject) => {
        const req = shrinkageStore.add({
          pigment_id: pId,
          mg_lost: mgLost,
          weight_mg: mgLost,
          cogs_loss_cents: cogsLossCents,
          reason,
          created_at: Date.now(),
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return logId;
    });
  }

  async completeSale(customerId, items, payments, isCreditOverride = false, pricingMode = 'RETAIL') {
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

      // BUG-09: Credit exposure netting — tab debt is checked against the unified exposure
      // (customer.balance + outstanding open prepayments), not just customer.balance alone.
      const netExposureCents = await this.getCustomerTotalExposure(Number(customerId));
      const creditLimitCents = Number(customer.credit_limit_cents) || 0;
      const availableCredit = creditLimitCents - netExposureCents;

      if (tabAmount > availableCredit && !isCreditOverride) {
        throw new Error(`Credit limit exceeded. Available: $${(availableCredit/100).toFixed(2)}, Requested: $${(tabAmount/100).toFixed(2)}. Enable Handshake Override.`);
      }
    }

    // Atomic IndexedDB multi-store transaction with in-transaction inventory reads & stock validation
    const storeNames = ['sales', 'sale_items', 'sale_payments', 'pigments', 'customers', 'customer_ledger', 'audit_log'];
    const now = Date.now();
    let createdSaleId = null;

    await this.db.runTransaction(storeNames, 'readwrite', async (tx) => {
      const salesStore = tx.objectStore('sales');
      const saleItemsStore = tx.objectStore('sale_items');
      const salePaymentsStore = tx.objectStore('sale_payments');
      const pigmentsStore = tx.objectStore('pigments');
      const customersStore = tx.objectStore('customers');
      const auditStore = tx.objectStore('audit_log');

      // 1. Read & validate all pigments inside the transaction lock.
      // Aggregate requested weight per pigment FIRST so that multiple cart
      // lines referencing the same pigment are validated and deducted
      // against one shared running total, not independent snapshots
      // (independent reads would let a later put() silently clobber an
      // earlier one — the "last write wins" duplicate-pigment bug).
      const requestedByPigment = new Map(); // pId -> total weight_mg requested
      for (const item of items) {
        const pId = Number(item.pigment_id);
        if (pId > 0) {
          requestedByPigment.set(pId, (requestedByPigment.get(pId) || 0) + item.weight_mg);
        }
      }

      const pigmentCache = new Map(); // pId -> pigment record (single shared instance)
      for (const [pId, totalRequested] of requestedByPigment.entries()) {
        const pigment = await new Promise((resolve, reject) => {
          const req = pigmentsStore.get(pId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        if (!pigment) {
          tx.abort();
          throw new Error(`Pigment #${pId} not found in database.`);
        }
        if (pigment.stock_mg < totalRequested) {
          tx.abort();
          throw new Error(`Insufficient stock for ${pigment.name}. Available: ${formatMgToGrams(pigment.stock_mg)}, Requested: ${formatMgToGrams(totalRequested)}.`);
        }

        pigmentCache.set(pId, pigment);
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
          sale_type: (pricingMode || 'RETAIL').toUpperCase(),
          pricing_mode: (pricingMode || 'RETAIL').toUpperCase(),
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

      // 4. Write sale_items and accumulate pigment stock deductions against
      // the single shared pigment instance for that pigment_id with live WAC COGS.
      for (const item of items) {
        const pId = Number(item.pigment_id);
        if (pId > 0) {
          const pigment = pigmentCache.get(pId);
          const liveUnitCogs = pigment && pigment.stock_mg > 0
            ? Math.round((pigment.total_cost_cents / pigment.stock_mg) * item.weight_mg)
            : (item.unit_cogs_cents || 0);

          saleItemsStore.add({
            sale_id: createdSaleId,
            pigment_id: pId,
            weight_mg: item.weight_mg,
            price_charged_cents: item.price_charged_cents,
            unit_cogs_cents: liveUnitCogs,
          });

          pigment.stock_mg = Math.max(0, pigment.stock_mg - item.weight_mg);
          pigment.total_cost_cents = Math.max(0, pigment.total_cost_cents - liveUnitCogs);
        }
      }

      // Persist each pigment exactly once, after all its cart lines have
      // been folded into the shared instance.
      for (const pigment of pigmentCache.values()) {
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

      // 5. Write payments and update customer ledger/balance
      for (const payment of payments) {
        const calculatedFee = payment.merchant_fee_cents !== undefined && payment.merchant_fee_cents !== null
          ? Number(payment.merchant_fee_cents) || 0
          : (payment.payment_type === 'DIGITAL' ? calculateMerchantFeeCents(payment.digital_provider, payment.amount_cents) : 0);

        salePaymentsStore.add({
          sale_id: createdSaleId,
          payment_type: payment.payment_type,
          digital_provider: payment.digital_provider || null,
          amount_cents: payment.amount_cents,
          merchant_fee_cents: calculatedFee,
        });

        if (payment.payment_type === 'HOUSE_TAB' && customerObj) {
          await this._applyLedgerEntryInTx(tx, {
            customerId: Number(customerId),
            amountCents: -payment.amount_cents, // Negative signed amount = debt
            type: 'SALE_DEBT',
            description: `House tab charge for Sale #${createdSaleId}`,
            saleId: createdSaleId,
            timestamp: now
          });
        } else if ((payment.payment_type === 'STORE_CREDIT' || payment.payment_type === 'PREPAID_DELIVERY') && customerObj) {
          await this._applyLedgerEntryInTx(tx, {
            customerId: Number(customerId),
            amountCents: -payment.amount_cents, // Negative signed amount = credit consumed
            type: 'SALE_CREDIT_APPLIED',
            description: `Store credit applied to Sale #${createdSaleId}`,
            saleId: createdSaleId,
            timestamp: now
          });
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
    const siId = Number(saleItemId);
    return await this.db.runTransaction(
      ['sales', 'sale_items', 'sale_payments', 'returns', 'pigments', 'customers', 'customer_ledger'],
      'readwrite',
      async (tx) => {
        const salesStore = tx.objectStore('sales');
        const saleItemsStore = tx.objectStore('sale_items');
        const salePaymentsStore = tx.objectStore('sale_payments');
        const returnsStore = tx.objectStore('returns');
        const pigmentsStore = tx.objectStore('pigments');

        const saleItem = await new Promise((resolve, reject) => {
          const req = saleItemsStore.get(siId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (!saleItem) throw new Error(`SaleItem ${saleItemId} not found`);

        const existingReturns = await new Promise((resolve, reject) => {
          const req = returnsStore.index('sale_item_id').getAll(siId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        const alreadyReturnedMg = existingReturns.reduce((sum, r) => sum + r.mg_returned, 0);
        const maxEligible = saleItem.weight_mg - alreadyReturnedMg;

        if (mgReturned > maxEligible) {
          throw new Error(`Cannot return ${formatMgToGrams(mgReturned)} — max eligible is ${formatMgToGrams(maxEligible)}`);
        }

        const proportionalRefundCents = saleItem.weight_mg > 0
          ? Math.round((saleItem.price_charged_cents / saleItem.weight_mg) * mgReturned)
          : 0;

        const returnId = await new Promise((resolve, reject) => {
          const req = returnsStore.add({
            sale_item_id: siId,
            mg_returned: mgReturned,
            refund_amount_cents: proportionalRefundCents,
            restock_to_inventory: restockToInventory,
            reason,
            created_at: Date.now(),
          });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        if (restockToInventory && saleItem.pigment_id > 0) {
          const pigment = await new Promise((resolve, reject) => {
            const req = pigmentsStore.get(Number(saleItem.pigment_id));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (pigment) {
            const proportionalCogs = saleItem.weight_mg > 0
              ? Math.floor((saleItem.unit_cogs_cents / saleItem.weight_mg) * mgReturned)
              : 0;
            pigment.stock_mg += mgReturned;
            pigment.total_cost_cents += proportionalCogs;
            pigmentsStore.put(pigment);
          }
        }

        // BUG-01: Restore store credit balance when original sale used STORE_CREDIT payment.
        // _applyLedgerEntryInTx is the sole writer of customer.balance — no direct field assignment.
        if (proportionalRefundCents > 0 && saleItem.sale_id) {
          const salePayments = await new Promise((resolve, reject) => {
            const req = salePaymentsStore.index('sale_id').getAll(Number(saleItem.sale_id));
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          });
          const storeCreditPayments = salePayments.filter(p => p.payment_type === 'STORE_CREDIT');
          if (storeCreditPayments.length > 0) {
            // Determine the sale's customer
            const sale = await new Promise((resolve, reject) => {
              const req = salesStore.get(Number(saleItem.sale_id));
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            if (sale && sale.customer_id) {
              // Proportionally refund only the store-credit portion of the original sale
              const totalSaleStoreCreditCents = storeCreditPayments.reduce((s, p) => s + (p.amount_cents || 0), 0);
              const totalSaleAmountCents = saleItem.price_charged_cents || proportionalRefundCents;
              const storeCreditFraction = totalSaleAmountCents > 0
                ? Math.min(1, totalSaleStoreCreditCents / totalSaleAmountCents)
                : 1;
              const storeCreditRefundCents = Math.round(proportionalRefundCents * storeCreditFraction);
              if (storeCreditRefundCents > 0) {
                await this._applyLedgerEntryInTx(tx, {
                  customerId: sale.customer_id,
                  amountCents: storeCreditRefundCents,
                  type: 'REFUND_STORE_CREDIT',
                  description: `Store credit restored for return on sale #${saleItem.sale_id}`,
                  saleId: saleItem.sale_id
                });
              }
            }
          }
        }

        return returnId;
      }
    );
  }

  async voidSale(saleId, reason) {
    const sId = Number(saleId);
    return await this.db.runTransaction(
      ['sales', 'sale_items', 'sale_payments', 'pigments', 'customers', 'customer_ledger', 'returns', 'audit_log', 'customer_prepayments'],
      'readwrite',
      async (tx) => {
        const salesStore = tx.objectStore('sales');
        const saleItemsStore = tx.objectStore('sale_items');
        const salePaymentsStore = tx.objectStore('sale_payments');
        const pigmentsStore = tx.objectStore('pigments');
        const customersStore = tx.objectStore('customers');
        const returnsStore = tx.objectStore('returns');
        const auditStore = tx.objectStore('audit_log');

        const sale = await new Promise((resolve, reject) => {
          const req = salesStore.get(sId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (!sale) throw new Error(`Sale ${saleId} not found`);
        if (sale.status === 'VOIDED') return sale;

        // Read all sale items
        const items = await new Promise((resolve, reject) => {
          const req = saleItemsStore.index('sale_id').getAll(sId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });

        // Restock only net weight (sold − already returned) for each item
        for (const item of items) {
          if (!item.pigment_id || item.pigment_id <= 0) continue;

          const itemReturns = await new Promise((resolve, reject) => {
            const req = returnsStore.index('sale_item_id').getAll(item.sale_item_id);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
          });
          const alreadyReturnedMg = itemReturns.reduce((sum, r) => sum + (r.mg_returned || 0), 0);
          const netMg = item.weight_mg - alreadyReturnedMg;

          if (netMg < 0) {
            throw new Error(`Cannot void sale #${saleId}: item #${item.sale_item_id} has more returns (${alreadyReturnedMg}mg) than original weight (${item.weight_mg}mg)`);
          }

          if (netMg > 0) {
            const netCogs = item.weight_mg > 0
              ? Math.round((item.unit_cogs_cents / item.weight_mg) * netMg)
              : 0;

            const pigment = await new Promise((resolve, reject) => {
              const req = pigmentsStore.get(Number(item.pigment_id));
              req.onsuccess = () => resolve(req.result);
              req.onerror = () => reject(req.error);
            });
            if (pigment) {
              pigment.stock_mg += netMg;
              pigment.total_cost_cents += netCogs;
              pigmentsStore.put(pigment);
            }
          }
        }

        // Reverse customer tab charges via customer_ledger
        const payments = await new Promise((resolve, reject) => {
          const req = salePaymentsStore.index('sale_id').getAll(sId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });

        const now = Date.now();

        if (sale.customer_id) {
          const tabTotal = payments
            .filter(p => p.payment_type === 'HOUSE_TAB')
            .reduce((sum, p) => sum + p.amount_cents, 0);

          if (tabTotal > 0) {
            await this._applyLedgerEntryInTx(tx, {
              customerId: Number(sale.customer_id),
              amountCents: tabTotal, // Positive reversal of debt
              type: 'SALE_VOID_REVERSAL',
              description: `Reversal of tab charges from voided Sale #${sId}`,
              saleId: sId,
              timestamp: now
            });
          }

          const storeCreditTotal = payments
            .filter(p => p.payment_type === 'STORE_CREDIT')
            .reduce((sum, p) => sum + p.amount_cents, 0);

          if (storeCreditTotal > 0) {
            await this._applyLedgerEntryInTx(tx, {
              customerId: Number(sale.customer_id),
              amountCents: storeCreditTotal, // Positive refund restoring customer store credit
              type: 'SALE_VOID_CREDIT_REFUND',
              description: `Refund of store credit applied to voided Sale #${sId}`,
              saleId: sId,
              timestamp: now
            });
          }
        }

        // Restore prepayment if this sale originated from a fulfilled prepayment
        if (sale.prepayment_id) {
          const prepStore = tx.objectStore('customer_prepayments');
          const prepayment = await new Promise((resolve, reject) => {
            const req = prepStore.get(Number(sale.prepayment_id));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (prepayment && prepayment.status === 'FULFILLED') {
            prepayment.status = 'PENDING_DELIVERY';
            delete prepayment.fulfilled_at;
            delete prepayment.fulfillment_notes;
            prepStore.put(prepayment);
          }
        }

        // Mark sale as voided
        sale.status = 'VOIDED';
        sale.void_reason = reason;
        salesStore.put(sale);

        auditStore.add({
          entity_type: 'Sale',
          entity_id: sId,
          action: 'VOID_SALE',
          details_json: JSON.stringify({ sale_id: sId, reason }),
          created_at: now,
          timestamp: now,
        });
      }
    );
  }

  /**
   * Internal helper to synchronously write a ledger entry and update customer.balance
   * inside an active database transaction.
   */
  async _applyLedgerEntryInTx(tx, { customerId, amountCents, type, description = '', saleId = null, tabPaymentId = null, prepaymentId = null, timestamp = null }) {
    const ledgerStore = tx.objectStore('customer_ledger');
    const custStore = tx.objectStore('customers');
    const cId = Number(customerId);
    const now = timestamp || Date.now();
    const signedAmount = Math.round(Number(amountCents) || 0);

    const ledgerRecord = {
      customer_id: cId,
      amount_cents: signedAmount,
      type,
      description: description || '',
      sale_id: saleId ? Number(saleId) : null,
      tab_payment_id: tabPaymentId ? Number(tabPaymentId) : null,
      prepayment_id: prepaymentId ? Number(prepaymentId) : null,
      created_at: now,
      timestamp: now,
    };

    await new Promise((resolve, reject) => {
      const req = ledgerStore.add(ledgerRecord);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return await new Promise((resolve, reject) => {
      const req = custStore.get(cId);
      req.onsuccess = () => {
        const customer = req.result;
        if (customer) {
          customer.balance = (Number(customer.balance) || 0) + signedAmount;
          customer.current_balance_cents = (-customer.balance) === 0 ? 0 : -customer.balance; // Legacy compatibility
          custStore.put(customer);
        }
        resolve(customer);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Records a payment received from a customer independent of a sale.
   * Positive ledger entry: reduces debt or increases store credit.
   */
  async recordCustomerPayment(customerId, amountPaidCents, paymentType = 'CASH', digitalProvider = null, notes = '') {
    const cId = Number(customerId);
    const paidCents = Math.round(Number(amountPaidCents) || 0);
    if (paidCents <= 0) throw new Error('Payment amount must be positive');
    const now = Date.now();

    return await this.db.runTransaction(['customers', 'customer_ledger', 'tab_payments', 'audit_log'], 'readwrite', async (tx) => {
      const custStore = tx.objectStore('customers');
      const tabStore = tx.objectStore('tab_payments');
      const auditStore = tx.objectStore('audit_log');

      const customer = await new Promise((resolve, reject) => {
        const req = custStore.get(cId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!customer) throw new Error(`Customer #${cId} not found`);

      const prevBal = Number(customer.balance) || 0;
      const newBal = prevBal + paidCents;

      const tabPaymentId = await new Promise((resolve, reject) => {
        const req = tabStore.add({
          customer_id: cId,
          amount_paid_cents: paidCents,
          payment_type: paymentType,
          digital_provider: digitalProvider,
          notes: notes || '',
          created_at: now,
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      await this._applyLedgerEntryInTx(tx, {
        customerId: cId,
        amountCents: paidCents, // Positive amount reduces debt or adds credit
        type: 'PAYMENT_RECEIVED',
        description: notes ? `Payment (${paymentType}): ${notes}` : `Payment received via ${paymentType}${digitalProvider ? ` (${digitalProvider})` : ''}`,
        tabPaymentId,
        timestamp: now
      });

      await new Promise((resolve, reject) => {
        const req = auditStore.add({
          entity_type: 'Customer',
          entity_id: cId,
          action: 'RECORD_CUSTOMER_PAYMENT',
          details_json: JSON.stringify({
            tab_payment_id: tabPaymentId,
            customer_id: cId,
            amount_paid_cents: paidCents,
            payment_type: paymentType,
            digital_provider: digitalProvider,
            previous_balance_cents: prevBal,
            new_balance_cents: newBal,
            notes: notes || ''
          }),
          created_at: now,
          timestamp: now,
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return tabPaymentId;
    });
  }

  // Alias for backward compatibility
  async settleTabPayment(customerId, amountPaidCents, paymentType = 'CASH', digitalProvider = null, notes = '') {
    return this.recordCustomerPayment(customerId, amountPaidCents, paymentType, digitalProvider, notes);
  }

  /**
   * Adjusts customer balance manually with a signed ledger entry.
   */
  async adjustCustomerBalance(customerId, { amountCents, type = 'CREDIT', reason = '', notes = '' }) {
    const cId = Number(customerId);
    if (!amountCents && type !== 'SET_BALANCE') {
      throw new Error('Adjustment amount is required');
    }
    const safeAmountCents = Math.round(Number(amountCents) || 0);
    const now = Date.now();

    return await this.db.runTransaction(['customers', 'customer_ledger', 'audit_log'], 'readwrite', async (tx) => {
      const custStore = tx.objectStore('customers');
      const auditStore = tx.objectStore('audit_log');

      const customer = await new Promise((resolve, reject) => {
        const req = custStore.get(cId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!customer) throw new Error(`Customer #${cId} not found`);

      const prevBal = Number(customer.balance) || 0;
      let deltaCents = 0;

      if (type === 'CREDIT' || type === 'ADD_CREDIT') {
        deltaCents = Math.abs(safeAmountCents); // Positive credit
      } else if (type === 'DEBIT' || type === 'ADD_DEBT') {
        deltaCents = -Math.abs(safeAmountCents); // Negative debt
      } else if (type === 'SET_BALANCE') {
        deltaCents = safeAmountCents - prevBal;
      } else {
        throw new Error(`Invalid adjustment type: ${type}`);
      }

      await this._applyLedgerEntryInTx(tx, {
        customerId: cId,
        amountCents: deltaCents,
        type: 'BALANCE_ADJUSTMENT',
        description: reason ? `${reason}${notes ? ` - ${notes}` : ''}` : (notes || 'Manual balance adjustment'),
        timestamp: now
      });

      const newBal = prevBal + deltaCents;

      const auditId = await new Promise((resolve, reject) => {
        const req = auditStore.add({
          entity_type: 'Customer',
          entity_id: cId,
          action: 'CUSTOMER_BALANCE_ADJUSTMENT',
          details_json: JSON.stringify({
            customer_id: cId,
            customer_name: customer.name,
            adjustment_type: type,
            amount_cents: safeAmountCents,
            delta_cents: deltaCents,
            previous_balance_cents: prevBal,
            new_balance_cents: newBal,
            reason: reason || 'Manual Balance Adjustment',
            notes: notes || ''
          }),
          created_at: now,
          timestamp: now,
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return {
        customer_id: cId,
        previous_balance_cents: prevBal,
        new_balance_cents: newBal,
        audit_id: auditId
      };
    });
  }

  /**
   * Retrieves full chronological transaction ledger for a customer with verified running balance.
   */
  async getCustomerLedger(customerId) {
    const cId = Number(customerId);
    const customer = await this.db.getById('customers', cId);
    if (!customer) throw new Error(`Customer #${cId} not found`);

    const storedEntries = await this.db.getAllByIndex('customer_ledger', 'customer_id', cId);

    if (storedEntries && storedEntries.length > 0) {
      const sorted = [...storedEntries].sort((a, b) => (a.created_at || a.timestamp || 0) - (b.created_at || b.timestamp || 0));
      let runningBalance = 0;
      const withRunning = sorted.map(entry => {
        runningBalance += entry.amount_cents;
        const isCredit = entry.amount_cents > 0;
        const isDebt = entry.amount_cents < 0;
        return {
          ...entry,
          id: entry.entry_id,
          timestamp: entry.created_at || entry.timestamp || Date.now(),
          running_balance_cents: runningBalance,
          is_credit: isCredit,
          is_debt: isDebt,
          direction: isCredit ? 'CREDIT' : 'DEBIT',
          title: (entry.type === 'opening_balance' || entry.type === 'OPENING_BALANCE')
            ? `Opening balance`
            : entry.type === 'SALE_DEBT' || entry.type === 'HOUSE_TAB_CHARGE'
            ? `Sale #${String(entry.sale_id || '').substring(0, 6)} Tab Charge`
            : entry.type === 'PAYMENT_RECEIVED' || entry.type === 'TAB_PAYMENT'
            ? `Payment Received`
            : entry.type === 'PREPAYMENT_CREDIT' || entry.type === 'PREPAYMENT_DEPOSIT'
            ? `Prepayment Deposit`
            : entry.type === 'SALE_VOID_REVERSAL'
            ? `Void Sale Reversal`
            : `Balance Adjustment`,
          formatted_amount: isCredit ? `+${formatCents(entry.amount_cents)}` : formatCents(entry.amount_cents)
        };
      });
      return withRunning.reverse();
    }

    // Fallback: derive from sales and tab payments if customer_ledger is empty (e.g. pre-migration)
    const allSales = await this.db.getAllByIndex('sales', 'customer_id', cId);
    const allTabPayments = await this.db.getAllByIndex('tab_payments', 'customer_id', cId);
    const allPrepayments = await this.db.getAllByIndex('customer_prepayments', 'customer_id', cId);
    const allAudit = await this.db.getAll('audit_log');

    const customerAudits = (allAudit || []).filter(
      a => a.entity_type === 'Customer' && Number(a.entity_id) === cId
    );

    const ledgerEvents = [];

    for (const sale of allSales || []) {
      if (sale.status === 'COMPLETED' || !sale.status || sale.status === 'PAID') {
        const payments = await this.db.getAllByIndex('sale_payments', 'sale_id', sale.sale_id);
        const tabPayments = (payments || []).filter(p => p.payment_type === 'HOUSE_TAB');
        const tabTotal = tabPayments.reduce((sum, p) => sum + p.amount_cents, 0);

        if (tabTotal > 0) {
          ledgerEvents.push({
            id: `sale_tab_${sale.sale_id}`,
            timestamp: sale.created_at || Date.now(),
            type: 'SALE_DEBT',
            title: `Sale #${String(sale.sale_id).substring(0, 6)} Tab Charge`,
            amount_cents: -tabTotal,
            direction: 'DEBIT',
            description: `Charged to House Tab (${formatCents(tabTotal)})`,
            sale_id: sale.sale_id,
            reference_id: sale.sale_id
          });
        }
      }
    }

    for (const tp of allTabPayments || []) {
      ledgerEvents.push({
        id: `tab_pay_${tp.payment_id}`,
        timestamp: tp.created_at || Date.now(),
        type: 'PAYMENT_RECEIVED',
        title: `Payment Received (${tp.payment_type || 'CASH'})`,
        amount_cents: tp.amount_paid_cents,
        direction: 'CREDIT',
        description: tp.notes ? tp.notes : `Payment received (${tp.payment_type})`,
        reference_id: tp.payment_id
      });
    }

    for (const prep of allPrepayments || []) {
      ledgerEvents.push({
        id: `prep_${prep.prepayment_id}`,
        timestamp: prep.created_at || Date.now(),
        type: 'PREPAYMENT_CREDIT',
        title: `Prepayment: ${prep.pigment_name || 'Store Credit'}`,
        amount_cents: prep.amount_cents || 0,
        direction: 'CREDIT',
        description: `Status: ${prep.status} ${prep.notes ? `• ${prep.notes}` : ''}`,
        reference_id: prep.prepayment_id
      });
    }

    for (const audit of customerAudits || []) {
      if (audit.action === 'CUSTOMER_BALANCE_ADJUSTMENT' || audit.action === 'CUSTOMER_OPENING_BALANCE') {
        let details = {};
        try {
          details = typeof audit.details_json === 'string' ? JSON.parse(audit.details_json) : audit.details_json || {};
        } catch (e) {}

        const delta = (details.delta_cents !== undefined)
          ? details.delta_cents
          : ((details.new_balance_cents !== undefined && details.previous_balance_cents !== undefined)
            ? (details.new_balance_cents - details.previous_balance_cents)
            : (details.adjustment_type === 'CREDIT' ? (details.amount_cents || 0) : -(details.amount_cents || 0)));

        const isOpening = audit.action === 'CUSTOMER_OPENING_BALANCE' || details.reason === 'Initial Account Balance';

        ledgerEvents.push({
          id: `audit_adj_${audit.audit_id}`,
          timestamp: audit.created_at || audit.timestamp || Date.now(),
          type: isOpening ? 'opening_balance' : 'BALANCE_ADJUSTMENT',
          title: isOpening ? 'Opening balance' : `Balance Adjustment: ${details.reason || details.adjustment_type || 'Manual'}`,
          amount_cents: delta,
          direction: delta > 0 ? 'CREDIT' : 'DEBIT',
          description: details.notes
            ? `${details.notes} (${formatCents(details.previous_balance_cents)} ➔ ${formatCents(details.new_balance_cents)})`
            : `Balance: ${formatCents(details.previous_balance_cents)} ➔ ${formatCents(details.new_balance_cents)}`,
          reference_id: audit.audit_id
        });
      }
    }

    ledgerEvents.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    let runningBal = 0;
    const withRunning = ledgerEvents.map(event => {
      runningBal += event.amount_cents;
      const isCredit = event.amount_cents > 0;
      return {
        ...event,
        running_balance_cents: runningBal,
        is_credit: isCredit,
        is_debt: event.amount_cents < 0,
        formatted_amount: isCredit ? `+${formatCents(event.amount_cents)}` : formatCents(event.amount_cents)
      };
    });

    return withRunning.reverse();
  }

  /**
   * Verifies that customer.balance strictly matches the sum of customer_ledger entries.
   */
  async verifyCustomerBalance(customerId) {
    const cId = Number(customerId);
    const customer = await this.db.getById('customers', cId);
    if (!customer) throw new Error(`Customer #${cId} not found`);

    const entries = await this.db.getAllByIndex('customer_ledger', 'customer_id', cId);
    const ledgerSum = (entries || []).reduce((sum, e) => sum + (Number(e.amount_cents) || 0), 0);
    const customerBal = customer.balance !== undefined
      ? Number(customer.balance)
      : (customer.current_balance_cents !== undefined ? -Number(customer.current_balance_cents) : 0);

    const legacyDebt = Number(customer.current_balance_cents) || 0;
    const hasDualFieldDrift = (customer.balance !== undefined && customer.current_balance_cents !== undefined)
      ? (customerBal !== -legacyDebt)
      : false;

    return {
      customer_id: cId,
      customer_name: customer.name,
      current_balance: customerBal,
      legacy_debt_cents: legacyDebt,
      ledger_sum: ledgerSum,
      has_dual_field_drift: hasDualFieldDrift,
      is_valid: customerBal === ledgerSum && !hasDualFieldDrift,
      discrepancy: customerBal - ledgerSum,
      entries_count: (entries || []).length
    };
  }

  /**
   * Derives customer balance directly from the ledger.
   */
  async deriveCustomerBalance(customerId) {
    const verification = await this.verifyCustomerBalance(customerId);
    return verification.ledger_sum;
  }

  /**
   * Repairs customer balance and dual-field drift against ledger truth.
   * If customer has legacy balance with 0 ledger entries, initializes canonical opening_balance ledger entry.
   * If ledger entries exist, synchronizes customer.balance and customer.current_balance_cents to sum(customer_ledger).
   */
  async repairCustomerBalance(customerId) {
    const cId = Number(customerId);
    const now = Date.now();
    return await this.db.runTransaction(['customers', 'customer_ledger', 'audit_log'], 'readwrite', async (tx) => {
      const custStore = tx.objectStore('customers');
      const ledgerStore = tx.objectStore('customer_ledger');
      const auditStore = tx.objectStore('audit_log');

      const customer = await new Promise((resolve, reject) => {
        const req = custStore.get(cId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!customer) throw new Error(`Customer #${cId} not found`);

      let entries = [];
      if (ledgerStore.indexNames && ledgerStore.indexNames.contains('customer_id')) {
        const idx = ledgerStore.index('customer_id');
        entries = await new Promise((resolve, reject) => {
          const req = idx.getAll(cId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      } else {
        const allEntries = await new Promise((resolve, reject) => {
          const req = ledgerStore.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
        entries = allEntries.filter(e => Number(e.customer_id) === cId);
      }

      let targetBalance = 0;
      let repairReason = '';

      if (entries.length === 0) {
        // Case 1: Pre-v1.4.0 legacy customer with no ledger records yet
        const legacyDebt = Number(customer.current_balance_cents) || 0;
        const recordedBal = customer.balance !== undefined ? Number(customer.balance) : -legacyDebt;
        targetBalance = recordedBal !== 0 ? recordedBal : -legacyDebt;

        if (targetBalance !== 0) {
          await new Promise((resolve, reject) => {
            const req = ledgerStore.add({
              customer_id: cId,
              amount_cents: targetBalance,
              type: 'opening_balance',
              description: 'Legacy opening balance migration repair',
              created_at: now,
              timestamp: now
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        }
        repairReason = `Initialized canonical opening_balance ledger entry (${targetBalance} cents) for legacy customer`;
      } else {
        // Case 2: Customer has ledger entries - sum of ledger is absolute source of truth
        targetBalance = entries.reduce((sum, e) => sum + (Number(e.amount_cents) || 0), 0);
        repairReason = `Aligned customer balance to ledger sum (${targetBalance} cents)`;
      }

      customer.balance = targetBalance;
      customer.current_balance_cents = (-targetBalance) === 0 ? 0 : -targetBalance;
      custStore.put(customer);

      auditStore.add({
        entity_type: 'Customer',
        entity_id: cId,
        action: 'CUSTOMER_BALANCE_INTEGRITY_REPAIR',
        details_json: JSON.stringify({
          customer_id: cId,
          repaired_balance: targetBalance,
          reason: repairReason,
          timestamp: now
        }),
        created_at: now,
        timestamp: now
      });

      return {
        customer_id: cId,
        repaired_balance: targetBalance,
        legacy_debt_cents: customer.current_balance_cents,
        is_valid: true,
        has_dual_field_drift: false
      };
    });
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
      const totalCostCents = data.total_cost_cents || 0;
      const paymentStatus = data.payment_status || 'PAID';
      const paidDownCents = data.paid_down_cents || 0;

      const safePaidDown = paymentStatus === 'PAID'
        ? totalCostCents
        : Math.min(totalCostCents, Math.max(0, paidDownCents || 0));

      const unpaidTabCents = paymentStatus === 'PAID' ? 0 : Math.max(0, totalCostCents - safePaidDown);

      const statusLabel = paymentStatus === 'PAID'
        ? 'PAID'
        : safePaidDown > 0
          ? `PARTIAL ($${(safePaidDown / 100).toFixed(2)} Paid / $${(unpaidTabCents / 100).toFixed(2)} Owed)`
          : 'UNPAID_TAB';

      // BUG-06: Run supplier resolution + balance update + receipt creation in a single
      // transaction so new suppliers created here always get their debt tracked correctly.
      // _resolveOrCreateSupplierInTx handles both lookup and auto-creation;
      // _updateSupplierBalanceInTx is the sole writer of supplier.current_balance_cents.
      await this.db.runTransaction(
        ['suppliers', 'stock_receipts', 'supplier_payments'],
        'readwrite',
        async (tx) => {
          const receiptsStore = tx.objectStore('stock_receipts');
          const suppPayStore = tx.objectStore('supplier_payments');

          const sId = await this._resolveOrCreateSupplierInTx(tx, data.supplier_id || null, data.supplier_name || null);

          if (unpaidTabCents > 0 && sId) {
            await this._updateSupplierBalanceInTx(tx, sId, unpaidTabCents);
          }

          const receiptId = await new Promise((resolve, reject) => {
            const req = receiptsStore.add({
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
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          if (safePaidDown > 0 && sId && paymentStatus !== 'PAID') {
            suppPayStore.add({
              supplier_id: sId,
              amount_cents: safePaidDown,
              payment_type: 'DOWN_PAYMENT',
              notes: `Initial stock purchase down payment for receipt #${receiptId}`,
              created_at: Date.now(),
            });
          }
        }
      );
    }

    return pigmentId;
  }

  async createCustomer(data) {
    const initialBal = data.starting_balance !== undefined
      ? Number(data.starting_balance)
      : (data.balance !== undefined
        ? Number(data.balance)
        : (data.initial_balance_cents !== undefined
          ? Number(data.initial_balance_cents)
          : (data.current_balance_cents !== undefined ? -Number(data.current_balance_cents) : 0)));

    const customerType = (data.customer_type || (data.is_wholesale ? 'WHOLESALE' : 'RETAIL')).toUpperCase();
    const isWholesale = customerType === 'WHOLESALE';

    const customerId = await this.db.add('customers', {
      name: data.name,
      phone_number: data.phone_number || data.phone || '',
      customer_type: customerType,
      is_wholesale: isWholesale,
      balance: initialBal,
      current_balance_cents: -initialBal, // Legacy compatibility
      credit_limit_cents: data.credit_limit_cents !== undefined ? Number(data.credit_limit_cents) : 2500,
      trust_status: data.trust_status || 'GOOD_STANDING',
      notes: data.notes || '',
    });

    if (initialBal !== 0) {
      const now = Date.now();
      await this.db.add('customer_ledger', {
        customer_id: Number(customerId),
        amount_cents: initialBal,
        type: 'opening_balance',
        description: data.starting_balance_notes || data.notes || (initialBal > 0 ? 'Opening credit balance' : 'Opening debt balance'),
        sale_id: null,
        created_at: now,
        timestamp: now
      });

      await this.db.add('audit_log', {
        entity_type: 'Customer',
        entity_id: Number(customerId),
        action: 'CUSTOMER_OPENING_BALANCE',
        details_json: JSON.stringify({
          customer_id: customerId,
          customer_name: data.name,
          adjustment_type: initialBal > 0 ? 'CREDIT' : 'DEBIT',
          amount_cents: Math.abs(initialBal),
          previous_balance_cents: 0,
          new_balance_cents: initialBal,
          reason: 'Opening Balance',
          notes: data.starting_balance_notes || data.notes || ''
        }),
        created_at: now,
        timestamp: now,
      });
    }

    return customerId;
  }

  async getAllCustomerNames() {
    const customers = await this.db.getAll('customers');
    const names = new Set();
    for (const c of (customers || [])) {
      if (c && c.name && typeof c.name === 'string') {
        const trimmed = c.name.trim();
        if (trimmed) names.add(trimmed);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }

  async updateCustomer(data) {
    if (!data || !data.customer_id) throw new Error('Customer ID required');
    const cId = Number(data.customer_id);

    return await this.db.runTransaction(['customers', 'customer_ledger', 'audit_log'], 'readwrite', async (tx) => {
      const custStore = tx.objectStore('customers');
      const ledgerStore = tx.objectStore('customer_ledger');
      const auditStore = tx.objectStore('audit_log');

      const existing = await new Promise((resolve, reject) => {
        const req = custStore.get(cId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!existing) throw new Error(`Customer ${data.customer_id} not found`);

      const prevBal = existing.balance !== undefined
        ? Number(existing.balance)
        : (existing.current_balance_cents !== undefined ? -Number(existing.current_balance_cents) : 0);

      let targetBal = prevBal;

      // Handle starting balance setting on edit (Allowed ONLY if customer has no existing ledger entries)
      const startingBal = data.starting_balance !== undefined
        ? Number(data.starting_balance)
        : (data.balance !== undefined && data.is_opening_balance ? Number(data.balance) : undefined);

      if (startingBal !== undefined && startingBal !== 0) {
        let existingEntries = [];
        try {
          if (ledgerStore.indexNames && ledgerStore.indexNames.contains('customer_id')) {
            const index = ledgerStore.index('customer_id');
            existingEntries = await new Promise((resolve, reject) => {
              const req = index.getAll(cId);
              req.onsuccess = () => resolve(req.result || []);
              req.onerror = () => reject(req.error);
            });
          }
        } catch (err) {
          // fallback
        }

        if (existingEntries.length > 0) {
          throw new Error('Cannot set opening balance: Customer already has existing ledger transactions. Use Adjust Balance instead.');
        }

        const now = Date.now();
        // BUG-05: Use _applyLedgerEntryInTx as sole writer of customer.balance;
        // direct field assignment removed from spread below.
        const updatedCustOpen = await this._applyLedgerEntryInTx(tx, {
          customerId: cId,
          amountCents: startingBal,
          type: 'opening_balance',
          description: data.starting_balance_notes || data.notes || (startingBal > 0 ? 'Opening credit balance' : 'Opening debt balance'),
          timestamp: now
        });
        existing.balance = updatedCustOpen ? updatedCustOpen.balance : startingBal;
        existing.current_balance_cents = updatedCustOpen ? updatedCustOpen.current_balance_cents : -startingBal;

        await new Promise((resolve, reject) => {
          const req = auditStore.add({
            entity_type: 'Customer',
            entity_id: cId,
            action: 'CUSTOMER_OPENING_BALANCE',
            details_json: JSON.stringify({
              customer_id: cId,
              customer_name: data.name || existing.name,
              amount_cents: startingBal,
              adjustment_type: startingBal > 0 ? 'CREDIT' : 'DEBIT',
              notes: data.starting_balance_notes || data.notes || ''
            }),
            created_at: now,
            timestamp: now
          });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });

        targetBal = startingBal;
      } else if (data.balance !== undefined && !data.is_opening_balance) {
        targetBal = Number(data.balance) || 0;
        const delta = targetBal - prevBal;
        if (delta !== 0) {
          const now = Date.now();
          // BUG-05: _applyLedgerEntryInTx is the sole writer of customer.balance.
          // The direct `balance`/`current_balance_cents` assignment in the spread below
          // has been removed; `existing` is updated here from the returned record.
          const updatedCustAdj = await this._applyLedgerEntryInTx(tx, {
            customerId: cId,
            amountCents: delta,
            type: 'BALANCE_ADJUSTMENT',
            description: data.balance_notes
              ? `Balance adjustment: ${data.balance_notes}`
              : (data.balance_reason ? `Balance adjustment (${data.balance_reason})` : 'Balance updated via customer edit'),
            timestamp: now
          });
          existing.balance = updatedCustAdj ? updatedCustAdj.balance : targetBal;
          existing.current_balance_cents = updatedCustAdj ? updatedCustAdj.current_balance_cents : -targetBal;

          await new Promise((resolve, reject) => {
            const req = auditStore.add({
              entity_type: 'Customer',
              entity_id: cId,
              action: 'CUSTOMER_BALANCE_ADJUSTMENT',
              details_json: JSON.stringify({
                customer_id: cId,
                customer_name: data.name || existing.name,
                adjustment_type: delta > 0 ? 'CREDIT' : 'DEBIT',
                amount_cents: Math.abs(delta),
                delta_cents: delta,
                previous_balance_cents: prevBal,
                new_balance_cents: targetBal,
                reason: data.balance_reason || 'Customer Profile Edit Balance Update',
                notes: data.balance_notes || ''
              }),
              created_at: now,
              timestamp: now
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
        }
      }

      const custType = data.customer_type !== undefined
        ? data.customer_type.toUpperCase()
        : (data.is_wholesale !== undefined
          ? (data.is_wholesale ? 'WHOLESALE' : 'RETAIL')
          : (existing.customer_type || (existing.is_wholesale ? 'WHOLESALE' : 'RETAIL')));
      const isWholesale = custType === 'WHOLESALE';

      // BUG-05: balance and current_balance_cents are NOT set here directly.
      // They have already been updated on `existing` by _applyLedgerEntryInTx above
      // (or left unchanged if no balance delta occurred). Spreading `existing` here
      // carries the already-correct values without a redundant second write.
      const updated = {
        ...existing,
        name: data.name !== undefined ? data.name : existing.name,
        phone_number: data.phone_number !== undefined ? data.phone_number : (data.phone !== undefined ? data.phone : existing.phone_number),
        customer_type: custType,
        is_wholesale: isWholesale,
        credit_limit_cents: data.credit_limit_cents !== undefined ? Number(data.credit_limit_cents) : existing.credit_limit_cents,
        trust_status: data.trust_status !== undefined ? data.trust_status : existing.trust_status,
        notes: data.notes !== undefined ? data.notes : (existing.notes || '')
      };

      await new Promise((resolve, reject) => {
        const req = custStore.put(updated);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      return updated;
    });
  }

  async createCustomerPrepayment(data) {
    if (!data.customer_id) throw new Error('Customer is required');
    const now = Date.now();
    const paymentType = data.payment_type || 'CASH';
    const digitalProvider = data.digital_provider || null;
    const merchantFeeCents = data.merchant_fee_cents !== undefined
      ? Number(data.merchant_fee_cents) || 0
      : (paymentType === 'DIGITAL' ? calculateMerchantFeeCents(digitalProvider, Number(data.amount_cents) || 0) : 0);

    const record = {
      customer_id: Number(data.customer_id),
      pigment_id: data.pigment_id ? Number(data.pigment_id) : null,
      pigment_name: data.pigment_name || '',
      weight_mg: data.weight_mg || 0,
      amount_cents: data.amount_cents || 0,
      status: data.status || 'PENDING_DELIVERY',
      payment_type: paymentType,
      digital_provider: digitalProvider,
      merchant_fee_cents: merchantFeeCents,
      notes: data.notes || '',
      created_at: now,
    };
    const prepaymentId = await this.db.add('customer_prepayments', record);

    await this.db.add('audit_log', {
      entity_type: 'CustomerPrepayment',
      entity_id: Number(prepaymentId),
      action: 'CREATE_PREPAYMENT',
      details_json: JSON.stringify({
        customer_id: data.customer_id,
        weight_mg: data.weight_mg,
        amount_cents: data.amount_cents,
        payment_type: paymentType,
        digital_provider: digitalProvider,
        merchant_fee_cents: merchantFeeCents
      }),
      created_at: now,
      timestamp: now,
    });

    return prepaymentId;
  }

  async fulfillCustomerPrepayment(prepaymentId, notes = '') {
    const prepId = Number(prepaymentId);
    return await this.db.runTransaction(
      ['customer_prepayments', 'pigments', 'sales', 'sale_items', 'sale_payments', 'audit_log'],
      'readwrite',
      async (tx) => {
        const prepStore = tx.objectStore('customer_prepayments');
        const pigmentsStore = tx.objectStore('pigments');
        const salesStore = tx.objectStore('sales');
        const itemsStore = tx.objectStore('sale_items');
        const paymentsStore = tx.objectStore('sale_payments');
        const auditStore = tx.objectStore('audit_log');

        const item = await new Promise((resolve, reject) => {
          const req = prepStore.get(prepId);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (!item) throw new Error(`Prepayment #${prepaymentId} not found`);
        if (item.status === 'FULFILLED') return item;

        const now = Date.now();

        // 1. If pigment & weight reserved, deduct inventory stock & WAC cost basis.
        // A missing pigment or insufficient stock must abort the whole
        // fulfillment — never fall through to marking it FULFILLED with no
        // sale/payment record created (that was the ledger-hole bug).
        if (item.pigment_id && item.weight_mg > 0) {
          const pigment = await new Promise((resolve, reject) => {
            const req = pigmentsStore.get(Number(item.pigment_id));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (!pigment) {
            tx.abort();
            throw new Error(`Pigment #${item.pigment_id} not found — cannot fulfill prepayment #${prepId}.`);
          }
          if (pigment.stock_mg < item.weight_mg) {
            tx.abort();
            throw new Error(`Insufficient stock for ${pigment.name}. Available: ${formatMgToGrams(pigment.stock_mg)}, Required: ${formatMgToGrams(item.weight_mg)}.`);
          }

          const unitCogsCents = pigment.stock_mg > 0
            ? Math.round((pigment.total_cost_cents / pigment.stock_mg) * item.weight_mg)
            : 0;

          pigment.stock_mg = Math.max(0, pigment.stock_mg - item.weight_mg);
          pigment.total_cost_cents = Math.max(0, pigment.total_cost_cents - unitCogsCents);
          pigmentsStore.put(pigment);

          // 2. Create Completed Sale record in Sales History
          const saleId = await new Promise((resolve, reject) => {
            const req = salesStore.add({
              customer_id: item.customer_id ? Number(item.customer_id) : null,
              sale_type: (item.sale_type || item.pricing_mode || 'RETAIL').toUpperCase(),
              pricing_mode: (item.pricing_mode || item.sale_type || 'RETAIL').toUpperCase(),
              total_amount_cents: item.amount_cents || 0,
              total_cogs_cents: unitCogsCents,
              status: 'COMPLETED',
              source: 'PREPAYMENT_FULFILLMENT',
              prepayment_id: prepId,
              created_at: now,
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          itemsStore.add({
            sale_id: saleId,
            pigment_id: Number(item.pigment_id),
            weight_mg: item.weight_mg,
            price_charged_cents: item.amount_cents || 0,
            unit_cogs_cents: unitCogsCents,
          });

          paymentsStore.add({
            sale_id: saleId,
            payment_type: 'PREPAID_DELIVERY',
            digital_provider: null,
            amount_cents: item.amount_cents || 0,
            merchant_fee_cents: 0,
          });
        } else if (item.amount_cents > 0) {
          // General credit store fulfillment
          const saleId = await new Promise((resolve, reject) => {
            const req = salesStore.add({
              customer_id: item.customer_id ? Number(item.customer_id) : null,
              sale_type: (item.sale_type || item.pricing_mode || 'RETAIL').toUpperCase(),
              pricing_mode: (item.pricing_mode || item.sale_type || 'RETAIL').toUpperCase(),
              total_amount_cents: item.amount_cents,
              total_cogs_cents: 0,
              status: 'COMPLETED',
              source: 'PREPAYMENT_FULFILLMENT',
              prepayment_id: prepId,
              created_at: now,
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });

          itemsStore.add({
            sale_id: saleId,
            pigment_id: 0,
            weight_mg: 0,
            price_charged_cents: item.amount_cents,
            unit_cogs_cents: 0,
          });

          paymentsStore.add({
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
        prepStore.put(item);

        auditStore.add({
          entity_type: 'CustomerPrepayment',
          entity_id: prepId,
          action: 'FULFILL_PREPAYMENT',
          details_json: JSON.stringify({ prepayment_id: prepId, weight_mg: item.weight_mg, amount_cents: item.amount_cents }),
          created_at: now,
          timestamp: now,
        });

        return item;
      }
    );
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

    return await this.db.runTransaction(['suppliers', 'supplier_payments', 'audit_log'], 'readwrite', async (tx) => {
      const suppStore = tx.objectStore('suppliers');
      const payStore = tx.objectStore('supplier_payments');
      const auditStore = tx.objectStore('audit_log');

      const supplier = await new Promise((resolve, reject) => {
        const req = suppStore.get(sId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!supplier) throw new Error(`Supplier ${supplierId} not found`);

      const now = Date.now();
      const paymentId = await new Promise((resolve, reject) => {
        const req = payStore.add({
          supplier_id: sId,
          amount_paid_cents: amountPaidCents,
          payment_type: paymentType,
          notes,
          created_at: now,
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      supplier.current_balance_cents = (supplier.current_balance_cents || 0) - amountPaidCents;
      suppStore.put(supplier);

      auditStore.add({
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
    });
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
      if (diff > 1 || sale.needs_reconciliation) {
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

    // Also scan all customers for ledger discrepancy and dual-field drift
    const allCustomers = await this.db.getAll('customers');
    let customerRepairedCount = 0;

    for (const cust of allCustomers) {
      const cId = Number(cust.customer_id);
      const verification = await this.verifyCustomerBalance(cId);
      if (!verification.is_valid || verification.has_dual_field_drift) {
        await this.repairCustomerBalance(cId);
        customerRepairedCount++;
      }
    }

    return { repairedCount, flaggedCount, customerRepairedCount };
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

      // Compute customer balance delta (both HOUSE_TAB debt and STORE_CREDIT draw from customer balance)
      const oldTabTotalCents = oldPayments
        .filter(p => p.payment_type === 'HOUSE_TAB')
        .reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
      const newTabTotalCents = payments
        .filter(p => p.payment_type === 'HOUSE_TAB')
        .reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
      const tabDeltaCents = newTabTotalCents - oldTabTotalCents;

      const oldCreditTotalCents = oldPayments
        .filter(p => p.payment_type === 'STORE_CREDIT' || p.payment_type === 'PREPAID_DELIVERY')
        .reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
      const newCreditTotalCents = payments
        .filter(p => p.payment_type === 'STORE_CREDIT' || p.payment_type === 'PREPAID_DELIVERY')
        .reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
      const creditDeltaCents = newCreditTotalCents - oldCreditTotalCents;

      const totalBalanceDeltaCents = -(tabDeltaCents + creditDeltaCents);

      await this.db.runTransaction(
        ['sale_payments', 'sales', 'customers', 'customer_ledger', 'audit_log'],
        'readwrite',
        async (tx) => {
          const paymentStore = tx.objectStore('sale_payments');
          const salesStore = tx.objectStore('sales');
          const auditStore = tx.objectStore('audit_log');

          // Delete old payments
          for (const op of oldPayments) {
            if (op.payment_id) {
              paymentStore.delete(op.payment_id);
            }
          }

          // Write corrected payments
          for (const p of payments) {
            paymentStore.add({
              sale_id: sId,
              payment_type: p.payment_type,
              digital_provider: p.digital_provider || null,
              amount_cents: p.amount_cents,
              merchant_fee_cents: p.merchant_fee_cents || 0
            });
          }

          // Rebalance customer balance via ledger (keeps both balance fields in sync)
          if (totalBalanceDeltaCents !== 0 && sale.customer_id) {
            await this._applyLedgerEntryInTx(tx, {
              customerId: Number(sale.customer_id),
              amountCents: totalBalanceDeltaCents,
              type: 'RECONCILIATION_ADJUSTMENT',
              description: `Payment correction for Sale #${sId} (tab delta: ${tabDeltaCents}, credit delta: ${creditDeltaCents})`,
              saleId: sId,
              timestamp: now
            });
          }

          // Mark reconciled
          const currentSale = await new Promise((resolve, reject) => {
            const req = salesStore.get(sId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          if (currentSale) {
            currentSale.needs_reconciliation = false;
            currentSale.reconciliation_status = 'RECONCILED';
            salesStore.put(currentSale);
          }

          auditStore.add({
            entity_type: 'Sale',
            entity_id: sId,
            action: 'MANUAL_RECONCILIATION_CORRECT_PAYMENT',
            details_json: JSON.stringify({ sale_id: sId, corrected_payments: payments, tab_delta_cents: tabDeltaCents }),
            created_at: now,
            timestamp: now
          });
        }
      );
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
  salePayments = [],
  pigments = [],
  customers = [],
  suppliers = [],
  shrinkageLogs = [],
  stockReceipts = [],
  customerPrepayments = [],
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

  // Merchant Processing Fees (actual recorded fees from sale_payments)
  const filteredSalePayments = (salePayments || []).filter(p => completedSaleIds.has(p.sale_id));
  const totalMerchantFeeCents = filteredSalePayments.reduce((sum, p) => sum + (p.merchant_fee_cents || 0), 0);

  // Pricing Mode Breakdown
  let retailSalesCount = 0;
  let wholesaleSalesCount = 0;
  let retailRevenueCents = 0;
  let wholesaleRevenueCents = 0;
  let retailCogsCents = 0;
  let wholesaleCogsCents = 0;

  completedSales.forEach(s => {
    const mode = (s.sale_type || s.pricing_mode || 'RETAIL').toUpperCase();
    const rev = s.total_amount_cents || 0;
    const cogs = s.total_cogs_cents || 0;

    if (mode === 'WHOLESALE') {
      wholesaleSalesCount += 1;
      wholesaleRevenueCents += rev;
      wholesaleCogsCents += cogs;
    } else {
      retailSalesCount += 1;
      retailRevenueCents += rev;
      retailCogsCents += cogs;
    }
  });

  const retailProfitCents = retailRevenueCents - retailCogsCents;
  const wholesaleProfitCents = wholesaleRevenueCents - wholesaleCogsCents;
  const retailMarginPct = retailRevenueCents > 0 ? Number(((retailProfitCents / retailRevenueCents) * 100).toFixed(1)) : 0;
  const wholesaleMarginPct = wholesaleRevenueCents > 0 ? Number(((wholesaleProfitCents / wholesaleRevenueCents) * 100).toFixed(1)) : 0;
  const retailAovCents = retailSalesCount > 0 ? Math.round(retailRevenueCents / retailSalesCount) : 0;
  const wholesaleAovCents = wholesaleSalesCount > 0 ? Math.round(wholesaleRevenueCents / wholesaleSalesCount) : 0;

  const pricingModeSummary = {
    retailSalesCount,
    wholesaleSalesCount,
    retailRevenueCents,
    wholesaleRevenueCents,
    retailCogsCents,
    wholesaleCogsCents,
    retailProfitCents,
    wholesaleProfitCents,
    retailMarginPct,
    wholesaleMarginPct,
    retailAovCents,
    wholesaleAovCents
  };

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

  // 6. Payables Summary (What I Owe Suppliers)
  const supplierPayables = (suppliers || [])
    .filter(sup => (sup.current_balance_cents || 0) > 0)
    .map(sup => {
      return {
        supplier_id: sup.supplier_id,
        name: sup.name,
        amountOwedCents: sup.current_balance_cents,
        contactInfo: sup.contact_info || sup.phone || 'N/A'
      };
    })
    .sort((a, b) => b.amountOwedCents - a.amountOwedCents);

  const totalApCents = supplierPayables.reduce((sum, s) => sum + s.amountOwedCents, 0);

  // 7. Shrinkage & Loss Impact Analysis
  const filteredShrinkage = (shrinkageLogs || []).filter(log => {
    const ts = log.created_at || log.timestamp || 0;
    return filterTimestamp === 0 || ts >= filterTimestamp;
  });

  const shrinkageMap = new Map();
  filteredShrinkage.forEach(log => {
    const pId = log.pigment_id || 0;
    let entry = shrinkageMap.get(pId);
    if (!entry) {
      const matchP = (pigments || []).find(p => p.pigment_id === pId);
      entry = {
        pigment_id: pId,
        name: matchP?.name || `Pigment #${pId}`,
        weightLostMg: 0,
        cogsLossCents: 0,
        incidentCount: 0
      };
      shrinkageMap.set(pId, entry);
    }
    entry.weightLostMg += (log.mg_lost || log.weight_mg || 0);
    entry.cogsLossCents += (log.cogs_loss_cents || log.cogs_cents || 0);
    entry.incidentCount += 1;
  });

  const shrinkageImpact = Array.from(shrinkageMap.values()).sort((a, b) => b.cogsLossCents - a.cogsLossCents);
  const totalShrinkageLossCents = shrinkageImpact.reduce((sum, item) => sum + item.cogsLossCents, 0);

  // 8. Individual Sale History (Drill-Down Detail)
  const detailedSalesList = completedSales.map(s => {
    const cust = (customers || []).find(c => Number(c.customer_id) === Number(s.customer_id));
    const custName = cust ? cust.name : 'Walk-in Customer';
    const sItems = (saleItems || []).filter(si => Number(si.sale_id) === Number(s.sale_id));

    const rev = s.total_amount_cents || 0;
    const cogs = s.total_cogs_cents || 0;
    const profit = rev - cogs;
    const marginPct = rev > 0 ? Number(((profit / rev) * 100).toFixed(1)) : 0;

    const formattedItems = sItems.map(si => {
      const matchP = (pigments || []).find(p => Number(p.pigment_id) === Number(si.pigment_id));
      const iRev = si.price_charged_cents || 0;
      const iCogs = si.unit_cogs_cents !== undefined ? si.unit_cogs_cents : (si.cogs_cents || 0);
      const iProfit = iRev - iCogs;
      const iMargin = iRev > 0 ? Number(((iProfit / iRev) * 100).toFixed(1)) : 0;
      return {
        sale_item_id: si.sale_item_id,
        pigment_id: si.pigment_id,
        name: matchP ? matchP.name : (si.pigment_name || `Pigment #${si.pigment_id}`),
        weight_mg: si.weight_mg || 0,
        price_charged_cents: iRev,
        unit_cogs_cents: iCogs,
        profit_cents: iProfit,
        margin_pct: iMargin
      };
    });

    return {
      sale_id: s.sale_id,
      created_at: s.created_at || s.timestamp || s.date,
      customer_id: s.customer_id,
      customer_name: custName,
      sale_type: (s.sale_type || s.pricing_mode || 'RETAIL').toUpperCase(),
      pricing_mode: (s.pricing_mode || s.sale_type || 'RETAIL').toUpperCase(),
      is_below_floor: (rev > 0) && (((s.sale_type || s.pricing_mode || 'RETAIL').toUpperCase() === 'WHOLESALE' && marginPct < 50) || ((s.sale_type || s.pricing_mode || 'RETAIL').toUpperCase() === 'RETAIL' && marginPct < 65)),
      status: s.status || 'COMPLETED',
      total_amount_cents: rev,
      total_cogs_cents: cogs,
      profit_cents: profit,
      margin_pct: marginPct,
      items: formattedItems
    };
  }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

  // 9. Stock Receipt History & Supplier Cost Trends
  const validReceipts = (stockReceipts || [])
    .filter(r => r.payment_status !== 'VOIDED')
    .map(r => {
      const matchP = (pigments || []).find(p => Number(p.pigment_id) === Number(r.pigment_id));
      const receivedGrams = (r.received_mg || 0) / 1000;
      const totalCostCents = r.total_cost_cents || 0;
      const costPerGramCents = receivedGrams > 0 ? Math.round(totalCostCents / receivedGrams) : 0;
      const dateTs = r.received_at || r.timestamp || r.created_at || 0;

      return {
        stock_receipt_id: r.stock_receipt_id || r.receipt_id,
        pigment_id: r.pigment_id,
        pigment_name: matchP?.name || `Pigment #${r.pigment_id}`,
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name || 'Direct Restock',
        received_mg: r.received_mg || 0,
        total_cost_cents: totalCostCents,
        cost_per_gram_cents: costPerGramCents,
        received_at: dateTs
      };
    })
    .sort((a, b) => b.received_at - a.received_at);

  const costTrendMap = new Map();
  validReceipts.forEach(r => {
    if (!r.pigment_id || r.pigment_id <= 0) return;
    let list = costTrendMap.get(r.pigment_id);
    if (!list) {
      list = [];
      costTrendMap.set(r.pigment_id, list);
    }
    list.push(r);
  });

  const pigmentCostTrends = Array.from(costTrendMap.entries()).map(([pId, receipts]) => {
    const matchP = (pigments || []).find(p => Number(p.pigment_id) === Number(pId));
    const latestReceipt = receipts[0];
    const oldestReceipt = receipts[receipts.length - 1];

    const latestCostPerGram = latestReceipt.cost_per_gram_cents;
    const oldestCostPerGram = oldestReceipt.cost_per_gram_cents;
    const diffCents = latestCostPerGram - oldestCostPerGram;
    const pctChange = oldestCostPerGram > 0 ? Number(((diffCents / oldestCostPerGram) * 100).toFixed(1)) : 0;

    let trendStatus = 'STABLE';
    if (pctChange > 2) trendStatus = 'INCREASING';
    else if (pctChange < -2) trendStatus = 'DECREASING';

    return {
      pigment_id: pId,
      name: matchP?.name || `Pigment #${pId}`,
      receiptCount: receipts.length,
      latestCostPerGramCents: latestCostPerGram,
      oldestCostPerGramCents: oldestCostPerGram,
      pctChange,
      trendStatus,
      latestSupplierName: latestReceipt.supplier_name
    };
  }).sort((a, b) => b.pctChange - a.pctChange);

  // Add Payables, Waste & Cost Inflation Warnings to Deterministic Recommendations
  if (totalApCents > 0) {
    recommendations.push({
      id: 'rec_payables',
      type: 'WARNING',
      icon: '📤',
      title: 'Supplier Payables Outstanding',
      message: `You owe ${formatCents(totalApCents)} across ${supplierPayables.length} supplier account(s).`
    });
  }

  if (totalShrinkageLossCents > 0 && shrinkageImpact.length > 0) {
    const topWaste = shrinkageImpact[0];
    recommendations.push({
      id: `rec_waste_${topWaste.pigment_id}`,
      type: 'WARNING',
      icon: '📉',
      title: 'Top Shrinkage & Waste Impact',
      message: `"${topWaste.name}" accounts for highest waste loss: ${formatCents(topWaste.cogsLossCents)} (${formatMgToGrams(topWaste.weightLostMg)}) lost across ${topWaste.incidentCount} incident(s).`
    });
  }

  // Rule 5: Low Margin "Below Floor" Sales Warning (WHOLESALE < 50% or RETAIL < 65%)
  completedSales.forEach(s => {
    const rev = s.total_amount_cents || 0;
    if (rev <= 0) return;
    const cogs = s.total_cogs_cents || 0;
    const profit = rev - cogs;
    const marginPct = Number(((profit / rev) * 100).toFixed(1));
    const mode = (s.sale_type || s.pricing_mode || 'RETAIL').toUpperCase();
    const isBelowFloor = (mode === 'WHOLESALE' && marginPct < 50) || (mode === 'RETAIL' && marginPct < 65);

    if (isBelowFloor) {
      const cust = (customers || []).find(c => Number(c.customer_id) === Number(s.customer_id));
      const custName = cust ? cust.name : 'Walk-in Customer';
      const floorPct = mode === 'WHOLESALE' ? 50 : 65;

      recommendations.push({
        id: `rec_below_floor_${s.sale_id}`,
        type: 'WARNING',
        icon: '⚠️',
        title: `Margin Below Floor (${mode})`,
        message: `Sale #${String(s.sale_id).substring(0, 8)} (${custName}) yielded ${marginPct}% margin in ${mode} mode, below established ${floorPct}% baseline floor.`
      });
    }
  });

  pigmentCostTrends.filter(t => t.trendStatus === 'INCREASING' && t.pctChange >= 10).forEach(t => {
    recommendations.push({
      id: `rec_cost_increase_${t.pigment_id}`,
      type: 'WARNING',
      icon: '📈',
      title: 'Restock Cost Inflation Warning',
      message: `"${t.name}" supplier restock cost per gram increased by +${t.pctChange}% (from ${formatCents(t.oldestCostPerGramCents)}/g to ${formatCents(t.latestCostPerGramCents)}/g). Evaluate margin adjustment.`
    });
  });

  const voidedSales = (sales || []).filter(s => {
    const isVoided = s.status === 'VOIDED';
    const ts = s.created_at || s.timestamp || s.date || 0;
    return isVoided && (filterTimestamp === 0 || ts >= filterTimestamp);
  });
  const voidedCount = voidedSales.length;

  const netProfitCents = grossProfitCents - totalShrinkageLossCents - totalMerchantFeeCents;
  const netMarginPct = grossRevenueCents > 0 ? Math.round((netProfitCents / grossRevenueCents) * 100) : 0;

  // Customer Prepayments & Backorder Liabilities
  const activePrepayments = (customerPrepayments || []).filter(p => p.status !== 'FULFILLED');
  const totalPrepaymentCreditCents = activePrepayments.reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
  const totalPrepaymentWeightMg = activePrepayments.reduce((sum, p) => sum + (Number(p.weight_mg) || 0), 0);

  // Inventory Valuation
  const totalInventoryMg = (pigments || []).reduce((sum, p) => sum + (Number(p.stock_mg) || 0), 0);
  const totalCostBasisCents = (pigments || []).reduce((sum, p) => sum + (Number(p.total_cost_cents) || 0), 0);
  const totalRetailValueCents = (pigments || []).reduce((sum, p) => {
    const g = (Number(p.stock_mg) || 0) / 1000;
    const rate = Number(p.retail_price_per_gram_cents) || 0;
    return sum + Math.round(g * rate);
  }, 0);

  return {
    timeRange,
    completedCount,
    voidedCount,
    grossRevenueCents,
    totalCogsCents,
    grossProfitCents,
    grossMarginPct,
    totalMerchantFeeCents,
    actualMerchantFeesCents: totalMerchantFeeCents, // alias for reports compatibility
    netProfitCents,
    netMarginPct,
    averageOrderValueCents,
    perPigmentProfitability,
    dayOfWeekStats,
    hourOfDayStats,
    peakDay,
    peakHour,
    customerReceivables,
    totalArCents,
    supplierPayables,
    totalApCents,
    shrinkageImpact,
    totalShrinkageLossCents,
    activePrepayments,
    totalPrepaymentCreditCents,
    totalPrepaymentWeightMg,
    totalInventoryMg,
    totalCostBasisCents,
    totalRetailValueCents,
    pricingModeSummary,
    detailedSalesList,
    validReceipts,
    pigmentCostTrends,
    recommendations
  };
}

/**
 * Filter and rank customers by name or phone number for autocomplete matching.
 * @param {Array} customers - List of customer records
 * @param {string} query - Search query
 * @returns {Array} Filtered and ranked customer records
 */
export function filterCustomers(customers = [], query = '') {
  if (!Array.isArray(customers)) return [];
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...customers];

  const scored = [];
  for (const c of customers) {
    if (!c) continue;
    const name = (c.name || '').toLowerCase();
    const phone = (c.phone_number || c.phone || '').toLowerCase();

    if (name === q) {
      scored.push({ customer: c, score: 0 }); // exact match
    } else if (name.startsWith(q)) {
      scored.push({ customer: c, score: 1 }); // prefix match
    } else if (name.includes(q)) {
      scored.push({ customer: c, score: 2 }); // substring match in name
    } else if (phone.includes(q)) {
      scored.push({ customer: c, score: 3 }); // match in phone number
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return (a.customer.name || '').localeCompare(b.customer.name || '');
  });

  return scored.map(s => s.customer);
}

/**
 * Retrieve distinct customer names from the existing customers store (tied to prepayments/credit).
 * @param {Object} dbOrRepo - Database instance or PosRepository instance
 * @returns {Promise<string[]>} Array of distinct sorted customer names
 */
export async function getAllCustomerNames(dbOrRepo) {
  if (!dbOrRepo) return [];
  if (typeof dbOrRepo.getAllCustomerNames === 'function') {
    return await dbOrRepo.getAllCustomerNames();
  }
  const db = dbOrRepo.db || dbOrRepo;
  if (typeof db.getAll === 'function') {
    const customers = await db.getAll('customers');
    const names = new Set();
    for (const c of (customers || [])) {
      if (c && c.name && typeof c.name === 'string') {
        const trimmed = c.name.trim();
        if (trimmed) names.add(trimmed);
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }
  return [];
}

/**
 * Filter cached customer list for suggestions (case-insensitive startsWith, min length 2, up to 5 items).
 * @param {Array} customers - Cached list of customer records
 * @param {string} input - Customer name input string
 * @returns {Array} Array of up to 5 matching customer records
 */
export function filterCustomerSuggestions(customers = [], input = '') {
  if (!Array.isArray(customers) || !input || typeof input !== 'string') return [];
  const q = input.trim().toLowerCase();
  if (q.length < 2) return [];
  return customers
    .filter(c => c && typeof c.name === 'string' && c.name.trim().toLowerCase().startsWith(q))
    .slice(0, 5);
}
