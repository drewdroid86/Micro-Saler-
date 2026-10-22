import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import {
  formatCents,
  formatMgToGrams,
  calculatePricingBreakdown,
  calculateCustomerBalance,
  calculateMerchantFeeCents
} from '../../repository';

const REASON_PRESETS = [
  'Wrong Weight Entered',
  'Price Adjustment',
  'Wrong Payment Tender',
  'Wrong Customer',
  'Wholesale / Retail Mode Fix'
];

export const CorrectSaleModal = () => {
  const {
    modal,
    closeModal,
    sales,
    saleItems,
    salePayments,
    pigments,
    customers,
    customerPrepayments,
    returns,
    priceTiers,
    repo,
    refreshAllData,
    showToast,
    isSubmitting,
    setIsSubmitting
  } = usePos();

  const payload = modal.payload || {};
  const rawSale = payload.sale || (payload.sale_id ? payload : null);
  const saleId = rawSale?.sale_id;

  const targetSale = useMemo(() => {
    if (!saleId) return null;
    return (sales || []).find(s => Number(s.sale_id) === Number(saleId)) || rawSale;
  }, [sales, saleId, rawSale]);

  const originalItems = useMemo(() => {
    if (!saleId) return [];
    if (Array.isArray(payload.items) && payload.items.length > 0) return payload.items;
    return (saleItems || []).filter(i => Number(i.sale_id) === Number(saleId));
  }, [saleItems, saleId, payload.items]);

  const originalPayments = useMemo(() => {
    if (!saleId) return [];
    if (Array.isArray(payload.payments) && payload.payments.length > 0) return payload.payments;
    return (salePayments || []).filter(p => Number(p.sale_id) === Number(saleId));
  }, [salePayments, saleId, payload.payments]);

  const [corrCustomerId, setCorrCustomerId] = useState('');
  const [corrPricingMode, setCorrPricingMode] = useState('RETAIL');
  const [corrItems, setCorrItems] = useState([]);
  const [paymentMode, setPaymentMode] = useState('CASH'); // 'CASH' | 'DIGITAL' | 'HOUSE_TAB' | 'STORE_CREDIT' | 'SPLIT'
  const [digitalProvider, setDigitalProvider] = useState('Square');
  const [splitCash, setSplitCash] = useState('');
  const [splitDigital, setSplitDigital] = useState('');
  const [splitDigitalProvider, setSplitDigitalProvider] = useState('Square');
  const [splitTab, setSplitTab] = useState('');
  const [splitCredit, setSplitCredit] = useState('');
  const [overrideTotalInput, setOverrideTotalInput] = useState('');
  const [reason, setReason] = useState('Price Adjustment');
  const [isCreditOverride, setIsCreditOverride] = useState(false);

  // Map of sale_item_id -> alreadyReturnedMg
  const returnsBySaleItemId = useMemo(() => {
    const map = new Map();
    for (const r of returns || []) {
      const siId = Number(r.sale_item_id);
      if (siId) {
        map.set(siId, (map.get(siId) || 0) + (Number(r.mg_returned) || 0));
      }
    }
    return map;
  }, [returns]);

  useEffect(() => {
    if (modal.name !== 'correctSale' || !targetSale) return;

    setCorrCustomerId(targetSale.customer_id ? String(targetSale.customer_id) : '');
    setCorrPricingMode((targetSale.pricing_mode || targetSale.sale_type || 'RETAIL').toUpperCase());
    setIsCreditOverride(Boolean(targetSale.is_credit_override));
    setReason(targetSale.last_correction_reason || 'Price Adjustment');
    setOverrideTotalInput('');

    const mappedItems = (originalItems || []).map((item, idx) => ({
      rowKey: `existing_${item.sale_item_id || item.id || idx}`,
      sale_item_id: item.sale_item_id || item.id || null,
      pigment_id: String(item.pigment_id || ''),
      pigment_name: item.pigment_name || '',
      weight_g: ((Number(item.weight_mg) || 0) / 1000).toString(),
      price_dollars: ((Number(item.price_charged_cents) || 0) / 100).toFixed(2),
      unit_cogs_cents: Number(item.unit_cogs_cents) || 0
    }));
    setCorrItems(mappedItems);

    if (originalPayments.length === 1) {
      const p = originalPayments[0];
      const pType = p.payment_type === 'PREPAID_DELIVERY' ? 'STORE_CREDIT' : (p.payment_type || 'CASH');
      setPaymentMode(pType);
      if (p.digital_provider) {
        setDigitalProvider(p.digital_provider);
      }
      setSplitCash(pType === 'CASH' ? ((p.amount_cents || 0) / 100).toFixed(2) : '');
      setSplitDigital(pType === 'DIGITAL' ? ((p.amount_cents || 0) / 100).toFixed(2) : '');
      setSplitTab(pType === 'HOUSE_TAB' ? ((p.amount_cents || 0) / 100).toFixed(2) : '');
      setSplitCredit(pType === 'STORE_CREDIT' ? ((p.amount_cents || 0) / 100).toFixed(2) : '');
    } else if (originalPayments.length > 1) {
      setPaymentMode('SPLIT');
      const cashAmt = originalPayments.filter(p => p.payment_type === 'CASH').reduce((s, p) => s + (p.amount_cents || 0), 0);
      const digPayments = originalPayments.filter(p => p.payment_type === 'DIGITAL');
      const digAmt = digPayments.reduce((s, p) => s + (p.amount_cents || 0), 0);
      const tabAmt = originalPayments.filter(p => p.payment_type === 'HOUSE_TAB').reduce((s, p) => s + (p.amount_cents || 0), 0);
      const credAmt = originalPayments.filter(p => p.payment_type === 'STORE_CREDIT' || p.payment_type === 'PREPAID_DELIVERY').reduce((s, p) => s + (p.amount_cents || 0), 0);

      setSplitCash(cashAmt > 0 ? (cashAmt / 100).toFixed(2) : '');
      setSplitDigital(digAmt > 0 ? (digAmt / 100).toFixed(2) : '');
      if (digPayments[0]?.digital_provider) {
        setSplitDigitalProvider(digPayments[0].digital_provider);
      }
      setSplitTab(tabAmt > 0 ? (tabAmt / 100).toFixed(2) : '');
      setSplitCredit(credAmt > 0 ? (credAmt / 100).toFixed(2) : '');
    } else {
      setPaymentMode('CASH');
      setSplitCash('');
      setSplitDigital('');
      setSplitTab('');
      setSplitCredit('');
    }
  }, [modal.name, targetSale, originalItems, originalPayments]);

  if (modal.name !== 'correctSale' || !targetSale) return null;

  const newTotalCents = corrItems.reduce((sum, item) => {
    const pD = parseFloat(item.price_dollars);
    return sum + (isNaN(pD) ? 0 : Math.round(pD * 100));
  }, 0);

  const selectedCustomerObj = (customers || []).find(
    c => String(c.customer_id) === String(corrCustomerId)
  ) || null;

  const computePigmentPriceDollars = (pigmentIdStr, weightGramsStr, modeOverride = corrPricingMode) => {
    const pObj = (pigments || []).find(p => String(p.pigment_id) === String(pigmentIdStr));
    const wG = parseFloat(weightGramsStr);
    if (!pObj || isNaN(wG) || wG <= 0) return null;
    const breakdown = calculatePricingBreakdown({
      pigment: pObj,
      weightMg: Math.round(wG * 1000),
      pricingMode: modeOverride,
      priceTiers
    });
    return (breakdown.totalPriceCents / 100).toFixed(2);
  };

  const handleItemPigmentChange = (index, newPigmentId) => {
    setCorrItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      const pObj = (pigments || []).find(p => String(p.pigment_id) === String(newPigmentId));
      const autoPrice = computePigmentPriceDollars(newPigmentId, it.weight_g, corrPricingMode);
      return {
        ...it,
        pigment_id: String(newPigmentId),
        pigment_name: pObj ? pObj.name : '',
        price_dollars: autoPrice !== null ? autoPrice : it.price_dollars
      };
    }));
  };

  const handleItemWeightChange = (index, newWeightG, autoRecalc = false) => {
    setCorrItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      const next = { ...it, weight_g: newWeightG };
      if (autoRecalc) {
        const autoPrice = computePigmentPriceDollars(it.pigment_id, newWeightG, corrPricingMode);
        if (autoPrice !== null) next.price_dollars = autoPrice;
      }
      return next;
    }));
  };

  const handleItemPriceChange = (index, newPriceDollars) => {
    setCorrItems(prev => prev.map((it, idx) => idx === index ? { ...it, price_dollars: newPriceDollars } : it));
  };

  const handleRecalcSingleItem = (index) => {
    setCorrItems(prev => prev.map((it, idx) => {
      if (idx !== index) return it;
      const autoPrice = computePigmentPriceDollars(it.pigment_id, it.weight_g, corrPricingMode);
      return autoPrice !== null ? { ...it, price_dollars: autoPrice } : it;
    }));
  };

  const handleRecalcAllItemsForMode = (mode) => {
    setCorrItems(prev => prev.map(it => {
      const autoPrice = computePigmentPriceDollars(it.pigment_id, it.weight_g, mode);
      return autoPrice !== null ? { ...it, price_dollars: autoPrice } : it;
    }));
  };

  const handleAddItem = () => {
    const availablePigments = (pigments || []).filter(p => !p.is_archived);
    const defaultPigment = availablePigments[0] || (pigments || [])[0];
    if (!defaultPigment) {
      showToast('No pigments in catalog to add.', 'error');
      return;
    }
    const defaultWeightG = '1';
    const defaultPrice = computePigmentPriceDollars(defaultPigment.pigment_id, defaultWeightG, corrPricingMode) || '0.00';

    setCorrItems(prev => [
      ...prev,
      {
        rowKey: `new_${Date.now()}_${Math.random()}`,
        sale_item_id: null,
        pigment_id: String(defaultPigment.pigment_id),
        pigment_name: defaultPigment.name,
        weight_g: defaultWeightG,
        price_dollars: defaultPrice,
        unit_cogs_cents: 0
      }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (corrItems.length <= 1) {
      showToast('A sale must have at least one line item. Use Void Sale to cancel the entire sale.', 'error');
      return;
    }
    const item = corrItems[index];
    const returnedMg = item.sale_item_id ? (returnsBySaleItemId.get(Number(item.sale_item_id)) || 0) : 0;
    if (returnedMg > 0) {
      showToast(`Cannot remove item with ${formatMgToGrams(returnedMg)} already returned.`, 'error');
      return;
    }
    setCorrItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleApplyTotalOverride = () => {
    const targetD = parseFloat(overrideTotalInput);
    if (isNaN(targetD) || targetD <= 0) {
      showToast('Enter a valid positive dollar total to apply.', 'error');
      return;
    }
    const targetTotalCents = Math.round(targetD * 100);
    if (corrItems.length === 0) return;

    const currentSumCents = newTotalCents;
    let assignedCents = 0;

    const scaled = corrItems.map((item, idx) => {
      if (idx === corrItems.length - 1) {
        const lastCents = Math.max(0, targetTotalCents - assignedCents);
        return { ...item, price_dollars: (lastCents / 100).toFixed(2) };
      }
      const itemCents = Math.round((parseFloat(item.price_dollars) || 0) * 100);
      const share = currentSumCents > 0
        ? Math.round((itemCents / currentSumCents) * targetTotalCents)
        : Math.round(targetTotalCents / corrItems.length);
      assignedCents += share;
      return { ...item, price_dollars: (share / 100).toFixed(2) };
    });

    setCorrItems(scaled);
    setOverrideTotalInput('');
    showToast(`Line item prices scaled to ${formatCents(targetTotalCents)}`, 'info');
  };

  // Build final payments list from UI state
  const buildPaymentsList = () => {
    if (paymentMode === 'CASH') {
      return [{ payment_type: 'CASH', digital_provider: null, amount_cents: newTotalCents, merchant_fee_cents: 0 }];
    }
    if (paymentMode === 'DIGITAL') {
      const fee = calculateMerchantFeeCents(digitalProvider, newTotalCents);
      return [{ payment_type: 'DIGITAL', digital_provider: digitalProvider, amount_cents: newTotalCents, merchant_fee_cents: fee }];
    }
    if (paymentMode === 'HOUSE_TAB') {
      return [{ payment_type: 'HOUSE_TAB', digital_provider: null, amount_cents: newTotalCents, merchant_fee_cents: 0 }];
    }
    if (paymentMode === 'STORE_CREDIT') {
      return [{ payment_type: 'STORE_CREDIT', digital_provider: null, amount_cents: newTotalCents, merchant_fee_cents: 0 }];
    }
    // SPLIT mode
    const list = [];
    const cashC = Math.round((parseFloat(splitCash) || 0) * 100);
    const digC = Math.round((parseFloat(splitDigital) || 0) * 100);
    const tabC = Math.round((parseFloat(splitTab) || 0) * 100);
    const credC = Math.round((parseFloat(splitCredit) || 0) * 100);

    if (cashC > 0) list.push({ payment_type: 'CASH', digital_provider: null, amount_cents: cashC, merchant_fee_cents: 0 });
    if (digC > 0) list.push({
      payment_type: 'DIGITAL',
      digital_provider: splitDigitalProvider,
      amount_cents: digC,
      merchant_fee_cents: calculateMerchantFeeCents(splitDigitalProvider, digC)
    });
    if (tabC > 0) list.push({ payment_type: 'HOUSE_TAB', digital_provider: null, amount_cents: tabC, merchant_fee_cents: 0 });
    if (credC > 0) list.push({ payment_type: 'STORE_CREDIT', digital_provider: null, amount_cents: credC, merchant_fee_cents: 0 });
    return list;
  };

  const previewPayments = buildPaymentsList();
  const previewPaymentsSumCents = previewPayments.reduce((s, p) => s + (p.amount_cents || 0), 0);
  const splitRemainingCents = newTotalCents - previewPaymentsSumCents;

  const handleSaveCorrection = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!reason || !reason.trim()) {
      showToast('Please provide a reason for correcting this sale.', 'error');
      return;
    }

    if (corrItems.length === 0) {
      showToast('Sale must contain at least one item.', 'error');
      return;
    }

    const formattedItems = [];
    for (const it of corrItems) {
      const wG = parseFloat(it.weight_g);
      const pD = parseFloat(it.price_dollars);
      const pId = Number(it.pigment_id);

      if (isNaN(wG) || wG <= 0) {
        showToast('Each item must have a weight greater than 0g.', 'error');
        return;
      }
      if (isNaN(pD) || pD < 0) {
        showToast('Each item must have a valid price.', 'error');
        return;
      }

      const weightMg = Math.round(wG * 1000);
      const returnedMg = it.sale_item_id ? (returnsBySaleItemId.get(Number(it.sale_item_id)) || 0) : 0;
      if (returnedMg > 0 && weightMg < returnedMg) {
        showToast(`Weight cannot be less than already returned weight (${formatMgToGrams(returnedMg)}).`, 'error');
        return;
      }

      const pObj = (pigments || []).find(p => Number(p.pigment_id) === pId);
      formattedItems.push({
        sale_item_id: it.sale_item_id ? Number(it.sale_item_id) : undefined,
        pigment_id: pId,
        pigment_name: pObj ? pObj.name : (it.pigment_name || `Pigment #${pId}`),
        weight_mg: weightMg,
        price_charged_cents: Math.round(pD * 100),
        unit_cogs_cents: it.unit_cogs_cents || 0
      });
    }

    if (Math.abs(splitRemainingCents) > 1) {
      showToast(`Payment breakdown (${formatCents(previewPaymentsSumCents)}) must match corrected sale total (${formatCents(newTotalCents)}).`, 'error');
      return;
    }

    const needsCustomer = previewPayments.some(p => p.payment_type === 'HOUSE_TAB' || p.payment_type === 'STORE_CREDIT');
    if (needsCustomer && !corrCustomerId) {
      showToast('Please assign a customer when using House Tab or Store Credit.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedSale = await repo.correctSale(targetSale.sale_id, {
        customerId: corrCustomerId ? Number(corrCustomerId) : null,
        pricingMode: corrPricingMode,
        items: formattedItems,
        payments: previewPayments,
        reason: reason.trim(),
        isCreditOverride
      });

      await refreshAllData();
      if (typeof payload.onCorrected === 'function') {
        payload.onCorrected(updatedSale);
      }
      showToast(`Sale #${String(targetSale.sale_id).substring(0, 6)} corrected & logged in Audit Trail!`, 'success');
      closeModal();
    } catch (err) {
      showToast(err.message || 'Failed to correct sale', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDeltaCents = newTotalCents - (Number(targetSale.total_amount_cents) || 0);

  return (
    <div className="modal-overlay active" onClick={closeModal}>
      <div
        className="modal"
        style={{ maxWidth: '680px', width: '95%' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0 }}>✏️ Correct Sale #{String(targetSale.sale_id).substring(0, 8)}</h2>
            <div className="body-small text-muted" style={{ marginTop: '2px' }}>
              Originally recorded {new Date(targetSale.created_at || targetSale.timestamp || Date.now()).toLocaleString()} • Original Total: <strong>{formatCents(targetSale.total_amount_cents)}</strong>
            </div>
          </div>
          <button className="modal-close" onClick={closeModal}>&times;</button>
        </div>

        <form onSubmit={handleSaveCorrection}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>

            {/* 1. Customer & Pricing Mode */}
            <div className="grid-2col gap-sm mb-md">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Customer</label>
                <select
                  className="form-select"
                  value={corrCustomerId}
                  onChange={e => setCorrCustomerId(e.target.value)}
                >
                  <option value="">🚶 Walk-in Customer</option>
                  {(customers || []).map(c => {
                    const bal = calculateCustomerBalance(c, customerPrepayments || []);
                    const balText = bal.hasDebt
                      ? `Owes ${formatCents(bal.debtCents)}`
                      : bal.hasStoreCredit
                      ? `Credit +${formatCents(bal.storeCreditCents)}`
                      : '$0.00';
                    return (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.name} ({balText})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Pricing Mode</label>
                <div className="flex-center gap-xs">
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${corrPricingMode === 'RETAIL' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCorrPricingMode('RETAIL')}
                  >
                    🏪 Retail
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${corrPricingMode === 'WHOLESALE' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCorrPricingMode('WHOLESALE')}
                  >
                    🏷️ Wholesale
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    title="Recalculate all item prices using selected pricing mode"
                    onClick={() => handleRecalcAllItemsForMode(corrPricingMode)}
                    style={{ border: '1px solid var(--market-border)', fontSize: '11px' }}
                  >
                    🔄 Recalc
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Line Items Editor */}
            <div className="card card-static p-sm mb-md" style={{ background: 'var(--market-surface-variant)' }}>
              <div className="flex-between mb-sm">
                <span className="label-medium">📦 Line Items ({corrItems.length})</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={handleAddItem}
                >
                  + Add Item
                </button>
              </div>

              <div className="flex-col gap-xs">
                {corrItems.map((item, idx) => {
                  const returnedMg = item.sale_item_id ? (returnsBySaleItemId.get(Number(item.sale_item_id)) || 0) : 0;
                  const hasReturns = returnedMg > 0;
                  return (
                    <div
                      key={item.rowKey}
                      className="p-xs"
                      style={{
                        background: 'var(--market-surface)',
                        borderRadius: '6px',
                        border: '1px solid var(--market-border)'
                      }}
                    >
                      <div className="flex-between gap-xs" style={{ flexWrap: 'wrap' }}>
                        {/* Pigment Selector */}
                        <div style={{ flex: '2 1 170px' }}>
                          <label className="label-small text-muted" style={{ display: 'block', fontSize: '10px' }}>
                            PIGMENT {hasReturns ? `(Returned: ${formatMgToGrams(returnedMg)})` : ''}
                          </label>
                          <select
                            className="form-select"
                            style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                            value={item.pigment_id}
                            disabled={hasReturns}
                            onChange={e => handleItemPigmentChange(idx, e.target.value)}
                          >
                            {Number(item.pigment_id) <= 0 && (
                              <option value={item.pigment_id}>{item.pigment_name || 'Credit / Prepayment'}</option>
                            )}
                            {(pigments || []).map(p => (
                              <option key={p.pigment_id} value={p.pigment_id}>
                                {p.name} ({formatMgToGrams(p.stock_mg)} stock)
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Weight (grams) */}
                        <div style={{ flex: '1 1 95px' }}>
                          <label className="label-small text-muted" style={{ display: 'block', fontSize: '10px' }}>
                            WEIGHT (g)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                            value={item.weight_g}
                            onChange={e => handleItemWeightChange(idx, e.target.value, false)}
                            required
                          />
                        </div>

                        {/* Price Charged ($) */}
                        <div style={{ flex: '1 1 105px' }}>
                          <label className="label-small text-muted" style={{ display: 'block', fontSize: '10px' }}>
                            PRICE ($)
                          </label>
                          <div className="flex-center gap-xs">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-input"
                              style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                              value={item.price_dollars}
                              onChange={e => handleItemPriceChange(idx, e.target.value)}
                              required
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              title="Auto-calculate price from weight & tier"
                              style={{ border: '1px solid var(--market-border)', padding: '5px 6px' }}
                              onClick={() => handleRecalcSingleItem(idx)}
                            >
                              🔄
                            </button>
                          </div>
                        </div>

                        {/* Remove Item */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-xs"
                            disabled={hasReturns || corrItems.length <= 1}
                            title={hasReturns ? 'Cannot remove item with existing returns' : 'Remove line item'}
                            onClick={() => handleRemoveItem(idx)}
                            style={{ padding: '6px 8px' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Total Override Bar */}
              <div className="flex-between mt-sm pt-sm" style={{ borderTop: '1px dashed var(--market-border)', flexWrap: 'wrap', gap: '8px' }}>
                <div className="flex-center gap-xs">
                  <span className="body-small text-muted">Override Total ($):</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-input"
                    placeholder={(newTotalCents / 100).toFixed(2)}
                    style={{ width: '100px', padding: '4px 8px', fontSize: '0.85rem' }}
                    value={overrideTotalInput}
                    onChange={e => setOverrideTotalInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleApplyTotalOverride}
                  >
                    Scale Prices
                  </button>
                </div>
                <div className="title-medium">
                  Corrected Total: <strong className="text-primary">{formatCents(newTotalCents)}</strong>
                  {totalDeltaCents !== 0 && (
                    <span
                      className={`body-small ml-xs ${totalDeltaCents > 0 ? 'text-warning' : 'text-success'}`}
                      style={{ marginLeft: '6px' }}
                    >
                      ({totalDeltaCents > 0 ? `+${formatCents(totalDeltaCents)}` : formatCents(totalDeltaCents)})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Payment Tender Breakdown */}
            <div className="card card-static p-sm mb-md">
              <label className="label-medium mb-xs" style={{ display: 'block' }}>💳 Payment Tender</label>
              <div className="flex-center gap-xs mb-sm" style={{ flexWrap: 'wrap' }}>
                {[
                  { id: 'CASH', label: '💵 Cash' },
                  { id: 'DIGITAL', label: '💳 Digital' },
                  { id: 'HOUSE_TAB', label: '📑 House Tab' },
                  { id: 'STORE_CREDIT', label: '💰 Store Credit' },
                  { id: 'SPLIT', label: '🔀 Split Tender' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`btn btn-xs ${paymentMode === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setPaymentMode(tab.id);
                      if (tab.id === 'SPLIT' && previewPaymentsSumCents === 0) {
                        setSplitCash((newTotalCents / 100).toFixed(2));
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {paymentMode === 'DIGITAL' && (
                <div className="flex-between p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <div className="flex-center gap-xs">
                    <span className="body-small">Provider:</span>
                    {['Square', 'Venmo', 'Zelle'].map(prov => (
                      <button
                        key={prov}
                        type="button"
                        className={`btn btn-xs ${digitalProvider === prov ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setDigitalProvider(prov)}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                  <span className="body-small text-muted">
                    Est. Fee: {formatCents(calculateMerchantFeeCents(digitalProvider, newTotalCents))}
                  </span>
                </div>
              )}

              {(paymentMode === 'HOUSE_TAB' || (paymentMode === 'SPLIT' && (parseFloat(splitTab) || 0) > 0)) && (
                <div className="p-xs mt-xs" style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <div className="flex-between body-small">
                    <span>
                      {selectedCustomerObj
                        ? `Customer: ${selectedCustomerObj.name} (Credit Limit: ${formatCents(selectedCustomerObj.credit_limit_cents || 0)})`
                        : '⚠️ Select a customer above for House Tab charges'}
                    </span>
                    <label className="flex-center gap-xs" style={{ cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input
                        type="checkbox"
                        checked={isCreditOverride}
                        onChange={e => setIsCreditOverride(e.target.checked)}
                      />
                      Handshake Override
                    </label>
                  </div>
                </div>
              )}

              {paymentMode === 'SPLIT' && (
                <div className="mt-sm">
                  <div className="grid-2col gap-xs mb-xs">
                    <div>
                      <label className="label-small text-muted">💵 Cash ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={e => setSplitCash(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-small text-muted">💳 Digital ($)</label>
                      <div className="flex-center gap-xs">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          placeholder="0.00"
                          value={splitDigital}
                          onChange={e => setSplitDigital(e.target.value)}
                        />
                        <select
                          className="form-select"
                          style={{ width: '95px' }}
                          value={splitDigitalProvider}
                          onChange={e => setSplitDigitalProvider(e.target.value)}
                        >
                          <option value="Square">Square</option>
                          <option value="Venmo">Venmo</option>
                          <option value="Zelle">Zelle</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="label-small text-muted">📑 House Tab ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0.00"
                        value={splitTab}
                        onChange={e => setSplitTab(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label-small text-muted">💰 Store Credit ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-input"
                        placeholder="0.00"
                        value={splitCredit}
                        onChange={e => setSplitCredit(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex-between body-small pt-xs" style={{ borderTop: '1px solid var(--market-border)' }}>
                    <span>Allocated: <strong>{formatCents(previewPaymentsSumCents)}</strong> / {formatCents(newTotalCents)}</span>
                    {splitRemainingCents !== 0 ? (
                      <div className="flex-center gap-xs">
                        <span className="text-error">Diff: {formatCents(splitRemainingCents)}</span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={() => {
                            const curCashC = Math.round((parseFloat(splitCash) || 0) * 100);
                            setSplitCash((Math.max(0, curCashC + splitRemainingCents) / 100).toFixed(2));
                          }}
                        >
                          Adjust Cash
                        </button>
                      </div>
                    ) : (
                      <span className="text-success">✓ Exact Match</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Correction Reason */}
            <div className="form-group mb-xs">
              <label className="form-label">Reason for Correction (Audit Log)</label>
              <div className="flex-center gap-xs mb-xs" style={{ flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                {REASON_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn btn-xs ${reason === preset ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ border: '1px solid var(--market-border)', fontSize: '11px' }}
                    onClick={() => setReason(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                className="form-input"
                placeholder="Describe why this sale was corrected..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
              />
            </div>

          </div>

          <div className="modal-footer flex-between">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || Math.abs(splitRemainingCents) > 1}
            >
              {isSubmitting ? 'Saving...' : `💾 Save Sale Correction (${formatCents(newTotalCents)})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
