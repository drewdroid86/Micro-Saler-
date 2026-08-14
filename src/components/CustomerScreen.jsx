import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams, calculateCustomerBalance } from '../repository';

export const CustomerScreen = () => {
  const { customers, customerPrepayments, repo, openModal, refreshAllData, showToast } = usePos();
  const safeCustomers = customers || [];
  const safePrepayments = customerPrepayments || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'DEBT' | 'CREDIT' | 'PREPAY' | 'ZERO'
  const [customerTypeFilter, setCustomerTypeFilter] = useState('ALL'); // 'ALL' | 'RETAIL' | 'WHOLESALE'
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerLedger, setSelectedCustomerLedger] = useState([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);

  const handleFulfill = async (prepaymentId) => {
    try {
      await repo.fulfillCustomerPrepayment(prepaymentId);
      await refreshAllData();
      showToast('Prepayment marked as delivered / fulfilled!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Calculate high-level summary KPIs
  const customerMetrics = useMemo(() => {
    let totalDebtCents = 0;
    let debtCustomerCount = 0;
    let totalStoreCreditCents = 0;
    let creditCustomerCount = 0;
    let zeroBalanceCount = 0;
    let wholesaleCustomerCount = 0;
    let retailCustomerCount = 0;

    safeCustomers.forEach(c => {
      const balInfo = calculateCustomerBalance(c, safePrepayments);
      if (balInfo.isWholesale) {
        wholesaleCustomerCount += 1;
      } else {
        retailCustomerCount += 1;
      }

      if (balInfo.hasDebt) {
        totalDebtCents += balInfo.debtCents;
        debtCustomerCount += 1;
      } else if (balInfo.hasStoreCredit) {
        totalStoreCreditCents += balInfo.storeCreditCents;
        creditCustomerCount += 1;
      } else {
        zeroBalanceCount += 1;
      }
    });

    const activePrepayments = safePrepayments.filter(p => p.status !== 'FULFILLED');
    const totalPrepaymentCreditCents = activePrepayments.reduce((sum, p) => sum + (Number(p.amount_cents) || 0), 0);
    const totalPrepaymentWeightMg = activePrepayments.reduce((sum, p) => sum + (Number(p.weight_mg) || 0), 0);
    const prepayCustomerIds = new Set(activePrepayments.map(p => Number(p.customer_id)));

    const netPositionCents = totalStoreCreditCents + totalPrepaymentCreditCents - totalDebtCents;

    return {
      totalDebtCents,
      debtCustomerCount,
      totalStoreCreditCents,
      creditCustomerCount,
      zeroBalanceCount,
      wholesaleCustomerCount,
      retailCustomerCount,
      activePrepaymentsCount: activePrepayments.length,
      prepayCustomerCount: prepayCustomerIds.size,
      totalPrepaymentCreditCents,
      totalPrepaymentWeightMg,
      netPositionCents,
      totalCustomers: safeCustomers.length
    };
  }, [safeCustomers, safePrepayments]);

  // Filter customers by search term, balance category, and customer type
  const filteredCustomers = useMemo(() => {
    return safeCustomers.filter(c => {
      const balInfo = calculateCustomerBalance(c, safePrepayments);

      // 1. Customer Type filter
      if (customerTypeFilter === 'RETAIL' && balInfo.isWholesale) return false;
      if (customerTypeFilter === 'WHOLESALE' && !balInfo.isWholesale) return false;

      // 2. Financial Balance filter
      if (activeFilter === 'DEBT' && !balInfo.hasDebt) return false;
      if (activeFilter === 'CREDIT' && !balInfo.hasStoreCredit) return false;
      if (activeFilter === 'PREPAY') {
        const hasActivePrepay = safePrepayments.some(
          p => Number(p.customer_id) === Number(c.customer_id) && p.status !== 'FULFILLED'
        );
        if (!hasActivePrepay) return false;
      }
      if (activeFilter === 'ZERO' && (balInfo.hasDebt || balInfo.hasStoreCredit)) return false;

      // 3. Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const phoneMatch = (c.phone_number || c.phone || '').toLowerCase().includes(q);
        const notesMatch = (c.notes || '').toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !notesMatch) return false;
      }

      return true;
    });
  }, [safeCustomers, safePrepayments, searchQuery, activeFilter, customerTypeFilter]);

  // Automatically ensure a valid selected customer in the split-pane
  const selectedCustomer = useMemo(() => {
    if (selectedCustomerId) {
      const found = filteredCustomers.find(c => Number(c.customer_id) === Number(selectedCustomerId));
      if (found) return found;
      const foundInAll = safeCustomers.find(c => Number(c.customer_id) === Number(selectedCustomerId));
      if (foundInAll) return foundInAll;
    }
    return filteredCustomers[0] || null;
  }, [selectedCustomerId, filteredCustomers, safeCustomers]);

  // Load ledger for selected customer
  useEffect(() => {
    if (selectedCustomer && repo) {
      setIsLoadingLedger(true);
      repo.getCustomerLedger(selectedCustomer.customer_id)
        .then(entries => {
          setSelectedCustomerLedger(entries || []);
        })
        .catch(() => setSelectedCustomerLedger([]))
        .finally(() => setIsLoadingLedger(false));
    } else {
      setSelectedCustomerLedger([]);
    }
  }, [selectedCustomer?.customer_id, repo]);

  const selectedCustomerBalInfo = useMemo(() => {
    if (!selectedCustomer) return null;
    return calculateCustomerBalance(selectedCustomer, safePrepayments);
  }, [selectedCustomer, safePrepayments]);

  const selectedCustomerActivePrepayments = useMemo(() => {
    if (!selectedCustomer) return [];
    return safePrepayments.filter(
      p => Number(p.customer_id) === Number(selectedCustomer.customer_id) && p.status !== 'FULFILLED'
    );
  }, [selectedCustomer, safePrepayments]);

  return (
    <div className="customer-screen-container">
      {/* Section Header */}
      <div className="section-header mb-md">
        <div>
          <h2 className="section-title">👥 CUSTOMER ACCOUNTS & BALANCES</h2>
          <p className="body-small text-muted">Track customer house tabs, store credits, retail vs wholesale accounts, and prepaid backorders.</p>
        </div>
        <div className="flex-center gap-xs">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => openModal('HELP', { section: 'customer-balances' })}
            title="Open Customer Balances & Credit Guide"
          >
            ❓ Customer Guide
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('addCustomerPrepayment')}>
            📦 + Record Prepayment
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addCustomer')}>
            + New Customer
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      <div className="grid-4col mb-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-error)' }}>
          <div className="label-small text-muted">TOTAL HOUSE TAB DEBT</div>
          <div className="title-medium text-error mt-xs">{formatCents(customerMetrics.totalDebtCents)}</div>
          <div className="body-small text-muted">{customerMetrics.debtCustomerCount} customer(s) owe money</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-success)' }}>
          <div className="label-small text-muted">STORE CREDIT HELD</div>
          <div className="title-medium text-success mt-xs">+{formatCents(customerMetrics.totalStoreCreditCents)}</div>
          <div className="body-small text-muted">{customerMetrics.creditCustomerCount} customer(s) with credit</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-primary)' }}>
          <div className="label-small text-muted">ACTIVE PREPAYMENTS</div>
          <div className="title-medium text-primary mt-xs">{customerMetrics.activePrepaymentsCount} Orders</div>
          <div className="body-small text-muted">
            {formatMgToGrams(customerMetrics.totalPrepaymentWeightMg)} ({formatCents(customerMetrics.totalPrepaymentCreditCents)})
          </div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-border)' }}>
          <div className="label-small text-muted">TOTAL ACCOUNTS</div>
          <div className="title-medium mt-xs">{customerMetrics.totalCustomers} Accounts</div>
          <div className="body-small text-muted">{customerMetrics.retailCustomerCount} Retail • {customerMetrics.wholesaleCustomerCount} Wholesale</div>
        </div>
      </div>

      {/* Account Type Toggle & Search Toolbar */}
      <div className="card p-sm mb-md flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search customers by name, phone, or notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* Wholesale vs Retail Filter Toggle */}
        <div className="flex-center gap-xs" style={{ background: 'var(--market-surface-variant)', padding: '4px', borderRadius: '6px' }}>
          {[
            { id: 'ALL', label: `All (${customerMetrics.totalCustomers})` },
            { id: 'RETAIL', label: `🏪 Retail (${customerMetrics.retailCustomerCount})` },
            { id: 'WHOLESALE', label: `🏷️ Wholesale (${customerMetrics.wholesaleCustomerCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-sm ${customerTypeFilter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setCustomerTypeFilter(tab.id)}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Financial Balance Filter Tabs */}
        <div className="flex-center gap-xs" style={{ flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveFilter('ALL')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            All Balances
          </button>
          <button
            className={`btn btn-sm ${activeFilter === 'DEBT' ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => setActiveFilter('DEBT')}
            title="Customers with outstanding house tab debt"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            🔴 Debt ({customerMetrics.debtCustomerCount})
          </button>
          <button
            className={`btn btn-sm ${activeFilter === 'CREDIT' ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => setActiveFilter('CREDIT')}
            title="Customers with store credit available"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            🟢 Credit ({customerMetrics.creditCustomerCount})
          </button>
          <button
            className={`btn btn-sm ${activeFilter === 'PREPAY' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setActiveFilter('PREPAY')}
            title="Customers with pending prepayments / backorders"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            📦 Prepay ({customerMetrics.prepayCustomerCount})
          </button>
          <button
            className={`btn btn-sm ${activeFilter === 'ZERO' ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setActiveFilter('ZERO')}
            title="Customers with settled zero balance"
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            ⚪ Settled ({customerMetrics.zeroBalanceCount})
          </button>
        </div>
      </div>

      {/* Responsive Split-Pane Layout */}
      {filteredCustomers.length === 0 ? (
        <div className="card text-center p-xl mb-lg">
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👤</div>
          <div className="title-medium mb-xs">No matching customers found</div>
          <p className="body-small text-muted mb-md">
            {searchQuery ? `No customer records matching "${searchQuery}" under filter.` : 'No customers in this category.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addCustomer', { name: searchQuery })}>
            + Add New Customer
          </button>
        </div>
      ) : (
        <div className="split-pane-layout mb-lg">
          {/* Left Panel: Customer Directory Cards */}
          <div className="split-pane-list-panel">
            <div className="body-small text-muted px-xs flex-between">
              <span>Showing {filteredCustomers.length} customer(s)</span>
              <span>Tap to inspect & manage</span>
            </div>

            {filteredCustomers.map(c => {
              const balInfo = calculateCustomerBalance(c, safePrepayments);
              const isSelected = selectedCustomer && Number(selectedCustomer.customer_id) === Number(c.customer_id);
              const badgeClass = c.trust_status === 'VIP'
                ? 'badge-vip'
                : c.trust_status === 'PAUSED'
                ? 'badge-paused'
                : 'badge-good-standing';

              const activePrepayCount = safePrepayments.filter(
                p => Number(p.customer_id) === Number(c.customer_id) && p.status !== 'FULFILLED'
              ).length;

              return (
                <div
                  key={c.customer_id}
                  className={`card split-pane-selectable-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedCustomerId(c.customer_id)}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex-between mb-xs">
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <strong className="body-large" style={{ color: isSelected ? 'var(--market-primary)' : 'inherit' }}>
                        {c.name}
                      </strong>
                      {balInfo.isWholesale ? (
                        <span className="badge badge-vip" style={{ fontSize: '9px', padding: '1px 5px' }}>🏷️ Wholesale</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '9px', padding: '1px 5px' }}>🏪 Retail</span>
                      )}
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                        {c.trust_status || 'GOOD_STANDING'}
                      </span>
                    </div>

                    {/* Financial balance status chip */}
                    <div>
                      {balInfo.hasDebt ? (
                        <span className="badge badge-danger" style={{ fontSize: '11px', fontWeight: 'bold' }}>
                          🔴 -{formatCents(balInfo.debtCents)}
                        </span>
                      ) : balInfo.hasStoreCredit ? (
                        <span className="badge badge-completed" style={{ fontSize: '11px', fontWeight: 'bold' }}>
                          🟢 +{formatCents(balInfo.storeCreditCents)}
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '11px' }}>
                          ⚪ $0.00
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-between body-small text-muted">
                    <span>{c.phone_number || c.phone || 'No phone recorded'}</span>
                    {activePrepayCount > 0 && (
                      <span className="text-primary font-weight-bold" style={{ fontSize: '11px' }}>
                        📦 {activePrepayCount} backorder(s)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Panel: Sticky Customer Detail Inspector */}
          <div className="split-pane-detail-panel">
            {selectedCustomer && selectedCustomerBalInfo ? (
              <>
                {/* Inspector Header */}
                <div className="flex-between border-bottom pb-sm">
                  <div>
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <h3 className="title-large" style={{ margin: 0 }}>{selectedCustomer.name}</h3>
                      {selectedCustomerBalInfo.isWholesale ? (
                        <span className="badge badge-vip" style={{ fontSize: '10px' }}>🏷️ Wholesale Account</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '10px' }}>🏪 Retail Account</span>
                      )}
                      <span
                        className={`badge ${
                          selectedCustomer.trust_status === 'VIP'
                            ? 'badge-vip'
                            : selectedCustomer.trust_status === 'PAUSED'
                            ? 'badge-paused'
                            : 'badge-good-standing'
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {selectedCustomer.trust_status || 'GOOD_STANDING'}
                      </span>
                    </div>
                    <div className="body-small text-muted mt-xs">
                      📞 {selectedCustomer.phone_number || selectedCustomer.phone || 'No phone number'} &bull; Customer #{selectedCustomer.customer_id}
                    </div>
                    {selectedCustomer.notes && (
                      <div className="body-small text-muted font-italic mt-xs">
                        📝 {selectedCustomer.notes}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openModal('editCustomer', selectedCustomer)}
                    title="Edit Customer Profile, Type & Credit Limit"
                  >
                    ✏️ Edit Profile
                  </button>
                </div>

                {/* Financial Balance Summary Card */}
                <div
                  className="p-md"
                  style={{
                    background: selectedCustomerBalInfo.hasDebt
                      ? 'rgba(239, 68, 68, 0.08)'
                      : selectedCustomerBalInfo.hasStoreCredit
                      ? 'rgba(34, 197, 94, 0.08)'
                      : 'var(--market-surface-variant)',
                    borderRadius: '8px',
                    border: `1px solid ${
                      selectedCustomerBalInfo.hasDebt
                        ? 'rgba(239, 68, 68, 0.25)'
                        : selectedCustomerBalInfo.hasStoreCredit
                        ? 'rgba(34, 197, 94, 0.25)'
                        : 'var(--market-border-light)'
                    }`
                  }}
                >
                  <div className="flex-between mb-xs">
                    <span className="label-small text-muted" style={{ fontWeight: 700 }}>
                      {selectedCustomerBalInfo.hasDebt
                        ? '🔴 HOUSE TAB DEBT (OWES YOU)'
                        : selectedCustomerBalInfo.hasStoreCredit
                        ? '🟢 POSITIVE STORE CREDIT (YOU OWE GOODS)'
                        : '⚪ ACCOUNT SETTLED (ZERO BALANCE)'}
                    </span>
                    <span
                      className={`title-large ${
                        selectedCustomerBalInfo.hasDebt
                          ? 'text-error'
                          : selectedCustomerBalInfo.hasStoreCredit
                          ? 'text-success'
                          : ''
                      }`}
                    >
                      {selectedCustomerBalInfo.hasDebt
                        ? `-${formatCents(selectedCustomerBalInfo.debtCents)} (Owed)`
                        : selectedCustomerBalInfo.hasStoreCredit
                        ? `+${formatCents(selectedCustomerBalInfo.storeCreditCents)} (Credit)`
                        : '$0.00 (Settled)'}
                    </span>
                  </div>

                  <div className="flex-between body-small text-muted mt-sm pt-xs border-top">
                    <span>
                      Credit Limit: <strong>{selectedCustomerBalInfo.creditLimitCents > 0 ? formatCents(selectedCustomerBalInfo.creditLimitCents) : 'Standard ($25.00)'}</strong>
                    </span>
                    {selectedCustomerBalInfo.hasDebt && selectedCustomerBalInfo.availableCreditCents !== undefined && (
                      <span>
                        Available Tab: <strong className={selectedCustomerBalInfo.availableCreditCents <= 0 ? 'text-error' : 'text-primary'}>
                          {formatCents(Math.max(0, selectedCustomerBalInfo.availableCreditCents))}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>

                {/* Primary Quick Action Buttons */}
                <div className="grid-2col gap-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => openModal('settleTab', selectedCustomer)}
                    title="Log a payment against customer's balance independent of a sale"
                  >
                    💵 Record Payment
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openModal('adjustCustomerBalance', selectedCustomer)}
                    title="Issue Store Credit, Charge Debt, or Adjust Balance"
                  >
                    💳 Adjust Balance
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openModal('addCustomerPrepayment', { customer_id: selectedCustomer.customer_id })}
                    title="Record an upfront payment for pending stock delivery"
                  >
                    📦 + Prepayment
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => openModal('customerLedger', selectedCustomer)}
                    title="View Complete Immutable Balance & Transaction Ledger"
                  >
                    📜 Full Ledger
                  </button>
                </div>

                {/* Active Prepayments for this customer (if any) */}
                {selectedCustomerActivePrepayments.length > 0 && (
                  <div className="card p-sm" style={{ background: 'rgba(56, 107, 31, 0.1)', borderColor: 'rgba(56, 107, 31, 0.3)' }}>
                    <div className="label-small text-success font-weight-bold mb-xs">
                      📦 PENDING PREPAID ORDERS ({selectedCustomerActivePrepayments.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedCustomerActivePrepayments.map(p => (
                        <div key={p.prepayment_id} className="flex-between p-xs" style={{ background: 'var(--market-surface)', borderRadius: '4px' }}>
                          <div>
                            <div className="body-small font-weight-bold">
                              {p.pigment_name || 'General Stock'} — {p.weight_mg > 0 ? formatMgToGrams(p.weight_mg) : ''} {p.amount_cents > 0 ? `(${formatCents(p.amount_cents)} Paid)` : ''}
                            </div>
                            <div className="label-small text-muted">
                              Status: {p.status || 'PENDING_DELIVERY'} &bull; {new Date(p.created_at || Date.now()).toLocaleDateString()}
                            </div>
                          </div>
                          <button
                            className="btn btn-success btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            onClick={() => handleFulfill(p.prepayment_id)}
                            title="Mark this customer order as delivered"
                          >
                            ✅ Deliver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Recent Ledger Feed */}
                <div className="card p-sm">
                  <div className="flex-between mb-xs">
                    <div className="label-small text-muted font-weight-bold">RECENT LEDGER TRANSACTIONS</div>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => openModal('customerLedger', selectedCustomer)}
                    >
                      View All &rarr;
                    </button>
                  </div>

                  {isLoadingLedger ? (
                    <div className="text-center p-sm text-muted body-small">Loading ledger entries...</div>
                  ) : selectedCustomerLedger.length === 0 ? (
                    <div className="text-center p-sm text-muted body-small font-italic">No ledger transactions recorded yet.</div>
                  ) : (
                    <div className="help-table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      <table className="help-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th className="text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCustomerLedger.slice(0, 6).map((entry, idx) => {
                            const amt = Number(entry.amount_cents) || 0;
                            const isPos = amt > 0;
                            const isNeg = amt < 0;
                            return (
                              <tr key={entry.ledger_id || idx}>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  {new Date(entry.created_at || entry.timestamp || Date.now()).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                                </td>
                                <td>
                                  <span className="badge badge-secondary" style={{ fontSize: '9px', padding: '1px 4px' }}>
                                    {entry.type || 'TX'}
                                  </span>
                                </td>
                                <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.description}>
                                  {entry.description || 'Transaction'}
                                </td>
                                <td className={`text-right font-weight-bold ${isPos ? 'text-success' : isNeg ? 'text-error' : ''}`}>
                                  {isPos ? `+${formatCents(amt)}` : isNeg ? `-${formatCents(Math.abs(amt))}` : '$0.00'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-xl text-muted">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👈</div>
                <div className="title-medium mb-xs">Select a Customer</div>
                <p className="body-small text-muted">Click any customer on the left to inspect full balances, ledger, and quick actions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prepaid Deliveries & Backordered Stock Ledger */}
      <div className="card mt-lg">
        <div className="card-header border-bottom pb-sm mb-md flex-between">
          <div>
            <h3 className="title-medium">📦 Complete Customer Prepayments & Backordered Stock Ledger</h3>
            <p className="body-small text-muted" style={{ margin: 0 }}>Active orders and stock owed to customers across all accounts.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('addCustomerPrepayment')}>
            + Record Prepayment
          </button>
        </div>

        {safePrepayments.length === 0 ? (
          <div className="text-center p-md text-muted">No prepaid deliveries or backorders recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {safePrepayments.map(p => {
              const customer = safeCustomers.find(c => Number(c.customer_id) === Number(p.customer_id));
              const isFulfilled = p.status === 'FULFILLED';
              const statusBadgeClass = p.status === 'FULFILLED'
                ? 'badge-good-standing'
                : p.status === 'AWAITING_STOCK'
                ? 'badge-paused'
                : 'badge-vip';

              return (
                <div key={p.prepayment_id} className="flex-between p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px', opacity: isFulfilled ? 0.6 : 1 }}>
                  <div>
                    <div className="body-medium font-weight-bold">
                      {customer ? customer.name : `Customer #${p.customer_id}`} — {p.pigment_name ? p.pigment_name : 'General Credit'}
                    </div>
                    <div className="body-small text-muted">
                      {p.weight_mg > 0 ? `Weight Owed: ${formatMgToGrams(p.weight_mg)} • ` : ''}
                      {p.amount_cents > 0 ? `Paid Credit: ${formatCents(p.amount_cents)} • ` : ''}
                      Date: {new Date(p.created_at || Date.now()).toLocaleDateString()}
                    </div>
                    {p.notes && (
                      <div className="body-small text-muted font-italic mt-xs">
                        Note: {p.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex-center gap-sm">
                    <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '10px' }}>
                      {p.status || 'PENDING_DELIVERY'}
                    </span>
                    {!isFulfilled && (
                      <button className="btn btn-success btn-sm" onClick={() => handleFulfill(p.prepayment_id)}>
                        ✅ Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
