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
  
  // Sort State for Per-Pigment Profitability Table
  const [profitSortField, setProfitSortField] = useState('profitCents'); // 'profitCents' | 'marginPct' | 'revenueCents' | 'weightSoldMg'
  const [profitSortAsc, setProfitSortAsc] = useState(false);

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

  // CSV Export Handler
  const handleDownloadCSV = () => {
    const csvLines = [];

    // Header
    csvLines.push(`"MICRO SALER - BUSINESS INSIGHTS REPORT"`);
    csvLines.push(`"Generated:","${new Date().toLocaleString()}"`);
    csvLines.push(`"Timeframe:","${timeRange}"`);
    csvLines.push(``);

    // Section 1: Profitability
    csvLines.push(`"PER-PIGMENT PROFITABILITY"`);
    csvLines.push(`"Pigment Name","Weight Sold (g)","Revenue ($)","COGS ($)","Profit ($)","Margin (%)"`);
    insights.perPigmentProfitability.forEach(p => {
      csvLines.push(`"${p.name}","${(p.weightSoldMg / 1000).toFixed(1)}","${(p.revenueCents / 100).toFixed(2)}","${(p.cogsCents / 100).toFixed(2)}","${(p.profitCents / 100).toFixed(2)}","${p.marginPct}%"`);
    });
    csvLines.push(``);

    // Section 2: Inventory Velocity
    csvLines.push(`"INVENTORY VELOCITY & STOCK REMAINING"`);
    csvLines.push(`"Pigment Name","Stock (g)","Avg Daily Sell Rate (g/day)","Est Days Remaining","Velocity Flag"`);
    insights.perPigmentProfitability.forEach(p => {
      const daysStr = Number.isFinite(p.estimatedDaysRemaining) ? p.estimatedDaysRemaining : 'Infinity';
      csvLines.push(`"${p.name}","${(p.stock_mg / 1000).toFixed(1)}","${(p.dailySellRateMg / 1000).toFixed(2)}","${daysStr}","${p.velocityStatus}"`);
    });
    csvLines.push(``);

    // Section 3: Time Patterns
    csvLines.push(`"SALES PATTERNS BY DAY OF WEEK"`);
    csvLines.push(`"Day","Orders","Revenue ($)"`);
    insights.dayOfWeekStats.forEach(d => {
      csvLines.push(`"${d.day}","${d.count}","${(d.revenueCents / 100).toFixed(2)}"`);
    });
    csvLines.push(``);

    // Section 4: Receivables Summary
    csvLines.push(`"RECEIVABLES SUMMARY (CUSTOMER TABS)"`);
    csvLines.push(`"Customer Name","Amount Owed ($)","Oldest Unpaid Sale Date","Days Outstanding"`);
    insights.customerReceivables.forEach(c => {
      csvLines.push(`"${c.name}","${(c.amountOwedCents / 100).toFixed(2)}","${c.oldestSaleDate}","${c.daysOutstanding}"`);
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
      {/* Screen Header, Controls & Export Actions */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 className="section-title">📈 BUSINESS INSIGHTS & ANALYTICS</h2>
          <p className="body-small text-muted">
            Pigment profitability, inventory velocity, peak sales time patterns, customer receivables, and deterministic recommendations
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
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadCSV} title="Export Insights to CSV">
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
            <span>🤖</span> Actionable Insights & Recommendations ({insights.recommendations.length})
          </h3>
          <span className="label-small text-muted">Rule-Based Deterministic Intelligence</span>
        </div>

        {insights.recommendations.length === 0 ? (
          <p className="body-medium text-muted">All inventory levels, margins, and customer tabs are within optimal thresholds!</p>
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
            <h3 className="title-medium">📊 Per-Pigment Profitability</h3>
            <p className="body-small text-muted">Weight sold, gross revenue, COGS, net profit $, and gross margin % per pigment</p>
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

      {/* SECTION 2: Inventory Velocity & Stock Remaining */}
      <div className="card mb-lg">
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="title-medium">📦 Inventory Velocity & Stock Remaining</h3>
            <p className="body-small text-muted">Calculated sell rate per day (last 30 days) and estimated days of stock remaining</p>
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
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>30-Day Avg Rate</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Est. Days Remaining</th>
                <th style={{ padding: '10px 8px', textAlign: 'center' }}>Velocity Status</th>
              </tr>
            </thead>
            <tbody>
              {insights.perPigmentProfitability.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '16px', textAlign: 'center' }} className="text-muted">No active pigments found.</td>
                </tr>
              ) : (
                insights.perPigmentProfitability.map(p => {
                  const daysDisplay = Number.isFinite(p.estimatedDaysRemaining) ? `${p.estimatedDaysRemaining} days` : 'N/A (No sales)';
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
        <h3 className="title-medium mb-xs">⏰ Time-Based Sales Patterns</h3>
        <p className="body-small text-muted mb-md">Revenue breakdown by day of week and peak sales hours</p>

        <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Day of Week Visual Bar Chart */}
          <div style={{ background: 'var(--market-surface-variant)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
            <div className="flex-center space-between mb-sm">
              <strong className="body-medium">Day of Week Breakdown</strong>
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
              <strong className="body-medium">Hour of Day Revenue Peak</strong>
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

      {/* SECTION 4: Receivables Summary */}
      <div className="card mb-lg" style={{ borderColor: insights.totalArCents > 0 ? 'var(--market-warning)' : 'var(--market-border)' }}>
        <div className="flex-center space-between mb-sm" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="title-medium text-warning">📥 Receivables Summary (Outstanding Customer Tabs)</h3>
            <p className="body-small text-muted">Customers with current balances &gt; $0.00 sorted by amount owed descending</p>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setCurrentTab('customers')}
          >
            Go to Customers Tab →
          </button>
        </div>

        {insights.customerReceivables.length === 0 ? (
          <p className="body-medium text-muted" style={{ padding: '12px 0' }}>🎉 Zero outstanding customer receivables!</p>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--market-border)' }}>
                  <th style={{ padding: '10px 8px' }}>Customer Name</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right' }}>Amount Owed</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Oldest Unpaid Sale Date</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Days Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {insights.customerReceivables.map(c => (
                  <tr key={c.customer_id} style={{ borderBottom: '1px solid var(--market-border-light)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{c.name}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }} className="text-warning">
                      {formatCents(c.amountOwedCents)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }} className="text-muted">{c.oldestSaleDate}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                      <span className={`badge ${c.daysOutstanding > 30 ? 'badge-danger' : c.daysOutstanding > 14 ? 'badge-warning' : 'badge-info'}`}>
                        {c.daysOutstanding} days
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsightsScreen;
