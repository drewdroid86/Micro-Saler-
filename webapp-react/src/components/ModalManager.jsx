import React, { useState, useEffect, useCallback } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';
import { CustomWeightModal } from './modals/CustomWeightModal';

export const ModalManager = () => {
  const {
    modal,
    closeModal,
    customers,
    selectedCustomer,
    setSelectedCustomer,
    cart,
    setCart,
    setSelectedPigment,
    isHandshakeOverride,
    setIsHandshakeOverride,
    repo,
    refreshAllData,
    showToast
  } = usePos();

  // Local form states
  const [restockWeight, setRestockWeight] = useState('');
  const [restockCost, setRestockCost] = useState('');
  const [restockSupplier, setRestockSupplier] = useState('');

  const [shrinkageWeight, setShrinkageWeight] = useState('');
  const [shrinkageReason, setShrinkageReason] = useState('Spillage');

  const [pigmentName, setPigmentName] = useState('');
  const [pigmentColor, setPigmentColor] = useState('#000000');
  const [pigmentFinish, setPigmentFinish] = useState('Matte');
  const [pigmentStock, setPigmentStock] = useState('');
  const [pigmentCost, setPigmentCost] = useState('');
  const [pigmentRetail, setPigmentRetail] = useState('');
  const [pigmentWholesale, setPigmentWholesale] = useState('');

  const [editRetail, setEditRetail] = useState('');
  const [editWholesale, setEditWholesale] = useState('');

  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custLimit, setCustLimit] = useState('');
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

  const resetAllFormStates = useCallback(() => {
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

    setEditRetail('');
    setEditWholesale('');

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
    if (modal.name === 'editPrice' && modal.payload) {
      setEditRetail(modal.payload.retail_price_per_gram_cents ? (modal.payload.retail_price_per_gram_cents / 100).toFixed(2) : '');
      setEditWholesale(modal.payload.wholesale_price_per_gram_cents ? (modal.payload.wholesale_price_per_gram_cents / 100).toFixed(2) : '');
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

  const totalAmountCents = cart.reduce((sum, item) => sum + item.price_charged_cents, 0);

  // Handlers
  const handleRestock = async () => {
    const weightG = parseFloat(restockWeight);
    const costD = parseFloat(restockCost);
    if (!weightG || weightG <= 0 || isNaN(costD) || costD < 0) {
      showToast('Invalid input', 'error');
      return;
    }
    try {
      await repo.restockPigment(modal.payload.pigment_id, Math.round(weightG * 1000), Math.round(costD * 100), restockSupplier);
      await refreshAllData();
      handleClose();
      showToast('Restock successful', 'success');
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

    if (!pigmentName || retailD <= 0 || wholeD <= 0) {
      showToast('Missing required fields', 'error');
      return;
    }

    try {
      await repo.createPigment({
        name: pigmentName,
        color_code: pigmentColor,
        finish_type: pigmentFinish,
        stock_mg: Math.round(stockG * 1000),
        total_cost_cents: Math.round(costD * 100),
        retail_price_per_gram_cents: Math.round(retailD * 100),
        wholesale_price_per_gram_cents: Math.round(wholeD * 100),
        default_pkg_cents: 0
      });
      await refreshAllData();
      handleClose();
      showToast('Pigment created', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleEditPrice = async () => {
    const retailD = parseFloat(editRetail);
    const wholeD = parseFloat(editWholesale);
    if (isNaN(retailD) || retailD <= 0 || isNaN(wholeD) || wholeD <= 0) {
      showToast('Invalid prices', 'error');
      return;
    }
    try {
      await repo.updatePigmentPricing(modal.payload.pigment_id, Math.round(retailD * 100), Math.round(wholeD * 100));
      await refreshAllData();
      handleClose();
      showToast('Prices updated', 'success');
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
    if (!selectedCustomer) return;
    const customerId = selectedCustomer.customer_id;
    const payments = [{ payment_type: 'HOUSE_TAB', digital_provider: null, amount_cents: totalAmountCents, merchant_fee_cents: 0 }];

    try {
      await repo.completeSale(customerId, cart, payments, isHandshakeOverride);
      setCart([]);
      setSelectedCustomer(null);
      setSelectedPigment(null);
      await refreshAllData();
      handleClose();
      showToast('Charged to house tab!', 'success');
    } catch (error) {
      showToast('Tab charge failed: ' + error.message, 'error');
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
            <h2>Payment: {formatCents(totalAmountCents)}</h2>
            <button className="modal-close" onClick={handleClose}>&times;</button>
          </div>

          <div className="payment-mode-tabs mb-md">
            {['digital', 'tab', 'split'].map(t => (
              <button
                key={t}
                className={`payment-mode-tab ${drawerTab === t ? 'active' : ''}`}
                onClick={() => setDrawerTab(t)}
              >
                {t === 'tab' ? 'HOUSE TAB' : t.toUpperCase()}
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
                <div className="text-center text-error p-md">Please select a customer first.</div>
              ) : (
                <div>
                  <div className="card card-static p-md mb-md">
                    <h3 className="title-medium mb-sm">{selectedCustomer.name}</h3>
                    <div className="flex-between body-medium mb-xs">
                      <span>Current Balance:</span> <strong>{formatCents(selectedCustomer.current_balance_cents)}</strong>
                    </div>
                    <div className="flex-between body-medium mb-xs">
                      <span>Credit Limit:</span> <strong>{formatCents(selectedCustomer.credit_limit_cents)}</strong>
                    </div>
                    <div className={`flex-between body-medium ${selectedCustomer.current_balance_cents + totalAmountCents > selectedCustomer.credit_limit_cents ? 'text-error' : 'text-success'}`}>
                      <span>New Balance:</span> <strong>{formatCents(selectedCustomer.current_balance_cents + totalAmountCents)}</strong>
                    </div>
                  </div>

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
                    Charge to Tab
                  </button>
                </div>
              )}
            </div>
          )}

          {drawerTab === 'split' && (
            <div className="text-center p-md">
              <p className="body-medium mb-md">Split payments feature is currently simplified for this demo.</p>
              <button className="btn btn-secondary" onClick={() => { handleClose(); showToast('Split payment coming soon!', 'success'); }}>
                Acknowledge
              </button>
            </div>
          )}
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
                <input type="number" className="form-input" value={restockWeight} onChange={e => setRestockWeight(e.target.value)} step="0.1" min="0.1" />
              </div>
              <div className="form-group">
                <label className="form-label">Total Cost ($)</label>
                <input type="number" className="form-input" value={restockCost} onChange={e => setRestockCost(e.target.value)} step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier Notes</label>
                <input type="text" className="form-input" value={restockSupplier} onChange={e => setRestockSupplier(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRestock}>Confirm Restock</button>
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
              <div className="form-group">
                <input type="number" className="form-input" placeholder="Initial Cost ($)" value={pigmentCost} onChange={e => setPigmentCost(e.target.value)} min="0" step="0.01" />
              </div>
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

        {/* Edit Price */}
        {modal.name === 'editPrice' && (
          <div>
            <div className="modal-header">
              <h2>Edit Price</h2>
              <button className="modal-close" onClick={handleClose}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="body-medium mb-md">Edit Pricing: <strong>{modal.payload?.name}</strong></p>
              <div className="form-group">
                <label className="form-label">Retail Price/g ($)</label>
                <input type="number" className="form-input" value={editRetail} onChange={e => setEditRetail(e.target.value)} placeholder={modal.payload?.retail_price_per_gram_cents ? (modal.payload.retail_price_per_gram_cents / 100).toFixed(2) : '0.00'} step="0.01" min="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Wholesale Price/g ($)</label>
                <input type="number" className="form-input" value={editWholesale} onChange={e => setEditWholesale(e.target.value)} placeholder={modal.payload?.wholesale_price_per_gram_cents ? (modal.payload.wholesale_price_per_gram_cents / 100).toFixed(2) : '0.00'} step="0.01" min="0" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditPrice}>Save Prices</button>
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

      </div>
    </div>
  );
};
