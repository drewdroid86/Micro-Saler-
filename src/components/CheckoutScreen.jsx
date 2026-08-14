import React, { useState, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';
import { CustomerNameInput } from './CustomerNameInput';

const CartItem = ({ item, index, onRemove, openModal }) => {
  return (
    <div className="cart-item">
      <div className="cart-item-details">
        <span className="cart-item-title">{item.pigment.name}</span>
        <span className="cart-item-meta">{formatMgToGrams(item.weight_mg)}</span>
      </div>
      <div className="flex-center gap-sm">
        <span className="cart-item-price">{formatCents(item.price_charged_cents)}</span>
        <button
          className="cart-item-action-btn"
          onClick={() => openModal('editCartItem', { item, index })}
          title="Edit line item"
          aria-label="Edit line item"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

  const presets = [
    { label: '¼g', mg: 250 },
    { label: '½g', mg: 500 },
    { label: '¾g', mg: 750 },
    { label: '1g', mg: 1000 },
    { label: '1.5g', mg: 1500 },
    { label: '1.75g', mg: 1750 },
    { label: '3.5g', mg: 3500 },
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

  const safeCart = cart || [];
  const safePigments = pigments || [];
  const totalCharged = safeCart.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
  const totalCogs = safeCart.reduce((sum, item) => sum + (item.unit_cogs_cents || 0), 0);
  const margin = totalCharged > 0 ? Math.round(((totalCharged - totalCogs) / totalCharged) * 100) : 0;

  return (
    <div className="checkout-layout">
      {integrityMismatchCount > 0 && (
        <div className="card mb-md flex-between" style={{ background: 'rgba(245, 124, 0, 0.15)', borderColor: '#f57c00', padding: '10px 14px', alignItems: 'center' }}>
          <div>
            <div className="font-weight-bold" style={{ color: '#e65100', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span> Data Integrity Warning: {integrityMismatchCount} completed sale(s) have payment total mismatches.
            </div>
            <div className="body-small text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
              Line item amounts do not match recorded payment totals in local IndexedDB.
            </div>
          </div>
          <button
            className="btn btn-warning btn-sm"
            style={{ backgroundColor: '#f57c00', borderColor: '#e65100', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}
            onClick={() => openModal('integrityRepair')}
          >
            Review & Fix
          </button>
        </div>
      )}

      <div className="checkout-top-bar mb-md">
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
              RETAIL
            </button>
            <button
              className={`toggle-option ${pricingMode === 'WHOLESALE' ? 'active' : ''}`}
              onClick={() => (changePricingMode ? changePricingMode('WHOLESALE') : setPricingMode('WHOLESALE'))}
            >
              WHOLESALE
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
        <div className="card mb-md flex-between" style={{ background: 'rgba(56, 107, 31, 0.15)', borderColor: 'var(--market-green-primary)', padding: '10px 14px', alignItems: 'center' }}>
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

      <div className="grid-2col mb-md">
        {safePigments.map(p => {
          const isSelected = selectedPigment && selectedPigment.pigment_id === p.pigment_id;
          return (
            <div
              key={p.pigment_id}
              className={`pigment-grid-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedPigment(p)}
            >
              <div className="color-swatch" style={{ backgroundColor: p.color_code }} />
              <div className="pigment-info">
                <div className="pigment-name">{p.name}</div>
                <div className="pigment-finish">{p.finish_type}</div>
                <div className={`pigment-stock ${p.stock_mg < 10000 ? 'low-stock' : ''}`}>
                  {formatMgToGrams(p.stock_mg)} in stock
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="weight-presets mb-md">
        {presets.map(preset => {
          const isTierSet = hasTierOverride(preset.mg);
          return (
            <button
              key={preset.label}
              className={`weight-preset-btn ${isTierSet ? 'has-tier-override' : ''}`}
              onClick={() => handlePresetClick(preset.mg)}
              style={{ position: 'relative' }}
            >
              {preset.label}
              {isTierSet && (
                <span
                  className="tier-badge-dot"
                  title="Fixed preset tier price active"
                  style={{
                    position: 'absolute',
                    top: '3px',
                    right: '3px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--market-primary, #3b82f6)'
                  }}
                />
              )}
            </button>
          );
        })}
        <button className="weight-preset-btn active" onClick={handleCustomClick}>
          Custom
        </button>
      </div>

      <div className="cart-summary mb-md">
        <div className="card-header">
          <h3 className="title-medium">Cart</h3>
          {cart.length > 0 && (
            <button className="btn btn-ghost btn-sm text-error" onClick={clearCart}>
              Clear Cart
            </button>
          )}
        </div>
        <div className="card-body">
          {safeCart.length === 0 ? (
            <div className="cart-empty">Cart is empty</div>
          ) : (
            safeCart.map((item, index) => (
              <CartItem
                key={item.cartItemId || index}
                item={item}
                index={index}
                onRemove={() => removeFromCart(index)}
                openModal={openModal}
              />
            ))
          )}
        </div>

        <div className="cart-margin">
          <span>COGS: {formatCents(totalCogs)}</span>
          <span>Est. Margin: <strong className="margin-value">{margin}%</strong></span>
        </div>

        <div className="cart-total flex-between" style={{ alignItems: 'center' }}>
          <div className="flex-center gap-xs">
            <span>Total Transaction Price</span>
            {safeCart.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => openModal('editCartTotal')}
                title="Set/override total transaction price"
                style={{ padding: '2px 8px', fontSize: '0.8rem', background: 'var(--market-surface-variant)', border: '1px solid var(--market-border)' }}
              >
                ✏️ Edit Total
              </button>
            )}
            {safeCart.length > 0 && (
              <button
                className="btn btn-ghost btn-sm text-muted"
                onClick={resetCartPrices}
                title="Reset line item prices to standard rates"
                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
              >
                🔄 Reset
              </button>
            )}
          </div>
          <span style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--market-green-primary)' }}>
            {formatCents(totalCharged)}
          </span>
        </div>
      </div>

      <div className="checkout-bottom-actions">
        <button className="btn btn-collect-cash" onClick={quickCollectCash}>
          💵 COLLECT CASH
        </button>
        <button className="btn btn-primary btn-block" onClick={() => openModal('paymentDrawer')}>
          Digital / Tab / Split
        </button>
      </div>
    </div>
  );
};
