import React, { useState } from 'react';

const weights = ['¼g', '½g', '¾g', '1g', '1.5g', '1.75g', '3.5g', '7g', '14g', '28g', 'Custom'];
const pigments = [
  { id: 1, name: 'Crimson Red', color: '#dc143c', stock: '250g', retail: 15, wholesale: 10 },
  { id: 2, name: 'Cobalt Blue', color: '#0047ab', stock: '120g', retail: 18, wholesale: 12 },
  { id: 3, name: 'Titanium White', color: '#f5f5f5', stock: '500g', retail: 10, wholesale: 7 },
  { id: 4, name: 'Cadmium Yellow', color: '#fff600', stock: '85g', retail: 20, wholesale: 14 },
];

const CheckoutScreen = () => {
  const [pricingMode, setPricingMode] = useState('RETAIL');
  const [selectedCustomer, setSelectedCustomer] = useState('Walk-in Customer');
  const [selectedWeight, setSelectedWeight] = useState('1g');

  return (
    <div className="checkout-screen">
      <div className="controls-row">
        <div className="customer-pill">
          <span className="icon">👤</span> {selectedCustomer}
        </div>
        <div className="pricing-toggle">
          <button 
            className={pricingMode === 'RETAIL' ? 'active' : ''} 
            onClick={() => setPricingMode('RETAIL')}
          >
            RETAIL
          </button>
          <button 
            className={pricingMode === 'WHOLESALE' ? 'active' : ''} 
            onClick={() => setPricingMode('WHOLESALE')}
          >
            WHOLESALE
          </button>
        </div>
      </div>

      <div className="weight-presets-container">
        <div className="weight-presets">
          {weights.map(w => (
            <button 
              key={w} 
              className={`weight-pill ${selectedWeight === w ? 'active' : ''}`}
              onClick={() => setSelectedWeight(w)}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="pigment-grid">
        {pigments.map(p => (
          <div key={p.id} className="pigment-card" style={{ borderTop: `4px solid ${p.color}` }}>
            <div className="color-swatch" style={{ backgroundColor: p.color }}></div>
            <div className="pigment-info">
              <h3>{p.name}</h3>
              <p className="stock-indicator">Stock: {p.stock}</p>
              <p className="price">${pricingMode === 'RETAIL' ? p.retail : p.wholesale}/g</p>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="cart-details">
          <div className="breakdown">
            <span>Revenue: $0.00</span>
            <span>COGS: $0.00</span>
            <span className="margin">Margin: 0%</span>
          </div>
          <h2>Total: $0.00</h2>
        </div>
        <div className="action-buttons">
          <button className="btn-secondary">PAYMENT DRAWER</button>
          <button className="btn-primary collect-cash">COLLECT CASH</button>
        </div>
      </div>

      <style>{`
        .checkout-screen {
          padding: 16px;
          display: flex;
          flex-direction: column;
          height: calc(100vh - 120px);
        }
        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .customer-pill {
          background: #f0f0f0;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pricing-toggle {
          display: flex;
          background: #e0e0e0;
          border-radius: 20px;
          overflow: hidden;
        }
        .pricing-toggle button {
          border: none;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          background: transparent;
          color: #666;
        }
        .pricing-toggle button.active {
          background: #333;
          color: white;
        }
        .weight-presets-container {
          overflow-x: auto;
          margin-bottom: 16px;
          padding-bottom: 8px;
        }
        .weight-presets {
          display: flex;
          gap: 8px;
        }
        .weight-pill {
          padding: 8px 16px;
          border-radius: 16px;
          border: 1px solid #ccc;
          background: white;
          white-space: nowrap;
          font-weight: 500;
        }
        .weight-pill.active {
          background: #e8f5e9;
          border-color: #2e7d32;
          color: #2e7d32;
        }
        .pigment-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          flex: 1;
          overflow-y: auto;
          margin-bottom: 16px;
        }
        .pigment-card {
          background: white;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .color-swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid #ddd;
        }
        .pigment-info h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
        }
        .stock-indicator {
          margin: 0;
          font-size: 12px;
          color: #666;
        }
        .price {
          margin: 4px 0 0 0;
          font-weight: bold;
          color: #2e7d32;
        }
        .cart-summary {
          background: white;
          padding: 16px;
          border-radius: 12px;
          box-shadow: 0 -4px 10px rgba(0,0,0,0.1);
          margin: -16px;
          margin-top: auto;
        }
        .cart-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .breakdown {
          display: flex;
          flex-direction: column;
          font-size: 12px;
          color: #666;
        }
        .margin {
          color: #2e7d32;
          font-weight: 600;
        }
        .cart-details h2 {
          margin: 0;
        }
        .action-buttons {
          display: flex;
          gap: 12px;
        }
        .action-buttons button {
          flex: 1;
          padding: 16px;
          border-radius: 8px;
          font-weight: bold;
          border: none;
        }
        .btn-secondary {
          background: #f0f0f0;
          color: #333;
        }
        .btn-primary {
          background: #2e7d32;
          color: white;
        }
        .collect-cash {
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};

export default CheckoutScreen;
