import React from 'react';
import { usePos } from '../context/PosContext';

const TAB_LABELS = {
  checkout: { icon: '🛒', title: 'Point of Sale Register', group: 'POS' },
  inventory: { icon: '📦', title: 'Inventory & Stock', group: 'Catalog' },
  pricing: { icon: '🧮', title: 'Pricing Calculator', group: 'Catalog' },
  customers: { icon: '👥', title: 'Customer Accounts', group: 'Accounts' },
  suppliers: { icon: '🏭', title: 'Suppliers & Payables', group: 'Accounts' },
  reports: { icon: '📊', title: 'Reports & P&L', group: 'Analytics' },
  insights: { icon: '📈', title: 'Business Insights', group: 'Analytics' },
  history: { icon: '📋', title: 'Sales History', group: 'POS' },
  audit: { icon: '🔒', title: 'Security Audit Log', group: 'Analytics' }
};

export const Header = () => {
  const { openModal, isBackupOverdue, lastBackupTime, currentTab, theme, toggleTheme } = usePos();
  const activeMeta = TAB_LABELS[currentTab] || TAB_LABELS.checkout;

  return (
    <header className="top-header">
      <div className="header-left-group">
        <div className="header-brand">
          <div className="brand-logo-badge">⚖️</div>
          <div className="header-brand-text">
            <div className="header-brand-title">
              <span>MICRO SALER</span>
              <span className="header-version-pill">v1.5</span>
            </div>
            <div className="header-brand-subtitle">Artisan Pigment POS</div>
          </div>
        </div>

        <div className="header-breadcrumb">
          <span className="header-breadcrumb-group">{activeMeta.group}</span>
          <span className="header-breadcrumb-sep">/</span>
          <span className="header-breadcrumb-active">
            <span>{activeMeta.icon}</span>
            <span>{activeMeta.title}</span>
          </span>
        </div>
      </div>

      <div className="header-actions-group">
        {isBackupOverdue && (
          <button
            className="backup-warning-badge"
            onClick={() => openModal('backupRestore')}
            title={lastBackupTime ? `Last backup > 24h ago (${new Date(lastBackupTime).toLocaleString()}). Click to backup now.` : 'No backups saved yet! Click to backup now.'}
          >
            <span>⚠️</span>
            <span className="hide-on-xs">Backup Overdue</span>
          </button>
        )}

        <button
          className="header-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle color theme"
        >
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span className="hide-on-sm">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <button
          className="header-btn"
          onClick={() => openModal('backupRestore')}
          title="Backup & Restore Ledger Data"
        >
          <span>💾</span>
          <span className="hide-on-sm">Backup</span>
        </button>

        <button
          className="header-btn"
          onClick={() => openModal('HELP')}
          title="Micro Saler User Guide & Quick Reference (Shortcut: ?)"
        >
          <span>❓</span>
          <span className="hide-on-sm">Guide</span>
        </button>

        <div className="offline-badge" title="All data stored locally in IndexedDB — 100% offline capable">
          <span className="hide-on-md">LOCAL OFFLINE</span>
        </div>
      </div>
    </header>
  );
};
