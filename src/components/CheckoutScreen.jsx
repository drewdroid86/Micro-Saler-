import React, { useState, useEffect, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams, calculateRecommendedMsrpCents, getEffectivePricePerGramCents } from '../repository';
import { CustomerNameInput } from './CustomerNameInput';

const CartItem = ({ item, index, onRemove, updateCartItem, openModal, priceTiers }) => {
  const itemMsrp = calculateRecommendedMsrpCents(item.pigment, item.weight_mg, priceTiers);
  const isDiscounted = itemMsrp > (item.price_charged_cents || 0);

  const handleDecrement = () => {
    const currentMg = item.weight_mg || 0;
    const stepMg = currentMg <= 1000 ? 250 : 1000;
    const nextMg = currentMg - stepMg;
    if (nextMg <= 0) {
      onRemove();
    } else {
      updateCartItem(index, nextMg);
    }
  };

  const handleIncrement = () => {
    const currentMg = item.weight_mg || 0;
    const stepMg = currentMg < 1000 ? 250 : 1000;
    updateCartItem(index, currentMg + stepMg);
  };

  return (
    <div className="cart-item">
      <div className="cart-item-details">
        <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
          {item.pigment?.color_code && (
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: item.pigment.color_code,
                border: '1px solid rgba(0,0,0,0.15)',
                flexShrink: 0
              }}
            />
          )}
          <span className="cart-item-title">{item.pigment?.name || 'Item'}</span>
        </div>
        <span className="cart-item-meta">
          <strong>{formatMgToGrams(item.weight_mg)}</strong>
          {itemMsrp > 0 && (
            <span style={{ marginLeft: '6px', opacity: 0.85 }}>
              • MSRP: {formatCents(itemMsrp)}
            </span>
          )}
        </span>
      </div>

      <div className="flex-center gap-xs">
        <div className="cart-stepper-group" title="Adjust weight (-/+)">
          <button
            type="button"
            className="cart-stepper-btn"
            onClick={handleDecrement}
            aria-label="Decrease weight"
          >
            −
          </button>
          <span className="cart-stepper-val">{formatMgToGrams(item.weight_mg)}</span>
          <button
            type="button"
            className="cart-stepper-btn"
            onClick={handleIncrement}
            aria-label="Increase weight"
          >
            +
          </button>
        </div>

        <div style={{ textAlign: 'right', minWidth: '58px' }}>
          <span className="cart-item-price">{formatCents(item.price_charged_cents)}</span>
          {isDiscounted && (
            <div style={{ fontSize: '10px', color: 'var(--market-success)', fontWeight: '700' }}>
              -{formatCents(itemMsrp - (item.price_charged_cents || 0))}
            </div>
          )}
        </div>

        <button
          className="cart-item-action-btn"
          onClick={() => openModal('editCartItem', { item, index })}
          title="Edit weight or custom price"
          aria-label="Edit line item"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button className="cart-item-remove" onClick={onRemove} title="Remove line item">
          &times;
        </button>
      </div>
    </div>
  );
};

export const CheckoutScreen = () => {
  const {
    pigments,
    priceTiers,
    customers,
    selectedCustomer,
    setSelectedCustomer,
    selectedPigment,
    setSelectedPigment,
    pricingMode,
    setPricingMode,
    changePricingMode,
    cart,
    addToCart,
    removeFromCart,
    updateCartItem,
    clearCart,
    resetCartPrices,
    quickCollectCash,
    openModal,
    showToast,
    customerPrepayments,
    integrityMismatchCount,
    repo,
    refreshAllData
  } = usePos();

  const [pigmentSearch, setPigmentSearch] = useState('');
  const [finishFilter, setFinishFilter] = useState('ALL');

  const safeCustomerPrepayments = customerPrepayments || [];
  const selectedCustomerActivePrepayments = selectedCustomer && selectedCustomer.customer_id
    ? safeCustomerPrepayments.filter(p => Number(p.customer_id) === Number(selectedCustomer.customer_id) && p.status !== 'FULFILLED')
    : [];
  const customerPrepaymentWeightMg = selectedCustomerActivePrepayments.reduce((sum, p) => sum + (p.weight_mg || 0), 0);
  const customerPrepaymentCreditCents = selectedCustomerActivePrepayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

  const [customerNameInput, setCustomerNameInput] = useState(selectedCustomer?.name || '');

  useEffect(() => {
    setCustomerNameInput(selectedCustomer ? selectedCustomer.name : '');
  }, [selectedCustomer]);

  const safeCart = cart || [];
  const safePigments = pigments || [];

  const availableFinishes = useMemo(() => {
    const finishes = new Set();
    safePigments.forEach(p => {
      if (p.finish_type) finishes.add(p.finish_type);
    });
    return ['ALL', ...Array.from(finishes)];
  }, [safePigments]);

  const filteredPigments = useMemo(() => {
    return safePigments.filter(p => {
      if (finishFilter !== 'ALL' && p.finish_type !== finishFilter) return false;
      if (pigmentSearch.trim()) {
        const q = pigmentSearch.toLowerCase();
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchFinish = (p.finish_type || '').toLowerCase().includes(q);
        if (!matchName && !matchFinish) return false;
      }
      return true;
    });
  }, [safePigments, finishFilter, pigmentSearch]);

  const presets = [
    { label: '¼g', mg: 250 },
    { label: '½g', mg: 500 },
    { label: '¾g', mg: 750 },
    { label: '1g', mg: 1000 },
    { label: '1.5g', mg: 1500 },
    { label: '1.75g', mg: 1750 },
    { label: '3.5g', mg: 3500 },
    { label: '5g', mg: 5000 },
    { label: '7g', mg: 7000 },
    { label: '14g', mg: 14000 },
    { label: '28g', mg: 28000 }
  ];

  const hasTierOverride = (presetMg) => {
    if (!selectedPigment) return false;
    const tier = (priceTiers || []).find(
      t => Number(t.pigment_id) === Number(selectedPigment.pigment_id) && Number(t.weight_mg) === Number(presetMg)
    );
    if (!tier) return false;
    const val = pricingMode === 'RETAIL' ? tier.retail_price_cents : tier.wholesale_price_cents;
    return val !== null && val !== undefined && !isNaN(val) && Number(val) > 0;
  };

  const getPresetPrice = (presetMg) => {
    if (!selectedPigment) return null;
    const tier = (priceTiers || []).find(
      t => Number(t.pigment_id) === Number(selectedPigment.pigment_id) && Number(t.weight_mg) === Number(presetMg)
    );
    if (tier) {
      const val = pricingMode === 'RETAIL' ? tier.retail_price_cents : tier.wholesale_price_cents;
      if (val !== null && val !== undefined && !isNaN(val) && Number(val) > 0) {
        return Number(val);
      }
    }
    const rate = getEffectivePricePerGramCents(selectedPigment, presetMg, pricingMode);
    return Math.round((presetMg / 1000) * rate) + (selectedPigment.default_pkg_cents || 0);
  };

  const handlePresetClick = (mg) => {
    if (!selectedPigment) {
      showToast('Please select a pigment first.', 'error');
      return;
    }
    addToCart(selectedPigment, mg);
  };

  const handleCustomClick = () => {
    if (!selectedPigment) {
      showToast('Please select a pigment first.', 'error');
      return;
    }
    openModal('customWeight');
  };

  const totalCharged = safeCart.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
  const totalCogs = safeCart.reduce((sum, item) => sum + (item.unit_cogs_cents || 0), 0);
  const totalMsrp = safeCart.reduce((sum, item) => sum + calculateRecommendedMsrpCents(item.pigment, item.weight_mg, priceTiers), 0);
  const totalWeightMg = safeCart.reduce((sum, item) => sum + (item.weight_mg || 0), 0);
  const margin = totalCharged > 0 ? Math.round(((totalCharged - totalCogs) / totalCharged) * 100) : 0;

  return (
    <div className="checkout-layout">
      {integrityMismatchCount > 0 && (
        <div className="card mb-sm flex-between" style={{ background: 'rgba(245, 124, 0, 0.12)', borderColor: 'var(--market-warning)', padding: '10px 14px', alignItems: 'center' }}>
          <div>
            <div className="font-weight-bold" style={{ color: 'var(--market-warning)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span> Data Integrity Warning: {integrityMismatchCount} completed sale(s) have payment total mismatches.
            </div>
            <div className="body-small text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Line item amounts do not match recorded payment totals in local IndexedDB.
            </div>
          </div>
          <button
            className="btn btn-warning btn-sm"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => openModal('integrityRepair')}
          >
            Review & Fix
          </button>
        </div>
      )}

      {/* Top Customer & Pricing Mode Bar */}
      <div className="checkout-top-bar">
        <CustomerNameInput
          value={customerNameInput}
          onChange={(text, customerRecord) => {
            setCustomerNameInput(text);
            setSelectedCustomer(customerRecord);
            if (customerRecord) {
              const isWholesale = customerRecord.customer_type === 'WHOLESALE' || Boolean(customerRecord.is_wholesale);
              const switchFn = changePricingMode || setPricingMode;
              switchFn(isWholesale ? 'WHOLESALE' : 'RETAIL');
            }
          }}
          customers={customers}
          customerPrepayments={customerPrepayments}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={(cust) => {
            setSelectedCustomer(cust);
            setCustomerNameInput(cust ? cust.name : '');
            if (cust) {
              const isWholesale = cust.customer_type === 'WHOLESALE' || Boolean(cust.is_wholesale);
              const switchFn = changePricingMode || setPricingMode;
              switchFn(isWholesale ? 'WHOLESALE' : 'RETAIL');
            }
          }}
          onOpenCustomerPicker={() => openModal('customerPicker')}
        />

        <div className="flex-center gap-xs">
          <div className="pricing-toggle">
            <button
              className={`toggle-option ${pricingMode === 'RETAIL' ? 'active' : ''}`}
              onClick={() => (changePricingMode ? changePricingMode('RETAIL') : setPricingMode('RETAIL'))}
            >
              🏷️ RETAIL
            </button>
            <button
              className={`toggle-option ${pricingMode === 'WHOLESALE' ? 'active' : ''}`}
              onClick={() => (changePricingMode ? changePricingMode('WHOLESALE') : setPricingMode('WHOLESALE'))}
            >
              📦 WHOLESALE
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px 10px', fontSize: '12px' }}
            onClick={() => openModal('HELP', { section: 'quick-start' })}
            title="Checkout & Register Quick Guide"
          >
            ❓ Guide
          </button>
        </div>
      </div>

      {selectedCustomerActivePrepayments.length > 0 && (
        <div className="card flex-between" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--market-success)', padding: '10px 14px', alignItems: 'center' }}>
          <div>
            <div className="font-weight-bold text-success" style={{ fontSize: '13px' }}>
              📦 Pending Prepayment / Backorder Owed ({selectedCustomerActivePrepayments.length})
            </div>
            <div className="body-small text-muted" style={{ fontSize: '12px' }}>
              {customerPrepaymentWeightMg > 0 ? `Owed: ${formatMgToGrams(customerPrepaymentWeightMg)} ` : ''}
              {customerPrepaymentCreditCents > 0 ? `• Credit: ${formatCents(customerPrepaymentCreditCents)}` : ''}
            </div>
          </div>
          <button
            className="btn btn-success btn-sm"
            onClick={async () => {
              try {
                for (const p of selectedCustomerActivePrepayments) {
                  await repo.fulfillCustomerPrepayment(p.prepayment_id);
                }
                await refreshAllData();
                showToast('Prepayment marked as delivered / fulfilled!', 'success');
              } catch (e) {
                showToast('Fulfillment failed: ' + e.message, 'error');
              }
            }}
          >
            ✅ Mark Delivered
          </button>
        </div>
      )}

      {/* Responsive Split Container: Catalog & Presets on Left, Sticky Receipt Cart on Right (>=900px) */}
      <div className="checkout-split-container">
        {/* Left Pane: Step 1 (Pigment Selection) & Step 2 (Weight Tier Selection) */}
        <div className="checkout-catalog-pane">
          {/* STEP 1: SELECT PIGMENT */}
          <div className="pos-step-section">
            <div className="pos-step-header">
              <div className="flex-center gap-xs">
                <span className="pos-step-badge">1</span>
                <span className="pos-step-title">Select Pigment</span>
                <span className="badge" style={{ marginLeft: '4px' }}>{filteredPigments.length} shown</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => openModal('addPigment')}
                title="Add a new pigment to catalog"
              >
                + New Pigment
              </button>
            </div>

            {/* Quick Search & Finish Filter Bar */}
            <div className="pos-catalog-toolbar">
              <div className="pos-search-input-wrap">
                <span className="pos-search-icon">🔍</span>
                <input
                  type="text"
                  className="pos-search-input"
                  placeholder="Filter pigments by name or finish..."
                  value={pigmentSearch}
                  onChange={e => setPigmentSearch(e.target.value)}
                />
                {pigmentSearch && (
                  <button
                    type="button"
                    className="pos-search-clear"
                    onClick={() => setPigmentSearch('')}
                    aria-label="Clear pigment search"
                  >
                    &times;
                  </button>
                )}
              </div>

              {availableFinishes.length > 2 && (
                <div className="pos-filter-pills">
                  {availableFinishes.map(fin => (
                    <button
                      key={fin}
                      type="button"
                      className={`pos-filter-pill ${finishFilter === fin ? 'active' : ''}`}
                      onClick={() => setFinishFilter(fin)}
                    >
                      {fin === 'ALL' ? 'All Finishes' : fin}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pigment Catalog Grid */}
            {filteredPigments.length === 0 ? (
              <div className="card p-md text-center text-muted body-small">
                No pigments match "{pigmentSearch}".{' '}
                <button className="btn btn-ghost btn-xs" onClick={() => { setPigmentSearch(''); setFinishFilter('ALL'); }}>
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid-2col">
                {filteredPigments.map(p => {
                  const isSelected = selectedPigment && selectedPigment.pigment_id === p.pigment_id;
                  const activeRate = pricingMode === 'WHOLESALE'
                    ? p.wholesale_price_per_gram_cents
                    : p.retail_price_per_gram_cents;
                  const isLowStock = (p.stock_mg || 0) < 10000;

                  return (
                    <div
                      key={p.pigment_id}
                      className={`pigment-grid-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedPigment(p)}
                    >
                      <div className="color-swatch" style={{ backgroundColor: p.color_code }}>
                        {isSelected && <span className="swatch-check">✓</span>}
                      </div>
                      <div className="pigment-info">
                        <div className="flex-between" style={{ gap: '6px' }}>
                          <div className="pigment-name">{p.name}</div>
                          <span className="pigment-rate-pill">{formatCents(activeRate)}/g</span>
                        </div>
                        <div className="flex-between mt-xs" style={{ alignItems: 'center' }}>
                          <span className="pigment-finish">{p.finish_type || 'Standard'}</span>
                          <span className={`pigment-stock ${isLowStock ? 'low-stock' : ''}`}>
                            {isLowStock ? '⚠️ ' : ''}{formatMgToGrams(p.stock_mg)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STEP 2: TAP WEIGHT TO ADD */}
          <div className="pos-step-section mt-md">
            <div className="pos-step-header">
              <div className="flex-center gap-xs">
                <span className="pos-step-badge">2</span>
                <span className="pos-step-title">Tap Weight Tier to Add</span>
              </div>
              {selectedPigment && (
                <div className="selected-pigment-chip">
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: selectedPigment.color_code,
                      display: 'inline-block',
                      border: '1px solid rgba(0,0,0,0.2)'
                    }}
                  />
                  <strong>{selectedPigment.name}</strong>
                  <span className="text-muted">•</span>
                  <span className="text-primary font-weight-bold">
                    {formatCents(pricingMode === 'WHOLESALE' ? selectedPigment.wholesale_price_per_gram_cents : selectedPigment.retail_price_per_gram_cents)}/g
                  </span>
                </div>
              )}
            </div>

            <div className="weight-presets">
              {presets.map(preset => {
                const isTierSet = hasTierOverride(preset.mg);
                const presetPrice = selectedPigment ? getPresetPrice(preset.mg) : null;
                const presetMsrp = selectedPigment ? calculateRecommendedMsrpCents(selectedPigment, preset.mg, priceTiers) : null;
                return (
                  <button
                    key={preset.label}
                    className={`weight-preset-btn ${isTierSet ? 'has-tier-override' : ''}`}
                    onClick={() => handlePresetClick(preset.mg)}
                    title={selectedPigment ? `${preset.label} (${formatMgToGrams(preset.mg)}) • MSRP: ${formatCents(presetMsrp)}${pricingMode === 'WHOLESALE' ? ` | Wholesale: ${formatCents(presetPrice)}` : ''}` : preset.label}
                  >
                    <span className="weight-preset-label">{preset.label}</span>
                    {presetPrice !== null && (
                      <span className="weight-preset-price">
                        {formatCents(presetPrice)}
                      </span>
                    )}
                    {isTierSet && (
                      <span
                        className="tier-badge-dot"
                        title="Fixed preset tier price active"
                      />
                    )}
                  </button>
                );
              })}
              <button className="weight-preset-btn custom-btn" onClick={handleCustomClick}>
                <span className="weight-preset-label">+ Custom</span>
                <span className="weight-preset-price">Any g / $</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane: Step 3 (Sticky Receipt Cart & Payment Actions) */}
        <div className="checkout-cart-pane">
          <div className="cart-summary">
            <div className="card-header">
              <div className="flex-center gap-xs">
                <span className="pos-step-badge">3</span>
                <h3 className="title-medium" style={{ margin: 0 }}>Order Receipt</h3>
                {safeCart.length > 0 && (
                  <span className="badge badge-info">
                    {safeCart.length} {safeCart.length === 1 ? 'item' : 'items'} • {formatMgToGrams(totalWeightMg)}
                  </span>
                )}
              </div>
              {safeCart.length > 0 && (
                <button className="btn btn-ghost btn-xs text-error" onClick={clearCart}>
                  Clear All
                </button>
              )}
            </div>

            <div className="card-body cart-items-scroll">
              {safeCart.length === 0 ? (
                <div className="cart-empty">
                  <div style={{ fontSize: '28px', marginBottom: '6px', opacity: 0.6 }}>🧾</div>
                  <div style={{ fontWeight: 700, color: 'var(--market-text-primary)', marginBottom: '2px' }}>No items in cart yet</div>
                  <div style={{ fontSize: '12px' }}>Select a pigment and tap any weight tier on the left to add items.</div>
                </div>
              ) : (
                safeCart.map((item, index) => (
                  <CartItem
                    key={item.cartItemId || index}
                    item={item}
                    index={index}
                    onRemove={() => removeFromCart(index)}
                    updateCartItem={updateCartItem}
                    openModal={openModal}
                    priceTiers={priceTiers}
                  />
                ))
              )}
            </div>

            <div className="cart-receipt-footer">
              <div className="cart-margin">
                <span>COGS: <strong>{formatCents(totalCogs)}</strong></span>
                <span>MSRP: <strong style={{ color: 'var(--market-text-primary)' }}>{formatCents(totalMsrp)}</strong></span>
                <span>Margin: <strong className="margin-value">{margin}%</strong></span>
              </div>

              {totalCharged < totalMsrp && (
                <div className="cart-savings-banner">
                  🎉 Customer Saves {formatCents(totalMsrp - totalCharged)} vs. Retail MSRP
                </div>
              )}

              <div className="cart-total flex-between">
                <div className="flex-col" style={{ gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--market-text-secondary)' }}>
                    Total Due ({pricingMode})
                  </span>
                  {safeCart.length > 0 && (
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => openModal('editCartTotal')}
                        title="Set/override total transaction price"
                        style={{ background: 'var(--market-surface)', border: '1px solid var(--market-border)' }}
                      >
                        ✏️ Override Total
                      </button>
                      <button
                        className="btn btn-ghost btn-xs text-muted"
                        onClick={resetCartPrices}
                        title="Reset line item prices to standard rates"
                      >
                        🔄 Reset
                      </button>
                    </div>
                  )}
                </div>
                <span className="cart-total-amount">
                  {formatCents(totalCharged)}
                </span>
              </div>
            </div>
          </div>

          <div className="checkout-bottom-actions">
            <button
              className="btn btn-collect-cash"
              onClick={quickCollectCash}
              disabled={safeCart.length === 0}
            >
              <span>💵 Collect Cash</span>
              {safeCart.length > 0 && <span>({formatCents(totalCharged)})</span>}
            </button>
            <button
              className="btn btn-primary btn-block btn-lg"
              onClick={() => openModal('paymentDrawer')}
              disabled={safeCart.length === 0}
            >
              💳 Digital / House Tab / Split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
