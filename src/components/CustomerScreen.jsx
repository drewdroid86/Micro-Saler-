import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams, calculateCustomerBalance } from '../repository';

export const CustomerScreen = () => {
  const { customers, customerPrepayments, repo, openModal, refreshAllData, showToast } = usePos();
  const safeCustomers = customers || [];
  const safePrepayments = customerPrepayments || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'DEBT' | 'CREDIT' | 'PREPAY' | 'ZERO'
  const [customerTypeFilter, setCustomerTypeFilter] = useState('ALL'); // 'ALL' | 'RETAIL' | 'WHOLESALE'

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

  // Filtered and searched customer list
  const filteredCustomers = useMemo(() => {
    return safeCustomers.filter(c => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone_number && c.phone_number.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const balInfo = calculateCustomerBalance(c, safePrepayments);

      if (customerTypeFilter === 'WHOLESALE' && !balInfo.isWholesale) return false;
      if (customerTypeFilter === 'RETAIL' && balInfo.isWholesale) return false;

      if (activeFilter === 'DEBT') return balInfo.hasDebt;
      if (activeFilter === 'CREDIT') return balInfo.hasStoreCredit;
      if (activeFilter === 'PREPAY') return balInfo.hasPrepayments;
      if (activeFilter === 'ZERO') return balInfo.currentBalanceCents === 0 && !balInfo.hasPrepayments;
      return true; // 'ALL'
    });
  }, [safeCustomers, safePrepayments, searchQuery, activeFilter, customerTypeFilter]);

  return (
    <div className="customer-screen-container">
      {/* Section Header */}
      <div className="section-header mb-md">
        <div>
          <h2 className="section-title">👥 CUSTOMER ACCOUNTS & BALANCES</h2>
          <p className="body-small text-muted">Track customer house tabs, store credits, retail vs wholesale accounts, and prepaid backorders.</p>
        </div>
        <div className="flex-center gap-xs">
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('addCustomerPrepayment')}>
            📦 + Prepaid / Backorder
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addCustomer')}>
            + New Customer
          </button>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid-4col mb-md" style={{ gap: '12px' }}>
        {/* Receivables / Debt Owed */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid var(--market-error)' }}>
          <div className="flex-between body-small text-muted mb-xs">
            <span>🔴 RECEIVABLES (DEBT)</span>
            <span className="badge badge-paused" style={{ fontSize: '10px' }}>{customerMetrics.debtCustomerCount} accounts</span>
          </div>
          <div className="title-large text-error" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {formatCents(customerMetrics.totalDebtCents)}
          </div>
          <div className="body-small text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
            Unpaid House Tabs owed to store
          </div>
        </div>

        {/* Store Credit Held */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid var(--market-green-primary)' }}>
          <div className="flex-between body-small text-muted mb-xs">
            <span>🟢 STORE CREDIT</span>
            <span className="badge badge-good-standing" style={{ fontSize: '10px' }}>{customerMetrics.creditCustomerCount} accounts</span>
          </div>
          <div className="title-large text-success" style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {formatCents(customerMetrics.totalStoreCreditCents)}
          </div>
          <div className="body-small text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
            Customer balances & overpayments
          </div>
        </div>

        {/* Prepaid Orders & Backorders */}
        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #f57c00' }}>
          <div className="flex-between body-small text-muted mb-xs">
            <span>📦 PENDING PREPAYMENTS</span>
            <span className="badge badge-vip" style={{ fontSize: '10px' }}>{customerMetrics.activePrepaymentsCount} orders</span>
          </div>
          <div className="title-large" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f57c00' }}>
            {formatCents(customerMetrics.totalPrepaymentCreditCents)}
          </div>
          <div className="body-small text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
            {customerMetrics.totalPrepaymentWeightMg > 0 ? `${formatMgToGrams(customerMetrics.totalPrepaymentWeightMg)} weight owed` : 'Prepaid goods & credit'}
          </div>
        </div>

        {/* Net Customer Position */}
        <div className="card" style={{ padding: '14px', borderLeft: `4px solid ${customerMetrics.netPositionCents >= 0 ? 'var(--market-primary)' : 'var(--market-warning)'}` }}>
          <div className="flex-between body-small text-muted mb-xs">
            <span>⚖️ ACCOUNTS SPLIT</span>
            <span className="label-small text-muted">{customerMetrics.totalCustomers} total</span>
          </div>
          <div className="flex-center gap-xs mt-xs mb-xs" style={{ justifyContent: 'flex-start' }}>
            <span className="badge badge-secondary" style={{ fontSize: '12px', padding: '3px 8px' }}>
              🏪 {customerMetrics.retailCustomerCount} Retail
            </span>
            <span className="badge badge-vip" style={{ fontSize: '12px', padding: '3px 8px' }}>
              🏷️ {customerMetrics.wholesaleCustomerCount} Wholesale
            </span>
          </div>
          <div className="body-small text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
            Net Ledger: {customerMetrics.netPositionCents >= 0 ? `+${formatCents(customerMetrics.netPositionCents)}` : formatCents(customerMetrics.netPositionCents)}
          </div>
        </div>
      </div>

      {/* Account Type Toggle & Search Toolbar */}
      <div className="card p-sm mb-md flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '200px' }}>
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

      {/* Customer Cards Grid */}
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
        <div className="grid-2col mb-lg">
          {filteredCustomers.map(c => {
            const balInfo = calculateCustomerBalance(c, safePrepayments);
            const badgeClass = c.trust_status === 'VIP'
              ? 'badge-vip'
              : c.trust_status === 'PAUSED'
              ? 'badge-paused'
              : 'badge-good-standing';

            const activePrepayments = safePrepayments.filter(
              p => Number(p.customer_id) === Number(c.customer_id) && p.status !== 'FULFILLED'
            );

            return (
              <div key={c.customer_id} className="customer-card">
                {/* Header */}
                <div className="customer-card-header">
                  <div>
                    <div className="customer-name flex-center gap-xs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <span>{c.name}</span>
                      {balInfo.isWholesale ? (
                        <span className="badge badge-vip" style={{ fontSize: '10px' }}>🏷️ Wholesale</span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '10px' }}>🏪 Retail</span>
                      )}
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '10px' }}>{c.trust_status || 'GOOD_STANDING'}</span>
                    </div>
                    <div className="customer-phone">{c.phone_number || c.phone || 'No phone recorded'}</div>
                  </div>
                  <div className="flex-center gap-xs">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => openModal('editCustomer', c)}
                      title="Edit Customer Details & Credit Limit"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                      onClick={() => openModal('customerLedger', c)}
                      title="View Complete Balance & Transaction Ledger"
                    >
                      📜 Ledger
                    </button>
                  </div>
                </div>

                {/* Balance & Debt Breakdown Box */}
                <div
                  className="p-sm"
                  style={{
                    background: balInfo.hasDebt
                      ? 'rgba(239, 68, 68, 0.08)'
                      : balInfo.hasStoreCredit
                      ? 'rgba(34, 197, 94, 0.08)'
                      : 'var(--market-surface-variant)',
                    borderRadius: '8px',
                    border: `1px solid ${
                      balInfo.hasDebt
                        ? 'rgba(239, 68, 68, 0.25)'
                        : balInfo.hasStoreCredit
                        ? 'rgba(34, 197, 94, 0.25)'
                        : 'var(--market-border-light)'
                    }`
                  }}
                >
                  {/* Status Headline */}
                  <div className="flex-between mb-xs">
                    <span className="body-small text-muted" style={{ fontWeight: 600 }}>
                      {balInfo.hasDebt ? '🔴 OWES MONEY (DEBT)' : balInfo.hasStoreCredit ? '🟢 PREPAID / STORE CREDIT' : '⚪ ACCOUNT SETTLED'}
                    </span>
                    <span className={`body-medium font-weight-bold ${balInfo.hasDebt ? 'text-error' : balInfo.hasStoreCredit ? 'text-success' : ''}`}>
                      {balInfo.hasDebt
                        ? `-${formatCents(balInfo.debtCents)} (Owed)`
                        : balInfo.hasStoreCredit
                        ? `+${formatCents(balInfo.storeCreditCents)} (Credit)`
                        : '$0.00 (Settled)'}
                    </span>
                  </div>

                  <div className="flex-between body-small text-muted mb-xs" style={{ fontSize: '12px' }}>
                    <span>Account Balance: <strong className={balInfo.hasDebt ? 'text-error' : balInfo.hasStoreCredit ? 'text-success' : ''}>{balInfo.formattedBalance}</strong></span>
                    {balInfo.creditLimitCents > 0 && (
                      <span>Limit: <strong>{formatCents(balInfo.creditLimitCents)}</strong></span>
                    )}
                  </div>
                </div>

                {/* Active Prepayments / Backorders Section */}
                {(balInfo.prepaidWeightMg > 0 || balInfo.prepaidCreditCents > 0) && (
                  <div className="p-xs body-small flex-between" style={{ background: 'rgba(56, 107, 31, 0.12)', borderRadius: '6px', alignItems: 'center', border: '1px solid rgba(56, 107, 31, 0.3)' }}>
                    <div>
                      <div className="font-weight-bold text-success">
                        📦 Prepayments: {balInfo.prepaidWeightMg > 0 ? formatMgToGrams(balInfo.prepaidWeightMg) : ''} {balInfo.prepaidCreditCents > 0 ? `(${formatCents(balInfo.prepaidCreditCents)} Paid)` : ''}
                      </div>
                      <div className="text-muted font-italic" style={{ fontSize: '11px' }}>
                        {activePrepayments.length} order(s) pending delivery
                      </div>
                    </div>
                    <button
                      className="btn btn-success btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      onClick={async () => {
                        for (const p of activePrepayments) {
                          await handleFulfill(p.prepayment_id);
                        }
                      }}
                      title="Mark all pending prepayments for this customer as delivered"
                    >
                      ✅ Deliver
                    </button>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex-center gap-xs mt-xs" style={{ width: '100%' }}>
                  <button
                    className="btn btn-success btn-sm flex-1"
                    style={{ flex: 1 }}
                    onClick={() => openModal('settleTab', c)}
                    title="Log a payment against customer's balance independent of a sale"
                  >
                    💵 Record Payment
                  </button>
                  <button
                    className="btn btn-secondary btn-sm flex-1"
                    style={{ flex: 1 }}
                    onClick={() => openModal('adjustCustomerBalance', c)}
                    title="Issue Store Credit, Charge Debt, or Adjust Balance"
                  >
                    💳 Adjust Balance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Prepaid Deliveries & Backordered Stock Ledger */}
      <div className="card mt-lg">
        <div className="card-header border-bottom pb-sm mb-md flex-between">
          <div>
            <h3 className="title-medium">📦 Customer Prepayments & Backordered Stock Ledger</h3>
            <p className="body-small text-muted" style={{ margin: 0 }}>Active orders and stock owed to customers.</p>
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
