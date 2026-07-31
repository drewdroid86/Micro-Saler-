import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  const [integrityMismatches, setIntegrityMismatches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [stockReceipts, setStockReceipts] = useState([]);
  const [customerPrepayments, setCustomerPrepayments] = useState([]);

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
      const allSup = await activeDb.getAllSuppliers();
      const allSupPay = await activeDb.getAll('supplier_payments');
      const allReceipts = await activeDb.getAll('stock_receipts');
      const allPrep = await activeDb.getAll('customer_prepayments');
      const allS = await activeDb.getAllSales();
      const allSI = await activeDb.getAll('sale_items');
      const allAudit = await activeDb.getAll('audit_log');
      const allShrink = await activeDb.getAll('shrinkage_logs');

      setPigments(activeP);
      setPriceTiers(allTiers || []);
      setCustomers(allC);
      setSuppliers(allSup);
      setSupplierPayments(allSupPay || []);
      setStockReceipts(allReceipts || []);
      setCustomerPrepayments(allPrep || []);
      setSales(allS);
      setSaleItems(allSI);
      setAuditLogs(allAudit.sort((a, b) => (b.created_at || b.timestamp || 0) - (a.created_at || a.timestamp || 0)));
      setShrinkageLogs(allShrink.sort((a, b) => (b.created_at || 0) - (a.created_at || 0)));
    } catch (err) {
      showToast('Failed to refresh data: ' + err.message, 'error');
    }
  };

  const checkStartupIntegrity = async (activeDb, activeRepo = repo) => {
    try {
      const mismatches = activeRepo ? await activeRepo.getIntegrityMismatches() : [];
      setIntegrityMismatches(mismatches);

      if (mismatches.length > 0) {
        console.warn(`Startup integrity check: Found ${mismatches.length} completed sale(s) with payment total mismatches.`);
        showToast(`Data integrity warning: ${mismatches.length} completed sale(s) have payment total mismatches.`, 'warning');
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
        console.warn('Database initialization timed out (4s fail-fast safety net).');
        setLoadingError('Database loading took longer than expected. Please click Auto-Fix below.');
        setLoading(false);
      }
    }, 4000);

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
        await checkStartupIntegrity(database, repository);

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

  const retryDbInit = async () => {
    setLoading(true);
    setLoadingError(null);
    setIsDbBlocked(false);

    try {
      if (db && db.db) {
        try { db.db.close(); } catch (e) {}
      }
      const database = new MicroSalerDB();
      await database.init(() => {
        setIsDbBlocked(true);
      });
      const repository = new PosRepository(database);

      setDb(database);
      setRepo(repository);

      await refreshAllData(repository, database);
      await checkStartupIntegrity(database);

      const activeP = await database.getActivePigments();
      if (activeP.length > 0) {
        setSelectedPigment(activeP[0]);
      }
      showToast('Database reconnected successfully!', 'success');
    } catch (e) {
      console.error('Database retry error:', e);
      setLoadingError(e.message);
    } finally {
      setLoading(false);
    }
  };

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

  const overrideCartTotal = (newTotalCents) => {
    setCart(prevCart => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      const currentTotalCents = prevCart.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);
      if (currentTotalCents <= 0) return prevCart;

      const targetTotal = Math.max(0, Math.round(newTotalCents));
      let assignedCents = 0;

      return prevCart.map((item, index) => {
        if (index === prevCart.length - 1) {
          const finalItemPrice = Math.max(0, targetTotal - assignedCents);
          return { ...item, price_charged_cents: finalItemPrice };
        } else {
          const itemShare = Math.max(0, Math.round((item.price_charged_cents / currentTotalCents) * targetTotal));
          assignedCents += itemShare;
          return { ...item, price_charged_cents: itemShare };
        }
      });
    });
  };

  const resetCartPrices = () => {
    setCart(prevCart => {
      if (!prevCart) return [];
      return prevCart.map(item => {
        const pigment = item.pigment;
        const validWeightMg = item.weight_mg;
        if (!pigment) return item;

        let priceChargedCents = null;
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

        return {
          ...item,
          price_charged_cents: priceChargedCents
        };
      });
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const quickCollectCash = async () => {
    if (isSubmitting) return;
    if (cart.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }
    const totalAmountCents = cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
    const customerId = selectedCustomer?.customer_id || null;
    const payments = [{ payment_type: 'CASH', digital_provider: null, amount_cents: totalAmountCents, merchant_fee_cents: 0 }];

    setIsSubmitting(true);
    try {
      await repo.completeSale(customerId, cart, payments, false);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedPigment(null);
      await refreshAllData();
      showToast('Sale completed successfully!', 'success');
    } catch (error) {
      showToast('Checkout failed: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
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
    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
      throw err;
    }
  };

  const repairDataIntegrity = async () => {
    if (!repo || !db) return 0;
    const count = await repo.repairDataIntegrity();
    await refreshAllData(repo, db);
    const remaining = await repo.getIntegrityMismatches();
    setIntegrityMismatches(remaining);
    return count;
  };


  const contextValue = useMemo(() => ({
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
    suppliers,
    supplierPayments,
    stockReceipts,
    customerPrepayments,
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
    isSubmitting,
    toasts,
    showToast,
    modal,
    openModal,
    closeModal,
    addToCart,
    removeFromCart,
    updateCartItem,
    editCartItem,
    overrideCartTotal,
    resetCartPrices,
    clearCart,
    quickCollectCash,
    exportBackup,
    importBackup,
    refreshAllData,
    retryDbInit,
    integrityMismatches,
    integrityMismatchCount: integrityMismatches.length,
    repairDataIntegrity,
    checkStartupIntegrity
  }), [
    db, repo, loading, loadingError, isDbBlocked, currentTab, pigments, priceTiers,
    customers, suppliers, supplierPayments, stockReceipts, customerPrepayments, sales, saleItems, auditLogs,
    shrinkageLogs, cart, selectedCustomer, selectedPigment, pricingMode, isHandshakeOverride,
    isSubmitting, toasts, modal, integrityMismatches
  ]);

  return (
    <PosContext.Provider value={contextValue}>
      {children}
    </PosContext.Provider>
  );

};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within PosProvider');
  return context;
};
