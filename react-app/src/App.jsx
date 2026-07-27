import React, { useState, useEffect } from 'react';
import MicroSalerDB from '../db.js';
import { PosRepository } from '../repository.js';
import Header from './components/Header.jsx';
import CheckoutScreen from './components/CheckoutScreen.jsx';
import InventoryScreen from './components/InventoryScreen.jsx';
import CustomersScreen from './components/CustomersScreen.jsx';
import HistoryScreen from './components/HistoryScreen.jsx';
import AuditScreen from './components/AuditScreen.jsx';

export default function App() {
  const [db, setDb] = useState(null);
  const [repo, setRepo] = useState(null);
  const [currentTab, setCurrentTab] = useState('checkout');
  const [loading, setLoading] = useState(true);

  // Core app state
  const [pigments, setPigments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  useEffect(() => {
    async function initDb() {
      try {
        const instance = new MicroSalerDB();
        await instance.init();
        const posRepo = new PosRepository(instance);
        setDb(instance);
        setRepo(posRepo);
        await refreshData(instance);
      } catch (err) {
        console.error("Database initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    initDb();
  }, []);

  const refreshData = async (dbInstance = db) => {
    if (!dbInstance) return;
    try {
      const activePigments = await dbInstance.getActivePigments();
      const allCustomers = await dbInstance.getAllCustomers();
      const allSales = await dbInstance.getAllSales();
      const allLogs = await dbInstance.getAll('audit_log');
      
      setPigments(activePigments);
      setCustomers(allCustomers);
      setSales(allSales);
      setAuditLogs(allLogs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    } catch (e) {
      console.error("Failed to refresh data:", e);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>
        <h2>Loading Micro Saler POS...</h2>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {currentTab === 'checkout' && (
          <CheckoutScreen
            pigments={pigments}
            customers={customers}
            repo={repo}
            onSaleComplete={() => refreshData(db)}
          />
        )}

        {currentTab === 'inventory' && (
          <InventoryScreen
            pigments={pigments}
            sales={sales}
            repo={repo}
            onRefresh={() => refreshData(db)}
          />
        )}

        {currentTab === 'customers' && (
          <CustomersScreen
            customers={customers}
            repo={repo}
            onRefresh={() => refreshData(db)}
          />
        )}

        {currentTab === 'history' && (
          <HistoryScreen
            sales={sales}
            pigments={pigments}
            customers={customers}
            repo={repo}
            onRefresh={() => refreshData(db)}
          />
        )}

        {currentTab === 'audit' && (
          <AuditScreen auditLogs={auditLogs} />
        )}
      </main>
    </div>
  );
}
