import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { formatCents } from '../../repository';

export const IntegrityRepairModal = () => {
  const { closeModal, integrityMismatches, repairDataIntegrity, repo, refreshAllData, showToast } = usePos();
  const [isRepairing, setIsRepairing] = useState(false);
  const [activeSaleId, setActiveSaleId] = useState(null);
  const [actionMode, setActionMode] = useState(null); // 'CORRECT_PAYMENT' | 'EXTERNAL' | 'VOID'
  
  // Action form states
  const [correctType, setCorrectType] = useState('CASH');
  const [correctProvider, setCorrectProvider] = useState('Square');
  const [correctAmountDollars, setCorrectAmountDollars] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');
  const [voidNote, setVoidNote] = useState('');

  const safeMismatches = integrityMismatches || [];

  const handleAutoRepair = async () => {
    setIsRepairing(true);
    try {
      const result = await repairDataIntegrity();
      showToast(`Auto-repair complete: ${result.repairedCount || 0} record(s) repaired, ${result.flaggedCount || 0} need manual review.`, 'success');
      if ((result.flaggedCount || 0) === 0) {
        closeModal();
      }
    } catch (err) {
      showToast('Auto-repair failed: ' + err.message, 'error');
    } finally {
      setIsRepairing(false);
    }
  };

  const handleSelectSale = (mismatch, mode) => {
    setActiveSaleId(mismatch.sale_id);
    setActionMode(mode);
    if (mode === 'CORRECT_PAYMENT') {
      setCorrectAmountDollars((mismatch.sale.total_amount_cents / 100).toFixed(2));
      setCorrectType('CASH');
    }
    setReconcileNote('');
    setVoidNote('');
  };

  const handleExecuteAction = async (saleId) => {
    try {
      if (actionMode === 'CORRECT_PAYMENT') {
        const amtCents = Math.round(parseFloat(correctAmountDollars) * 100);
        if (isNaN(amtCents) || amtCents <= 0) {
          showToast('Please enter a valid payment amount > $0', 'error');
          return;
        }
        await repo.reconcileSaleRecord(saleId, 'CORRECT_PAYMENT', {
          payments: [{
            payment_type: correctType,
            digital_provider: correctType === 'DIGITAL' ? correctProvider : null,
            amount_cents: amtCents,
            merchant_fee_cents: 0
          }]
        });
        showToast(`Sale #${saleId} payments updated successfully!`, 'success');
      } else if (actionMode === 'EXTERNAL') {
        if (!reconcileNote || !reconcileNote.trim()) {
          showToast('A reconciliation note is required.', 'error');
          return;
        }
        await repo.reconcileSaleRecord(saleId, 'EXTERNAL_RECONCILE', { note: reconcileNote });
        showToast(`Sale #${saleId} marked as externally reconciled.`, 'success');
      } else if (actionMode === 'VOID') {
        if (!voidNote || !voidNote.trim()) {
          showToast('A reason note is required to void.', 'error');
          return;
        }
        await repo.reconcileSaleRecord(saleId, 'VOID_SALE', { note: voidNote });
        showToast(`Sale #${saleId} voided and inventory restored.`, 'success');
      }

      setActiveSaleId(null);
      setActionMode(null);
      await refreshAllData();
    } catch (err) {
      showToast('Reconciliation failed: ' + err.message, 'error');
    }
  };

  return (
    <div>
      <div className="modal-header">
        <h2>🛡️ Data Reconciliation Review</h2>
        <button className="modal-close" onClick={closeModal}>&times;</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p className="body-medium text-muted" style={{ margin: 0 }}>
          {safeMismatches.length > 0
            ? `Data check: ${safeMismatches.length} completed sale(s) need payment reconciliation.`
            : 'All completed sales have matching payment totals.'}
        </p>

        {safeMismatches.length === 0 ? (
          <div style={{ background: 'rgba(56, 142, 60, 0.1)', color: '#2e7d32', padding: '14px', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
            ✓ <strong>No integrity issues found!</strong> All completed sales have matching payment totals.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
            {safeMismatches.map((m) => {
              const isSelected = activeSaleId === m.sale_id;
              return (
                <div key={m.sale_id} className="card" style={{ padding: '12px', background: 'var(--market-bg)', border: '1px solid var(--border-color)' }}>
                  <div className="flex-between mb-xs">
                    <span className="font-weight-bold">Sale #{m.sale_id}</span>
                    <span className="body-small text-muted">{m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '0.85rem', marginBottom: '8px' }}>
                    <div>Items: <strong>{formatCents(m.itemsTotal)}</strong></div>
                    <div>Payments: <strong>{formatCents(m.paymentsTotal)}</strong></div>
                    <div>Diff: <strong style={{ color: '#d32f2f' }}>{formatCents(m.diffCents)}</strong></div>
                  </div>

                  {!isSelected ? (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectSale(m, 'CORRECT_PAYMENT')}
                      >
                        ✏️ Fix Payment
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleSelectSale(m, 'EXTERNAL')}
                      >
                        📝 Mark Reconciled
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleSelectSale(m, 'VOID')}
                      >
                        🚫 Void Sale
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--market-surface-variant)', padding: '10px', borderRadius: '6px', marginTop: '8px' }}>
                      {actionMode === 'CORRECT_PAYMENT' && (
                        <div>
                          <div className="font-weight-bold body-small mb-xs">Correct Recorded Payment:</div>
                          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <select className="form-input" value={correctType} onChange={(e) => setCorrectType(e.target.value)} style={{ flex: 1, minWidth: '100px' }}>
                              <option value="CASH">CASH</option>
                              <option value="DIGITAL">DIGITAL</option>
                              <option value="HOUSE_TAB">HOUSE_TAB</option>
                            </select>
                            {correctType === 'DIGITAL' && (
                              <select className="form-input" value={correctProvider} onChange={(e) => setCorrectProvider(e.target.value)} style={{ flex: 1 }}>
                                <option value="Square">Square</option>
                                <option value="Venmo">Venmo</option>
                                <option value="Zelle">Zelle</option>
                                <option value="PayPal">PayPal</option>
                              </select>
                            )}
                            <input
                              type="number"
                              step="0.01"
                              className="form-input"
                              placeholder="Amount ($)"
                              value={correctAmountDollars}
                              onChange={(e) => setCorrectAmountDollars(e.target.value)}
                              style={{ width: '100px' }}
                            />
                          </div>
                        </div>
                      )}

                      {actionMode === 'EXTERNAL' && (
                        <div>
                          <div className="font-weight-bold body-small mb-xs">External Reconciliation Note (Required):</div>
                          <input
                            type="text"
                            className="form-input mb-xs"
                            placeholder="e.g. Reconciled variance manually in register close"
                            value={reconcileNote}
                            onChange={(e) => setReconcileNote(e.target.value)}
                          />
                        </div>
                      )}

                      {actionMode === 'VOID' && (
                        <div>
                          <div className="font-weight-bold body-small mb-xs" style={{ color: '#d32f2f' }}>Reason to Void Sale (Required):</div>
                          <input
                            type="text"
                            className="form-input mb-xs"
                            placeholder="e.g. Invalid test record created during setup"
                            value={voidNote}
                            onChange={(e) => setVoidNote(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="flex-between mt-xs">
                        <button className="btn btn-secondary btn-sm" onClick={() => { setActiveSaleId(null); setActionMode(null); }}>
                          Cancel
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => handleExecuteAction(m.sale_id)}>
                          Confirm Action
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: 'rgba(245, 124, 0, 0.08)', border: '1px solid rgba(245, 124, 0, 0.3)', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
          ℹ️ <strong>Safe Audit Guarantee:</strong> Every reconciliation action logs an immutable entry to the Audit Log. No historical data will be deleted without an audit trail.
        </div>
      </div>

      <div className="modal-footer flex-between">
        <button className="btn btn-secondary" onClick={closeModal}>Close</button>
        {safeMismatches.length > 0 && (
          <button
            className="btn btn-warning"
            onClick={handleAutoRepair}
            disabled={isRepairing}
          >
            {isRepairing ? '⏳ Auto-Repairing...' : '🛠️ Run Auto-Repair Routine'}
          </button>
        )}
      </div>
    </div>
  );
};

export const IntegrityReconciliationModal = IntegrityRepairModal;
