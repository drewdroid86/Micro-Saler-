import React from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const CheckoutScreen = () => {
  const {
    pigments,
    selectedCustomer,
    selectedPigment,
    setSelectedPigment,
    pricingMode,
    setPricingMode,
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    quickCollectCash,
    openModal,
    showToast
  } = usePos();

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

  const totalCharged = cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
  const totalCogs = cart.reduce((sum, item) => sum + item.unit_cogs_cents, 0);
  const margin = totalCharged > 0 ? Math.round(((totalCharged - totalCogs) / totalCharged) * 100) : 0;

  return (
    <div className="checkout-layout">
      <div className="flex-between mb-md">
        <div
          className={`customer-pill ${selectedCustomer ? '' : 'walk-in'}`}
          onClick={() => openModal('customerPicker')}
        >
          {selectedCustomer ? `👤 ${selectedCustomer.name}` : '👤 Walk-in Customer'}
        </div>

        <div className="pricing-toggle">
          <button
            className={`toggle-option ${pricingMode === 'RETAIL' ? 'active' : ''}`}
            onClick={() => setPricingMode('RETAIL')}
          >
            RETAIL
          </button>
          <button
            className={`toggle-option ${pricingMode === 'WHOLESALE' ? 'active' : ''}`}
            onClick={() => setPricingMode('WHOLESALE')}
          >
            WHOLESALE
          </button>
        </div>
      </div>

      <div className="grid-2col mb-md">
        {pigments.map(p => {
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
        {presets.map(preset => (
          <button
            key={preset.label}
            className="weight-preset-btn"
            onClick={() => handlePresetClick(preset.mg)}
          >
            {preset.label}
          </button>
        ))}
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
          {cart.length === 0 ? (
            <div className="cart-empty">Cart is empty</div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="cart-item">
                <div className="cart-item-details">
                  <span className="cart-item-title">{item.pigment.name}</span>
                  <span className="cart-item-meta">{formatMgToGrams(item.weight_mg)}</span>
                </div>
                <div className="flex-center gap-sm">
                  <span className="cart-item-price">{formatCents(item.price_charged_cents)}</span>
                  <button className="cart-item-remove" onClick={() => removeFromCart(index)}>&times;</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-margin">
          <span>COGS: {formatCents(totalCogs)}</span>
          <span>Est. Margin: <strong className="margin-value">{margin}%</strong></span>
        </div>

        <div className="cart-total">
          <span>Total</span>
          <span>{formatCents(totalCharged)}</span>
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
