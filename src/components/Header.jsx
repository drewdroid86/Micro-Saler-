import React from 'react';
import { usePos } from '../context/PosContext';

export const Header = () => {
  const { openModal, isBackupOverdue, lastBackupTime } = usePos();
  return (
    <header className="top-header">
      <div className="header-brand">
        <span className="header-brand-icon">⚖️</span>
        <span>MICRO SALER</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {isBackupOverdue && (
          <button
            className="backup-warning-badge"
            onClick={() => openModal('backupRestore')}
            title={lastBackupTime ? `Last backup > 24h ago (${new Date(lastBackupTime).toLocaleString()}). Click to backup now.` : 'No backups saved yet! Click to backup now.'}
          >
            ⚠️ Backup Overdue (&gt;24h)
          </button>
        )}
        <button 
          className="header-btn" 
          onClick={() => openModal('userGuide')}
          title="Micro Saler User Guide & Quick Reference"
        >
          📖 Guide
        </button>
        <button 
          className="header-btn" 
          onClick={() => openModal('backupRestore')}
          title="Backup & Restore Ledger Data"
        >
          💾 Backup / Restore
        </button>
        <div className="offline-badge">100% OFFLINE LOCAL</div>
      </div>
    </header>
  );
};

