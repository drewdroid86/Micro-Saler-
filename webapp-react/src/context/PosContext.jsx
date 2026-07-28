import React, { createContext, useContext, useState, useEffect } from 'react';
import MicroSalerDB from '../db.js';
import { PosRepository, getEffectivePricePerGramCents } from '../repository.js';

const PosContext = createContext(null);

export const PosProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentTab, setCurrentTab] = useState('checkout');
  const [pigments, setPigments] = useState([]);
  const [priceTiers, setPriceTiers] = useState([]);
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
      const allTiers = await activeDb.getAll('pigment_price_tiers');
      const allC = await activeDb.getAllCustomers();
      const allS = await activeDb.getAllSales();
      const allSI = await activeDb.getAll('sale_items');
      const allAudit = await activeDb.getAll('audit_log');
      const allShrink = await activeDb.getAll('shrinkage_logs');

      setPigments(activeP);
      setPriceTiers(allTiers || []);
      setCustomers(allC);
      setSales(allS);
      setSaleItems(allSI);
      setAuditLogs(allAudit.sort((a, b) => (b.created_at || b.timestamp || 0) - (a.created_at || a.timestamp || 0)));
      setShrinkageLogs(allShrink.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
    } catch (err) {
      showToast('Failed to refresh data: ' + err.message, 'error');
    }
  };

  const checkStartupIntegrity = async (activeDb) => {
    try {
      const allSales = await activeDb.getAllSales();
      const completedSales = allSales.filter(s => s.status === 'COMPLETED');
      const allItems = await activeDb.getAll('sale_items');
      const allPayments = await activeDb.getAll('sale_payments');

      let mismatchCount = 0;

      for (const sale of completedSales) {
        const saleId = sale.sale_id;
        const itemsForSale = allItems.filter(i => Number(i.sale_id) === Number(saleId));
        const paymentsForSale = allPayments.filter(p => Number(p.sale_id) === Number(saleId));

        const itemsTotal = itemsForSale.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
        const paymentsTotal = paymentsForSale.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

        if (Math.abs(itemsTotal - paymentsTotal) > 1) {
          mismatchCount++;
          console.warn(
            `[Data Integrity Warning] Sale ID ${saleId}: Items Total = ${itemsTotal}¢, Payments Total = ${paymentsTotal}¢ (Diff: ${Math.abs(itemsTotal - paymentsTotal)}¢)`
          );
        }
      }

      if (mismatchCount > 0) {
        console.warn(`Startup integrity check: Found ${mismatchCount} completed sale(s) with payment total mismatches.`);
        showToast(`Data integrity warning: ${mismatchCount} completed sale(s) have payment total mismatches.`, 'warning');
      }
    } catch (err) {
      console.error('Startup integrity check error:', err);
    }
  };

  const [loadingError, setLoadingError] = useState(null);
  const [isDbBlocked, setIsDbBlocked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fallbackTimer = setTimeout(() => {
      if (isMounted && loading) {
        console.warn('Database initialization timed out (6s safety net).');
        setLoadingError('Database initialization timed out. Please refresh or clear site data.');
        setLoading(false);
      }
    }, 6000);

    async function initDB() {
      try {
        const database = new MicroSalerDB();
        await database.init(() => {
          if (isMounted) setIsDbBlocked(true);
        });
        const repository = new PosRepository(database);

        if (!isMounted) return;

        setDb(database);
        setRepo(repository);

        await refreshAllData(repository, database);
        await checkStartupIntegrity(database);

        // Pre-select first pigment if available
        const activeP = await database.getActivePigments();
        if (activeP.length > 0 && isMounted) {
          setSelectedPigment(activeP[0]);
        }
      } catch (e) {
        console.error('Database initialization error:', e);
        if (isMounted) {
          setLoadingError(e.message);
        }
      } finally {
        clearTimeout(fallbackTimer);
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    initDB();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []);

  const addToCart = (pigment, weightMg, customPriceCents = null) => {
    if (!pigment) {
      showToast('Please select a pigment first.', 'error');
      return;
    }

    let priceChargedCents = null;

    if (customPriceCents !== null) {
      priceChargedCents = customPriceCents;
    } else {
      // Check if a fixed preset price tier exists for (pigment_id, weight_mg)
      const matchingTier = priceTiers.find(
        t => Number(t.pigment_id) === Number(pigment.pigment_id) && Number(t.weight_mg) === Number(weightMg)
      );

      if (matchingTier) {
        const tierPrice = pricingMode === 'RETAIL'
          ? matchingTier.retail_price_cents
          : matchingTier.wholesale_price_cents;

        if (tierPrice !== null && tierPrice !== undefined && !isNaN(tierPrice) && Number(tierPrice) > 0) {
          priceChargedCents = Number(tierPrice);
        }
      }

      // If no preset tier override, fall back to per-gram formula
      if (priceChargedCents === null) {
        const pricePerGramCents = getEffectivePricePerGramCents(pigment, weightMg, pricingMode);
        priceChargedCents = Math.round((weightMg / 1000) * pricePerGramCents) + (pigment.default_pkg_cents || 0);
      }
    }

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

  const updateCartItem = (index, weightMg, customPriceCents = null) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const validWeightMg = Math.max(0, weightMg);
      const pigment = item.pigment;

      let priceChargedCents = null;

      if (customPriceCents !== null) {
        priceChargedCents = customPriceCents;
      } else {
        const matchingTier = priceTiers.find(
          t => Number(t.pigment_id) === Number(pigment.pigment_id) && Number(t.weight_mg) === Number(validWeightMg)
        );

        if (matchingTier) {
          const tierPrice = pricingMode === 'RETAIL'
            ? matchingTier.retail_price_cents
            : matchingTier.wholesale_price_cents;

          if (tierPrice !== null && tierPrice !== undefined && !isNaN(tierPrice) && Number(tierPrice) > 0) {
            priceChargedCents = Number(tierPrice);
          }
        }

        if (priceChargedCents === null) {
          const pricePerGramCents = getEffectivePricePerGramCents(pigment, validWeightMg, pricingMode);
          priceChargedCents = Math.round((validWeightMg / 1000) * pricePerGramCents) + (pigment.default_pkg_cents || 0);
        }
      }

      const unitCogsCents = pigment.stock_mg > 0
        ? Math.round((pigment.total_cost_cents / pigment.stock_mg) * validWeightMg)
        : 0;

      return {
        ...item,
        weight_mg: validWeightMg,
        price_charged_cents: priceChargedCents,
        unit_cogs_cents: unitCogsCents
      };
    }));
  };

  const editCartItem = (index, newWeightMg, newPriceCents) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const validWeightMg = Math.max(0, newWeightMg);
      const pigment = item.pigment;
      const unitCogsCents = (pigment && pigment.stock_mg > 0)
        ? Math.round((pigment.total_cost_cents / pigment.stock_mg) * validWeightMg)
        : 0;

      return {
        ...item,
        weight_mg: validWeightMg,
        price_charged_cents: Math.max(0, newPriceCents),
        unit_cogs_cents: unitCogsCents
      };
    }));
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

      const pad = (n) => String(n).padStart(2, '0');
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
      const fileName = `micro-saler-backup-${dateStr}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
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
    if (!window.confirm("This will overwrite all current data — continue?")) {
      return false;
    }
    try {
      await repo.importData(jsonData);
      await refreshAllData();
      showToast('Ledger backup restored successfully!', 'success');
      return true;
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
      loadingError,
      isDbBlocked,
      currentTab,
      setCurrentTab,
      pigments,
      priceTiers,
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
      updateCartItem,
      editCartItem,
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
