/**
 * @fileoverview Business logic repository layer for Micro Saler POS.
 * Contains all transactional business logic that was in Android PosRepository.kt.
 */

/**
 * Formats a cent value to a dollar string (e.g., $1.25)
 * @param {number} cents
 * @returns {string}
 */
export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Formats milligrams to grams (e.g., 1.5g)
 * @param {number} mg
 * @returns {string}
 */
export function formatMgToGrams(mg) {
  return `${(mg / 1000).toFixed(1)}g`;
}

/**
 * Formats milligrams to ounces
 * @param {number} mg
 * @returns {string}
 */
export function formatMgToOz(mg) {
  return `${(mg / 28349.5).toFixed(2)} oz`;
}

/**
 * PosRepository — all business logic for the Micro Saler POS.
 */
export class PosRepository {
  /**
   * @param {import('./db.js').default} db - MicroSalerDB instance
   */
  constructor(db) {
    this.db = db;
  }

  // ========================================
  // Restocking
  // ========================================

  /**
   * Restocks a pigment using weighted average cost.
   * @param {number} pigmentId
   * @param {number} receivedMg
   * @param {number} totalCostCents
   * @param {string} supplierName
   * @returns {Promise<number>} receipt ID
   */
  async restockPigment(pigmentId, receivedMg, totalCostCents, supplierName) {
    const pigment = await this.db.getById('pigments', pigmentId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

    const newStockMg = pigment.stock_mg + receivedMg;
    const newTotalCostCents = pigment.total_cost_cents + totalCostCents;

    await this.db.updateStockAndCost(pigmentId, newStockMg, newTotalCostCents);

    return await this.db.add('stock_receipts', {
      pigment_id: pigmentId,
      received_mg: receivedMg,
      total_cost_cents: totalCostCents,
      supplier_name: supplierName,
      received_at: Date.now(),
    });
  }

  // ========================================
  // Shrinkage
  // ========================================

  /**
   * Logs shrinkage (spillage, samples, defects).
   * @param {number} pigmentId
   * @param {number} mgLost
   * @param {string} reason
   * @returns {Promise<number>} shrinkage log ID
   */
  async logShrinkage(pigmentId, mgLost, reason) {
    const pigment = await this.db.getById('pigments', pigmentId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

    const cogsLossCents = pigment.stock_mg > 0
      ? Math.floor((pigment.total_cost_cents / pigment.stock_mg) * mgLost)
      : 0;

    const newStockMg = pigment.stock_mg - mgLost;
    const newCostCents = pigment.total_cost_cents - cogsLossCents;

    await this.db.updateStockAndCost(pigmentId, newStockMg, newCostCents);

    return await this.db.add('shrinkage_logs', {
      pigment_id: pigmentId,
      mg_lost: mgLost,
      cogs_loss_cents: cogsLossCents,
      reason,
      created_at: Date.now(),
    });
  }

  // ========================================
  // Sale Completion (core transaction)
  // ========================================

  /**
   * Completes a sale with full validation and inventory updates.
   * @param {number|null} customerId - null = Walk-in
   * @param {Array<{pigment_id:number, weight_mg:number, price_charged_cents:number, unit_cogs_cents:number}>} items
   * @param {Array<{payment_type:string, digital_provider:string|null, amount_cents:number, merchant_fee_cents:number}>} payments
   * @param {boolean} isCreditOverride
   * @returns {Promise<number>} sale ID
   */
  async completeSale(customerId, items, payments, isCreditOverride = false) {
    // Validation
    if (!items || items.length === 0) throw new Error('Sale must have at least one item');
    if (!payments || payments.length === 0) throw new Error('Sale must have at least one payment');

    const totalSaleAmountCents = items.reduce((sum, i) => sum + i.price_charged_cents, 0);
    const totalPaymentsCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const totalCogsCents = items.reduce((sum, i) => sum + i.unit_cogs_cents, 0);

    // Payment reconciliation (1 cent tolerance)
    if (Math.abs(totalSaleAmountCents - totalPaymentsCents) > 1) {
      throw new Error(`Payments ($${(totalPaymentsCents/100).toFixed(2)}) do not match sale total ($${(totalSaleAmountCents/100).toFixed(2)})`);
    }

    // House tab credit limit check
    const hasHouseTab = payments.some(p => p.payment_type === 'HOUSE_TAB');
    if (hasHouseTab) {
      if (!customerId) throw new Error('Customer is required for HOUSE_TAB payment');
      const customer = await this.db.getById('customers', customerId);
      if (!customer) throw new Error(`Customer ${customerId} not found`);

      const tabAmount = payments
        .filter(p => p.payment_type === 'HOUSE_TAB')
        .reduce((sum, p) => sum + p.amount_cents, 0);
      const availableCredit = Math.max(0, customer.credit_limit_cents - customer.current_balance_cents);

      if (tabAmount > availableCredit && !isCreditOverride) {
        throw new Error(`Credit limit exceeded. Available: $${(availableCredit/100).toFixed(2)}, Requested: $${(tabAmount/100).toFixed(2)}. Enable Handshake Override.`);
      }
    }

    // Insert Sale
    const saleId = await this.db.add('sales', {
      customer_id: customerId,
      total_amount_cents: totalSaleAmountCents,
      total_cogs_cents: totalCogsCents,
      status: 'COMPLETED',
      is_credit_override: isCreditOverride,
      created_at: Date.now(),
    });

    // Insert SaleItems & update inventory
    for (const item of items) {
      await this.db.add('sale_items', {
        sale_id: saleId,
        pigment_id: item.pigment_id,
        weight_mg: item.weight_mg,
        price_charged_cents: item.price_charged_cents,
        unit_cogs_cents: item.unit_cogs_cents,
      });

      const pigment = await this.db.getById('pigments', item.pigment_id);
      if (pigment) {
        await this.db.updateStockAndCost(
          item.pigment_id,
          pigment.stock_mg - item.weight_mg,
          pigment.total_cost_cents - item.unit_cogs_cents
        );
      }
    }

    // Insert payments & update customer tab if needed
    for (const payment of payments) {
      await this.db.add('sale_payments', {
        sale_id: saleId,
        payment_type: payment.payment_type,
        digital_provider: payment.digital_provider || null,
        amount_cents: payment.amount_cents,
        merchant_fee_cents: payment.merchant_fee_cents || 0,
      });

      if (payment.payment_type === 'HOUSE_TAB' && customerId) {
        await this.db.updateCustomerBalance(customerId, payment.amount_cents);
      }
    }

    // Audit log for credit override
    if (isCreditOverride) {
      await this.db.add('audit_log', {
        entity_type: 'Sale',
        entity_id: saleId,
        action: 'HANDSHAKE_CREDIT_OVERRIDE',
        details: JSON.stringify({ sale_id: saleId, customer_id: customerId }),
        timestamp: Date.now(),
      });
    }

    return saleId;
  }

  // ========================================
  // Returns
  // ========================================

  /**
   * Processes a return for a sale item.
   * @param {number} saleItemId
   * @param {number} mgReturned
   * @param {number} refundAmountCents
   * @param {boolean} restockToInventory
   * @param {string} reason
   * @returns {Promise<number>} return record ID
   */
  async processReturn(saleItemId, mgReturned, refundAmountCents, restockToInventory, reason) {
    const saleItem = await this.db.getById('sale_items', saleItemId);
    if (!saleItem) throw new Error(`SaleItem ${saleItemId} not found`);

    const alreadyReturnedMg = await this.db.getTotalReturnedMgForSaleItem(saleItemId);
    const maxEligible = saleItem.weight_mg - alreadyReturnedMg;

    if (mgReturned > maxEligible) {
      throw new Error(`Cannot return ${formatMgToGrams(mgReturned)} — max eligible is ${formatMgToGrams(maxEligible)}`);
    }

    const returnId = await this.db.add('returns', {
      sale_item_id: saleItemId,
      mg_returned: mgReturned,
      refund_amount_cents: refundAmountCents,
      restock_to_inventory: restockToInventory,
      reason,
      created_at: Date.now(),
    });

    if (restockToInventory) {
      const pigment = await this.db.getById('pigments', saleItem.pigment_id);
      if (pigment) {
        const proportionalCogs = saleItem.weight_mg > 0
          ? Math.floor((saleItem.unit_cogs_cents / saleItem.weight_mg) * mgReturned)
          : 0;
        await this.db.updateStockAndCost(
          saleItem.pigment_id,
          pigment.stock_mg + mgReturned,
          pigment.total_cost_cents + proportionalCogs
        );
      }
    }

    return returnId;
  }

  // ========================================
  // Void Sale
  // ========================================

  /**
   * Voids a sale — restocks all items, reverses tab charges.
   * @param {number} saleId
   * @param {string} reason
   */
  async voidSale(saleId, reason) {
    const sale = await this.db.getById('sales', saleId);
    if (!sale) throw new Error(`Sale ${saleId} not found`);
    if (sale.status === 'VOIDED') throw new Error(`Sale ${saleId} is already voided`);

    // Restock all items
    const items = await this.db.getAllByIndex('sale_items', 'sale_id', saleId);
    for (const item of items) {
      const pigment = await this.db.getById('pigments', item.pigment_id);
      if (pigment) {
        await this.db.updateStockAndCost(
          item.pigment_id,
          pigment.stock_mg + item.weight_mg,
          pigment.total_cost_cents + item.unit_cogs_cents
        );
      }
    }

    // Reverse house tab charges
    const payments = await this.db.getAllByIndex('sale_payments', 'sale_id', saleId);
    for (const payment of payments) {
      if (payment.payment_type === 'HOUSE_TAB' && sale.customer_id) {
        await this.db.updateCustomerBalance(sale.customer_id, -payment.amount_cents);
      }
    }

    // Update sale status
    await this.db.updateSaleStatus(saleId, 'VOIDED');

    // Audit log
    await this.db.add('audit_log', {
      entity_type: 'Sale',
      entity_id: saleId,
      action: 'VOID_SALE',
      details: JSON.stringify({ sale_id: saleId, reason }),
      timestamp: Date.now(),
    });
  }

  // ========================================
  // Tab Settlement
  // ========================================

  /**
   * Settles a tab payment — reduces customer balance.
   * @param {number} customerId
   * @param {number} amountPaidCents
   * @param {string} paymentType - 'CASH' or 'DIGITAL'
   * @param {string|null} digitalProvider
   * @returns {Promise<number>} tab payment ID
   */
  async settleTabPayment(customerId, amountPaidCents, paymentType, digitalProvider = null) {
    const id = await this.db.add('tab_payments', {
      customer_id: customerId,
      amount_paid_cents: amountPaidCents,
      payment_type: paymentType,
      digital_provider: digitalProvider,
      created_at: Date.now(),
    });

    await this.db.updateCustomerBalance(customerId, -amountPaidCents);
    return id;
  }

  // ========================================
  // Pricing Updates
  // ========================================

  /**
   * Updates pigment pricing and logs to audit.
   * @param {number} pigmentId
   * @param {number} retailPricePerGramCents
   * @param {number} wholesalePricePerGramCents
   */
  async updatePigmentPricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents) {
    await this.db.updatePricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents);

    await this.db.add('audit_log', {
      entity_type: 'Pigment',
      entity_id: pigmentId,
      action: 'PRICING_UPDATE',
      details: JSON.stringify({ pigment_id: pigmentId, retail: retailPricePerGramCents, wholesale: wholesalePricePerGramCents }),
      timestamp: Date.now(),
    });
  }

  // ========================================
  // Create / Update Entities
  // ========================================

  /**
   * Creates a new pigment with defaults.
   * @param {Object} data
   * @returns {Promise<number>} pigment ID
   */
  async createPigment(data) {
    return await this.db.add('pigments', {
      name: data.name,
      color_code: data.color_code || '#888888',
      finish_type: data.finish_type || 'Mica Pearl',
      stock_mg: data.stock_mg || 0,
      total_cost_cents: data.total_cost_cents || 0,
      default_pkg_cents: data.default_pkg_cents || 35,
      retail_price_per_gram_cents: data.retail_price_per_gram_cents || 250,
      wholesale_price_per_gram_cents: data.wholesale_price_per_gram_cents || 150,
      is_archived: false,
    });
  }

  /**
   * Creates a new customer with defaults.
   * @param {Object} data
   * @returns {Promise<number>} customer ID
   */
  async createCustomer(data) {
    return await this.db.add('customers', {
      name: data.name,
      phone: data.phone || '',
      credit_limit_cents: data.credit_limit_cents || 2500,
      current_balance_cents: 0,
      trust_status: data.trust_status || 'GOOD_STANDING',
    });
  }

  /**
   * Updates an existing customer.
   * @param {Object} data - must include customer_id
   */
  async updateCustomer(data) {
    await this.db.put('customers', data);
  }
}
