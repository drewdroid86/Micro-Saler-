import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';

export const BackupRestoreModal = () => {
  const { closeModal, openModal, exportBackup, importBackup, showToast, repo, refreshAllData } = usePos();

  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setParseError(null);
    setParsedBackup(null);
    setSelectedFile(file || null);

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json || typeof json !== 'object' || !json.stores) {
          throw new Error('Invalid file format. Backup file must contain a "stores" root object.');
        }
        setParsedBackup(json);
      } catch (err) {
        setParseError(err.message);
        showToast('Invalid backup file: ' + err.message, 'error');
      }
    };
    reader.onerror = () => {
      setParseError('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedBackup) return;
    setIsImporting(true);
    try {
      await importBackup(parsedBackup);
      closeModal();
    } catch (err) {
      // Error toast already shown by importBackup
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div>
      <div className="modal-header">
        <h2>💾 Ledger Backup & Restore</h2>
        <button className="modal-close" onClick={closeModal}>&times;</button>
      </div>

      <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Export Section */}
        <div style={{ background: 'var(--market-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-color)' }}>📥 Export Ledger Backup</h3>
          <p className="body-medium text-muted" style={{ margin: '0 0 12px 0' }}>
            Download a full local JSON backup containing all 10 object stores (pigments, receipts, customers, sales, payments, returns, and audit logs).
          </p>
          <button className="btn btn-primary" onClick={exportBackup} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>📥</span> Download Ledger Backup (.json)
          </button>
        </div>

        {/* Restore Section */}
        <div style={{ background: 'var(--market-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-color)' }}>📤 Restore Ledger Backup</h3>
          <p className="body-medium text-muted" style={{ margin: '0 0 12px 0' }}>
            Upload a previously exported Micro Saler JSON backup file to restore your local database.
          </p>

          <div style={{ marginBottom: '12px' }}>
            <input 
              type="file" 
              accept=".json,application/json" 
              onChange={handleFileChange}
              className="form-input"
              style={{ padding: '8px' }}
            />
          </div>

          {parseError && (
            <div style={{ background: 'rgba(211, 47, 47, 0.1)', color: '#d32f2f', padding: '10px', borderRadius: '6px', fontSize: '0.9rem', marginBottom: '12px' }}>
              <strong>Error:</strong> {parseError}
            </div>
          )}

          {parsedBackup && (
            <div style={{ background: 'rgba(56, 142, 60, 0.08)', border: '1px solid rgba(56, 142, 60, 0.3)', padding: '14px', borderRadius: '6px', marginBottom: '12px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--market-primary)', fontSize: '0.95rem' }}>✓ Backup Verified</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
                <div><strong>Exported:</strong> {parsedBackup.exported_at ? new Date(parsedBackup.exported_at).toLocaleString() : 'N/A'}</div>
                <div><strong>Schema Version:</strong> v{parsedBackup.schema_version || 1}</div>
                <div><strong>Pigments:</strong> {parsedBackup.stores?.pigments?.length || 0}</div>
                <div><strong>Customers:</strong> {parsedBackup.stores?.customers?.length || 0}</div>
                <div><strong>Sales Records:</strong> {parsedBackup.stores?.sales?.length || 0}</div>
                <div><strong>Audit Logs:</strong> {parsedBackup.stores?.audit_log?.length || 0}</div>
              </div>
            </div>
          )}

          {parsedBackup && (
            <div style={{ background: 'rgba(245, 124, 0, 0.12)', border: '1px solid rgba(245, 124, 0, 0.4)', color: '#e65100', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '12px' }}>
              ⚠️ <strong>Warning:</strong> Restoring will overwrite all current local IndexedDB data. A safety backup of your current database will be downloaded automatically before restoring.
            </div>
          )}

          {parsedBackup && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={confirmOverwrite}
                  onChange={(e) => setConfirmOverwrite(e.target.checked)}
                />
                <span>I understand and confirm overwriting local data with this backup</span>
              </label>
            </div>
          )}

          <button 
            className="btn btn-warning" 
            onClick={async () => {
              if (!confirmOverwrite) return;
              setIsImporting(true);
              try {
                // Auto-create safety backup before overwrite
                showToast('Downloading safety backup of current data...', 'info');
                await exportBackup();
                await handleConfirmImport();
              } catch (err) {
                // Handled
              } finally {
                setIsImporting(false);
              }
            }} 
            disabled={!parsedBackup || !confirmOverwrite || isImporting}
            style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <span>{isImporting ? '⏳ Creating Safety Backup & Restoring...' : '📤 Overwrite & Restore Ledger'}</span>
          </button>
        </div>

        {/* Data Integrity Section */}
        <div style={{ background: 'var(--market-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-color)' }}>🛡️ Data Integrity Check & Repair</h3>
          <p className="body-medium text-muted" style={{ margin: '0 0 12px 0' }}>
            Check and reconcile completed sale records to ensure line item totals match recorded payment totals.
          </p>
          <button
            className="btn btn-warning"
            onClick={() => {
              closeModal();
              setTimeout(() => openModal('integrityRepair'), 100);
            }}
            style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <span>🛡️ Review & Repair Data Integrity</span>
          </button>
        </div>

        {/* Wipe Data Section */}
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--market-error)' }}>🗑️ Clear All Current Data</h3>
          <p className="body-medium text-muted" style={{ margin: '0 0 12px 0' }}>
            Completely wipe all inventory items, sales records, customer house tabs, supplier liabilities, and audit logs to start with a fresh database.
          </p>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (window.confirm('⚠️ ARE YOU SURE? This will permanently delete all current data (pigments, sales, customers, suppliers) from local storage!')) {
                try {
                  await repo.wipeAllData();
                  await refreshAllData();
                  closeModal();
                  showToast('All app data wiped successfully! App is now clean.', 'success');
                } catch (err) {
                  showToast('Wipe failed: ' + err.message, 'error');
                }
              }
            }}
            style={{ width: '100%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
          >
            <span>🗑️ Wipe All App Data & Start Fresh</span>
          </button>
        </div>

      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={closeModal}>Close</button>
      </div>
    </div>
  );
};
