import React from 'react';
import { usePos } from '../context/PosContext';

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${dd}, ${yy} ${hh}:${mm}`;
}

export const AuditScreen = () => {
  const { auditLogs, openModal } = usePos();

  return (
    <div>
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title">🔒 AUDIT LOG & SECURITY OVERRIDES</h2>
        <button 
          className="btn btn-secondary" 
          onClick={() => openModal('backupRestore')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          💾 Ledger Backup / Restore
        </button>
      </div>


      <div>
        {auditLogs.map((log, idx) => {
          const isSecurity = log.action === 'HANDSHAKE_CREDIT_OVERRIDE';
          return (
            <div key={log.audit_id || `${log.created_at || log.timestamp || 0}_${idx}`} className={`audit-card ${isSecurity ? 'security-override' : ''}`}>
              <div className="audit-header">
                <span className={`title-medium ${isSecurity ? 'text-error' : ''}`}>{log.action}</span>
                <span className="audit-time">{formatDate(log.created_at || log.timestamp)}</span>
              </div>
              <div className="body-medium">
                Entity: {log.entity_type} ({log.entity_id})
              </div>
              <pre className="json-details">
                {log.details_json || log.details || ''}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};
