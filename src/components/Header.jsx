import React from 'react';
import { usePos } from '../context/PosContext';

export const Header = () => {
  const { openModal } = usePos();
  return (
    <header className="top-header">
      <div className="header-brand">
        <span className="header-brand-icon">⚖️</span>
        <span>MICRO SALER</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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

