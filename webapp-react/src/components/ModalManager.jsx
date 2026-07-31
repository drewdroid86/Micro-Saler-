import React, { useState, useEffect, useCallback } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';
import { CustomWeightModal } from './modals/CustomWeightModal';
import { EditCartItemModal } from './modals/EditCartItemModal';
import { BackupRestoreModal } from './modals/BackupRestoreModal';
import { EditCartTotalModal } from './modals/EditCartTotalModal';

const PRESET_TIERS = [
  { label: '¼g', weight_mg: 250 },
  { label: '½g', weight_mg: 500 },
  { label: '¾g', weight_mg: 750 },
  { label: '1g', weight_mg: 1000 },
  { label: '1.5g', weight_mg: 1500 },
  { label: '1.75g', weight_mg: 1750 },
  { label: '3.5g', weight_mg: 3500 },
  { label: '7g', weight_mg: 7000 },
  { label: '14g', weight_mg: 14000 },
  { label: '28g', weight_mg: 28000 }
];

export const ModalManager = () => {

  const {
    modal,
    openModal,
    closeModal,
    customers,
    suppliers,
    pigments,
    selectedCustomer,
    setSelectedCustomer,
    cart,
    setCart,
    setSelectedPigment,
    isHandshakeOverride,
    setIsHandshakeOverride,
    overrideCartTotal,
    repo,
    refreshAllData,
    showToast
  } = usePos();

  // Local form states
  const [restockWeight, setRestockWeight] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');
  const [restockPaymentStatus, setRestockPaymentStatus] = useState('PAID');
  const [restockSupplierId, setRestockSupplierId] = useState('');
  const [restockPaidDown, setRestockPaidDown] = useState('');

  const [supplierNameInput, setSupplierNameInput] = useState('');
  const [supplierPhoneInput, setSupplierPhoneInput] = useState('');
  const [supplierNotesInput, setSupplierNotesInput] = useState('');
  const [clearInventoryMode, setClearInventoryMode] = useState('ZERO_STOCK');

  const [paySupplierAmt, setPaySupplierAmt] = useState('');
  const [paySupplierType, setPaySupplierType] = useState('CASH');
  const [paySupplierNotes, setPaySupplierNotes] = useState('');

  const [shrinkageWeight, setShrinkageWeight] = useState('');
  const [shrinkageReason, setShrinkageReason] = useState('Spillage');

  const [pigmentName, setPigmentName] = useState('');
  const [pigmentColor, setPigmentColor] = useState('#000000');
  const [pigmentFinish, setPigmentFinish] = useState('Matte');
  const [pigmentStock, setPigmentStock] = useState('');
  const [pigmentCost, setPigmentCost] = useState('');
  const [pigmentRetail, setPigmentRetail] = useState('');
  const [pigmentWholesale, setPigmentWholesale] = useState('');

  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#000000');
  const [editFinish, setEditFinish] = useState('Mica Pearl');
  const [editPkg, setEditPkg] = useState('');
  const [editRetail, setEditRetail] = useState('');
  const [editWholesale, setEditWholesale] = useState('');
  const [editArchived, setEditArchived] = useState(false);
  const [editTiers, setEditTiers] = useState([]);
  const [presetTierInputs, setPresetTierInputs] = useState({});

  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custLimit, setCustLimit] = useState('');

  const [prepaymentCustomerId, setPrepaymentCustomerId] = useState('');
  const [prepaymentPigmentId, setPrepaymentPigmentId] = useState('');
  const [prepaymentWeightG, setPrepaymentWeightG] = useState('');
  const [prepaymentAmountD, setPrepaymentAmountD] = useState('');
  const [prepaymentStatus, setPrepaymentStatus] = useState('PENDING_DELIVERY');
  const [prepaymentNotes, setPrepaymentNotes] = useState('');
  const [custStatus, setCustStatus] = useState('GOOD_STANDING');

  const [settleAmt, setSettleAmt] = useState('');
  const [settleType, setSettleType] = useState('CASH');
  const [settleProvider, setSettleProvider] = useState('Square');

  const [voidReason, setVoidReason] = useState('');

  const [returnWeight, setReturnWeight] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnRestock, setReturnRestock] = useState(true);

  // Drawer state
  const [drawerTab, setDrawerTab] = useState('digital');
  const [digitalProvider, setDigitalProvider] = useState(null);

  // Tab payment breakdown state
  const [tabPayMode, setTabPayMode] = useState('FULL');
  const [tabPaidNowInput, setTabPaidNowInput] = useState('');
  const [tabPuttingOnTabInput, setTabPuttingOnTabInput] = useState('');
  const [tabPaidType, setTabPaidType] = useState('CASH');
  const [tabDigitalProvider, setTabDigitalProvider] = useState('Square');

  // Split payment state
  const [splitCashInput, setSplitCashInput] = useState('');
  const [splitDigitalInput, setSplitDigitalInput] = useState('');
  const [splitTabInput, setSplitTabInput] = useState('');
  const [splitDigitalProvider, setSplitDigitalProvider] = useState('Square');

  const resetAllFormStates = useCallback(() => {
    setTabPayMode('FULL');
    setTabPaidNowInput('');
    setTabPuttingOnTabInput('');
    setTabPaidType('CASH');
    setTabDigitalProvider('Square');
    setSplitCashInput('');
    setSplitDigitalInput('');
    setSplitTabInput('');
    setSplitDigitalProvider('Square');
    setRestockWeight('');
    setRestockCost('');
    setRestockSupplier('');

    setShrinkageWeight('');
    setShrinkageReason('Spillage');

    setPigmentName('');
    setPigmentColor('#000000');
    setPigmentFinish('Matte');
    setPigmentStock('');
    setPigmentCost('');
    setPigmentRetail('');
    setPigmentWholesale('');

    setEditName('');
    setEditColor('#000000');
    setEditFinish('Mica Pearl');
    setEditPkg('');
    setEditRetail('');
    setEditWholesale('');
    setEditArchived(false);
    setEditTiers([]);
    setPresetTierInputs({});

    setCustName('');
    setCustPhone('');
    setCustLimit('');
    setCustStatus('GOOD_STANDING');

    setSettleAmt('');
    setSettleType('CASH');
    setSettleProvider('Square');

    setVoidReason('');

    setReturnWeight('');
    setReturnReason('');
    setReturnRestock(true);

    setDrawerTab('digital');
    setDigitalProvider(null);
  }, []);

  const handleClose = useCallback(() => {
    resetAllFormStates();
    closeModal();
  }, [resetAllFormStates, closeModal]);

  // Reset form states whenever modal opens or payload changes to fix state leaks
  useEffect(() => {
    resetAllFormStates();

    // Pre-populate payload-dependent fields
    if ((modal.name === 'editPigment' || modal.name === 'editPrice') && modal.payload) {
      setEditName(modal.payload.name || '');
      setEditColor(modal.payload.color_code || '#888888');
      setEditFinish(modal.payload.finish_type || 'Mica Pearl');
      setEditPkg(modal.payload.default_pkg_cents !== undefined ? (modal.payload.default_pkg_cents / 100).toFixed(2) : '0.35');
      setEditRetail(modal.payload.retail_price_per_gram_cents ? (modal.payload.retail_price_per_gram_cents / 100).toFixed(2) : '');
      setEditWholesale(modal.payload.wholesale_price_per_gram_cents ? (modal.payload.wholesale_price_per_gram_cents / 100).toFixed(2) : '');
      setEditArchived(Boolean(modal.payload.is_archived));

      if (repo && modal.payload.pigment_id) {
        repo.getPriceTiersForPigment(modal.payload.pigment_id).then(tiers => {
          const initial = {};
          (tiers || []).forEach(t => {
            initial[t.weight_mg] = {
              retail: t.retail_price_cents !== null && t.retail_price_cents !== undefined ? (t.retail_price_cents / 100).toFixed(2) : '',
              wholesale: t.wholesale_price_cents !== null && t.wholesale_price_cents !== undefined ? (t.wholesale_price_cents / 100).toFixed(2) : ''
            };
          });
          setPresetTierInputs(initial);
        }).catch(console.error);
      }

      if (modal.payload.tier_pricing_json) {
        try {
          const parsed = typeof modal.payload.tier_pricing_json === 'string'
            ? JSON.parse(modal.payload.tier_pricing_json)
            : modal.payload.tier_pricing_json;
          if (Array.isArray(parsed)) {
            setEditTiers(parsed.map(t => ({
              min_weight_g: (t.min_weight_mg / 1000).toString(),
              retail_price_g: (t.retail_price_per_gram_cents / 100).toFixed(2),
              wholesale_price_g: (t.wholesale_price_per_gram_cents / 100).toFixed(2)
            })));
          } else {
            setEditTiers([]);
          }
        } catch (e) {
          setEditTiers([]);
        }
      } else {
        setEditTiers([]);
      }
    }


    if (modal.name === 'paySupplier' && modal.payload) {
      setPaySupplierAmt(modal.payload.current_balance_cents ? (modal.payload.current_balance_cents / 100).toFixed(2) : '');
      setPaySupplierType('CASH');
      setPaySupplierNotes('');
    }

    if (modal.name === 'settleTab' && modal.payload) {
      setSettleAmt(modal.payload.current_balance_cents ? (modal.payload.current_balance_cents / 100).toFixed(2) : '');
      setSettleType('CASH');
      setSettleProvider('Square');
    }

    if (modal.name === 'returnItem' && modal.payload?.saleItem) {
      setReturnWeight((modal.payload.saleItem.weight_mg / 1000).toFixed(1));
    }
  }, [modal.name, modal.payload, resetAllFormStates]);

  if (!modal.name) return null;

  if (modal.name === 'customWeight') {
    return <CustomWeightModal />;
  }

  if (modal.name === 'editCartItem') {
    return <EditCartItemModal />;
  }

  if (modal.name === 'editCartTotal') {
    return <EditCartTotalModal />;
  }

  const safeCart = cart || [];
  const totalAmountCents = safeCart.reduce((sum, item) => sum + (item.price_charged_cents || 0), 0);

  // Handlers
  const handleRestock = async () => {
    const weightG = parseFloat(restockWeight);
    const costD = parseFloat(restockCost);
    if (!weightG || weightG <= 0 || isNaN(costD) || costD < 0) {
      showToast('Invalid weight or cost input', 'error');
      return;
    }
    const paidDownD = parseFloat(restockPaidDown) || 0;
    const totalCostCents = Math.round(costD * 100);
    const paidDownCents = Math.round(paidDownD * 100);

    if (restockPaymentStatus === 'PARTIAL' && (paidDownCents <= 0 || paidDownCents >= totalCostCents)) {
      showToast('Partial down payment must be greater than $0 and less than total cost', 'error');
      return;
    }

    try {
      await repo.restockPigment(
        modal.payload.pigment_id,
        Math.round(weightG * 1000),
        totalCostCents,
        restockSupplier,
        restockPaymentStatus,
        restockSupplierId ? Number(restockSupplierId) : null,
        paidDownCents
      );
      await refreshAllData();
      handleClose();
      showToast('Restock recorded successfully!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleAddSupplier = async () => {
    if (!supplierNameInput || !supplierNameInput.trim()) {
      showToast('Supplier name is required', 'error');
      return;
    }
    try {
      await repo.createSupplier({
        name: supplierNameInput.trim(),
        phone_number: supplierPhoneInput.trim(),
        notes: supplierNotesInput.trim()
      });
      await refreshAllData();
      handleClose();
      showToast('Supplier added successfully', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handlePaySupplier = async () => {
    const amtD = parseFloat(paySupplierAmt);
    if (isNaN(amtD) || amtD <= 0) {
      showToast('Please enter a valid payment amount', 'error');
      return;
    }
    const sId = modal.payload?.supplier_id;
    if (!sId) {
      showToast('No supplier selected', 'error');
      return;
    }
    try {
      await repo.paySupplier(sId, Math.round(amtD * 100), paySupplierType, paySupplierNotes);
      await refreshAllData();
      handleClose();
      showToast('Supplier payment logged successfully', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleShrinkage = async () => {
    const weightG = parseFloat(shrinkageWeight);
    if (!weightG || weightG <= 0) {
      showToast('Invalid weight', 'error');
      return;
    }
    try {
      await repo.logShrinkage(modal.payload.pigment_id, Math.round(weightG * 1000), shrinkageReason);
      await refreshAllData();
      handleClose();
      showToast('Shrinkage logged', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleAddPigment = async () => {
    const stockG = parseFloat(pigmentStock || 0);
    const costD = parseFloat(pigmentCost || 0);
    const retailD = parseFloat(pigmentRetail || 0);
    const wholeD = parseFloat(pigmentWholesale || 0);
    const paidDownD = parseFloat(restockPaidDown || 0);

    if (!pigmentName || retailD <= 0 || wholeD <= 0) {
      showToast('Missing required fields', 'error');
      return;
    }

    const totalCostCents = Math.round(costD * 100);
    const paidDownCents = Math.round(paidDownD * 100);

    if (restockPaymentStatus === 'PARTIAL' && (paidDownCents <= 0 || paidDownCents >= totalCostCents)) {
      showToast('Partial down payment must be greater than $0 and less than total cost', 'error');
      return;
    }

    try {
      await repo.createPigment({
        name: pigmentName,
        color_code: pigmentColor,
        finish_type: pigmentFinish,
        stock_mg: Math.round(stockG * 1000),
        total_cost_cents: totalCostCents,
        retail_price_per_gram_cents: Math.round(retailD * 100),
        wholesale_price_per_gram_cents: Math.round(wholeD * 100),
        default_pkg_cents: 0,
        supplier_name: restockSupplier,
        supplier_id: restockSupplierId ? Number(restockSupplierId) : null,
        payment_status: restockPaymentStatus,
        paid_down_cents: paidDownCents
      });
      await refreshAllData();
      handleClose();
      showToast('Pigment created & initial stock purchase recorded!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const addEditTier = () => {
    setEditTiers(prev => [
      ...prev,
      { min_weight_g: '3.5', retail_price_g: editRetail || '4.00', wholesale_price_g: editWholesale || '3.00' }
    ]);
  };

  const updateEditTier = (index, field, value) => {
    setEditTiers(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeEditTier = (index) => {
    setEditTiers(prev => prev.filter((_, i) => i !== index));
  };

  const handleEditPigment = async () => {
    if (!editName.trim()) {
      showToast('Pigment name is required', 'error');
      return;
    }
    const retailD = parseFloat(editRetail);
    const wholeD = parseFloat(editWholesale);
    const pkgD = parseFloat(editPkg || '0');

    if (isNaN(retailD) || retailD <= 0 || isNaN(wholeD) || wholeD <= 0 || isNaN(pkgD) || pkgD < 0) {
      showToast('Please enter valid retail/wholesale prices (> 0) and packaging fee', 'error');
      return;
    }

    const formattedTiers = editTiers.map(t => {
      const wG = parseFloat(t.min_weight_g);
      const rD = parseFloat(t.retail_price_g);
      const wD = parseFloat(t.wholesale_price_g);
      if (isNaN(wG) || wG <= 0 || isNaN(rD) || rD <= 0 || isNaN(wD) || wD <= 0) return null;
      return {
        min_weight_mg: Math.round(wG * 1000),
        retail_price_per_gram_cents: Math.round(rD * 100),
        wholesale_price_per_gram_cents: Math.round(wD * 100)
      };
    }).filter(Boolean);

    try {
      await repo.updatePigmentDetails(modal.payload.pigment_id, {
        name: editName.trim(),
        color_code: editColor,
        finish_type: editFinish,
        default_pkg_cents: Math.round(pkgD * 100),
        retail_price_per_gram_cents: Math.round(retailD * 100),
        wholesale_price_per_gram_cents: Math.round(wholeD * 100),
        is_archived: editArchived,
        tier_pricing_json: formattedTiers.length > 0 ? JSON.stringify(formattedTiers) : null,
      });

      // Save fixed preset tier overrides
      for (const preset of PRESET_TIERS) {
        const input = presetTierInputs[preset.weight_mg] || {};
        const rD = parseFloat(input.retail);
        const wD = parseFloat(input.wholesale);
        const retailCents = (!isNaN(rD) && rD > 0) ? Math.round(rD * 100) : null;
        const wholesaleCents = (!isNaN(wD) && wD > 0) ? Math.round(wD * 100) : null;
        await repo.upsertPriceTier(modal.payload.pigment_id, preset.weight_mg, retailCents, wholesaleCents);
      }

      await refreshAllData();
      handleClose();
      showToast('Pigment updated successfully', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };



  const handleAddCustomer = async () => {
    const limitD = parseFloat(custLimit || 0);
    if (!custName) {
      showToast('Name is required', 'error');
      return;
    }
    try {
      await repo.createCustomer({
        name: custName,
        phone_number: custPhone,
        credit_limit_cents: Math.round(limitD * 100),
        trust_status: custStatus
      });
      await refreshAllData();
      handleClose();
      showToast('Customer created', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSettleTab = async () => {
    const amtD = parseFloat(settleAmt);
    if (!amtD || amtD <= 0) {
      showToast('Invalid amount', 'error');
      return;
    }
    try {
      await repo.settleTabPayment(modal.payload.customer_id, Math.round(amtD * 100), settleType, settleType === 'DIGITAL' ? settleProvider : null);
      await refreshAllData();
      handleClose();
      showToast('Payment applied successfully', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleVoidSale = async () => {
    if (!voidReason) {
      showToast('Reason required', 'error');
      return;
    }
    try {
      await repo.voidSale(modal.payload.sale_id, voidReason);
      await refreshAllData();
      handleClose();
      showToast('Sale voided', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleVoidStockReceipt = async () => {
    if (!voidReason) {
      showToast('Reason required', 'error');
      return;
    }
    try {
      await repo.voidStockReceipt(modal.payload.receipt_id, voidReason);
      await refreshAllData();
      handleClose();
      showToast('Stock receipt voided & inventory/balances reversed', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleUpdateRestockTerms = async () => {
    const paidDownD = parseFloat(restockPaidDown) || 0;
    const paidDownCents = Math.round(paidDownD * 100);
    const totalCostCents = modal.payload?.total_cost_cents || 0;

    if (restockPaymentStatus === 'PARTIAL' && (paidDownCents <= 0 || paidDownCents >= totalCostCents)) {
      showToast('Partial down payment must be greater than $0 and less than total cost', 'error');
      return;
    }

    try {
      await repo.updateRestockTerms(
        modal.payload.stock_receipt_id || modal.payload.receipt_id,
        restockPaymentStatus,
        paidDownCents
      );
      await refreshAllData();
      handleClose();
      showToast('Purchase terms updated & supplier tab rebalanced!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleClearInventory = async () => {
    try {
      if (clearInventoryMode === 'ZERO_STOCK') {
        await repo.resetAllInventoryStockAndCosts();
        showToast('All inventory stock weights & costs reset to 0', 'success');
      } else {
        await repo.clearAllInventoryCatalog();
        showToast('All pigment items & restock receipts cleared', 'success');
      }
      await refreshAllData();
      handleClose();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleCreateCustomerPrepayment = async () => {
    const wG = parseFloat(prepaymentWeightG || 0);
    const amtD = parseFloat(prepaymentAmountD || 0);

    if (!prepaymentCustomerId) {
      showToast('Please select a customer', 'error');
      return;
    }
    if (wG <= 0 && amtD <= 0) {
      showToast('Please enter weight owed or dollar credit amount', 'error');
      return;
    }

    const safePigments = pigments || [];
    const selPigment = safePigments.find(p => String(p.pigment_id) === String(prepaymentPigmentId));

    try {
      await repo.createCustomerPrepayment({
        customer_id: Number(prepaymentCustomerId),
        pigment_id: prepaymentPigmentId ? Number(prepaymentPigmentId) : null,
        pigment_name: selPigment ? selPigment.name : '',
        weight_mg: Math.round(wG * 1000),
        amount_cents: Math.round(amtD * 100),
        status: prepaymentStatus,
        notes: prepaymentNotes
      });
      await refreshAllData();
      handleClose();
      showToast('Customer prepayment / backorder recorded successfully!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleReturnItem = async () => {
    const w = parseFloat(returnWeight);
    if (!w || w <= 0 || !returnReason) {
      showToast('Invalid weight or missing reason', 'error');
      return;
    }
    try {
      await repo.processReturn(modal.payload.saleItem.sale_item_id, Math.round(w * 1000), returnReason, returnRestock);
      await refreshAllData();
      handleClose();
      showToast('Return processed', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleDigitalPayment = async () => {
    if (!digitalProvider) return;
    const feeCents = Math.round((totalAmountCents * 0.029) + 30);
    const customerId = selectedCustomer?.customer_id || null;
    const payments = [{ payment_type: 'DIGITAL', digital_provider: digitalProvider, amount_cents: totalAmountCents, merchant_fee_cents: feeCents }];

    try {
      await repo.completeSale(customerId, cart, payments, false);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedPigment(null);
      await refreshAllData();
      handleClose();
      showToast('Digital sale completed!', 'success');
    } catch (error) {
      showToast('Checkout failed: ' + error.message, 'error');
    }
  };

  const handleTabPayment = async () => {
    if (!selectedCustomer) {
      showToast('Please select a customer for house tab payment', 'error');
      return;
    }
    const customerId = selectedCustomer.customer_id;
    const payments = [];

    if (tabPayMode === 'FULL') {
      payments.push({
        payment_type: 'HOUSE_TAB',
        digital_provider: null,
        amount_cents: totalAmountCents,
        merchant_fee_cents: 0
      });
    } else {
      const paidNowCents = Math.round((parseFloat(tabPaidNowInput) || 0) * 100);
      if (paidNowCents < 0 || paidNowCents > totalAmountCents) {
        showToast('Paid now amount must be between $0.00 and transaction total', 'error');
        return;
      }
      const tabAmountCents = Math.max(0, totalAmountCents - paidNowCents);

      if (paidNowCents > 0) {
        if (tabPaidType === 'DIGITAL') {
          const feeCents = Math.round((paidNowCents * 0.029) + 30);
          payments.push({
            payment_type: 'DIGITAL',
            digital_provider: tabDigitalProvider,
            amount_cents: paidNowCents,
            merchant_fee_cents: feeCents
          });
        } else {
          payments.push({
            payment_type: 'CASH',
            digital_provider: null,
            amount_cents: paidNowCents,
            merchant_fee_cents: 0
          });
        }
      }

      if (tabAmountCents > 0) {
        payments.push({
          payment_type: 'HOUSE_TAB',
          digital_provider: null,
          amount_cents: tabAmountCents,
          merchant_fee_cents: 0
        });
      }
    }

    if (payments.length === 0) {
      showToast('No payment specified', 'error');
      return;
    }

    try {
      await repo.completeSale(customerId, cart, payments, isHandshakeOverride);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedPigment(null);
      await refreshAllData();
      handleClose();
      showToast('Sale completed & tab updated!', 'success');
    } catch (error) {
      showToast('Tab charge failed: ' + error.message, 'error');
    }
  };

  const handleSplitPayment = async () => {
    const cashD = parseFloat(splitCashInput) || 0;
    const digitalD = parseFloat(splitDigitalInput) || 0;
    const tabD = parseFloat(splitTabInput) || 0;

    const cashCents = Math.round(cashD * 100);
    const digitalCents = Math.round(digitalD * 100);
    const tabCents = Math.round(tabD * 100);

    const totalTenderedCents = cashCents + digitalCents + tabCents;

    if (totalTenderedCents !== totalAmountCents) {
      showToast(`Split total (${formatCents(totalTenderedCents)}) must equal sale total (${formatCents(totalAmountCents)})`, 'error');
      return;
    }

    if (tabCents > 0 && !selectedCustomer) {
      showToast('Please select a customer first for the house tab split portion', 'error');
      return;
    }

    const payments = [];
    if (cashCents > 0) {
      payments.push({ payment_type: 'CASH', digital_provider: null, amount_cents: cashCents, merchant_fee_cents: 0 });
    }
    if (digitalCents > 0) {
      const feeCents = Math.round((digitalCents * 0.029) + 30);
      payments.push({ payment_type: 'DIGITAL', digital_provider: splitDigitalProvider, amount_cents: digitalCents, merchant_fee_cents: feeCents });
    }
    if (tabCents > 0) {
      payments.push({ payment_type: 'HOUSE_TAB', digital_provider: null, amount_cents: tabCents, merchant_fee_cents: 0 });
    }

    const customerId = selectedCustomer?.customer_id || null;

    try {
      await repo.completeSale(customerId, cart, payments, isHandshakeOverride);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedPigment(null);
      await refreshAllData();
      handleClose();
      showToast('Split payment sale completed successfully!', 'success');
    } catch (error) {
      showToast('Split payment failed: ' + error.message, 'error');
    }
  };

  const modalKey = `${modal.name}_${modal.payload?.pigment_id || modal.payload?.customer_id || modal.payload?.sale_id || modal.payload?.saleItem?.sale_item_id || 'default'}`;

  // Payment Drawer Modal
  if (modal.name === 'paymentDrawer') {
    const feeCents = digitalProvider ? Math.round((totalAmountCents * 0.029) + 30) : 0;
    return (
      <div className="modal-overlay active" onClick={handleClose}>
        <div className="payment-drawer active" key={modalKey} onClick={e => e.stopPropagation()}>
          <div className="flex-between mb-md">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                Payment Total: {formatCents(totalAmountCents)}
              </h2>
              <button
                className="btn btn-ghost btn-sm text-primary"
                style={{ padding: '2px 6px', fontSize: '0.8rem', marginTop: '2px' }}
                onClick={() => { handleClose(); openModal('editCartTotal'); }}
              >
                ✏️ Edit Transaction Total
              </button>
            </div>
            <button className="modal-close" onClick={handleClose}>&times;</button>
          </div>

          <div className="payment-mode-tabs mb-md">
            {['digital', 'tab', 'split'].map(t => (
              <button
                key={t}
                className={`payment-mode-tab ${drawerTab === t ? 'active' : ''}`}
                onClick={() => setDrawerTab(t)}
              >
                {t === 'tab' ? 'HOUSE TAB & PARTIAL' : t.toUpperCase()}
              </button>
            ))}
          </div>

          {drawerTab === 'digital' && (
            <div>
              <div className="provider-chips">
                {['Square', 'Venmo', 'Zelle'].map(provider => (
                  <button
                    key={provider}
                    className={`chip ${digitalProvider === provider ? 'active' : ''}`}
                    onClick={() => setDigitalProvider(provider)}
                  >
                    {provider}
                  </button>
                ))}
              </div>

              <div className="merchant-fee-preview mb-md">
                {digitalProvider
                  ? `Estimated ${digitalProvider} Fee: ${formatCents(feeCents)} | Net Revenue: ${formatCents(totalAmountCents - feeCents)}`
                  : 'Select provider to see estimated fee (2.9% + $0.30)'}
              </div>

              <button
                className="btn btn-primary btn-block"
                onClick={handleDigitalPayment}
                disabled={!digitalProvider}
              >
                Charge Digital
              </button>
            </div>
          )}

          {drawerTab === 'tab' && (
            <div>
              {!selectedCustomer ? (
                <div className="card card-static p-md mb-md" style={{ border: '1px dashed var(--market-border)' }}>
                  <label className="form-label mb-xs">Select Customer for House Tab:</label>
                  <select
                    className="form-select"
                    value=""
                    onChange={e => {
                      const c = customers.find(cust => String(cust.customer_id) === String(e.target.value));
                      if (c) setSelectedCustomer(c);
                    }}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>
                        👤 {c.name} (Bal: {formatCents(c.current_balance_cents)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <div className="card card-static p-md mb-md">
                    <div className="flex-between mb-xs">
                      <h3 className="title-medium" style={{ margin: 0 }}>👤 {selectedCustomer.name}</h3>
                      <button
                        className="btn btn-ghost btn-sm text-muted"
                        onClick={() => setSelectedCustomer(null)}
                        style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                      >
                        Change Customer
                      </button>
                    </div>
                    <div className="flex-between body-small mb-xs">
                      <span>Current Tab Balance:</span> <strong>{formatCents(selectedCustomer.current_balance_cents)}</strong>
                    </div>
                    <div className="flex-between body-small mb-xs">
                      <span>Credit Limit:</span> <strong>{formatCents(selectedCustomer.credit_limit_cents)}</strong>
                    </div>
                  </div>

                  <div className="payment-mode-tabs mb-md" style={{ borderBottom: '1px solid var(--market-border)' }}>
                    <button
                      type="button"
                      className={`payment-mode-tab ${tabPayMode === 'FULL' ? 'active' : ''}`}
                      onClick={() => setTabPayMode('FULL')}
                    >
                      Put 100% on Tab
                    </button>
                    <button
                      type="button"
                      className={`payment-mode-tab ${tabPayMode === 'PARTIAL' ? 'active' : ''}`}
                      onClick={() => setTabPayMode('PARTIAL')}
                    >
                      Pay Part Now + Rest on Tab
                    </button>
                  </div>

                  {tabPayMode === 'PARTIAL' && (() => {
                    const totalD = totalAmountCents / 100;
                    const paidNowCents = tabPaidNowInput !== ''
                      ? Math.round((parseFloat(tabPaidNowInput) || 0) * 100)
                      : Math.max(0, totalAmountCents - Math.round((parseFloat(tabPuttingOnTabInput) || 0) * 100));

                    const tabAmountCents = tabPuttingOnTabInput !== ''
                      ? Math.round((parseFloat(tabPuttingOnTabInput) || 0) * 100)
                      : Math.max(0, totalAmountCents - paidNowCents);

                    const newBalanceCents = ((selectedCustomer && selectedCustomer.current_balance_cents) || 0) + tabAmountCents;
                    const isOverLimit = selectedCustomer ? newBalanceCents > (selectedCustomer.credit_limit_cents || 0) : false;

                    const handlePaidNowChange = (val) => {
                      setTabPaidNowInput(val);
                      const pD = parseFloat(val);
                      if (!isNaN(pD) && pD >= 0) {
                        const remainingTab = Math.max(0, totalD - pD);
                        setTabPuttingOnTabInput(remainingTab.toFixed(2));
                      }
                    };

                    const handlePuttingOnTabChange = (val) => {
                      setTabPuttingOnTabInput(val);
                      const tD = parseFloat(val);
                      if (!isNaN(tD) && tD >= 0) {
                        const remainingPaid = Math.max(0, totalD - tD);
                        setTabPaidNowInput(remainingPaid.toFixed(2));
                      }
                    };

                    return (
                      <div className="mb-md">
                        <div className="form-group mb-sm">
                          <label className="form-label">🏷️ 1. Total Price of Transaction ($)</label>
                          <div className="flex-center gap-xs">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-input"
                              value={(totalAmountCents / 100).toFixed(2)}
                              onChange={e => {
                                const newTot = parseFloat(e.target.value);
                                if (!isNaN(newTot) && newTot >= 0) {
                                  overrideCartTotal(Math.round(newTot * 100));
                                }
                              }}
                              style={{ fontWeight: 'bold', fontSize: '1.05rem' }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openModal('editCartTotal')}
                              style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            >
                              ✏️ Quick Round
                            </button>
                          </div>
                        </div>

                        <div className="form-group mb-sm">
                          <label className="form-label">💵 / 💳 2. What They Are Paying Now ($)</label>
                          <div className="flex-center gap-xs">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={(totalAmountCents / 100).toFixed(2)}
                              className="form-input"
                              placeholder="0.00"
                              value={tabPaidNowInput}
                              onChange={e => handlePaidNowChange(e.target.value)}
                              style={{ fontWeight: 'bold' }}
                            />
                            <div className="flex-center gap-xs">
                              <button
                                type="button"
                                className={`btn btn-sm ${tabPaidType === 'CASH' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTabPaidType('CASH')}
                              >
                                💵 Cash
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm ${tabPaidType === 'DIGITAL' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setTabPaidType('DIGITAL')}
                              >
                                💳 Digital
                              </button>
                            </div>
                          </div>
                        </div>

                        {tabPaidType === 'DIGITAL' && (
                          <div className="form-group mb-sm">
                            <label className="form-label">Digital Provider</label>
                            <select
                              className="form-select"
                              value={tabDigitalProvider}
                              onChange={e => setTabDigitalProvider(e.target.value)}
                            >
                              <option value="Square">Square</option>
                              <option value="Venmo">Venmo</option>
                              <option value="Zelle">Zelle</option>
                            </select>
                          </div>
                        )}

                        <div className="form-group mb-sm">
                          <label className="form-label">📑 3. What They Are Putting on House Tab ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={(totalAmountCents / 100).toFixed(2)}
                            className="form-input"
                            placeholder="0.00"
                            value={tabPuttingOnTabInput}
                            onChange={e => handlePuttingOnTabChange(e.target.value)}
                            style={{ fontWeight: 'bold', color: 'var(--market-warning)' }}
                          />
                        </div>

                        <div className="card card-static p-sm mb-sm" style={{ background: 'var(--market-surface-variant)' }}>
                          <div className="flex-between body-small mb-xs">
                            <span>Transaction Total:</span>
                            <strong>{formatCents(totalAmountCents)}</strong>
                          </div>
                          <div className="flex-between body-small mb-xs text-success">
                            <span>Paying Now ({tabPaidType}):</span>
                            <strong>-{formatCents(paidNowCents)}</strong>
                          </div>
                          <div className="flex-between body-small mb-xs text-warning">
                            <span>Putting on House Tab:</span>
                            <strong>+{formatCents(tabAmountCents)}</strong>
                          </div>
                          <div className={`flex-between body-small font-weight-bold ${isOverLimit ? 'text-error' : 'text-success'}`}>
                            <span>Customer New Tab Balance:</span>
                            <span>{formatCents(newBalanceCents)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {tabPayMode === 'FULL' && (() => {
                    const tabAmountCents = totalAmountCents;
                    const newBalanceCents = ((selectedCustomer && selectedCustomer.current_balance_cents) || 0) + tabAmountCents;
                    const isOverLimit = selectedCustomer ? newBalanceCents > (selectedCustomer.credit_limit_cents || 0) : false;

                    return (
                      <div className="card card-static p-sm mb-md" style={{ background: 'var(--market-surface-variant)' }}>
                        <div className="flex-between body-small mb-xs text-warning">
                          <span>Putting 100% on House Tab:</span>
                          <strong>+{formatCents(tabAmountCents)}</strong>
                        </div>
                        <div className={`flex-between body-small font-weight-bold ${isOverLimit ? 'text-error' : 'text-success'}`}>
                          <span>Customer New Tab Balance:</span>
                          <span>{formatCents(newBalanceCents)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="form-group mb-md">
                    <label className="flex-center gap-sm" style={{ justifyContent: 'flex-start', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isHandshakeOverride}
                        onChange={e => setIsHandshakeOverride(e.target.checked)}
                        style={{ width: '20px', height: '20px' }}
                      />
                      <span>Handshake Credit Override (Ignore limit rules)</span>
                    </label>
                  </div>

                  <button className="btn btn-warning btn-block" onClick={handleTabPayment}>
                    {tabPayMode === 'FULL'
                      ? `Charge ${formatCents(totalAmountCents)} to Tab`
                      : `Complete Sale (Pay ${formatCents(Math.round((parseFloat(tabPaidNowInput) || 0) * 100))} + Charge ${formatCents(Math.max(0, totalAmountCents - Math.round((parseFloat(tabPaidNowInput) || 0) * 100)))} to Tab)`}
                  </button>
                </div>
              )}
            </div>
          )}

          {drawerTab === 'split' && (() => {
            const cashC = Math.round((parseFloat(splitCashInput) || 0) * 100);
            const digitalC = Math.round((parseFloat(splitDigitalInput) || 0) * 100);
            const tabC = Math.round((parseFloat(splitTabInput) || 0) * 100);
            const tenderedTotal = cashC + digitalC + tabC;
            const diffC = totalAmountCents - tenderedTotal;

            return (
              <div>
                <p className="body-small text-muted mb-md">Divide the total amount across multiple tender types:</p>

                <div className="form-group mb-sm">
                  <label className="form-label">💵 Cash Portion ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={splitCashInput}
                    onChange={e => setSplitCashInput(e.target.value)}
                  />
                </div>

                <div className="form-group mb-sm">
                  <label className="form-label">💳 Digital Portion ($)</label>
                  <div className="flex-center gap-xs mb-xs">
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0.00"
                      value={splitDigitalInput}
                      onChange={e => setSplitDigitalInput(e.target.value)}
                    />
                    <select
                      className="form-select"
                      value={splitDigitalProvider}
                      onChange={e => setSplitDigitalProvider(e.target.value)}
                      style={{ width: '130px' }}
                    >
                      <option value="Square">Square</option>
                      <option value="Venmo">Venmo</option>
                      <option value="Zelle">Zelle</option>
                    </select>
                  </div>
                </div>

                <div className="form-group mb-md">
                  <label className="form-label">📑 House Tab Portion ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={splitTabInput}
                    onChange={e => setSplitTabInput(e.target.value)}
                    disabled={!selectedCustomer}
                  />
                  {!selectedCustomer && (
                    <div className="body-small text-muted mt-xs">Select a customer on checkout to split onto house tab.</div>
                  )}
                </div>

                <div className="card card-static p-sm mb-md" style={{ background: 'var(--market-surface-variant)' }}>
                  <div className="flex-between body-small mb-xs">
                    <span>Tendered Split Total:</span>
                    <strong>{formatCents(tenderedTotal)}</strong>
                  </div>
                  <div className="flex-between body-small font-weight-bold">
                    <span>Balance Remaining:</span>
                    <span className={diffC === 0 ? 'text-success' : 'text-error'}>
                      {diffC === 0 ? '✓ Balanced' : formatCents(diffC)}
                    </span>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-block"
                  onClick={handleSplitPayment}
                  disabled={diffC !== 0}
                >
                  Complete Split Sale ({formatCents(totalAmountCents)})
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay active" onClick={handleClose}>
      <div className="modal" key={modalKey} onClick={e => e.stopPropagation()}>
        
        {/* Customer Picker */}
        {modal.name === 'customerPicker' && (
          <div>
            <div className="modal-header">
              <h2>Select Customer</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body flex-col gap-sm" style={{ maxHeight: '400px' }}>
              <button
                className="btn btn-ghost btn-block text-left"
                onClick={() => { setSelectedCustomer(null); handleClose(); }}
                style={{ justifyContent: 'flex-start' }}
              >
                <strong>👤 Walk-in Customer</strong>
              </button>
              {customers.map(c => (
                <button
                  key={c.customer_id}
                  className="btn btn-ghost btn-block flex-between"
                  onClick={() => { setSelectedCustomer(c); handleClose(); }}
                >
                  <div className="text-left">
                    <strong>{c.name}</strong><br />
                    <small className="text-muted">{c.phone_number || c.phone || ''}</small>
                  </div>
                  <span className="body-medium text-muted">Bal: {formatCents(c.current_balance_cents)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Restock Pigment */}
        {modal.name === 'restock' && (
          <div>
            <div className="modal-header">
              <h2>Restock Pigment</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-md">Restocking: <strong>{modal.payload?.name}</strong></p>
              <div className="form-group">
                <label className="form-label">Weight Added (grams)</label>
                <input type="number" className="form-input" value={restockWeight} onChange={e => setRestockWeight(e.target.value)} step="0.1" min="0.1" placeholder="e.g. 50" />
              </div>
              <div className="form-group">
                <label className="form-label">Total Cost ($)</label>
                <input type="number" className="form-input" value={restockCost} onChange={e => setRestockCost(e.target.value)} step="0.01" min="0" placeholder="e.g. 45.00" />
              </div>
              <div className="form-group">
                <label className="form-label">Select Supplier</label>
                <select
                  className="form-select mb-xs"
                  value={restockSupplierId}
                  onChange={e => {
                    const id = e.target.value;
                    setRestockSupplierId(id);
                    const selected = suppliers.find(s => String(s.supplier_id) === String(id));
                    if (selected) setRestockSupplier(selected.name);
                  }}
                >
                  <option value="">-- Choose Existing Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>{s.name} (Bal: {formatCents(s.current_balance_cents)})</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Or enter new supplier name..."
                  value={restockSupplier}
                  onChange={e => setRestockSupplier(e.target.value)}
                />
              </div>
              <div className="form-group mb-sm">
                <label className="form-label">Payment Option</label>
                <select
                  className="form-select"
                  value={restockPaymentStatus}
                  onChange={e => setRestockPaymentStatus(e.target.value)}
                >
                  <option value="PAID">💵 Paid Immediately (Cash / Digital / Transfer)</option>
                  <option value="PARTIAL">💵 Partial Down Payment (Pay Down Now + Put Rest on Supplier Tab)</option>
                  <option value="UNPAID_TAB">📑 Add Entire Amount to Supplier Tab (Pay Later)</option>
                </select>
              </div>

              {restockPaymentStatus === 'PARTIAL' && (
                <div className="form-group mb-md">
                  <label className="form-label">Amount Paid Down Now ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={restockPaidDown}
                    onChange={e => setRestockPaidDown(e.target.value)}
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 30.00"
                  />
                  <div className="card card-static p-sm mt-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                    <div className="flex-between body-small mb-xs">
                      <span>Paid Down Now:</span>
                      <strong className="text-success">${(parseFloat(restockPaidDown) || 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex-between body-small font-weight-bold">
                      <span>Added to Supplier Tab (Owed):</span>
                      <strong className="text-error">
                        ${Math.max(0, (parseFloat(restockCost) || 0) - (parseFloat(restockPaidDown) || 0)).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRestock}>Confirm Restock</button>
            </div>
          </div>
        )}

        {/* Add Supplier Modal */}
        {modal.name === 'addSupplier' && (
          <div>
            <div className="modal-header">
              <h2>+ Add New Supplier</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Supplier / Vendor Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Pigments LLC"
                  value={supplierNameInput}
                  onChange={e => setSupplierNameInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. (555) 019-2831"
                  value={supplierPhoneInput}
                  onChange={e => setSupplierPhoneInput(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes / Terms (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Net 30, bulk mica pearl supplier"
                  value={supplierNotesInput}
                  onChange={e => setSupplierNotesInput(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddSupplier}>Create Supplier</button>
            </div>
          </div>
        )}

        {/* Pay Supplier Modal */}
        {modal.name === 'paySupplier' && (
          <div>
            <div className="modal-header">
              <h2>💵 Pay Supplier Balance</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-xs">Supplier: <strong>{modal.payload?.name}</strong></p>
              <p className="body-medium text-error mb-md">
                Current Debt Owed: <strong>{formatCents(modal.payload?.current_balance_cents || 0)}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Payment Amount ($)</label>
                <input
                  type="number"
                  className="form-input"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={paySupplierAmt}
                  onChange={e => setPaySupplierAmt(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-select"
                  value={paySupplierType}
                  onChange={e => setPaySupplierType(e.target.value)}
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="BANK_TRANSFER">🏛️ Bank Transfer / ACH</option>
                  <option value="DIGITAL">💳 Digital / Card</option>
                  <option value="CHECK">📜 Check</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Memo / Check # (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Inv #8921"
                  value={paySupplierNotes}
                  onChange={e => setPaySupplierNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-warning" onClick={handlePaySupplier}>Record Payment</button>
            </div>
          </div>
        )}

        {/* Shrinkage Log */}
        {modal.name === 'shrinkage' && (
          <div>
            <div className="modal-header">
              <h2>Log Shrinkage</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-md">Log Shrinkage for: <strong>{modal.payload?.name}</strong></p>
              <div className="form-group">
                <label className="form-label">Weight Lost (grams)</label>
                <input type="number" className="form-input" value={shrinkageWeight} onChange={e => setShrinkageWeight(e.target.value)} step="0.1" min="0.1" />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <select className="form-select" value={shrinkageReason} onChange={e => setShrinkageReason(e.target.value)}>
                  <option value="Spillage">Spillage</option>
                  <option value="Sample/Gift">Sample/Gift</option>
                  <option value="Container Residue">Container Residue</option>
                  <option value="Quality Defect">Quality Defect</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-warning" onClick={handleShrinkage}>Log Shrinkage</button>
            </div>
          </div>
        )}

        {/* Add Pigment */}
        {modal.name === 'addPigment' && (
          <div>
            <div className="modal-header">
              <h2>Add New Pigment</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <input type="text" className="form-input" placeholder="Pigment Name" value={pigmentName} onChange={e => setPigmentName(e.target.value)} />
              </div>
              <div className="form-group flex-center gap-sm mb-md" style={{ justifyContent: 'flex-start' }}>
                <input type="color" value={pigmentColor} onChange={e => setPigmentColor(e.target.value)} style={{ width: '40px', height: '40px', border: 'none' }} />
                <span>Color Hex</span>
              </div>
              <div className="form-group">
                <select className="form-select" value={pigmentFinish} onChange={e => setPigmentFinish(e.target.value)}>
                  <option value="Matte">Matte</option>
                  <option value="Metallic">Metallic</option>
                  <option value="Pearl">Pearl</option>
                  <option value="ColorShift">ColorShift</option>
                  <option value="Glow">Glow</option>
                </select>
              </div>
              <div className="form-group">
                <input type="number" className="form-input" placeholder="Initial Stock (g)" value={pigmentStock} onChange={e => setPigmentStock(e.target.value)} min="0" step="1" />
              </div>
              <div className="form-group mb-sm">
                <input type="number" className="form-input" placeholder="Initial Cost ($)" value={pigmentCost} onChange={e => setPigmentCost(e.target.value)} min="0" step="0.01" />
              </div>

              {/* Initial Purchase Supplier & Payment Terms */}
              <div className="form-group mb-sm">
                <label className="form-label">Supplier / Vendor (Optional)</label>
                <select
                  className="form-select mb-xs"
                  value={restockSupplierId}
                  onChange={e => {
                    const id = e.target.value;
                    setRestockSupplierId(id);
                    const selected = suppliers.find(s => String(s.supplier_id) === String(id));
                    if (selected) setRestockSupplier(selected.name);
                  }}
                >
                  <option value="">-- Choose Existing Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>{s.name} (Bal: {formatCents(s.current_balance_cents)})</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Or enter new supplier name..."
                  value={restockSupplier}
                  onChange={e => setRestockSupplier(e.target.value)}
                />
              </div>

              <div className="form-group mb-sm">
                <label className="form-label">Initial Purchase Payment Option</label>
                <select
                  className="form-select"
                  value={restockPaymentStatus}
                  onChange={e => setRestockPaymentStatus(e.target.value)}
                >
                  <option value="PAID">💵 Paid Immediately (Cash / Digital / Transfer)</option>
                  <option value="PARTIAL">💵 Partial Down Payment (Pay Down Now + Put Rest on Supplier Tab)</option>
                  <option value="UNPAID_TAB">📑 Add Entire Amount to Supplier Tab (Pay Later)</option>
                </select>
              </div>

              {restockPaymentStatus === 'PARTIAL' && (
                <div className="form-group mb-md">
                  <label className="form-label">Amount Paid Down Now ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={restockPaidDown}
                    onChange={e => setRestockPaidDown(e.target.value)}
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 30.00"
                  />
                  <div className="card card-static p-sm mt-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                    <div className="flex-between body-small mb-xs">
                      <span>Paid Down Now:</span>
                      <strong className="text-success">${(parseFloat(restockPaidDown) || 0).toFixed(2)}</strong>
                    </div>
                    <div className="flex-between body-small font-weight-bold">
                      <span>Added to Supplier Tab (Owed):</span>
                      <strong className="text-error">
                        ${Math.max(0, (parseFloat(pigmentCost) || 0) - (parseFloat(restockPaidDown) || 0)).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
              <div className="form-group">
                <input type="number" className="form-input" placeholder="Retail Price/g ($)" value={pigmentRetail} onChange={e => setPigmentRetail(e.target.value)} min="0" step="0.01" />
              </div>
              <div className="form-group">
                <input type="number" className="form-input" placeholder="Wholesale Price/g ($)" value={pigmentWholesale} onChange={e => setPigmentWholesale(e.target.value)} min="0" step="0.01" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddPigment}>Add Pigment</button>
            </div>
          </div>
        )}

        {/* Edit Pigment */}
        {(modal.name === 'editPigment' || modal.name === 'editPrice') && (
          <div>
            <div className="modal-header">
              <h2>Edit Pigment</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group mb-sm">
                <label className="form-label">Pigment Name</label>
                <input type="text" className="form-input" value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>

              <div className="grid-2col mb-sm">
                <div className="form-group">
                  <label className="form-label">Color Code (Hex)</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} style={{ width: '40px', height: '38px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                    <input type="text" className="form-input" value={editColor} onChange={e => setEditColor(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Finish Type</label>
                  <select className="form-select" value={editFinish} onChange={e => setEditFinish(e.target.value)}>
                    <option value="Mica Pearl">Mica Pearl</option>
                    <option value="Chameleon">Chameleon</option>
                    <option value="Metallic">Metallic</option>
                    <option value="Matte Powder">Matte Powder</option>
                    <option value="Satin">Satin</option>
                  </select>
                </div>
              </div>

              <div className="grid-2col mb-sm">
                <div className="form-group">
                  <label className="form-label">Retail Price/g ($)</label>
                  <input type="number" className="form-input" value={editRetail} onChange={e => setEditRetail(e.target.value)} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Wholesale Price/g ($)</label>
                  <input type="number" className="form-input" value={editWholesale} onChange={e => setEditWholesale(e.target.value)} step="0.01" min="0" />
                </div>
              </div>

              <div className="form-group mb-sm">
                <label className="form-label">Default Packaging Fee ($)</label>
                <input type="number" className="form-input" value={editPkg} onChange={e => setEditPkg(e.target.value)} step="0.01" min="0" />
              </div>

              {/* Weight-Tier Pricing Breaks */}
              <div className="form-group mb-sm" style={{ borderTop: '1px dashed var(--market-border)', paddingTop: '12px', marginTop: '12px' }}>
                <div className="flex-between mb-xs">
                  <label className="form-label" style={{ marginBottom: 0 }}>🏷️ Weight-Tier Pricing ($/g breaks)</label>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={addEditTier}>+ Add Tier</button>
                </div>
                <p className="label-small text-muted mb-xs" style={{ fontSize: '11px' }}>
                  Discounted $/g rate applied when customer weight meets or exceeds threshold.
                </p>

                {editTiers.length === 0 ? (
                  <div className="label-small text-muted" style={{ fontStyle: 'italic', padding: '4px 0' }}>
                    No weight tiers set (base price/g applies to all order sizes).
                  </div>
                ) : (
                  editTiers.map((tier, idx) => (
                    <div key={idx} className="flex-center gap-xs mb-xs" style={{ alignItems: 'flex-start', background: 'var(--market-surface-variant)', padding: '6px 8px', borderRadius: '4px' }}>
                      <div style={{ flex: '1' }}>
                        <label className="label-small text-muted" style={{ fontSize: '10px' }}>Min Weight (g)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          className="form-input"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={tier.min_weight_g}
                          onChange={e => updateEditTier(idx, 'min_weight_g', e.target.value)}
                        />
                      </div>
                      <div style={{ flex: '1' }}>
                        <label className="label-small text-muted" style={{ fontSize: '10px' }}>Retail $/g</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={tier.retail_price_g}
                          onChange={e => updateEditTier(idx, 'retail_price_g', e.target.value)}
                        />
                      </div>
                      <div style={{ flex: '1' }}>
                        <label className="label-small text-muted" style={{ fontSize: '10px' }}>Wholesale $/g</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="form-input"
                          style={{ padding: '4px 6px', fontSize: '12px' }}
                          value={tier.wholesale_price_g}
                          onChange={e => updateEditTier(idx, 'wholesale_price_g', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-error"
                        onClick={() => removeEditTier(idx)}
                        style={{ marginTop: '16px', padding: '4px 6px', fontSize: '14px' }}
                        title="Remove Tier"
                      >
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Fixed Preset Weight Tier Prices */}
              <div className="form-group mb-sm" style={{ borderTop: '1px dashed var(--market-border)', paddingTop: '12px', marginTop: '12px' }}>
                <label className="form-label mb-xs">🏷️ Fixed Preset Tier Prices (Optional Overrides)</label>
                <p className="label-small text-muted mb-sm" style={{ fontSize: '11px' }}>
                  Set a specific total dollar amount for preset weight buttons. Leave blank to use standard per-gram pricing.
                </p>

                <div style={{ display: 'grid', gap: '6px' }}>
                  {PRESET_TIERS.map(preset => {
                    const inputVal = presetTierInputs[preset.weight_mg] || { retail: '', wholesale: '' };
                    return (
                      <div key={preset.weight_mg} className="flex-center gap-xs" style={{ alignItems: 'center', background: 'var(--market-surface-variant)', padding: '5px 8px', borderRadius: '4px' }}>
                        <span className="body-small font-weight-bold" style={{ width: '65px', fontSize: '12px' }}>{preset.label}</span>
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Retail $"
                            className="form-input"
                            style={{ padding: '3px 6px', fontSize: '12px' }}
                            value={inputVal.retail || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setPresetTierInputs(prev => ({
                                ...prev,
                                [preset.weight_mg]: { ...(prev[preset.weight_mg] || {}), retail: val }
                              }));
                            }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Wholesale $"
                            className="form-input"
                            style={{ padding: '3px 6px', fontSize: '12px' }}
                            value={inputVal.wholesale || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setPresetTierInputs(prev => ({
                                ...prev,
                                [preset.weight_mg]: { ...(prev[preset.weight_mg] || {}), wholesale: val }
                              }));
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="form-group flex-center gap-sm" style={{ justifyContent: 'flex-start', marginTop: '12px' }}>
                <input type="checkbox" id="edit-archived" checked={editArchived} onChange={e => setEditArchived(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                <label htmlFor="edit-archived" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Archive pigment (hide from POS catalog)</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditPigment}>Save Changes</button>
            </div>
          </div>
        )}


        {/* Add Customer */}
        {modal.name === 'addCustomer' && (
          <div>
            <div className="modal-header">
              <h2>Add New Customer</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <input type="text" className="form-input" placeholder="Full Name" value={custName} onChange={e => setCustName(e.target.value)} />
              </div>
              <div className="form-group">
                <input type="text" className="form-input" placeholder="Phone Number" value={custPhone} onChange={e => setCustPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <input type="number" className="form-input" placeholder="Credit Limit ($)" value={custLimit} onChange={e => setCustLimit(e.target.value)} min="0" step="1" />
              </div>
              <div className="form-group">
                <select className="form-select" value={custStatus} onChange={e => setCustStatus(e.target.value)}>
                  <option value="GOOD_STANDING">Good Standing</option>
                  <option value="VIP">VIP</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddCustomer}>Add Customer</button>
            </div>
          </div>
        )}

        {/* Settle Tab */}
        {modal.name === 'settleTab' && (
          <div>
            <div className="modal-header">
              <h2>Settle Tab</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-md">Settle balance for <strong>{modal.payload?.name}</strong> (Owes: {formatCents(modal.payload?.current_balance_cents || 0)})</p>
              <div className="form-group">
                <label className="form-label">Payment Amount ($)</label>
                <input type="number" className="form-input" value={settleAmt} onChange={e => setSettleAmt(e.target.value)} step="0.01" min="0.01" max={(modal.payload?.current_balance_cents / 100).toFixed(2)} />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Type</label>
                <select className="form-select" value={settleType} onChange={e => setSettleType(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="DIGITAL">Digital</option>
                </select>
              </div>
              {settleType === 'DIGITAL' && (
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select className="form-select" value={settleProvider} onChange={e => setSettleProvider(e.target.value)}>
                    <option value="Square">Square</option>
                    <option value="Venmo">Venmo</option>
                    <option value="Zelle">Zelle</option>
                  </select>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-success" onClick={handleSettleTab}>Apply Payment</button>
            </div>
          </div>
        )}

        {/* Void Sale */}
        {modal.name === 'voidSale' && (
          <div>
            <div className="modal-header">
              <h2>Void Sale</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-md">Are you sure you want to void sale <strong>{String(modal.payload?.sale_id).substring(0, 8)}</strong>?</p>
              <div className="form-group">
                <input type="text" className="form-input" placeholder="Reason for voiding" value={voidReason} onChange={e => setVoidReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-danger" onClick={handleVoidSale}>Confirm Void</button>
            </div>
          </div>
        )}

        {/* Return Item */}
        {modal.name === 'returnItem' && (
          <div>
            <div className="modal-header">
              <h2>Return Item</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-sm">Returning: <strong>{modal.payload?.pigment?.name || 'Pigment Item'}</strong></p>
              <p className="body-medium text-muted mb-md">Purchased: {formatMgToGrams(modal.payload?.saleItem?.weight_mg || 0)}</p>
              <div className="form-group">
                <label className="form-label">Weight to Return (g)</label>
                <input type="number" className="form-input" value={returnWeight} onChange={e => setReturnWeight(e.target.value)} step="0.1" min="0.1" />
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <input type="text" className="form-input" value={returnReason} onChange={e => setReturnReason(e.target.value)} />
              </div>
              <div className="form-group flex-center gap-sm" style={{ justifyContent: 'flex-start' }}>
                <input type="checkbox" id="return-restock" checked={returnRestock} onChange={e => setReturnRestock(e.target.checked)} style={{ width: '20px', height: '20px' }} />
                <label htmlFor="return-restock">Restock into inventory</label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-warning" onClick={handleReturnItem}>Process Return</button>
            </div>
          </div>
        )}

        {/* Void Stock Receipt Modal */}
        {modal.name === 'voidStockReceipt' && (
          <div>
            <div className="modal-header">
              <h2>Void Restock Receipt</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-sm">
                Voiding Restock Receipt <strong>#{modal.payload?.receipt_id}</strong>
              </p>
              <div className="card card-static p-sm mb-md text-muted body-small" style={{ background: 'var(--market-surface-variant)' }}>
                <div>Weight Restocked: <strong>{formatMgToGrams(modal.payload?.received_mg || 0)}</strong></div>
                <div>Total Cost: <strong>{formatCents(modal.payload?.total_cost_cents || 0)}</strong></div>
                <div>Supplier: <strong>{modal.payload?.supplier_name || 'Direct Restock'}</strong></div>
              </div>
              <p className="body-small text-muted mb-sm">
                ⚠️ Voiding this receipt will deduct {formatMgToGrams(modal.payload?.received_mg || 0)} from inventory, adjust cost basis, and reverse any unpaid supplier tab balance.
              </p>
              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Reason for voiding (e.g. Entry Error, Wrong Weight)"
                  value={voidReason}
                  onChange={e => setVoidReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-danger" onClick={handleVoidStockReceipt}>Confirm Void & Reverse</button>
            </div>
          </div>
        )}

        {/* Clear Inventory Modal */}
        {modal.name === 'clearInventory' && (
          <div>
            <div className="modal-header">
              <h2>🧹 Clear Current Inventory</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-sm">
                Choose how you want to clear your inventory:
              </p>
              <div className="form-group mb-md" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label className="card card-static p-sm flex-between cursor-pointer" style={{ background: clearInventoryMode === 'ZERO_STOCK' ? 'var(--market-primary-light, rgba(59,130,246,0.15))' : 'var(--market-surface-variant)', border: clearInventoryMode === 'ZERO_STOCK' ? '1px solid var(--market-primary)' : '1px solid transparent', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="radio" name="clear-mode" value="ZERO_STOCK" checked={clearInventoryMode === 'ZERO_STOCK'} onChange={() => setClearInventoryMode('ZERO_STOCK')} />
                    <div>
                      <div className="body-medium font-weight-bold">Reset Stock Levels & Costs to 0</div>
                      <div className="body-small text-muted">Keeps pigment catalog names & pricing tiers intact, but resets all stock weights to 0.0g and total costs to $0.00.</div>
                    </div>
                  </div>
                </label>

                <label className="card card-static p-sm flex-between cursor-pointer" style={{ background: clearInventoryMode === 'WIPE_ALL' ? 'rgba(239, 68, 68, 0.15)' : 'var(--market-surface-variant)', border: clearInventoryMode === 'WIPE_ALL' ? '1px solid var(--market-error)' : '1px solid transparent', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input type="radio" name="clear-mode" value="WIPE_ALL" checked={clearInventoryMode === 'WIPE_ALL'} onChange={() => setClearInventoryMode('WIPE_ALL')} />
                    <div>
                      <div className="body-medium font-weight-bold text-error">Wipe All Pigment Items & History</div>
                      <div className="body-small text-muted">Completely deletes all pigments and stock receipt records from the database.</div>
                    </div>
                  </div>
                </label>
              </div>

              <div className="card p-sm body-small text-muted" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                ⚠️ Warning: Clearing inventory is immediate. You can export a database JSON backup from Settings first if needed.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className={`btn ${clearInventoryMode === 'WIPE_ALL' ? 'btn-danger' : 'btn-warning'}`} onClick={handleClearInventory}>
                Confirm Clear Inventory
              </button>
            </div>
          </div>
        )}

        {/* Record Customer Prepayment / Backorder Modal */}
        {modal.name === 'addCustomerPrepayment' && (
          <div>
            <div className="modal-header">
              <h2>📦 Record Customer Prepayment / Backorder</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group mb-sm">
                <label className="form-label">Customer *</label>
                <select
                  className="form-select"
                  value={prepaymentCustomerId}
                  onChange={e => setPrepaymentCustomerId(e.target.value)}
                >
                  <option value="">-- Select Customer --</option>
                  {(customers || []).map(c => (
                    <option key={c.customer_id} value={c.customer_id}>{c.name} ({c.phone_number || 'No phone'})</option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-sm">
                <label className="form-label">Pigment Owed / Backordered (Optional)</label>
                <select
                  className="form-select"
                  value={prepaymentPigmentId}
                  onChange={e => setPrepaymentPigmentId(e.target.value)}
                >
                  <option value="">-- Store Credit / General Delivery --</option>
                  {(pigments || []).map(p => (
                    <option key={p.pigment_id} value={p.pigment_id}>{p.name} ({p.finish_type})</option>
                  ))}
                </select>
              </div>

              <div className="grid-2col mb-sm">
                <div className="form-group">
                  <label className="form-label">Weight Owed to Customer (g)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 25.0"
                    value={prepaymentWeightG}
                    onChange={e => setPrepaymentWeightG(e.target.value)}
                    step="0.1"
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Dollar Credit / Paid ($)</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="e.g. 100.00"
                    value={prepaymentAmountD}
                    onChange={e => setPrepaymentAmountD(e.target.value)}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group mb-sm">
                <label className="form-label">Fulfillment Status</label>
                <select
                  className="form-select"
                  value={prepaymentStatus}
                  onChange={e => setPrepaymentStatus(e.target.value)}
                >
                  <option value="PENDING_DELIVERY">🚚 Pending Delivery / Prepaid</option>
                  <option value="AWAITING_STOCK">⏳ Awaiting Backordered Stock</option>
                  <option value="STORE_CREDIT">💵 Customer Store Credit</option>
                </select>
              </div>

              <div className="form-group mb-sm">
                <label className="form-label">Notes / Instructions (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Prepaid $100 cash, awaiting 25g Gold Pearl shipment"
                  value={prepaymentNotes}
                  onChange={e => setPrepaymentNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateCustomerPrepayment}>Record Prepayment</button>
            </div>
          </div>
        )}

        {/* Edit Restock Terms Modal */}
        {modal.name === 'editRestockTerms' && modal.payload && (() => {
          const totalCostCents = modal.payload.total_cost_cents || 0;
          const paidDownD = parseFloat(restockPaidDown) || 0;
          const paidDownCents = Math.round(paidDownD * 100);
          const newUnpaidTabCents = restockPaymentStatus === 'PAID'
            ? 0
            : Math.max(0, totalCostCents - paidDownCents);

          const oldUnpaidTabCents = modal.payload.unpaid_tab_cents !== undefined
            ? modal.payload.unpaid_tab_cents
            : (modal.payload.payment_status === 'UNPAID_TAB' ? totalCostCents : 0);

          const diffCents = newUnpaidTabCents - oldUnpaidTabCents;

          return (
            <div>
              <div className="modal-header">
                <h2>✏️ Edit Purchase Terms</h2>
                <button className="modal-close" onClick={handleClose}>&times;</button>
              </div>
              <div className="modal-body">
                <p className="body-medium mb-sm">Editing Receipt <strong>#{modal.payload.stock_receipt_id || modal.payload.receipt_id}</strong></p>
                <div className="card card-static p-sm mb-md text-muted body-small" style={{ background: 'var(--market-surface-variant)' }}>
                  <div>Supplier: <strong>{modal.payload.supplier_name || 'Direct Restock'}</strong></div>
                  <div>Total Cost: <strong>{formatCents(totalCostCents)}</strong></div>
                </div>

                <div className="form-group mb-sm">
                  <label className="form-label">Payment Terms</label>
                  <select
                    className="form-select"
                    value={restockPaymentStatus}
                    onChange={e => setRestockPaymentStatus(e.target.value)}
                  >
                    <option value="PAID">💵 Paid Immediately (Paid in Full)</option>
                    <option value="PARTIAL">💵 Partial Down Payment (Pay Down Now + Tab Rest)</option>
                    <option value="UNPAID_TAB">📑 Add Entire Amount to Supplier Tab (Pay Later)</option>
                  </select>
                </div>

                {restockPaymentStatus === 'PARTIAL' && (
                  <div className="form-group mb-md">
                    <label className="form-label">Amount Paid Down ($)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={restockPaidDown}
                      onChange={e => setRestockPaidDown(e.target.value)}
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 30.00"
                    />
                  </div>
                )}

                <div className="card card-static p-sm mb-md" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                  <div className="flex-between body-small mb-xs">
                    <span>New Tab Owed:</span>
                    <strong className={newUnpaidTabCents > 0 ? 'text-error' : 'text-success'}>
                      {formatCents(newUnpaidTabCents)}
                    </strong>
                  </div>
                  <div className="flex-between body-small font-weight-bold">
                    <span>Supplier Balance Impact:</span>
                    <span className={diffCents > 0 ? 'text-error' : diffCents < 0 ? 'text-success' : 'text-muted'}>
                      {diffCents > 0 ? `+${formatCents(diffCents)} (Owe More)` : diffCents < 0 ? `-${formatCents(Math.abs(diffCents))} (Owe Less)` : 'No Change'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleUpdateRestockTerms}>Update Terms</button>
              </div>
            </div>
          );
        })()}

        {/* Backup / Restore Modal */}
        {modal.name === 'backupRestore' && (
          <BackupRestoreModal />
        )}

        {/* Printable Receipt Modal */}
        {modal.name === 'receiptModal' && modal.payload && (() => {
          const sale = modal.payload.sale || {};
          const items = modal.payload.items || [];
          const payments = modal.payload.payments || [];
          const customer = modal.payload.customer;

          return (
            <div>
              <div className="modal-header text-center" style={{ display: 'block' }}>
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 4px 0' }}>⚖️ MICRO SALER POS</h2>
                <div className="body-small text-muted">Official Transaction Receipt</div>
                <div className="body-small text-muted">{new Date(sale.created_at || sale.timestamp || Date.now()).toLocaleString()}</div>
                <div className="body-small text-muted">Receipt ID: {sale.sale_id}</div>
              </div>

              <div className="modal-body" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {customer && (
                  <div className="p-xs mb-sm body-small" style={{ background: 'var(--market-surface-variant)', borderRadius: '4px' }}>
                    <strong>Customer:</strong> {customer.name} {customer.phone_number ? `(${customer.phone_number})` : ''}
                  </div>
                )}

                <table style={{ width: '100%', fontSize: '0.85rem', marginBottom: '12px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed var(--market-border)', textAlign: 'left' }}>
                      <th style={{ paddingBottom: '6px' }}>Item</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Weight</th>
                      <th style={{ textAlign: 'right', paddingBottom: '6px' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
                        <td style={{ padding: '6px 0' }}>{item.pigment_name || `Pigment #${item.pigment_id}`}</td>
                        <td style={{ textAlign: 'right' }}>{formatMgToGrams(item.weight_mg)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCents(item.price_charged_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                  <div className="flex-between font-weight-bold title-medium mb-xs">
                    <span>Total Paid:</span>
                    <span className="text-success">{formatCents(sale.total_amount_cents)}</span>
                  </div>
                  {payments.map((p, i) => (
                    <div key={i} className="flex-between body-small text-muted">
                      <span>{p.payment_type} {p.digital_provider ? `(${p.digital_provider})` : ''}</span>
                      <span>{formatCents(p.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer flex-between">
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  🖨️ Print Receipt
                </button>
                <button className="btn btn-primary" onClick={handleClose}>
                  Done
                </button>
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
};

