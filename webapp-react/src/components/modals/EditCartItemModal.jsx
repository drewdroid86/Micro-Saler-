import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';

export const EditCartItemModal = () => {
  const { modal, closeModal, editCartItem, pricingMode, showToast } = usePos();
  const [weightGrams, setWeightGrams] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [autoCalculate, setAutoCalculate] = useState(false);

  const payload = modal.payload || {};
  const item = payload.item;
  const index = payload.index;

  useEffect(() => {
    if (modal.name === 'editCartItem' && item) {
      setWeightGrams((item.weight_mg / 1000).toString());
      setPriceDollars((item.price_charged_cents / 100).toFixed(2));
      setAutoCalculate(false);
    } else {
      setWeightGrams('');
      setPriceDollars('');
      setAutoCalculate(false);
    }
  }, [modal.name, item]);

  if (modal.name !== 'editCartItem' || !item) return null;

  const handleCancel = () => {
    setWeightGrams('');
    setPriceDollars('');
    setAutoCalculate(false);
    closeModal();
  };

  const handleWeightChange = (e) => {
    const val = e.target.value;
    setWeightGrams(val);
    if (autoCalculate) {
      const wG = parseFloat(val);
      if (!isNaN(wG) && wG >= 0 && item.pigment) {
        const rateCents = pricingMode === 'RETAIL'
          ? item.pigment.retail_price_per_gram_cents
          : item.pigment.wholesale_price_per_gram_cents;
        const calcCents = Math.round(wG * rateCents) + (item.pigment.default_pkg_cents || 0);
        setPriceDollars((calcCents / 100).toFixed(2));
      }
    }
  };

  const handleToggleAutoCalc = (e) => {
    const checked = e.target.checked;
    setAutoCalculate(checked);
    if (checked) {
      const wG = parseFloat(weightGrams);
      if (!isNaN(wG) && wG >= 0 && item.pigment) {
        const rateCents = pricingMode === 'RETAIL'
          ? item.pigment.retail_price_per_gram_cents
          : item.pigment.wholesale_price_per_gram_cents;
        const calcCents = Math.round(wG * rateCents) + (item.pigment.default_pkg_cents || 0);
        setPriceDollars((calcCents / 100).toFixed(2));
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const wG = parseFloat(weightGrams);
    const pD = parseFloat(priceDollars);

    if (isNaN(wG) || wG <= 0) {
      showToast('Please enter a valid weight in grams.', 'error');
      return;
    }
    if (isNaN(pD) || pD < 0) {
      showToast('Please enter a valid price.', 'error');
      return;
    }

    const weightMg = Math.round(wG * 1000);
    const priceCents = Math.round(pD * 100);

    editCartItem(index, weightMg, priceCents);
    handleCancel();
  };

  return (
    <div className="modal-overlay active">
      <div className="modal" key={`edit-cart-item-${index}`}>
        <div className="modal-header">
          <h2>Edit Cart Line Item</h2>
          <button className="modal-close" onClick={handleCancel}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="body-medium mb-md">
              Pigment: <strong>{item.pigment?.name || 'Unknown'}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Weight (grams)</label>
              <input
                type="number"
                className="form-input"
                step="0.01"
                min="0.01"
                value={weightGrams}
                onChange={handleWeightChange}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Line Item Total Price ($)</label>
              <input
                type="number"
                className="form-input"
                step="0.01"
                min="0"
                value={priceDollars}
                onChange={e => {
                  setPriceDollars(e.target.value);
                  setAutoCalculate(false);
                }}
                required
              />
            </div>
            <div className="form-group flex-center gap-sm" style={{ justifyContent: 'flex-start', marginTop: '8px' }}>
              <input
                type="checkbox"
                id="auto-calc-checkbox"
                checked={autoCalculate}
                onChange={handleToggleAutoCalc}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="auto-calc-checkbox" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                Auto-calculate price from weight
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};
