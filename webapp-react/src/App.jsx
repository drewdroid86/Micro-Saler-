import React from 'react';
import { usePos } from './context/PosContext';
import { Header } from './components/Header';
import { NavTabs } from './components/NavTabs';
import { CheckoutScreen } from './components/CheckoutScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { CustomerScreen } from './components/CustomerScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { AuditScreen } from './components/AuditScreen';
import { ModalManager } from './components/ModalManager';
import { Toast } from './components/Toast';

export function App() {
  const { currentTab, loading } = usePos();

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
        {currentTab === 'history' && <HistoryScreen />}
        {currentTab === 'audit' && <AuditScreen />}
      </main>
      <ModalManager />
      <Toast />
    </div>
  );
}

export default App;
