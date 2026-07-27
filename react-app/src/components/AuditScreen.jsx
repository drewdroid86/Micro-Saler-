import React from 'react';

const auditData = [
  { id: 'LOG-001', type: 'PRICE_EDIT', entity: 'Pigment-02', timestamp: '2024-10-24T11:05:22Z', user: 'Admin', details: 'Changed RETAIL price from $18.00 to $19.00', warning: false },
  { id: 'LOG-002', type: 'HANDSHAKE_CREDIT_OVERRIDE', entity: 'Cust-03', timestamp: '2024-10-24T09:42:10Z', user: 'Admin', details: 'Allowed $120.00 charge on paused account. Override reason: Management approval.', warning: true },
  { id: 'LOG-003', type: 'STOCK_SPILLAGE', entity: 'Pigment-01', timestamp: '2024-10-23T16:15:00Z', user: 'Staff-1', details: 'Reported 2g loss. Value: $11.00', warning: false },
  { id: 'LOG-004', type: 'VOID_TRANSACTION', entity: 'TRX-9918', timestamp: '2024-10-23T14:16:30Z', user: 'Admin', details: 'Customer walked out before payment.', warning: false },
];

const AuditScreen = () => {
  return (
    <div className="audit-screen">
      <h2>System Audit Log</h2>
      <p className="subtitle">Immutable ledger of critical actions</p>
      
      <div className="audit-list">
        {auditData.map(log => (
          <div key={log.id} className={`audit-card ${log.warning ? 'warning' : ''}`}>
            <div className="log-header">
              <span className={`type-badge ${log.warning ? 'badge-warning' : 'badge-normal'}`}>
                {log.type}
              </span>
              <span className="log-id">{log.id}</span>
            </div>
            
            <div className="log-meta">
              <span><strong>Time:</strong> {new Date(log.timestamp).toLocaleString()}</span>
              <span><strong>User:</strong> {log.user}</span>
              <span><strong>Entity:</strong> {log.entity}</span>
            </div>
            
            <div className="log-details-container">
              <div className="log-details-text">{log.details}</div>
              <details className="json-details">
                <summary>View JSON Payload</summary>
                <pre>
                  {JSON.stringify({
                    eventId: log.id,
                    eventType: log.type,
                    targetEntityId: log.entity,
                    timestamp: log.timestamp,
                    actorId: log.user,
                    metadata: { notes: log.details }
                  }, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .audit-screen {
          padding: 16px;
        }
        h2 {
          margin-top: 0;
          margin-bottom: 4px;
        }
        .subtitle {
          color: #666;
          font-size: 12px;
          margin-bottom: 20px;
        }
        .audit-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .audit-card {
          background: white;
          padding: 16px;
          border-radius: 8px;
          border-left: 4px solid #42a5f5;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .audit-card.warning {
          border-left: 4px solid #ef5350;
          border: 1px solid #ef5350;
          background: #fffafa;
        }
        .log-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .type-badge {
          font-size: 11px;
          font-weight: bold;
          padding: 4px 8px;
          border-radius: 4px;
        }
        .badge-normal {
          background: #e3f2fd;
          color: #1565c0;
        }
        .badge-warning {
          background: #ffebee;
          color: #c62828;
        }
        .log-id {
          font-family: monospace;
          color: #888;
          font-size: 12px;
        }
        .log-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: #555;
          margin-bottom: 12px;
          background: rgba(0,0,0,0.02);
          padding: 8px;
          border-radius: 4px;
        }
        .log-details-container {
          font-size: 13px;
        }
        .log-details-text {
          margin-bottom: 12px;
          color: #333;
        }
        .json-details summary {
          font-size: 12px;
          color: #1976d2;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .json-details pre {
          background: #2d2d2d;
          color: #ccc;
          padding: 10px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          overflow-x: auto;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default AuditScreen;
