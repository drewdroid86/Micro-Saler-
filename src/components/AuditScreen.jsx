import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${months[d.getMonth()]} ${dd}, ${yy} ${hh}:${mm}:${ss}`;
}

export const AuditScreen = () => {
  const { auditLogs, openModal, showToast } = usePos();
  const safeLogs = auditLogs || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL'); // 'ALL' | 'SECURITY' | 'CUSTOMER' | 'INVENTORY' | 'SALE'
  const [selectedAuditIndex, setSelectedAuditIndex] = useState(0);

  // Filtered audit logs
  const filteredLogs = useMemo(() => {
    return safeLogs.filter((log) => {
      const action = (log.action || '').toUpperCase();
      const entityType = (log.entity_type || '').toUpperCase();
      const details = (typeof log.details_json === 'string' ? log.details_json : JSON.stringify(log.details || '')) || '';

      // Action Filter
      if (actionFilter === 'SECURITY' && !action.includes('OVERRIDE') && !action.includes('SECURITY')) return false;
      if (actionFilter === 'CUSTOMER' && !action.includes('CUSTOMER') && !entityType.includes('CUSTOMER')) return false;
      if (actionFilter === 'INVENTORY' && !action.includes('INVENTORY') && !action.includes('RESTOCK') && !action.includes('SHRINKAGE') && !entityType.includes('PIGMENT')) return false;
      if (actionFilter === 'SALE' && !action.includes('SALE') && !action.includes('VOID') && !action.includes('RETURN') && !entityType.includes('SALE')) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const actionMatch = action.toLowerCase().includes(q);
        const entityMatch = entityType.toLowerCase().includes(q) || String(log.entity_id || '').toLowerCase().includes(q);
        const detailsMatch = details.toLowerCase().includes(q);
        if (!actionMatch && !entityMatch && !detailsMatch) return false;
      }

      return true;
    });
  }, [safeLogs, actionFilter, searchQuery]);

  const selectedLog = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    return filteredLogs[selectedAuditIndex] || filteredLogs[0] || null;
  }, [filteredLogs, selectedAuditIndex]);

  const handleCopyJson = () => {
    if (!selectedLog) return;
    const jsonStr = typeof selectedLog.details_json === 'string'
      ? selectedLog.details_json
      : JSON.stringify(selectedLog, null, 2);
    navigator.clipboard?.writeText(jsonStr);
    showToast('Audit log JSON copied to clipboard!', 'success');
  };

  return (
    <div className="audit-screen-container">
      {/* Section Header */}
      <div className="section-header mb-md">
        <div>
          <h2 className="section-title">🔒 IMMUTABLE AUDIT TRAIL & SECURITY OVERRIDES</h2>
          <p className="body-small text-muted">Tamper-evident chronological record of transactions, balance adjustments, security overrides, and system reconciliations.</p>
        </div>
        <div className="flex-center gap-xs">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => openModal('HELP', { section: 'insights-reports' })}
            title="Open Audit Trail Guide"
          >
            ❓ Audit Guide
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => openModal('backupRestore')}
          >
            💾 Ledger Backup / Restore
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="card p-sm mb-md flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search audit logs by action, entity ID, or keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="flex-center gap-xs" style={{ flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All (${safeLogs.length})` },
            { id: 'SECURITY', label: '🛡️ Security Overrides' },
            { id: 'CUSTOMER', label: '👥 Customer Balances' },
            { id: 'INVENTORY', label: '📦 Inventory & Stock' },
            { id: 'SALE', label: '🛒 Sales & Voids' }
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-sm ${actionFilter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                setActionFilter(tab.id);
                setSelectedAuditIndex(0);
              }}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Split-Pane Layout */}
      {filteredLogs.length === 0 ? (
        <div className="card text-center p-xl mb-lg">
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔒</div>
          <div className="title-medium mb-xs">No audit logs match criteria</div>
          <p className="body-small text-muted mb-md">
            {searchQuery ? `No audit entries matching "${searchQuery}" under current filter.` : 'No audit entries recorded yet.'}
          </p>
          {searchQuery && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setActionFilter('ALL'); }}>
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="split-pane-layout mb-lg">
          {/* Left Panel: Audit Stream Feed */}
          <div className="split-pane-list-panel">
            <div className="body-small text-muted px-xs flex-between">
              <span>Showing {filteredLogs.length} audit event(s)</span>
              <span>Tap to inspect JSON</span>
            </div>

            {filteredLogs.map((log, idx) => {
              const isSelected = selectedLog && (log.audit_id ? log.audit_id === selectedLog.audit_id : idx === selectedAuditIndex);
              const isSecurity = (log.action || '').includes('OVERRIDE') || (log.action || '').includes('SECURITY');
              const isRepair = (log.action || '').includes('REPAIR') || (log.action || '').includes('RECONCILE');

              return (
                <div
                  key={log.audit_id || `${log.created_at || log.timestamp || 0}_${idx}`}
                  className={`card split-pane-selectable-card ${isSelected ? 'selected' : ''} ${isSecurity ? 'security-override' : ''}`}
                  onClick={() => setSelectedAuditIndex(idx)}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex-between mb-xs">
                    <strong
                      className="body-medium"
                      style={{
                        color: isSecurity ? 'var(--market-error)' : isRepair ? 'var(--market-warning)' : isSelected ? 'var(--market-primary)' : 'inherit',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                      }}
                    >
                      {log.action}
                    </strong>
                    <span className="label-small text-muted">
                      {formatDate(log.created_at || log.timestamp)}
                    </span>
                  </div>

                  <div className="flex-between body-small text-muted">
                    <span>Entity: <strong>{log.entity_type}</strong> ({log.entity_id})</span>
                    {isSecurity && (
                      <span className="badge badge-danger" style={{ fontSize: '9px' }}>SECURITY</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Panel: Sticky Audit Inspector & JSON Details */}
          <div className="split-pane-detail-panel">
            {selectedLog ? (
              <>
                {/* Header */}
                <div className="flex-between border-bottom pb-sm">
                  <div>
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <h3 className="title-medium" style={{ margin: 0, fontFamily: 'monospace', color: 'var(--market-primary)' }}>
                        {selectedLog.action}
                      </h3>
                    </div>
                    <div className="body-small text-muted mt-xs">
                      Logged: <strong>{formatDate(selectedLog.created_at || selectedLog.timestamp)}</strong> &bull; Audit ID #{selectedLog.audit_id || 'LOCAL'}
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyJson}
                    title="Copy full JSON payload to clipboard"
                  >
                    📋 Copy JSON
                  </button>
                </div>

                {/* Entity Context Card */}
                <div className="p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '8px' }}>
                  <div className="grid-2col gap-xs" style={{ fontSize: '13px' }}>
                    <div>
                      <span className="text-muted">Entity Type:</span> <strong>{selectedLog.entity_type}</strong>
                    </div>
                    <div>
                      <span className="text-muted">Entity ID:</span> <strong>{selectedLog.entity_id}</strong>
                    </div>
                  </div>
                </div>

                {/* Raw Structured JSON Payload */}
                <div className="card p-sm">
                  <div className="label-small text-muted font-weight-bold mb-xs">RAW AUDIT PAYLOAD (JSON)</div>
                  <pre
                    className="json-details"
                    style={{
                      maxHeight: '340px',
                      overflowY: 'auto',
                      background: 'var(--market-surface)',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid var(--market-border-light)',
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}
                  >
                    {typeof selectedLog.details_json === 'string'
                      ? (function() {
                          try {
                            return JSON.stringify(JSON.parse(selectedLog.details_json), null, 2);
                          } catch (e) {
                            return selectedLog.details_json;
                          }
                        })()
                      : JSON.stringify(selectedLog.details || selectedLog, null, 2)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="text-center p-xl text-muted">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👈</div>
                <div className="title-medium mb-xs">Select an Audit Entry</div>
                <p className="body-small text-muted">Click any log event on the left to inspect structured event details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
