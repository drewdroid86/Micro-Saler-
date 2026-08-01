import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { calculateBusinessInsights, formatCents, formatMgToGrams } from '../repository';

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${dd}, ${yy} ${hh}:${mm}`;
}

export const InsightsScreen = () => {
  const {
    sales,
    saleItems,
    pigments,
    customers,
    suppliers,
    shrinkageLogs,
    stockReceipts,
    setCurrentTab,
    openModal
  } = usePos();

  const [timeRange, setTimeRange] = useState('MONTH'); // 'TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YTD', 'ALL'
  
  // Sort State for Per-Pigment Profitability Table
  const [profitSortField, setProfitSortField] = useState('profitCents'); // 'profitCents' | 'marginPct' | 'revenueCents' | 'weightSoldMg'
  const [profitSortAsc, setProfitSortAsc] = useState(false);

  // Drill-Down Filters & Expanded State
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [pigmentFilter, setPigmentFilter] = useState('ALL');
  const [expandedSaleIds, setExpandedSaleIds] = useState(new Set());

  const toggleExpandSale = (saleId) => {
    setExpandedSaleIds(prev => {
      const next = new Set(prev);
      if (next.has(saleId)) next.delete(saleId);
      else next.add(saleId);
      return next;
    });
  };

  const insights = useMemo(() => {
    return calculateBusinessInsights({
      sales,
      saleItems,
      pigments,
      customers,
      suppliers,
      shrinkageLogs,
      stockReceipts,
      timeRange
    });
  }, [sales, saleItems, pigments, customers, suppliers, shrinkageLogs, stockReceipts, timeRange]);

  // Sorted Per-Pigment Profitability Table
  const sortedProfitability = useMemo(() => {
    const list = [...insights.perPigmentProfitability];
    return list.sort((a, b) => {
      const valA = a[profitSortField] || 0;
      const valB = b[profitSortField] || 0;
      return profitSortAsc ? valA - valB : valB - valA;
    });
  }, [insights.perPigmentProfitability, profitSortField, profitSortAsc]);

  const handleSortToggle = (field) => {
    if (profitSortField === field) {
      setProfitSortAsc(!profitSortAsc);
    } else {
      setProfitSortField(field);
      setProfitSortAsc(false); // Default to descending for numbers
    }
  };

  // Filtered Drill-Down Sales
  const filteredSalesList = useMemo(() => {
    let list = insights.detailedSalesList || [];
    if (customerFilter !== 'ALL') {
      list = list.filter(s => String(s.customer_id) === String(customerFilter));
    }
    if (pigmentFilter !== 'ALL') {
      list = list.filter(s => s.items.some(item => String(item.pigment_id) === String(pigmentFilter)));
    }
    return list;
  }, [insights.detailedSalesList, customerFilter, pigmentFilter]);

  // CSV Export Handler for all sections
  const handleDownloadCSV = () => {
    const csvLines = [];

    csvLines.push(`"MICRO SALER - EXECUTIVE INSIGHTS REPORT"`);
    csvLines.push(`"Generated:","${new Date().toLocaleString()}"`);
    csvLines.push(`"Timeframe:","${timeRange}"`);
    csvLines.push(``);

    // Section 1: Profitability
    csvLines.push(`"1. PER-PIGMENT PROFITABILITY"`);
    csvLines.push(`"Pigment Name","Weight Sold (g)","Revenue ($)","COGS ($)","Profit ($)","Margin (%)"`);
    insights.perPigmentProfitability.forEach(p => {
      csvLines.push(`"${p.name}","${(p.weightSoldMg / 1000).toFixed(1)}","${(p.revenueCents / 100).toFixed(2)}","${(p.cogsCents / 100).toFixed(2)}","${(p.profitCents / 100).toFixed(2)}","${p.marginPct}%"`);
    });
    csvLines.push(``);

    // Section 2: Inventory Velocity
    csvLines.push(`"2. INVENTORY VELOCITY & REORDER SIGNALS"`);
    csvLines.push(`"Pigment Name","Stock (g)","Avg Daily Sell Rate (g/day)","Est Days Remaining","Velocity Flag"`);
    insights.perPigmentProfitability.forEach(p => {
      const daysStr = Number.isFinite(p.estimatedDaysRemaining) ? p.estimatedDaysRemaining : 'Infinity';
      csvLines.push(`"${p.name}","${(p.stock_mg / 1000).toFixed(1)}","${(p.dailySellRateMg / 1000).toFixed(2)}","${daysStr}","${p.velocityStatus}"`);
    });
    csvLines.push(``);

    // Section 3: Time Patterns
    csvLines.push(`"3. SALES PATTERNS BY DAY OF WEEK"`);
    csvLines.push(`"Day","Orders","Revenue ($)"`);
    insights.dayOfWeekStats.forEach(d => {
      csvLines.push(`"${d.day}","${d.count}","${(d.revenueCents / 100).toFixed(2)}"`);
    });
    csvLines.push(``);

    // Section 4: Receivables
    csvLines.push(`"4. RECEIVABLES SUMMARY (WHO OWES ME)"`);
    csvLines.push(`"Customer Name","Amount Owed ($)","Oldest Unpaid Sale Date","Days Outstanding"`);
    insights.customerReceivables.forEach(c => {
      csvLines.push(`"${c.name}","${(c.amountOwedCents / 100).toFixed(2)}","${c.oldestSaleDate}","${c.daysOutstanding}"`);
    });
    csvLines.push(``);

    // Section 5: Payables
    csvLines.push(`"5. PAYABLES SUMMARY (WHAT I OWE)"`);
    csvLines.push(`"Supplier Name","Amount Owed ($)","Contact Info"`);
    insights.supplierPayables.forEach(s => {
      csvLines.push(`"${s.name}","${(s.amountOwedCents / 100).toFixed(2)}","${s.contactInfo}"`);
    });
    csvLines.push(``);

    // Section 6: Shrinkage Loss
    csvLines.push(`"6. SHRINKAGE & WASTE LOSS IMPACT"`);
    csvLines.push(`"Pigment Name","Weight Lost (g)","COGS Lost ($)","Incident Count"`);
    insights.shrinkageImpact.forEach(item => {
      csvLines.push(`"${item.name}","${(item.weightLostMg / 1000).toFixed(1)}","${(item.cogsLossCents / 100).toFixed(2)}","${item.incidentCount}"`);
    });
    csvLines.push(``);

    // Section 7: Stock Receipt Cost Trends
    csvLines.push(`"7. SUPPLIER COST TRENDS PER PIGMENT"`);
    csvLines.push(`"Pigment Name","Supplier","Initial Cost ($/g)","Latest Cost ($/g)","Cost Change (%)","Trend Status"`);
    (insights.pigmentCostTrends || []).forEach(t => {
      csvLines.push(`"${t.name}","${t.latestSupplierName}","${(t.oldestCostPerGramCents / 100).toFixed(2)}","${(t.latestCostPerGramCents / 100).toFixed(2)}","${t.pctChange}%","${t.trendStatus}"`);
    });
    csvLines.push(``);

    // Section 8: Drill-Down Completed Sales
    csvLines.push(`"8. INDIVIDUAL COMPLETED SALES DRILL-DOWN"`);
    csvLines.push(`"Sale ID","Date","Customer","Revenue ($)","COGS ($)","Profit ($)","Margin (%)","Line Items Count"`);
    insights.detailedSalesList.forEach(s => {
      csvLines.push(`"${s.sale_id}","${new Date(s.created_at).toLocaleString()}","${s.customer_name}","${(s.total_amount_cents / 100).toFixed(2)}","${(s.total_cogs_cents / 100).toFixed(2)}","${(s.profit_cents / 100).toFixed(2)}","${s.margin_pct}%","${s.items.length}"`);
    });

    const csvContent = csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `micro_saler_insights_${timeRange.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print / PDF Export Handler
  const handlePrintReport = () => {
    window.print();
  };

  // Max Revenue for Day/Hour Bar Chart scaling
  const maxDayRevenue = useMemo(() => {
    return Math.max(...insights.dayOfWeekStats.map(d => d.revenueCents), 1);
  }, [insights.dayOfWeekStats]);

  const maxHourRevenue = useMemo(() => {
    return Math.max(...insights.hourOfDayStats.map(h => h.revenueCents), 1);
  }, [insights.hourOfDayStats]);

  return (
    <div id="insights-screen">
      {/* Screen Header & Action Controls */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 className="section-title">📈 BUSINESS INSIGHTS & DECISION DASHBOARD</h2>
          <p className="body-small text-muted">
            Pigment profitability, inventory velocity, time patterns, receivables, payables, shrinkage loss, cost trends, and sale drill-downs
          </p>
        </div>

        <div className="flex-center gap-xs" style={{ flexWrap: 'wrap' }}>
          {/* Timeframe selector */}
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

          {/* Export Report Actions */}
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadCSV} title="Export Insights Report to CSV">
            📥 Download CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrintReport} title="Print or Save PDF">
            🖨️ Print / PDF
          </button>
        </div>
      </div>

      {/* Auto-Generated Deterministic Recommendations Section */}
      <div className="card mb-lg" style={{ background: 'var(--market-surface-variant)', borderLeft: '4px solid var(--market-green-primary)' }}>
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <h3 className="title-medium" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🤖</span> Rule-Based Actionable Recommendations ({insights.recommendations.length})
          </h3>
          <span className="label-small text-muted">Deterministic Business Logic</span>
        </div>

        {insights.recommendations.length === 0 ? (
          <p className="body-medium text-muted">All inventory levels, margins, customer tabs, and waste metrics are in optimal standing!</p>
        ) : (
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
                    gap: '6px',
                    background: 'var(--market-surface)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.3rem' }}>{rec.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>{rec.type}</span>
                        <strong className="body-medium" style={{ fontWeight: '600' }}>{rec.title}</strong>
                      </div>
                      <p className="body-small text-muted" style={{ lineHeight: '1.4' }}>{rec.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 1: Per-Pigment Profitability Table */}
      <div className="card mb-lg">
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="title-medium">📊 1. Per-Pigment Profitability Table</h3>
            <p className="body-small text-muted">Weight sold, gross revenue, COGS, net profit $, and margin % per pigment</p>
          </div>
          <div className="flex-center gap-xs" style={{ fontSize: '0.82rem' }}>
            <span className="text-muted">Sort by:</span>
            {[
              { field: 'profitCents', label: 'Profit $' },
              { field: 'marginPct', label: 'Margin %' },
              { field: 'revenueCents', label: 'Revenue' },
              { field: 'weightSoldMg', label: 'Weight Sold' }
            ].map(btn => (
              <button
                key={btn.field}
                className={`btn btn-xs ${profitSortField === btn.field ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => handleSortToggle(btn.field)}
                style={{ padding: '3px 8px', fontSize: '0.8rem' }}
              >
                {btn.label} {profitSortField === btn.field ? (profitSortAsc ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                <th style={{ padding: '10px 8px' }}>Pigment Name</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSortToggle('weightSoldMg')}>
                  Weight Sold {profitSortField === 'weightSoldMg' && (profitSortAsc ? '↑' : '↓')}
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSortToggle('revenueCents')}>
                  Revenue {profitSortField === 'revenueCents' && (profitSortAsc ? '↑' : '↓')}
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total COGS</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSortToggle('profitCents')}>
                  Profit $ {profitSortField === 'profitCents' && (profitSortAsc ? '↑' : '↓')}
                </th>
                <th style={{ padding: '10px 8px', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSortToggle('marginPct')}>
                  Margin % {profitSortField === 'marginPct' && (profitSortAsc ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedProfitability.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '16px', textAlign: 'center' }} className="text-muted">No pigment sales recorded for this timeframe.</td>
                </tr>
              ) : (
                sortedProfitability.map(p => (
                  <tr key={p.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{p.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMgToGrams(p.weightSoldMg)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>{formatCents(p.revenueCents)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }} className="text-muted">{formatCents(p.cogsCents)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }} className="text-success">
                      {formatCents(p.profitCents)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span className={`badge ${p.marginPct >= 50 ? 'badge-success' : p.marginPct >= 30 ? 'badge-info' : 'badge-warning'}`}>
                        {p.marginPct}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Inventory Velocity & Reorder Signals */}
      <div className="card mb-lg">
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="title-medium">📦 2. Inventory Velocity & Reorder Signals</h3>
            <p className="body-small text-muted">Days of stock remaining per pigment based on 30-day sell rate (Flags: &lt;7 days Reorder Soon, &gt;90 days Slow Mover)</p>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setCurrentTab('inventory')}
          >
            Manage Inventory →
          </button>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                <th style={{ padding: '10px 8px' }}>Pigment Name</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Current Stock</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>30-Day Sell Rate</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Est. Days Remaining</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Velocity Signal</th>
              </tr>
            </thead>
            <tbody>
              {insights.perPigmentProfitability.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '16px', textAlign: 'center' }} className="text-muted">No active pigments found.</td>
                </tr>
              ) : (
                insights.perPigmentProfitability.map(p => {
                  const daysDisplay = Number.isFinite(p.estimatedDaysRemaining) ? `${p.estimatedDaysRemaining} days` : 'N/A (No 30d sales)';
                  let badgeClass = 'badge-info';
                  if (p.velocityStatus === 'Reorder Soon' || p.velocityStatus === 'Out of Stock') badgeClass = 'badge-danger';
                  else if (p.velocityStatus === 'Slow Mover') badgeClass = 'badge-secondary';

                  return (
                    <tr key={p.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '500' }}>{p.name}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>{formatMgToGrams(p.stock_mg)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }} className="text-muted">
                        {formatMgToGrams(p.dailySellRateMg)}/day
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '500' }}>{daysDisplay}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem' }}>
                          {p.velocityStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: Time-Based Sales Patterns */}
      <div className="card mb-lg">
        <h3 className="title-medium mb-xs">⏰ 3. Time-Based Sales Patterns</h3>
        <p className="body-small text-muted mb-md">Revenue breakdown by day of week and peak sales hours from sales timestamps</p>

        <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Day of Week Visual Bar Chart */}
          <div style={{ background: 'var(--market-surface-variant)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <div className="flex-center space-between mb-sm">
              <strong className="body-medium">Day of Week Revenue</strong>
              {insights.peakDay && (
                <span className="label-small text-success">Peak: {insights.peakDay.day} ({formatCents(insights.peakDay.revenueCents)})</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {insights.dayOfWeekStats.map(d => {
                const widthPct = Math.min(100, Math.max(6, Math.round((d.revenueCents / maxDayRevenue) * 100)));
                return (
                  <div key={d.day} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div className="flex-center space-between" style={{ fontSize: '0.82rem' }}>
                      <span><strong>{d.day}</strong> <span className="text-muted">({d.count} orders)</span></span>
                      <strong>{formatCents(d.revenueCents)}</strong>
                    </div>
                    <div style={{ background: 'var(--market-border)', height: '10px', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${widthPct}%`,
                          height: '100%',
                          background: 'var(--market-green-primary)',
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Peak Hour of Day Breakdown */}
          <div style={{ background: 'var(--market-surface-variant)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <div className="flex-center space-between mb-sm">
              <strong className="body-medium">Peak Sales Hour Breakdown</strong>
              {insights.peakHour && (
                <span className="label-small text-success">Peak: {insights.peakHour.label} ({formatCents(insights.peakHour.revenueCents)})</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {insights.hourOfDayStats.map(h => {
                const widthPct = Math.min(100, Math.max(4, Math.round((h.revenueCents / maxHourRevenue) * 100)));
                return (
                  <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                    <span style={{ width: '45px', textAlign: 'right', color: 'var(--market-text-secondary)', fontWeight: '500' }}>{h.label}</span>
                    <div style={{ flex: 1, background: 'var(--market-border)', height: '8px', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${widthPct}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #386B1F, #D97706)',
                          borderRadius: 'var(--radius-full)'
                        }}
                      />
                    </div>
                    <span style={{ width: '65px', textAlign: 'right', fontWeight: 'bold' }}>{formatCents(h.revenueCents)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Receivables & SECTION 5: Payables */}
      <div className="grid-2col mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {/* Receivables Summary (Who Owes Me) */}
        <div className="card" style={{ borderColor: insights.totalArCents > 0 ? 'var(--market-warning)' : 'var(--market-border)' }}>
          <div className="flex-center space-between mb-sm">
            <div>
              <h3 className="title-medium text-warning">📥 4. Receivables (Who Owes Me)</h3>
              <p className="body-small text-muted">Customer tab balances &amp; days outstanding</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentTab('customers')}>
              Customers →
            </button>
          </div>

          {insights.customerReceivables.length === 0 ? (
            <p className="body-medium text-muted" style={{ padding: '12px 0' }}>🎉 Zero customer debt outstanding!</p>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                    <th style={{ padding: '8px' }}>Customer</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount Owed</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Oldest Unpaid</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.customerReceivables.map(c => (
                    <tr key={c.customer_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{c.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }} className="text-warning">
                        {formatCents(c.amountOwedCents)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }} className="text-muted">{c.oldestSaleDate}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <span className={`badge ${c.daysOutstanding > 30 ? 'badge-danger' : 'badge-warning'}`}>
                          {c.daysOutstanding}d
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payables Summary (What I Owe) */}
        <div className="card" style={{ borderColor: insights.totalApCents > 0 ? 'var(--market-error)' : 'var(--market-border)' }}>
          <div className="flex-center space-between mb-sm">
            <div>
              <h3 className="title-medium text-error">📤 5. Payables (What I Owe)</h3>
              <p className="body-small text-muted">Supplier balances &amp; unpaid restock tabs</p>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setCurrentTab('suppliers')}>
              Suppliers →
            </button>
          </div>

          {insights.supplierPayables.length === 0 ? (
            <p className="body-medium text-muted" style={{ padding: '12px 0' }}>🎉 Zero supplier payables outstanding!</p>
          ) : (
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                    <th style={{ padding: '8px' }}>Supplier Name</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Amount Owed</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.supplierPayables.map(s => (
                    <tr key={s.supplier_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                      <td style={{ padding: '8px', fontWeight: '500' }}>{s.name}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }} className="text-error">
                        {formatCents(s.amountOwedCents)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }} className="text-muted">{s.contactInfo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 6: Shrinkage & Loss Tracking */}
      <div className="card mb-lg">
        <div className="flex-center space-between mb-sm">
          <div>
            <h3 className="title-medium">📉 6. Shrinkage & Waste Loss Tracking</h3>
            <p className="body-small text-muted">Total value lost per pigment from shrinkage logs — identifies waste cost hot-spots</p>
          </div>
          <div className="title-medium text-error" style={{ fontWeight: 'bold' }}>
            Total Waste Loss: {formatCents(insights.totalShrinkageLossCents)}
          </div>
        </div>

        {insights.shrinkageImpact.length === 0 ? (
          <p className="body-medium text-muted" style={{ padding: '12px 0' }}>Zero shrinkage/loss events recorded in this timeframe.</p>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                  <th style={{ padding: '10px 8px' }}>Pigment Name</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Weight Lost</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>COGS Loss ($)</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Incident Count</th>
                </tr>
              </thead>
              <tbody>
                {insights.shrinkageImpact.map(item => (
                  <tr key={item.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{item.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMgToGrams(item.weightLostMg)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }} className="text-error">
                      {formatCents(item.cogsLossCents)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>{item.incidentCount} incident(s)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 7: Stock Receipt History & Supplier Cost Trends */}
      <div className="card mb-lg">
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="title-medium">📜 7. Stock Receipt History & Supplier Cost Trends</h3>
            <p className="body-small text-muted">Incoming restock inventory over time &amp; unit cost trends per pigment (cost inflation tracking)</p>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={() => setCurrentTab('suppliers')}>
            View Supplier Restocks →
          </button>
        </div>

        {/* Cost Trends Per Pigment Table */}
        {insights.pigmentCostTrends && insights.pigmentCostTrends.length > 0 && (
          <div className="mb-md p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong className="body-small text-muted mb-xs" style={{ display: 'block' }}>Pigment Unit Cost Trend Overview</strong>
            <div className="table-responsive">
              <table className="table" style={{ width: '100%', textAlign: 'left', background: 'var(--market-surface)', borderRadius: '6px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--market-border)' }}>
                    <th style={{ padding: '8px' }}>Pigment Name</th>
                    <th style={{ padding: '8px' }}>Latest Supplier</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Initial Cost/g</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Latest Cost/g</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Cost Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.pigmentCostTrends.map(t => {
                    let badgeClass = 'badge-info';
                    if (t.trendStatus === 'INCREASING') badgeClass = 'badge-warning';
                    else if (t.trendStatus === 'DECREASING') badgeClass = 'badge-success';

                    return (
                      <tr key={t.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{t.name}</td>
                        <td style={{ padding: '8px' }} className="text-muted">{t.latestSupplierName}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>{formatCents(t.oldestCostPerGramCents)}/g</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCents(t.latestCostPerGramCents)}/g</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem' }}>
                            {t.trendStatus === 'INCREASING' ? `+${t.pctChange}% Inflation` : t.trendStatus === 'DECREASING' ? `${t.pctChange}% Savings` : 'Stable'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Incoming Stock Receipts Ledger */}
        {(!insights.validReceipts || insights.validReceipts.length === 0) ? (
          <p className="body-medium text-muted" style={{ padding: '12px 0' }}>Zero stock receipts recorded.</p>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                  <th style={{ padding: '10px 8px' }}>Restock Date</th>
                  <th style={{ padding: '10px 8px' }}>Pigment Name</th>
                  <th style={{ padding: '10px 8px' }}>Supplier</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Received Weight</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Cost</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Unit Cost ($/g)</th>
                </tr>
              </thead>
              <tbody>
                {insights.validReceipts.slice(0, 15).map(r => (
                  <tr key={r.stock_receipt_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                    <td style={{ padding: '10px 8px', fontSize: '0.88rem' }}>{new Date(r.received_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{r.pigment_name}</td>
                    <td style={{ padding: '10px 8px' }} className="text-muted">{r.supplier_name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatMgToGrams(r.received_mg)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>{formatCents(r.total_cost_cents)}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }} className="text-success font-weight-bold">
                      {formatCents(r.cost_per_gram_cents)}/g
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 8: Individual Sale History (Drill-Down Detail) */}
      <div className="card mb-lg">
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="title-medium">🔍 8. Individual Sale History (Drill-Down Detail)</h3>
            <p className="body-small text-muted">Complete audit trail of sales with date, customer, line items, revenue, COGS, profit $, and margin %</p>
          </div>

          {/* Filters for Customer and Pigment */}
          <div className="flex-center gap-xs" style={{ flexWrap: 'wrap' }}>
            {/* Customer Filter */}
            <select
              className="input-select"
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '4px 8px' }}
            >
              <option value="ALL">All Customers</option>
              {(customers || []).map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
              ))}
            </select>

            {/* Pigment Filter */}
            <select
              className="input-select"
              value={pigmentFilter}
              onChange={e => setPigmentFilter(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '4px 8px' }}
            >
              <option value="ALL">All Pigments</option>
              {(pigments || []).filter(p => p.pigment_id > 0).map(p => (
                <option key={p.pigment_id} value={p.pigment_id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredSalesList.length === 0 ? (
          <p className="body-medium text-muted" style={{ padding: '16px 0', textAlign: 'center' }}>
            No completed sales matching the selected filters.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                  <th style={{ padding: '10px 8px' }}>Sale Date</th>
                  <th style={{ padding: '10px 8px' }}>Customer</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Items</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Revenue</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>COGS</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Profit $</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Margin %</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredSalesList.map(s => {
                  const isExpanded = expandedSaleIds.has(s.sale_id);
                  return (
                    <React.Fragment key={s.sale_id}>
                      <tr style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                        <td style={{ padding: '10px 8px', fontSize: '0.88rem' }}>{formatDate(s.created_at)}</td>
                        <td style={{ padding: '10px 8px', fontWeight: '500' }}>{s.customer_name}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>{s.items.length} item(s)</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600' }}>{formatCents(s.total_amount_cents)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right' }} className="text-muted">{formatCents(s.total_cogs_cents)}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }} className="text-success">
                          {formatCents(s.profit_cents)}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <span className={`badge ${s.margin_pct >= 50 ? 'badge-success' : s.margin_pct >= 30 ? 'badge-info' : 'badge-warning'}`}>
                            {s.margin_pct}%
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                          <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => toggleExpandSale(s.sale_id)}
                            style={{ fontSize: '0.78rem', padding: '2px 6px' }}
                          >
                            {isExpanded ? '▲ Hide' : '▼ View Items'}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Line Items Detail View */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" style={{ padding: '12px 16px', background: 'var(--market-surface-variant)' }}>
                            <div style={{ fontSize: '0.85rem' }}>
                              <strong className="body-small text-muted" style={{ display: 'block', marginBottom: '6px' }}>
                                Line Items Breakdown for Sale #{String(s.sale_id).substring(0, 8)}
                              </strong>
                              <table className="table" style={{ width: '100%', background: 'var(--market-surface)', borderRadius: '6px' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--market-border)' }}>
                                    <th style={{ padding: '6px 8px' }}>Item Name</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Weight</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Charged</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>COGS</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Item Profit</th>
                                    <th style={{ padding: '6px 8px', textAlign: 'center' }}>Item Margin</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.items.map(item => (
                                    <tr key={item.sale_item_id || item.pigment_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                                      <td style={{ padding: '6px 8px', fontWeight: '500' }}>{item.name}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatMgToGrams(item.weight_mg)}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatCents(item.price_charged_cents)}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right' }} className="text-muted">{formatCents(item.unit_cogs_cents)}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }} className="text-success">{formatCents(item.profit_cents)}</td>
                                      <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{item.margin_pct}%</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsScreen;
