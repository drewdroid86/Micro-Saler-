import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents } from '../repository';

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
  const {
    auditLogs,
    sales,
    saleItems,
    salePayments,
    customers,
    returns,
    pigments,
    openModal,
    showToast
  } = usePos();

  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL'); // 'ALL' | 'SECURITY' | 'CUSTOMER' | 'INVENTORY' | 'SALE'
  const [selectedAuditIndex, setSelectedAuditIndex] = useState(0);

  // Merge persisted audit_log entries with synthesized entries for any historical sales/returns
  // that were recorded before COMPLETE_SALE / PROCESS_RETURN audit logging was enabled.
  const safeLogs = useMemo(() => {
    const rawLogs = [...(auditLogs || [])];
    const loggedCompleteSaleIds = new Set();
    const loggedVoidSaleIds = new Set();
    const loggedReturnIds = new Set();

    for (const log of rawLogs) {
      const act = (log.action || '').toUpperCase();
      if (act === 'COMPLETE_SALE') {
        loggedCompleteSaleIds.add(Number(log.entity_id));
      } else if (act === 'VOID_SALE') {
        loggedVoidSaleIds.add(Number(log.entity_id));
      } else if (act === 'PROCESS_RETURN') {
        try {
          const det = typeof log.details_json === 'string' ? JSON.parse(log.details_json) : (log.details || {});
          if (det.return_id) loggedReturnIds.add(Number(det.return_id));
        } catch (e) {
          // ignore malformed JSON
        }
      }
    }

    for (const s of (sales || [])) {
      const sId = Number(s.sale_id);
      if (!loggedCompleteSaleIds.has(sId)) {
        const cust = (customers || []).find(c => Number(c.customer_id) === Number(s.customer_id));
        const items = (saleItems || []).filter(si => Number(si.sale_id) === sId);
        const payments = (salePayments || []).filter(sp => Number(sp.sale_id) === sId);
        const ts = s.created_at || s.timestamp || 0;
        rawLogs.push({
          audit_id: `SALE_${sId}`,
          entity_type: 'Sale',
          entity_id: sId,
          action: 'COMPLETE_SALE',
          details_json: JSON.stringify({
            sale_id: sId,
            customer_id: s.customer_id || null,
            customer_name: cust ? cust.name : 'Walk-in',
            pricing_mode: s.pricing_mode || s.sale_type || 'RETAIL',
            total_amount_cents: s.total_amount_cents,
            total_cogs_cents: s.total_cogs_cents,
            status: s.status || 'COMPLETED',
            items: items.map(i => ({
              pigment_id: i.pigment_id,
              pigment_name: i.pigment_name || ((pigments || []).find(p => Number(p.pigment_id) === Number(i.pigment_id))?.name) || `Pigment #${i.pigment_id}`,
              weight_mg: i.weight_mg,
              price_charged_cents: i.price_charged_cents,
              unit_cogs_cents: i.unit_cogs_cents,
            })),
            payments: payments.map(p => ({
              payment_type: p.payment_type,
              digital_provider: p.digital_provider || null,
              amount_cents: p.amount_cents,
            })),
          }),
          created_at: ts,
          timestamp: ts,
        });
      }

      if (s.status === 'VOIDED' && !loggedVoidSaleIds.has(sId)) {
        const ts = s.updated_at || (s.created_at ? s.created_at + 1 : 0);
        rawLogs.push({
          audit_id: `VOID_${sId}`,
          entity_type: 'Sale',
          entity_id: sId,
          action: 'VOID_SALE',
          details_json: JSON.stringify({
            sale_id: sId,
            reason: s.void_reason || 'Voided',
          }),
          created_at: ts,
          timestamp: ts,
        });
      }
    }

    for (const r of (returns || [])) {
      const rId = Number(r.return_id || r.id);
      if (rId && !loggedReturnIds.has(rId)) {
        const si = (saleItems || []).find(i => Number(i.sale_item_id || i.id) === Number(r.sale_item_id));
        const ts = r.created_at || r.timestamp || 0;
        rawLogs.push({
          audit_id: `RETURN_${rId}`,
          entity_type: 'Sale',
          entity_id: si?.sale_id || r.sale_item_id,
          action: 'PROCESS_RETURN',
          details_json: JSON.stringify({
            return_id: rId,
            sale_id: si?.sale_id || null,
            sale_item_id: r.sale_item_id,
            pigment_id: si?.pigment_id || null,
            pigment_name: si?.pigment_name || null,
            mg_returned: r.mg_returned,
            refund_amount_cents: r.refund_amount_cents,
            restock_to_inventory: Boolean(r.restock_to_inventory),
            reason: r.reason || '',
          }),
          created_at: ts,
          timestamp: ts,
        });
      }
    }

    return rawLogs.sort((a, b) => (b.created_at || b.timestamp || 0) - (a.created_at || a.timestamp || 0));
  }, [auditLogs, sales, saleItems, salePayments, customers, returns, pigments]);

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

                  {selectedLog.entity_type === 'Sale' && (() => {
                    const matchedSale = (sales || []).find(s => Number(s.sale_id) === Number(selectedLog.entity_id));
                    if (!matchedSale) return null;
                    const matchedCustomer = (customers || []).find(c => Number(c.customer_id) === Number(matchedSale.customer_id));
                    const matchedItems = (saleItems || []).filter(si => Number(si.sale_id) === Number(matchedSale.sale_id));
                    const matchedPayments = (salePayments || []).filter(sp => Number(sp.sale_id) === Number(matchedSale.sale_id));

                    return (
                      <div className="mt-sm pt-sm flex-between" style={{ borderTop: '1px solid var(--market-border)', flexWrap: 'wrap', gap: '8px' }}>
                        <div className="body-small">
                          <strong>{matchedCustomer ? matchedCustomer.name : 'Walk-in'}</strong> &bull; Total: <strong className="text-primary">{formatCents(matchedSale.total_amount_cents)}</strong> ({matchedSale.status || 'COMPLETED'})
                        </div>
                        <div className="flex-center gap-xs">
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={() => openModal('receiptModal', {
                              sale: matchedSale,
                              items: matchedItems,
                              customer: matchedCustomer,
                              payments: matchedPayments
                            })}
                          >
                            🖨️ Receipt
                          </button>
                          {matchedSale.status !== 'VOIDED' && (
                            <button
                              className="btn btn-primary btn-xs"
                              onClick={() => openModal('correctSale', {
                                sale: matchedSale,
                                items: matchedItems,
                                payments: matchedPayments
                              })}
                            >
                              ✏️ Correct Sale
                            </button>
                          )}
                          {(matchedSale.status === 'COMPLETED' || !matchedSale.status) && (
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => openModal('voidSale', matchedSale)}
                            >
                              🚫 Void
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
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
