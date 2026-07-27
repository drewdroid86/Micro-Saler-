import React from 'react';

const inventoryData = [
  { id: 1, name: 'Crimson Red', wac: 5.50, retail: 15, wholesale: 10, stock: 250 },
  { id: 2, name: 'Cobalt Blue', wac: 6.20, retail: 18, wholesale: 12, stock: 120 },
  { id: 3, name: 'Titanium White', wac: 2.10, retail: 10, wholesale: 7, stock: 500 },
];

const InventoryScreen = () => {
  return (
    <div className="inventory-screen">
      <div className="header-row">
        <h2>Inventory</h2>
        <button className="btn-new">+ New Pigment</button>
      </div>

      <div className="chart-card">
        <h3>Batch Cost vs Revenue</h3>
        <div className="bar-chart">
          <div className="chart-bar cost-bar" style={{ width: '40%' }}>Cost $1,200</div>
          <div className="chart-bar revenue-bar" style={{ width: '80%' }}>Rev $2,800</div>
        </div>
      </div>

      <div className="inventory-grid">
        {inventoryData.map(item => (
          <div key={item.id} className="inventory-card">
            <div className="card-header">
              <h3>{item.name}</h3>
              <span className="stock-badge">{item.stock}g</span>
            </div>
            <div className="price-details">
              <div className="price-col">
                <span className="label">WAC</span>
                <span className="value">${item.wac.toFixed(2)}</span>
              </div>
              <div className="price-col">
                <span className="label">Retail</span>
                <span className="value">${item.retail.toFixed(2)}</span>
              </div>
              <div className="price-col">
                <span className="label">Wholesale</span>
                <span className="value">${item.wholesale.toFixed(2)}</span>
              </div>
            </div>
            <div className="card-actions">
              <button className="action-btn spillage">Spillage</button>
              <button className="action-btn edit">Edit Price</button>
              <button className="action-btn restock">Restock</button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .inventory-screen {
          padding: 16px;
        }
        .header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .header-row h2 {
          margin: 0;
        }
        .btn-new {
          background: #2e7d32;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
        }
        .chart-card {
          background: white;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .chart-card h3 {
          margin-top: 0;
          font-size: 14px;
          color: #555;
        }
        .bar-chart {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .chart-bar {
          padding: 8px;
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .cost-bar {
          background: #ef5350;
        }
        .revenue-bar {
          background: #66bb6a;
        }
        .inventory-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .inventory-card {
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .card-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .stock-badge {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }
        .price-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 16px;
          background: #f9f9f9;
          padding: 8px;
          border-radius: 4px;
        }
        .price-col {
          display: flex;
          flex-direction: column;
        }
        .label {
          font-size: 10px;
          color: #777;
          text-transform: uppercase;
        }
        .value {
          font-size: 14px;
          font-weight: 600;
        }
        .card-actions {
          display: flex;
          gap: 8px;
        }
        .action-btn {
          flex: 1;
          padding: 6px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }
        .spillage { background: #ffebee; color: #c62828; }
        .edit { background: #fff3e0; color: #ef6c00; }
        .restock { background: #e8f5e9; color: #2e7d32; }
      `}</style>
    </div>
  );
};

export default InventoryScreen;
