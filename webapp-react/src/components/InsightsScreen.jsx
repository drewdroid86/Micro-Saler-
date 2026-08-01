import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { calculateBusinessInsights, formatCents, formatMgToGrams } from '../repository';

export const InsightsScreen = () => {
  const {
    sales,
    saleItems,
    pigments,
    customers,
    suppliers,
    shrinkageLogs,
    setCurrentTab
  } = usePos();

  const [timeRange, setTimeRange] = useState('MONTH'); // 'TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YTD', 'ALL'
  const [activeSubView, setActiveSubView] = useState('products'); // 'products', 'customers', 'inventory'

  const insights = useMemo(() => {
    return calculateBusinessInsights({
      sales,
      saleItems,
      pigments,
      customers,
      suppliers,
      shrinkageLogs,
      timeRange
    });
  }, [sales, saleItems, pigments, customers, suppliers, shrinkageLogs, timeRange]);

  // Compute maximum revenue for relative CSS bar chart scaling
  const maxProductRevenue = useMemo(() => {
    if (!insights.topSellersByRevenue || insights.topSellersByRevenue.length === 0) return 1;
    return Math.max(...insights.topSellersByRevenue.map(p => p.revenueCents), 1);
  }, [insights.topSellersByRevenue]);

  return (
    <div id="insights-screen">
      {/* Screen Header & Timeframe Switcher */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 className="section-title">📈 BUSINESS INSIGHTS & ANALYTICS</h2>
          <p className="body-small text-muted">
            Executive performance metrics, product margins, customer lifetime value, and inventory turnover
          </p>
        </div>

        <div className="flex-center gap-xs" style={{ background: 'var(--market-surface-variant)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {[
            { id: 'TODAY', label: 'Today' },
            { id: 'WEEK', label: '7 Days' },
            { id: 'MONTH', label: '30 Days' },
            { id: 'QUARTER', label: '90 Days' },
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

      {/* KPI Headline Summary Grid */}
      <div
        className="grid-4col mb-lg"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px'
        }}
      >
        {/* Net Operating Profit KPI */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(46, 125, 50, 0.15), rgba(18, 18, 18, 0.05))',
            borderColor: 'var(--market-green-primary)',
            boxShadow: 'var(--shadow-glow)'
          }}
        >
          <div className="label-small text-muted">Net Operating Profit</div>
          <div className="title-large text-success" style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(insights.netProfitCents)}
          </div>
          <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start', fontSize: '0.85rem' }}>
            <span className="badge badge-success">{insights.netMarginPct}% Net Margin</span>
            <span className="text-muted">Gross: {insights.grossMarginPct}%</span>
          </div>
        </div>

        {/* Gross Revenue & Sales Volume */}
        <div className="card">
          <div className="label-small text-muted">Gross Revenue & Sales</div>
          <div className="title-large" style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(insights.grossRevenueCents)}
          </div>
          <div className="body-small text-muted">
            {insights.completedCount} Order(s) • {formatMgToGrams(insights.totalWeightSoldMg)} Sold
          </div>
        </div>

        {/* Average Order Value & Repeat Customer Rate */}
        <div className="card">
          <div className="label-small text-muted">Average Order & Loyalty</div>
          <div className="title-large" style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(insights.averageOrderValueCents)}
          </div>
          <div className="body-small text-muted">
            {insights.repeatCustomerRate}% Repeat Customer Rate
          </div>
        </div>

        {/* Stock & AR Risk Overview */}
        <div className="card" style={{ borderColor: (insights.lowStockPigments.length > 0 || insights.totalArCents > 0) ? 'var(--market-warning)' : 'var(--market-border)' }}>
          <div className="label-small text-muted">Stock Alerts & AR Tab Risk</div>
          <div className="title-large text-warning" style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '4px 0' }}>
            {formatCents(insights.totalArCents)}
          </div>
          <div className="body-small text-muted">
            {insights.lowStockPigments.length} Low Stock • {insights.deadStock.length} Dead Stock
          </div>
        </div>
      </div>

      {/* Actionable Recommendations Section */}
      {insights.recommendations.length > 0 && (
        <div className="card mb-lg" style={{ background: 'var(--market-surface-variant)', borderLeft: '4px solid var(--market-green-primary)' }}>
          <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="title-medium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🤖</span> Smart Actionable Insights & Recommendations ({insights.recommendations.length})
            </h3>
            <span className="label-small text-muted">Automated Business Intelligence</span>
          </div>

          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {insights.recommendations.map(rec => {
              let badgeClass = 'badge-info';
              if (rec.type === 'CRITICAL') badgeClass = 'badge-danger';
              else if (rec.type === 'WARNING') badgeClass = 'badge-warning';
              else if (rec.type === 'SUCCESS') badgeClass = 'badge-success';

              return (
                <div
                  key={rec.id}
                  className="card"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    gap: '8px',
                    background: 'var(--market-surface)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.4rem' }}>{rec.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{rec.type}</span>
                        <strong className="body-medium" style={{ fontWeight: '600' }}>{rec.title}</strong>
                      </div>
                      <p className="body-small text-muted" style={{ lineHeight: '1.4' }}>{rec.message}</p>
                    </div>
                  </div>

                  {rec.targetTab && (
                    <div style={{ alignSelf: 'flex-end', marginTop: '4px' }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setCurrentTab(rec.targetTab)}
                        style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                      >
                        Take Action →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-View Navigation Tabs */}
      <div className="tabs-header mb-md" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--market-border)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeSubView === 'products' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveSubView('products')}
        >
          🏆 Product Sales & Margin Analytics
        </button>
        <button
          className={`btn btn-sm ${activeSubView === 'customers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveSubView('customers')}
        >
          👥 Customer Lifetime Value & AR Risk
        </button>
        <button
          className={`btn btn-sm ${activeSubView === 'inventory' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveSubView('inventory')}
        >
          📦 Inventory Health & Stock Velocity
        </button>
      </div>

      {/* Sub-View 1: Product Sales & Margin Analytics */}
      {activeSubView === 'products' && (
        <div className="sub-view-container">
          {/* Top 5 Sellers Visual Bar Chart */}
          <div className="card mb-lg">
            <h3 className="title-medium mb-sm">📊 Top Products by Revenue Breakdown</h3>
            <p className="body-small text-muted mb-md">Revenue and gross margin comparison across top performing pigments</p>

            {insights.topSellersByRevenue.length === 0 ? (
              <p className="text-muted body-medium" style={{ padding: '16px 0' }}>No product sales recorded in the selected timeframe.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {insights.topSellersByRevenue.slice(0, 5).map(prod => {
                  const widthPct = Math.min(100, Math.max(8, Math.round((prod.revenueCents / maxProductRevenue) * 100)));
                  return (
                    <div key={prod.pigment_id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="flex-center space-between" style={{ fontSize: '0.88rem' }}>
                        <span>
                          <strong>{prod.name}</strong> <span className="text-muted">({formatMgToGrams(prod.weightSoldMg)} sold across {prod.saleCount} sales)</span>
                        </span>
                        <span>
                          <strong>{formatCents(prod.revenueCents)}</strong> <span className="text-success" style={{ marginLeft: '6px', fontWeight: 'bold' }}>({prod.marginPct}% margin)</span>
                        </span>
                      </div>
                      <div style={{ background: 'var(--market-surface-variant)', height: '14px', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${widthPct}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--market-green-primary), var(--market-green-dark))',
                            borderRadius: 'var(--radius-full)',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Complete Product Breakdown Table */}
          <div className="card">
            <h3 className="title-medium mb-sm">📋 Detailed Product Financial Performance</h3>
            <div className="table-responsive" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                    <th style={{ padding: '8px' }}>Product Name</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Weight Sold</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Revenue</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>COGS</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Gross Profit</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Margin %</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Turnover</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.productList.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ padding: '16px', textAlign: 'center' }} className="text-muted">No products configured.</td>
                    </tr>
                  ) : (
                    insights.productList.map(prod => {
                      const isDead = prod.stock_mg > 0 && prod.weightSoldMg === 0;
                      const isLowStock = prod.stock_mg <= 5000;
                      const isLowMargin = prod.revenueCents > 0 && prod.marginPct < 30;

                      return (
                        <tr key={prod.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>{prod.name}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{formatMgToGrams(prod.weightSoldMg)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>{formatCents(prod.revenueCents)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }} className="text-muted">{formatCents(prod.cogsCents)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }} className="text-success">
                            {formatCents(prod.profitCents)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span className={`badge ${prod.marginPct >= 50 ? 'badge-success' : prod.marginPct >= 30 ? 'badge-info' : 'badge-warning'}`}>
                              {prod.marginPct}%
                            </span>
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {prod.turnoverPct}%
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            {isDead && <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>Dead Stock</span>}
                            {isLowStock && <span className="badge badge-danger" style={{ fontSize: '0.75rem', marginLeft: '4px' }}>Low Stock</span>}
                            {isLowMargin && <span className="badge badge-warning" style={{ fontSize: '0.75rem', marginLeft: '4px' }}>Low Margin</span>}
                            {!isDead && !isLowStock && !isLowMargin && prod.revenueCents > 0 && (
                              <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Active</span>
                            )}
                            {!isDead && !isLowStock && !isLowMargin && prod.revenueCents === 0 && (
                              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>No Sales</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-View 2: Customer Lifetime Value & AR Risk */}
      {activeSubView === 'customers' && (
        <div className="sub-view-container">
          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Top Customer Spend Leaders */}
            <div className="card">
              <h3 className="title-medium mb-sm">🏆 Top Customers by Revenue</h3>
              <p className="body-small text-muted mb-md">Customer Lifetime Value (LTV) and order frequency</p>

              {insights.topCustomers.length === 0 ? (
                <p className="text-muted body-medium">No customer transaction history in this period.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                        <th style={{ padding: '8px' }}>Customer</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Orders</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Total Spend</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Tab Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.topCustomers.map(cust => (
                        <tr key={cust.customer_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>{cust.name}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{cust.salesCount}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>{formatCents(cust.totalSpentCents)}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }} className={cust.currentBalanceCents > 0 ? 'text-warning font-weight-bold' : 'text-muted'}>
                            {formatCents(cust.currentBalanceCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Customer Accounts Receivable Exposure */}
            <div className="card" style={{ borderColor: insights.totalArCents > 0 ? 'var(--market-warning)' : 'var(--market-border)' }}>
              <div className="flex-center space-between mb-sm">
                <h3 className="title-medium">📥 Outstanding Customer Tab Liability</h3>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setCurrentTab('customers')}
                >
                  Manage Customers →
                </button>
              </div>

              {insights.customerTabRisks.length === 0 ? (
                <p className="text-muted body-medium">🎉 Zero customer tab debt outstanding!</p>
              ) : (
                <>
                  <div className="title-large text-warning mb-sm" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
                    Total AR Exposure: {formatCents(insights.totalArCents)}
                  </div>
                  <div className="table-responsive">
                    <table className="table" style={{ width: '100%', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                          <th style={{ padding: '8px' }}>Customer Name</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Outstanding Tab</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.customerTabRisks.map(c => (
                          <tr key={c.customer_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                            <td style={{ padding: '8px', fontWeight: '500' }}>{c.name}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }} className="text-warning">
                              {formatCents(c.current_balance_cents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-View 3: Inventory Health & Stock Velocity */}
      {activeSubView === 'inventory' && (
        <div className="sub-view-container">
          <div className="grid-2col mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Low Stock Reorder Table */}
            <div className="card" style={{ borderColor: insights.lowStockPigments.length > 0 ? 'var(--market-error)' : 'var(--market-border)' }}>
              <div className="flex-center space-between mb-sm">
                <h3 className="title-medium text-error">📦 Low Stock Reorder List ({insights.lowStockPigments.length})</h3>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setCurrentTab('inventory')}
                >
                  Restock Inventory →
                </button>
              </div>

              {insights.lowStockPigments.length === 0 ? (
                <p className="text-muted body-medium">All products have healthy inventory levels (&gt; 5g).</p>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                        <th style={{ padding: '8px' }}>Pigment Name</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Current Stock</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.lowStockPigments.map(p => (
                        <tr key={p.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>{p.name}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatMgToGrams(p.stock_mg)}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <span className={`badge ${p.stock_mg === 0 ? 'badge-danger' : 'badge-warning'}`}>
                              {p.stock_mg === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dead Stock & Stagnant Inventory Table */}
            <div className="card">
              <div className="flex-center space-between mb-sm">
                <h3 className="title-medium">💡 Stagnant / Dead Stock ({insights.deadStock.length})</h3>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setCurrentTab('pricing')}
                >
                  Set Tier Discounts →
                </button>
              </div>

              {insights.deadStock.length === 0 ? (
                <p className="text-muted body-medium">Great job! All products with inventory have sales activity.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ width: '100%', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                        <th style={{ padding: '8px' }}>Pigment Name</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Stock On Hand</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Cost Basis ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.deadStock.map(p => (
                        <tr key={p.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                          <td style={{ padding: '8px', fontWeight: '500' }}>{p.name}</td>
                          <td style={{ padding: '8px', textAlign: 'right' }}>{formatMgToGrams(p.stock_mg)}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>{formatCents(p.total_cost_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsScreen;
