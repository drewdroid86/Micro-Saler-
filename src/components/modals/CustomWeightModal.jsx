import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';

export const CustomWeightModal = () => {
  const { modal, closeModal, selectedPigment, addToCart, showToast } = usePos();
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
                placeholder="e.g. 2.5"
                step="0.01"
                min="0.01"
                value={weightGrams}
                onChange={e => setWeightGrams(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Custom Total Price ($) (Optional)</label>
              <input
                type="number"
                className="form-input"
                placeholder="Leave blank to auto-calculate price"
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
