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

export function formatMgToOz(mg) {
  const m = (mg === null || mg === undefined || isNaN(mg)) ? 0 : Number(mg);
  return `${(m / 28349.5).toFixed(2)} oz`;
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
    if (!items || items.length === 0) throw new Error('Sale must have at least one item');
    if (!payments || payments.length === 0) throw new Error('Sale must have at least one payment');

    const totalSaleAmountCents = items.reduce((sum, i) => sum + i.price_charged_cents, 0);
    const totalPaymentsCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const totalCogsCents = items.reduce((sum, i) => sum + i.unit_cogs_cents, 0);

    if (Math.abs(totalSaleAmountCents - totalPaymentsCents) > 1) {
      throw new Error(`Payments ($${(totalPaymentsCents/100).toFixed(2)}) do not match sale total ($${(totalSaleAmountCents/100).toFixed(2)})`);
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

    const saleId = await this.db.add('sales', {
      customer_id: customerId ? Number(customerId) : null,
      total_amount_cents: totalSaleAmountCents,
      total_cogs_cents: totalCogsCents,
      status: 'COMPLETED',
      is_credit_override: isCreditOverride,
      created_at: Date.now(),
    });

    for (const item of items) {
      await this.db.add('sale_items', {
        sale_id: saleId,
        pigment_id: Number(item.pigment_id),
        weight_mg: item.weight_mg,
        price_charged_cents: item.price_charged_cents,
        unit_cogs_cents: item.unit_cogs_cents,
      });

      const pigment = await this.db.getById('pigments', Number(item.pigment_id));
      if (pigment) {
        await this.db.updateStockAndCost(
          Number(item.pigment_id),
          pigment.stock_mg - item.weight_mg,
          pigment.total_cost_cents - item.unit_cogs_cents
        );
      }
    }

    for (const payment of payments) {
      await this.db.add('sale_payments', {
        sale_id: saleId,
        payment_type: payment.payment_type,
        digital_provider: payment.digital_provider || null,
        amount_cents: payment.amount_cents,
        merchant_fee_cents: payment.merchant_fee_cents || 0,
      });

      if (payment.payment_type === 'HOUSE_TAB' && customerId) {
        await this.db.updateCustomerBalance(Number(customerId), payment.amount_cents);
      }
    }

    if (isCreditOverride) {
      const now = Date.now();
      await this.db.add('audit_log', {
        entity_type: 'Sale',
        entity_id: saleId,
        action: 'HANDSHAKE_CREDIT_OVERRIDE',
        details_json: JSON.stringify({ sale_id: saleId, customer_id: customerId }),
        created_at: now,
        timestamp: now,
      });
    }

    return saleId;
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

      const diff = Math.abs(itemsTotal - paymentsTotal);
      if (diff > 1) {
        mismatches.push({
          sale_id: saleId,
          sale,
          itemsTotal,
          paymentsTotal,
          diffCents: diff,
          created_at: sale.created_at
        });
      }
    }

    return mismatches;
  }

  async repairDataIntegrity() {
    const mismatches = await this.getIntegrityMismatches();
    let repairedCount = 0;

    for (const mismatch of mismatches) {
      const { sale_id, sale, itemsTotal, paymentsTotal } = mismatch;
      const saleId = Number(sale_id);

      const itemsForSale = await this.db.getAllByIndex('sale_items', 'sale_id', saleId);
      const paymentsForSale = await this.db.getAllByIndex('sale_payments', 'sale_id', saleId);

      if (itemsForSale.length === 0 && paymentsTotal > 0) {
        // Case A: Missing sale_items (e.g. credit store prepayment fulfillment)
        await this.db.add('sale_items', {
          sale_id: saleId,
          pigment_id: 0,
          weight_mg: 0,
          price_charged_cents: paymentsTotal,
          unit_cogs_cents: 0,
        });
        sale.total_amount_cents = paymentsTotal;
        await this.db.put('sales', sale);
        repairedCount++;
      } else if (paymentsForSale.length === 0 && itemsTotal > 0) {
        // Case B: Missing sale_payments
        await this.db.add('sale_payments', {
          sale_id: saleId,
          payment_type: 'CASH',
          digital_provider: null,
          amount_cents: itemsTotal,
          merchant_fee_cents: 0,
        });
        sale.total_amount_cents = itemsTotal;
        await this.db.put('sales', sale);
        repairedCount++;
      } else if (itemsTotal > 0 && paymentsTotal > 0 && itemsTotal !== paymentsTotal) {
        // Case C: Both exist but totals differ. Adjust last payment to match items total.
        const lastPayment = paymentsForSale[paymentsForSale.length - 1];
        const diffCents = itemsTotal - paymentsTotal;
        lastPayment.amount_cents = (lastPayment.amount_cents || 0) + diffCents;
        await this.db.put('sale_payments', lastPayment);

        sale.total_amount_cents = itemsTotal;
        await this.db.put('sales', sale);
        repairedCount++;
      }

      const now = Date.now();
      await this.db.add('audit_log', {
        entity_type: 'Sale',
        entity_id: saleId,
        action: 'INTEGRITY_AUTO_REPAIR',
        details_json: JSON.stringify({
          sale_id: saleId,
          previous_items_total: itemsTotal,
          previous_payments_total: paymentsTotal,
          repaired_total: itemsTotal || paymentsTotal
        }),
        created_at: now,
        timestamp: now,
      });
    }

    return repairedCount;
  }
}

