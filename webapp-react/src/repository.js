/**
 * @fileoverview Business logic repository layer for Micro Saler POS (React version).
 */

export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatMgToGrams(mg) {
  return `${(mg / 1000).toFixed(1)}g`;
}

export function formatMgToOz(mg) {
  return `${(mg / 28349.5).toFixed(2)} oz`;
}

export class PosRepository {
  constructor(db) {
    this.db = db;
  }

  async restockPigment(pigmentId, receivedMg, totalCostCents, supplierName) {
    const pigment = await this.db.getById('pigments', Number(pigmentId));
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);

    const newStockMg = pigment.stock_mg + receivedMg;
    const newTotalCostCents = pigment.total_cost_cents + totalCostCents;

    await this.db.updateStockAndCost(Number(pigmentId), newStockMg, newTotalCostCents);

    return await this.db.add('stock_receipts', {
      pigment_id: Number(pigmentId),
      received_mg: receivedMg,
      total_cost_cents: totalCostCents,
      supplier_name: supplierName,
      received_at: Date.now(),
    });
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
      await this.db.add('audit_log', {
        entity_type: 'Sale',
        entity_id: saleId,
        action: 'HANDSHAKE_CREDIT_OVERRIDE',
        details_json: JSON.stringify({ sale_id: saleId, customer_id: customerId }),
        created_at: Date.now(),
      });
    }

    return saleId;
  }

  async processReturn(saleItemId, mgReturned, reason, restockToInventory) {
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
}

