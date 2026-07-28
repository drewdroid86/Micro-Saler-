import React, { createContext, useContext, useState, useEffect } from 'react';
import MicroSalerDB from '../db.js';
import { PosRepository } from '../repository.js';

const PosContext = createContext(null);

export const PosProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentTab, setCurrentTab] = useState('checkout');
  const [pigments, setPigments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [shrinkageLogs, setShrinkageLogs] = useState([]);

  // Checkout state
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedPigment, setSelectedPigment] = useState(null);
  const [pricingMode, setPricingMode] = useState('RETAIL');
  const [isHandshakeOverride, setIsHandshakeOverride] = useState(false);

  // Toast notification state
  const [toasts, setToasts] = useState([]);

  // Modal State
  const [modal, setModal] = useState({ name: null, payload: null });

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const closeModal = () => {
    setModal({ name: null, payload: null });
  };

  const openModal = (name, payload = null) => {
    setModal({ name, payload });
  };

  const refreshAllData = async (repository = repo, database = db) => {
    const activeRepo = repository || repo;
    const activeDb = database || db;
    if (!activeDb) return;

    try {
      const activeP = await activeDb.getActivePigments();
      const allC = await activeDb.getAllCustomers();
      const allS = await activeDb.getAllSales();
      const allSI = await activeDb.getAll('sale_items');
      const allAudit = await activeDb.getAll('audit_log');
      const allShrink = await activeDb.getAll('shrinkage_logs');

      setPigments(activeP);
      setCustomers(allC);
      setSales(allS);
      setSaleItems(allSI);
      setAuditLogs(allAudit.sort((a, b) => (b.created_at || b.timestamp || 0) - (a.created_at || a.timestamp || 0)));
      setShrinkageLogs(allShrink.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
    } catch (err) {
      showToast('Failed to refresh data: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    async function initDB() {
      try {
        const dbInstance = new MicroSalerDB();
        await dbInstance.init();
        const repoInstance = new PosRepository(dbInstance);
        setDb(dbInstance);
        setRepo(repoInstance);
        await refreshAllData(repoInstance, dbInstance);
        setLoading(false);
      } catch (err) {
        console.error('DB Initialization error:', err);
        setLoading(false);
      }
    }
    initDB();
  }, []);

  const addToCart = (pigment, weightMg, customPriceCents = null) => {
    if (!pigment) {
      showToast('Please select a pigment first.', 'error');
      return;
    }

    const pricePerGramCents = pricingMode === 'RETAIL'
      ? pigment.retail_price_per_gram_cents
      : pigment.wholesale_price_per_gram_cents;

    const priceChargedCents = customPriceCents !== null
      ? customPriceCents
      : Math.round((weightMg / 1000) * pricePerGramCents) + pigment.default_pkg_cents;

    const unitCogsCents = pigment.stock_mg > 0
      ? Math.round((pigment.total_cost_cents / pigment.stock_mg) * weightMg)
      : 0;

    setCart(prev => [
      ...prev,
      {
        pigment: { ...pigment },
        pigment_id: pigment.pigment_id,
        weight_mg: weightMg,
        price_charged_cents: priceChargedCents,
        unit_cogs_cents: unitCogsCents
      }
    ]);
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
  };

  const quickCollectCash = async () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }
    const totalAmountCents = cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
    const customerId = selectedCustomer?.customer_id || null;
    const payments = [{ payment_type: 'CASH', digital_provider: null, amount_cents: totalAmountCents, merchant_fee_cents: 0 }];

    try {
      await repo.completeSale(customerId, cart, payments, false);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedPigment(null);
      await refreshAllData();
      showToast('Sale completed successfully!', 'success');
    } catch (error) {
      showToast('Checkout failed: ' + error.message, 'error');
    }
  };

  const exportBackup = async () => {
    try {
      const backupData = await repo.exportData();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `micro-saler-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Ledger backup exported successfully!', 'success');
    } catch (error) {
      showToast('Export failed: ' + error.message, 'error');
    }
  };

  const importBackup = async (jsonData) => {
    try {
      await repo.importData(jsonData);
      await refreshAllData();
      showToast('Ledger backup restored successfully!', 'success');
    } catch (error) {
      showToast('Import failed: ' + error.message, 'error');
      throw error;
    }
  };

  return (
    <PosContext.Provider value={{
      db,
      repo,
      loading,
      currentTab,
      setCurrentTab,
      pigments,
      customers,
      sales,
      saleItems,
      auditLogs,
      shrinkageLogs,
      cart,
      setCart,
      selectedCustomer,
      setSelectedCustomer,
      selectedPigment,
      setSelectedPigment,
      pricingMode,
      setPricingMode,
      isHandshakeOverride,
      setIsHandshakeOverride,
      toasts,
      showToast,
      modal,
      openModal,
      closeModal,
      addToCart,
      removeFromCart,
      clearCart,
      quickCollectCash,
      exportBackup,
      importBackup,
      refreshAllData
    }}>
      {children}
    </PosContext.Provider>
  );

};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within PosProvider');
  return context;
};
