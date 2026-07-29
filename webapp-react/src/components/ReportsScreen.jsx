import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const ReportsScreen = () => {
  const {
    sales,
    saleItems,
    customers,
    suppliers,
    shrinkageLogs,
    pigments,
    openModal
  } = usePos();

  const [timeRange, setTimeRange] = useState('ALL'); // 'TODAY', 'WEEK', 'MONTH', 'YTD', 'ALL'

  // Filter timestamp bounds based on timeRange
  const filterTimestamp = useMemo(() => {
    const now = new Date();
    if (timeRange === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return startOfDay;
    }
    if (timeRange === 'WEEK') {
      const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
      return sevenDaysAgo;
    }
    if (timeRange === 'MONTH') {
      const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
      return thirtyDaysAgo;
    }
    if (timeRange === 'YTD') {
      const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
      return startOfYear;
    }
    return 0; // ALL
  }, [timeRange]);

  // Compute P&L Metrics
  const metrics = useMemo(() => {
    const safeSales = sales || [];
    const safeShrinkageLogs = shrinkageLogs || [];
    const safeCustomers = customers || [];
    const safeSuppliers = suppliers || [];
    const safePigments = pigments || [];

    const filteredSales = safeSales.filter(s => (s.created_at || 0) >= filterTimestamp);
    const completedSales = filteredSales.filter(s => s.status === 'COMPLETED');
    const voidedSales = filteredSales.filter(s => s.status === 'VOIDED');

    // Gross Revenue
    const grossRevenueCents = completedSales.reduce((sum, s) => sum + (s.total_amount_cents || 0), 0);

    // COGS
    const totalCogsCents = completedSales.reduce((sum, s) => sum + (s.total_cogs_cents || 0), 0);

    // Gross Profit
    const grossProfitCents = grossRevenueCents - totalCogsCents;
    const grossMarginPct = grossRevenueCents > 0 ? Math.round((grossProfitCents / grossRevenueCents) * 100) : 0;

    // Shrinkage Loss in selected period
    const filteredShrinkage = safeShrinkageLogs.filter(log => (log.created_at || 0) >= filterTimestamp);
    const shrinkageLossCents = filteredShrinkage.reduce((sum, log) => sum + (log.cogs_loss_cents || 0), 0);

    // Estimated Merchant Fees (~2.9% + 30c on digital portion)
    const estimatedMerchantFeesCents = completedSales.reduce((sum, s) => {
      // Rough estimate of 1.5% across transactions
      return sum + Math.round((s.total_amount_cents || 0) * 0.015);
    }, 0);

    // Net Profit
    const netProfitCents = grossProfitCents - shrinkageLossCents - estimatedMerchantFeesCents;
    const netMarginPct = grossRevenueCents > 0 ? Math.round((netProfitCents / grossRevenueCents) * 100) : 0;

    // Accounts Receivable (Who Owes Me) - Customers with balance > 0
    const arCustomers = safeCustomers.filter(c => (c.current_balance_cents || 0) > 0);
    const totalArCents = arCustomers.reduce((sum, c) => sum + (c.current_balance_cents || 0), 0);

    // Accounts Payable (What I Owe) - Suppliers with balance > 0
    const apSuppliers = safeSuppliers.filter(s => (s.current_balance_cents || 0) > 0);
    const totalApCents = apSuppliers.reduce((sum, s) => sum + (s.current_balance_cents || 0), 0);

    // Inventory Valuation
    const totalInventoryMg = safePigments.reduce((sum, p) => sum + (p.stock_mg || 0), 0);
    const totalCostBasisCents = safePigments.reduce((sum, p) => sum + (p.total_cost_cents || 0), 0);
    const totalRetailValueCents = safePigments.reduce((sum, p) => {
      const g = (p.stock_mg || 0) / 1000;
      const rate = p.retail_price_per_gram_cents || 0;
      return sum + Math.round(g * rate);
    }, 0);

    return {
      completedCount: completedSales.length,
      voidedCount: voidedSales.length,
      grossRevenueCents,
      totalCogsCents,
      grossProfitCents,
      grossMarginPct,
      shrinkageLossCents,
      estimatedMerchantFeesCents,
      netProfitCents,
      netMarginPct,
      arCustomers,
      totalArCents,
      apSuppliers,
      totalApCents,
      totalInventoryMg,
      totalCostBasisCents,
      totalRetailValueCents
    };
  }, [sales, shrinkageLogs, customers, suppliers, pigments, filterTimestamp]);

  return (
    <div id="reports-screen">
      {/* Header & Date Selector */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="section-title">📊 FINANCIAL REPORTS & LEDGER INSIGHTS</h2>
          <p className="body-small text-muted">Profit & Loss, Accounts Receivable (Who Owes Me), Accounts Payable (What I Owe)</p>
        </div>

        <div className="flex-center gap-xs" style={{ background: 'var(--market-surface-variant)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'WEEK', label: '7 Days' },
            { id: 'MONTH', label: '30 Days' },
            { id: 'YTD', label: 'YTD' },
            { id: 'ALL', label: 'All Time' }
          ].map(btn => (
            <button
              key={btn.id}
              className={`btn btn-sm ${timeRange === btn.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTimeRange(btn.id)}
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Level Key Metric KPI Cards */}
      <div className="grid-4col mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {/* Net Profit Card */}
        <div className="card" style={{ background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.2), rgba(18, 18, 18, 0.9))', borderColor: 'var(--market-green-primary)' }}>
          <div className="label-small text-muted">Net Operating Profit</div>
          <div className="title-large text-success" style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(metrics.netProfitCents)}
          </div>
          <div className="body-small font-weight-bold" style={{ color: 'var(--market-green-light)' }}>
            {metrics.netMarginPct}% Net Margin
          </div>
        </div>

        {/* Gross Revenue Card */}
        <div className="card">
          <div className="label-small text-muted">Gross Revenue</div>
          <div className="title-large" style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(metrics.grossRevenueCents)}
          </div>
          <div className="body-small text-muted">
            {metrics.completedCount} Completed Sales
          </div>
        </div>

        {/* Who Owes Me (Accounts Receivable) */}
        <div className="card" style={{ borderColor: metrics.totalArCents > 0 ? 'var(--market-warning)' : 'var(--market-border)' }}>
          <div className="label-small text-muted">📥 Who Owes Me (Accounts Receivable)</div>
          <div className={`title-large ${metrics.totalArCents > 0 ? 'text-warning' : ''}`} style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(metrics.totalArCents)}
          </div>
          <div className="body-small text-muted">
            {metrics.arCustomers.length} Customer Tab(s) Outstanding
          </div>
        </div>

        {/* What I Owe (Accounts Payable) */}
        <div className="card" style={{ borderColor: metrics.totalApCents > 0 ? 'var(--market-error)' : 'var(--market-border)' }}>
          <div className="label-small text-muted">📤 What I Owe (Accounts Payable)</div>
          <div className={`title-large ${metrics.totalApCents > 0 ? 'text-error' : ''}`} style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(metrics.totalApCents)}
          </div>
          <div className="body-small text-muted">
            {metrics.apSuppliers.length} Supplier Balance(s) Owed
          </div>
        </div>
      </div>

      {/* Main Breakdown Section */}
      <div className="grid-2col mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Profit & Loss Statement Statement Card */}
        <div className="card">
          <div className="card-header border-bottom pb-sm mb-md flex-between">
            <h3 className="title-medium">📈 Profit & Loss Statement (P&L)</h3>
            <span className="badge badge-completed">{timeRange}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex-between body-medium">
              <span>Gross Sales Revenue</span>
              <strong>{formatCents(metrics.grossRevenueCents)}</strong>
            </div>

            <div className="flex-between body-medium text-muted">
              <span>Cost of Goods Sold (COGS)</span>
              <span>- {formatCents(metrics.totalCogsCents)}</span>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            <div className="flex-between body-medium font-weight-bold">
              <span>Gross Profit</span>
              <span className="text-success">{formatCents(metrics.grossProfitCents)} ({metrics.grossMarginPct}%)</span>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            <div className="flex-between body-small text-muted">
              <span>Inventory Shrinkage Loss (Spillage)</span>
              <span className="text-error">- {formatCents(metrics.shrinkageLossCents)}</span>
            </div>

            <div className="flex-between body-small text-muted">
              <span>Est. Payment Processing Fees</span>
              <span>- {formatCents(metrics.estimatedMerchantFeesCents)}</span>
            </div>

            <div className="divider" style={{ margin: '8px 0', borderStyle: 'double' }} />

            <div className="flex-between title-medium font-weight-bold" style={{ fontSize: '1.1rem' }}>
              <span>Net Operating Profit</span>
              <span className={metrics.netProfitCents >= 0 ? 'text-success' : 'text-error'}>
                {formatCents(metrics.netProfitCents)}
              </span>
            </div>
          </div>
        </div>

        {/* Asset & Inventory Valuation Card */}
        <div className="card">
          <div className="card-header border-bottom pb-sm mb-md">
            <h3 className="title-medium">📦 Inventory Financial Assets</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="flex-between body-medium">
              <span>Total Inventory Weight</span>
              <strong>{formatMgToGrams(metrics.totalInventoryMg)}</strong>
            </div>

            <div className="flex-between body-medium">
              <span>Inventory Cost Basis (WAC Value)</span>
              <strong className="text-warning">{formatCents(metrics.totalCostBasisCents)}</strong>
            </div>

            <div className="flex-between body-medium">
              <span>Potential Retail Revenue Value</span>
              <strong className="text-success">{formatCents(metrics.totalRetailValueCents)}</strong>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            <div className="flex-between body-medium text-muted">
              <span>Unrealized Inventory Gross Margin</span>
              <span>{formatCents(metrics.totalRetailValueCents - metrics.totalCostBasisCents)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AR & AP Tables Grid */}
      <div className="grid-2col mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Accounts Receivable: Who Owes Me */}
        <div className="card">
          <div className="card-header border-bottom pb-sm mb-md flex-between">
            <h3 className="title-medium">📥 Who Owes Me (Customer Debt)</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => openModal('addCustomer')}>+ Add Customer</button>
          </div>

          {metrics.arCustomers.length === 0 ? (
            <div className="text-center p-md text-muted">No outstanding customer tab balances. 🎉</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.arCustomers.map(c => (
                <div key={c.customer_id} className="flex-between p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                  <div>
                    <div className="body-medium font-weight-bold">{c.name}</div>
                    <div className="body-small text-muted">{c.phone_number || 'No phone'}</div>
                  </div>
                  <div className="flex-center gap-sm">
                    <div className="text-right">
                      <div className="body-medium font-weight-bold text-warning">{formatCents(c.current_balance_cents)}</div>
                      <div className="label-small text-muted">Owed</div>
                    </div>
                    <button className="btn btn-success btn-sm" onClick={() => openModal('settleTab', c)}>
                      Settle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Accounts Payable: What I Owe */}
        <div className="card">
          <div className="card-header border-bottom pb-sm mb-md flex-between">
            <h3 className="title-medium">📤 What I Owe (Supplier Liabilities)</h3>
            <button className="btn btn-ghost btn-sm text-primary" onClick={() => openModal('addSupplier')}>+ Add Supplier</button>
          </div>

          {metrics.apSuppliers.length === 0 ? (
            <div className="text-center p-md text-muted">No supplier debt outstanding. All restocks paid! 👍</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.apSuppliers.map(s => (
                <div key={s.supplier_id} className="flex-between p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                  <div>
                    <div className="body-medium font-weight-bold">{s.name}</div>
                    <div className="body-small text-muted">{s.phone_number || 'No phone'}</div>
                  </div>
                  <div className="flex-center gap-sm">
                    <div className="text-right">
                      <div className="body-medium font-weight-bold text-error">{formatCents(s.current_balance_cents)}</div>
                      <div className="label-small text-muted">I Owe</div>
                    </div>
                    <button className="btn btn-warning btn-sm" onClick={() => openModal('paySupplier', s)}>
                      Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
