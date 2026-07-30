import React from 'react';
import { usePos } from './context/PosContext';
import { Header } from './components/Header';
import { NavTabs } from './components/NavTabs';
import { CheckoutScreen } from './components/CheckoutScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { CustomerScreen } from './components/CustomerScreen';
import { SupplierScreen } from './components/SupplierScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { AuditScreen } from './components/AuditScreen';
import { ModalManager } from './components/ModalManager';
import { Toast } from './components/Toast';

export function App() {
  const { currentTab, loading, loadingError, isDbBlocked, retryDbInit } = usePos();

  if (loadingError || isDbBlocked) {
    return (
      <div className="flex-center" style={{ height: '100vh', flexDirection: 'column', padding: '24px', textAlign: 'center', backgroundColor: 'var(--market-bg, #121212)', color: 'var(--market-text, #ffffff)' }}>
        <h2 style={{ color: 'var(--market-error, #ef4444)', marginBottom: '12px' }}>Database Upgrade Notice</h2>
        <p style={{ maxWidth: '440px', marginBottom: '24px', color: 'var(--market-text-secondary, #9e9e9e)', lineHeight: '1.5', fontSize: '0.95rem' }}>
          {isDbBlocked
            ? 'A database update is pending. Close any other open tabs of this app, or click Auto-Fix to reconnect.'
            : (loadingError || 'Database failed to initialize.')}
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={retryDbInit}>
            ⚡ Auto-Fix & Retry Connection
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.reload()}>
            🔄 Reload Page
          </button>
          <button
            className="btn btn-ghost text-error"
            onClick={() => {
              if (window.confirm('Clear local database and reload? Ensure you have backups if needed.')) {
                indexedDB.deleteDatabase('MicroSalerDB');
                window.location.reload();
              }
            }}
          >
            🗑️ Clear App Data & Reload
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh', fontSize: '1.2em', fontWeight: 'bold' }}>
        Loading Micro Saler POS...
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header />
      <NavTabs />
      <main className="main-content">
        {currentTab === 'checkout' && <CheckoutScreen />}
        {currentTab === 'inventory' && <InventoryScreen />}
        {currentTab === 'customers' && <CustomerScreen />}
        {currentTab === 'suppliers' && <SupplierScreen />}
        {currentTab === 'reports' && <ReportsScreen />}
        {currentTab === 'history' && <HistoryScreen />}
        {currentTab === 'audit' && <AuditScreen />}
      </main>
      <ModalManager />
      <Toast />
    </div>
  );
}

export default App;
