import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { formatCents, calculateRecommendedMsrpCents, getEffectivePricePerGramCents } from '../../repository';

export const CustomWeightModal = () => {
  const { modal, closeModal, selectedPigment, addToCart, showToast, priceTiers, pricingMode } = usePos();
  const [weightGrams, setWeightGrams] = useState('');
  const [customPriceDollars, setCustomPriceDollars] = useState('');

  // Reset local state whenever modal opens or selected pigment changes
  useEffect(() => {
    setWeightGrams('');
    setCustomPriceDollars('');
  }, [modal.name, selectedPigment?.pigment_id]);

  if (modal.name !== 'customWeight') return null;

  const handleCancel = () => {
    setWeightGrams('');
    setCustomPriceDollars('');
    closeModal();
  };

  const parsedGrams = parseFloat(weightGrams);
  const currentMg = (!isNaN(parsedGrams) && parsedGrams > 0) ? Math.round(parsedGrams * 1000) : 0;
  const recommendedMsrpCents = (selectedPigment && currentMg > 0)
    ? calculateRecommendedMsrpCents(selectedPigment, currentMg, priceTiers)
    : 0;
  const wholesaleRateCents = (selectedPigment && currentMg > 0)
    ? getEffectivePricePerGramCents(selectedPigment, currentMg, 'WHOLESALE')
    : 0;
  const wholesalePriceCents = (selectedPigment && currentMg > 0)
    ? Math.round((currentMg / 1000) * wholesaleRateCents) + (selectedPigment.default_pkg_cents || 0)
    : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    const w = parseFloat(weightGrams);
    if (isNaN(w) || w <= 0) {
      showToast('Please enter a valid positive weight in grams.', 'error');
      return;
    }

    let customPriceCents = null;
    if (customPriceDollars && !isNaN(customPriceDollars)) {
      const p = parseFloat(customPriceDollars);
      if (p >= 0) {
        customPriceCents = Math.round(p * 100);
      }
    }

    const weightMg = Math.round(w * 1000);
    addToCart(selectedPigment, weightMg, customPriceCents);
    setWeightGrams('');
    setCustomPriceDollars('');
    closeModal();
  };

  return (
    <div className="modal-overlay active">
      <div className="modal" key={selectedPigment?.pigment_id || 'custom-weight'}>
        <div className="modal-header">
          <h2>Custom Weight Entry</h2>
          <button className="modal-close" onClick={handleCancel}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="body-medium mb-md">
              Selected Pigment: <strong>{selectedPigment?.name || 'None'}</strong>
            </p>
            <div className="form-group">
              <label className="form-label">Weight (grams)</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 5.0"
                step="0.01"
                min="0.01"
                value={weightGrams}
                onChange={e => setWeightGrams(e.target.value)}
                autoFocus
                required
              />
            </div>

            {currentMg > 0 && selectedPigment && (
              <div className="card p-sm mb-md" style={{ background: 'var(--market-surface-variant)', border: '1px solid var(--market-border)', borderRadius: '6px' }}>
                <div className="flex-between body-small">
                  <span className="text-muted">Recommended MSRP:</span>
                  <div className="flex-center gap-xs">
                    <strong className="text-primary font-weight-bold" style={{ fontSize: '14px' }}>
                      {formatCents(recommendedMsrpCents)}
                    </strong>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '1px 6px', fontSize: '11px', background: 'var(--market-surface)', border: '1px solid var(--market-border)' }}
                      onClick={() => setCustomPriceDollars((recommendedMsrpCents / 100).toFixed(2))}
                    >
                      Use MSRP
                    </button>
                  </div>
                </div>
                {pricingMode === 'WHOLESALE' && (
                  <div className="flex-between body-small mt-xs">
                    <span className="text-muted">Wholesale Rate Price:</span>
                    <strong>{formatCents(wholesalePriceCents)}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Custom Total Price ($) (Optional)</label>
              <input
                type="number"
                className="form-input"
                placeholder={currentMg > 0 ? `Leave blank for standard rate (${formatCents(pricingMode === 'WHOLESALE' ? wholesalePriceCents : recommendedMsrpCents)})` : 'Leave blank to auto-calculate price'}
                step="0.01"
                min="0"
                value={customPriceDollars}
                onChange={e => setCustomPriceDollars(e.target.value)}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add to Cart</button>
          </div>
        </form>
      </div>
    </div>
  );
};
