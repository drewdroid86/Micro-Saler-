import React from 'react';

const customers = [
  { id: 1, name: 'Alex Johnson', type: 'VIP', balance: 450, limit: 1000 },
  { id: 2, name: 'Sarah Smith', type: 'GOOD_STANDING', balance: 120, limit: 500 },
  { id: 3, name: 'Mike Brown', type: 'PAUSED', balance: 800, limit: 800 },
];

const CustomersScreen = () => {
  const getBadgeStyle = (type) => {
    switch(type) {
      case 'VIP': return { bg: '#fff8e1', color: '#ff8f00' };
      case 'GOOD_STANDING': return { bg: '#e8f5e9', color: '#2e7d32' };
      case 'PAUSED': return { bg: '#ffebee', color: '#c62828' };
      default: return { bg: '#f5f5f5', color: '#666' };
    }
  };

  return (
    <div className="customers-screen">
      <div className="header-row">
        <h2>Customer Tabs</h2>
        <button className="btn-new">+ New Customer</button>
      </div>

      <div className="customers-list">
        {customers.map(c => {
          const badge = getBadgeStyle(c.type);
          const percentUsed = Math.min((c.balance / c.limit) * 100, 100);
          
          return (
            <div key={c.id} className="customer-card">
              <div className="card-header">
                <h3>{c.name}</h3>
                <span className="trust-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>
                  {c.type.replace('_', ' ')}
                </span>
              </div>
              
              <div className="tab-details">
                <div className="balance-info">
                  <span className="balance-label">Current Tab</span>
                  <span className="balance-amount">${c.balance.toFixed(2)}</span>
                </div>
                <div className="limit-info">
                  Limit: ${c.limit}
                </div>
              </div>
              
              <div className="progress-track">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${percentUsed}%`,
                    backgroundColor: percentUsed > 90 ? '#ef5350' : '#42a5f5' 
                  }}
                ></div>
              </div>
              
              <div className="card-actions">
                <button className="btn-settle" disabled={c.balance === 0}>
                  Settle Tab
                </button>
                <button className="btn-details">View History</button>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .customers-screen {
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
        .customers-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .customer-card {
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .card-header h3 {
          margin: 0;
        }
        .trust-badge {
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: bold;
        }
        .tab-details {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 8px;
        }
        .balance-info {
          display: flex;
          flex-direction: column;
        }
        .balance-label {
          font-size: 12px;
          color: #666;
        }
        .balance-amount {
          font-size: 20px;
          font-weight: bold;
        }
        .limit-info {
          font-size: 12px;
          color: #888;
        }
        .progress-track {
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          margin-bottom: 16px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 3px;
        }
        .card-actions {
          display: flex;
          gap: 12px;
        }
        .card-actions button {
          flex: 1;
          padding: 10px;
          border-radius: 6px;
          font-weight: 600;
          border: none;
        }
        .btn-settle {
          background: #2e7d32;
          color: white;
        }
        .btn-settle:disabled {
          background: #ccc;
          color: #999;
        }
        .btn-details {
          background: #f0f0f0;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default CustomersScreen;
