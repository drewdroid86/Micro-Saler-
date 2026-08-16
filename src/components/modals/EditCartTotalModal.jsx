import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { formatCents, calculateRecommendedMsrpCents } from '../../repository';

export const EditCartTotalModal = () => {
  const { cart, closeModal, overrideCartTotal, showToast, priceTiers } = usePos();
  const safeCart = cart || [];
  const currentCalculatedTotalCents = safeCart.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
  const totalMsrpCents = safeCart.reduce(
    (sum, item) => sum + calculateRecommendedMsrpCents(item.pigment, item.weight_mg, priceTiers),
    0
  );

  const [inputVal, setInputVal] = useState(
    currentCalculatedTotalCents > 0 ? (currentCalculatedTotalCents / 100).toFixed(2) : ''
  );

  const handleApply = () => {
    const parsed = parseFloat(inputVal);
    if (isNaN(parsed) || parsed < 0) {
      showToast('Please enter a valid total amount ($)', 'error');
      return;
    }
    const newTotalCents = Math.round(parsed * 100);
    overrideCartTotal(newTotalCents);
    closeModal();
    showToast(`Transaction total set to ${formatCents(newTotalCents)}`, 'success');
  };

  const handleRound = (roundType) => {
    const currentDollars = currentCalculatedTotalCents / 100;
    let target = currentDollars;
    if (roundType === 'down_dollar') {
      target = Math.floor(currentDollars);
    } else if (roundType === 'up_dollar') {
      target = Math.ceil(currentDollars);
    } else if (roundType === 'nearest_5') {
      target = Math.round(currentDollars / 5) * 5;
    }
    setInputVal(target.toFixed(2));
  };

  return (
    <div className="modal-overlay active" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2>✏️ Edit Transaction Total</h2>
          <button className="modal-close" onClick={closeModal}>&times;</button>
        </div>
        <div className="modal-body">
          <p className="body-small text-muted mb-md">
            Override the total price for this transaction. Line item prices will scale proportionally.
          </p>

          <div className="card card-static p-sm mb-md" style={{ background: 'var(--market-surface-variant)' }}>
            <div className="flex-between body-small mb-xs">
              <span>Calculated Item Subtotal:</span>
              <strong>{formatCents(currentCalculatedTotalCents)}</strong>
            </div>
            {totalMsrpCents > 0 && (
              <div className="flex-between body-small">
                <span>Recommended MSRP Total:</span>
                <div className="flex-center gap-xs">
                  <strong className="text-primary">{formatCents(totalMsrpCents)}</strong>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '1px 6px', fontSize: '11px', background: 'var(--market-surface)', border: '1px solid var(--market-border)' }}
                    onClick={() => setInputVal((totalMsrpCents / 100).toFixed(2))}
                  >
                    Use MSRP
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group mb-md">
            <label className="form-label">New Total Transaction Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input"
              style={{ fontSize: '1.25rem', fontWeight: 'bold' }}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="flex-center gap-xs mb-lg flex-wrap">
            <button className="btn btn-ghost btn-sm" onClick={() => handleRound('down_dollar')}>
              Round Down (${Math.floor(currentCalculatedTotalCents / 100)})
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleRound('up_dollar')}>
              Round Up (${Math.ceil(currentCalculatedTotalCents / 100)})
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleRound('nearest_5')}>
              Nearest $5 (${(Math.round((currentCalculatedTotalCents / 100) / 5) * 5).toFixed(0)})
            </button>
          </div>

          <div className="flex-between gap-sm">
            <button className="btn btn-ghost flex-1" onClick={closeModal}>
              Cancel
            </button>
            <button className="btn btn-primary flex-1" onClick={handleApply}>
              Apply Total
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
