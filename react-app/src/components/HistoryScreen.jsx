import React from 'react';

const historyData = [
  { id: 'TRX-9921', customer: 'Walk-in', time: '10:45 AM', date: 'Oct 24, 2024', status: 'COMPLETED', total: 45.00, items: ['1g Crimson Red', '3.5g Titanium White'], payment: 'Cash' },
  { id: 'TRX-9920', customer: 'Alex Johnson', time: '09:12 AM', date: 'Oct 24, 2024', status: 'COMPLETED', total: 120.00, items: ['7g Cobalt Blue'], payment: 'Tab Credit' },
  { id: 'TRX-9919', customer: 'Mike Brown', time: '04:30 PM', date: 'Oct 23, 2024', status: 'REFUNDED', total: 20.00, items: ['1g Cadmium Yellow'], payment: 'Cash' },
  { id: 'TRX-9918', customer: 'Walk-in', time: '02:15 PM', date: 'Oct 23, 2024', status: 'VOIDED', total: 15.00, items: ['1g Crimson Red'], payment: 'None' },
];

const HistoryScreen = () => {
  const getStatusStyle = (status) => {
    if (status === 'COMPLETED') return { bg: '#e8f5e9', color: '#2e7d32' };
    if (status === 'VOIDED') return { bg: '#eeeeee', color: '#616161' };
    if (status === 'REFUNDED') return { bg: '#fff3e0', color: '#ef6c00' };
    return { bg: '#f5f5f5', color: '#666' };
  };

  return (
    <div className="history-screen">
      <h2>Transaction History</h2>
      
      <div className="history-list">
        {historyData.map(trx => {
          const style = getStatusStyle(trx.status);
          
          return (
            <div key={trx.id} className="history-card">
              <div className="card-top">
                <div className="trx-id">{trx.id}</div>
                <div className="status-badge" style={{ backgroundColor: style.bg, color: style.color }}>
                  {trx.status}
                </div>
              </div>
              
              <div className="main-details">
                <div className="customer-info">
                  <span className="name">{trx.customer}</span>
                  <span className="timestamp">{trx.date} • {trx.time}</span>
                </div>
                <div className="total-amt">
                  ${trx.total.toFixed(2)}
                </div>
              </div>
              
              <div className="itemized-list">
                {trx.items.map((item, idx) => (
                  <div key={idx} className="item-row">- {item}</div>
                ))}
              </div>
              
              <div className="payment-method">
                Payment: <strong>{trx.payment}</strong>
              </div>
              
              {trx.status === 'COMPLETED' && (
                <div className="card-actions">
                  <button className="btn-void">Void Sale</button>
                  <button className="btn-return">Return Item</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .history-screen {
          padding: 16px;
        }
        h2 {
          margin-top: 0;
          margin-bottom: 16px;
        }
        .history-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .history-card {
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .card-top {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .trx-id {
          font-size: 12px;
          color: #888;
          font-family: monospace;
        }
        .status-badge {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          font-weight: bold;
        }
        .main-details {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .customer-info {
          display: flex;
          flex-direction: column;
        }
        .name {
          font-weight: 600;
          font-size: 16px;
        }
        .timestamp {
          font-size: 12px;
          color: #666;
          margin-top: 2px;
        }
        .total-amt {
          font-size: 18px;
          font-weight: bold;
        }
        .itemized-list {
          background: #f9f9f9;
          padding: 8px;
          border-radius: 4px;
          font-size: 13px;
          color: #444;
          margin-bottom: 12px;
        }
        .payment-method {
          font-size: 12px;
          color: #666;
          margin-bottom: 12px;
        }
        .card-actions {
          display: flex;
          gap: 8px;
          border-top: 1px solid #eee;
          padding-top: 12px;
        }
        .card-actions button {
          flex: 1;
          padding: 8px;
          border: 1px solid #ccc;
          background: white;
          border-radius: 4px;
          font-weight: 500;
          color: #444;
        }
        .btn-void {
          color: #c62828 !important;
        }
      `}</style>
    </div>
  );
};

export default HistoryScreen;
