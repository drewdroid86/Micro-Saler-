import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { formatCents } from '../../repository';

export const IntegrityRepairModal = () => {
  const { closeModal, integrityMismatches, repairDataIntegrity, showToast } = usePos();
  const [isRepairing, setIsRepairing] = useState(false);

  const safeMismatches = integrityMismatches || [];

  const handleRepairAll = async () => {
    setIsRepairing(true);
    try {
      const repairedCount = await repairDataIntegrity();
      showToast(`Data integrity repair complete! Repaired ${repairedCount} record(s).`, 'success');
      closeModal();
    } catch (err) {
      showToast('Repair failed: ' + err.message, 'error');
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div>
      <div className="modal-header">
        <h2>🛡️ Data Integrity Repair</h2>
        <button className="modal-close" onClick={closeModal}>&times;</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p className="body-medium text-muted" style={{ margin: 0 }}>
          The system detected {safeMismatches.length} completed sale(s) where line item totals do not match recorded payment totals.
        </p>

        {safeMismatches.length === 0 ? (
          <div style={{ background: 'rgba(56, 142, 60, 0.1)', color: '#2e7d32', padding: '14px', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
            ✓ <strong>No integrity issues found!</strong> All completed sales have matching payment totals.
          </div>
        ) : (
          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--market-bg)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Sale ID</th>
                  <th style={{ padding: '8px' }}>Date</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Items Total</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Payments Total</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {safeMismatches.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px' }}>#{m.sale_id}</td>
                    <td style={{ padding: '8px' }}>{m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatCents(m.itemsTotal)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatCents(m.paymentsTotal)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#d32f2f', fontWeight: 'bold' }}>
                      {formatCents(m.diffCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ background: 'rgba(245, 124, 0, 0.08)', border: '1px solid rgba(245, 124, 0, 0.3)', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
          ℹ️ <strong>Auto-Repair Process:</strong> For each mismatched record, the repair tool safely reconciles line items and payment entries, updates sale totals, and appends an immutable entry to the Audit Log. No data will be deleted.
        </div>
      </div>

      <div className="modal-footer flex-between">
        <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
        {safeMismatches.length > 0 && (
          <button
            className="btn btn-warning"
            onClick={handleRepairAll}
            disabled={isRepairing}
          >
            {isRepairing ? '⏳ Repairing Records...' : '🛠️ Auto-Fix All Mismatched Records'}
          </button>
        )}
      </div>
    </div>
  );
};
