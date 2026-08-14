import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

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

export const HistoryScreen = () => {
  const { sales, saleItems, pigments, customers, db, openModal } = usePos();

  const safeSales = sales || [];
  const safeItems = saleItems || [];
  const safeCustomers = customers || [];
  const safePigments = pigments || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'VOIDED' | 'REFUNDED'
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [selectedSalePayments, setSelectedSalePayments] = useState([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);

  // High-level sales metrics
  const salesMetrics = useMemo(() => {
    let completedCount = 0;
    let voidedCount = 0;
    let refundedCount = 0;
    let totalRevenueCents = 0;
    let totalCogsCents = 0;

    safeSales.forEach(s => {
      if (s.status === 'COMPLETED' || !s.status || s.status === 'PAID') {
        completedCount += 1;
        totalRevenueCents += Number(s.total_amount_cents) || 0;
        totalCogsCents += Number(s.total_cogs_cents) || 0;
      } else if (s.status === 'VOIDED') {
        voidedCount += 1;
      } else if (s.status === 'REFUNDED') {
        refundedCount += 1;
      }
    });

    const totalGrossProfitCents = totalRevenueCents - totalCogsCents;
    const overallMarginPct = totalRevenueCents > 0 ? Math.round((totalGrossProfitCents / totalRevenueCents) * 100) : 0;

    return {
      completedCount,
      voidedCount,
      refundedCount,
      totalSalesCount: safeSales.length,
      totalRevenueCents,
      totalGrossProfitCents,
      overallMarginPct
    };
  }, [safeSales]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return safeSales.filter(s => {
      // 1. Status Filter
      if (statusFilter === 'COMPLETED' && s.status !== 'COMPLETED' && s.status && s.status !== 'PAID') return false;
      if (statusFilter === 'VOIDED' && s.status !== 'VOIDED') return false;
      if (statusFilter === 'REFUNDED' && s.status !== 'REFUNDED') return false;

      // 2. Search Query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cust = safeCustomers.find(c => Number(c.customer_id) === Number(s.customer_id));
        const custName = cust ? cust.name.toLowerCase() : 'walk-in';
        const saleIdStr = String(s.sale_id).toLowerCase();

        // Check line items for pigment names
        const items = safeItems.filter(si => Number(si.sale_id) === Number(s.sale_id));
        const hasPigmentMatch = items.some(si => {
          const p = safePigments.find(pig => Number(pig.pigment_id) === Number(si.pigment_id));
          return p && p.name.toLowerCase().includes(q);
        });

        if (!custName.includes(q) && !saleIdStr.includes(q) && !hasPigmentMatch) {
          return false;
        }
      }

      return true;
    });
  }, [safeSales, safeCustomers, safeItems, safePigments, statusFilter, searchQuery]);

  // Selected sale for detail inspector
  const selectedSale = useMemo(() => {
    if (selectedSaleId) {
      const found = filteredSales.find(s => Number(s.sale_id) === Number(selectedSaleId));
      if (found) return found;
      const foundInAll = safeSales.find(s => Number(s.sale_id) === Number(selectedSaleId));
      if (foundInAll) return foundInAll;
    }
    return filteredSales[0] || null;
  }, [selectedSaleId, filteredSales, safeSales]);

  // Load payments for selected sale
  React.useEffect(() => {
    if (selectedSale && db) {
      setIsLoadingPayments(true);
      db.getAll('sale_payments')
        .then(allPayments => {
          const payments = allPayments.filter(p => Number(p.sale_id) === Number(selectedSale.sale_id));
          setSelectedSalePayments(payments || []);
        })
        .catch(() => setSelectedSalePayments([]))
        .finally(() => setIsLoadingPayments(false));
    } else {
      setSelectedSalePayments([]);
    }
  }, [selectedSale?.sale_id, db]);

  const selectedSaleItems = useMemo(() => {
    if (!selectedSale) return [];
    return safeItems.filter(si => Number(si.sale_id) === Number(selectedSale.sale_id));
  }, [selectedSale, safeItems]);

  const selectedSaleCustomer = useMemo(() => {
    if (!selectedSale) return null;
    return safeCustomers.find(c => Number(c.customer_id) === Number(selectedSale.customer_id)) || null;
  }, [selectedSale, safeCustomers]);

  const handleExportCsv = () => {
    if (safeSales.length === 0) return;

    const headers = ['Sale ID', 'Date', 'Customer', 'Status', 'Total Amount ($)', 'COGS ($)', 'Gross Profit ($)'];
    const rows = safeSales.map(s => {
      const cust = safeCustomers.find(c => Number(c.customer_id) === Number(s.customer_id));
      const custName = cust ? cust.name : 'Walk-in';
      const totalD = ((s.total_amount_cents || 0) / 100).toFixed(2);
      const cogsD = ((s.total_cogs_cents || 0) / 100).toFixed(2);
      const profitD = (((s.total_amount_cents || 0) - (s.total_cogs_cents || 0)) / 100).toFixed(2);
      const dateStr = s.created_at ? new Date(s.created_at).toISOString() : '';

      return [
        s.sale_id,
        `"${dateStr}"`,
        `"${custName}"`,
        s.status || 'COMPLETED',
        totalD,
        cogsD,
        profitD
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `micro-saler-sales-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenReceiptModal = () => {
    if (!selectedSale) return;
    openModal('receiptModal', {
      sale: selectedSale,
      items: selectedSaleItems,
      customer: selectedSaleCustomer,
      payments: selectedSalePayments
    });
  };

  return (
    <div className="history-screen-container">
      {/* Section Header */}
      <div className="section-header mb-md">
        <div>
          <h2 className="section-title">📋 SALES HISTORY & RECEIPT INSPECTOR</h2>
          <p className="body-small text-muted">View past register sales, process returns, void erroneous transactions, and inspect itemized digital receipts.</p>
        </div>
        <div className="flex-center gap-xs">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => openModal('HELP', { section: 'insights-reports' })}
            title="Open Sales History & Returns Guide"
          >
            ❓ History Guide
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} disabled={safeSales.length === 0}>
            📥 Export Sales CSV
          </button>
        </div>
      </div>

      {/* Sales Overview Summary Bar */}
      <div className="grid-4col mb-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-green-primary)' }}>
          <div className="label-small text-muted">COMPLETED REVENUE</div>
          <div className="title-medium text-success mt-xs">{formatCents(salesMetrics.totalRevenueCents)}</div>
          <div className="body-small text-muted">{salesMetrics.completedCount} successful transaction(s)</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-primary)' }}>
          <div className="label-small text-muted">GROSS PROFIT (MARGIN)</div>
          <div className="title-medium text-primary mt-xs">
            {formatCents(salesMetrics.totalGrossProfitCents)} <span style={{ fontSize: '12px', fontWeight: 'normal' }}>({salesMetrics.overallMarginPct}%)</span>
          </div>
          <div className="body-small text-muted">Net after pigment COGS</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-error)' }}>
          <div className="label-small text-muted">VOIDED SALES</div>
          <div className="title-medium text-error mt-xs">{salesMetrics.voidedCount} Voided</div>
          <div className="body-small text-muted">Stock & ledger auto-reverted</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-warning)' }}>
          <div className="label-small text-muted">RETURNS / REFUNDS</div>
          <div className="title-medium text-warning mt-xs">{salesMetrics.refundedCount} Refunded</div>
          <div className="body-small text-muted">Processed returns</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card p-sm mb-md flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search by customer, sale ID, or pigment name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="flex-center gap-xs">
          {[
            { id: 'ALL', label: `All (${salesMetrics.totalSalesCount})` },
            { id: 'COMPLETED', label: `✅ Completed (${salesMetrics.completedCount})` },
            { id: 'VOIDED', label: `🚫 Voided (${salesMetrics.voidedCount})` },
            { id: 'REFUNDED', label: `🔄 Refunded (${salesMetrics.refundedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn btn-sm ${statusFilter === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(tab.id)}
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Split-Pane Layout */}
      {filteredSales.length === 0 ? (
        <div className="card text-center p-xl mb-lg">
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
          <div className="title-medium mb-xs">No transactions found</div>
          <p className="body-small text-muted mb-md">
            {searchQuery ? `No sales records matching "${searchQuery}" under current filter.` : 'No sales transactions recorded yet.'}
          </p>
          {searchQuery && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setStatusFilter('ALL'); }}>
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="split-pane-layout mb-lg">
          {/* Left Panel: Transaction Feed List */}
          <div className="split-pane-list-panel">
            <div className="body-small text-muted px-xs flex-between">
              <span>Showing {filteredSales.length} sale(s)</span>
              <span>Tap to inspect receipt</span>
            </div>

            {filteredSales.map(s => {
              const cust = safeCustomers.find(c => Number(c.customer_id) === Number(s.customer_id));
              const custName = cust ? cust.name : 'Walk-in Customer';
              const items = safeItems.filter(si => Number(si.sale_id) === Number(s.sale_id));
              const isSelected = selectedSale && Number(selectedSale.sale_id) === Number(s.sale_id);
              const badgeClass = s.status === 'COMPLETED' || !s.status || s.status === 'PAID'
                ? 'badge-completed'
                : s.status === 'VOIDED'
                ? 'badge-voided'
                : 'badge-refunded';

              return (
                <div
                  key={s.sale_id}
                  className={`card split-pane-selectable-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedSaleId(s.sale_id)}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex-between mb-xs">
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                      <strong className="body-large" style={{ color: isSelected ? 'var(--market-primary)' : 'inherit' }}>
                        {custName}
                      </strong>
                    </div>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: '10px' }}>
                      {s.status || 'COMPLETED'}
                    </span>
                  </div>

                  <div className="flex-between body-small text-muted">
                    <span>
                      ID #{String(s.sale_id).substring(0, 8)} &bull; {formatDate(s.created_at || s.timestamp)}
                    </span>
                    <strong className="body-medium" style={{ color: 'var(--market-text)' }}>
                      {formatCents(s.total_amount_cents)}
                    </strong>
                  </div>

                  <div className="label-small text-muted mt-xs">
                    {items.length} line item(s) &bull; COGS: {formatCents(s.total_cogs_cents)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Panel: Sticky Receipt & Sale Inspector */}
          <div className="split-pane-detail-panel">
            {selectedSale ? (
              <>
                {/* Header */}
                <div className="flex-between border-bottom pb-sm">
                  <div>
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <h3 className="title-large" style={{ margin: 0 }}>
                        {selectedSaleCustomer ? selectedSaleCustomer.name : 'Walk-in Customer'}
                      </h3>
                      <span
                        className={`badge ${
                          selectedSale.status === 'COMPLETED' || !selectedSale.status || selectedSale.status === 'PAID'
                            ? 'badge-completed'
                            : selectedSale.status === 'VOIDED'
                            ? 'badge-voided'
                            : 'badge-refunded'
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {selectedSale.status || 'COMPLETED'}
                      </span>
                    </div>
                    <div className="body-small text-muted mt-xs">
                      Receipt #{selectedSale.sale_id} &bull; {formatDate(selectedSale.created_at || selectedSale.timestamp)}
                    </div>
                  </div>

                  <div className="flex-center gap-xs">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleOpenReceiptModal}
                      title="Open full printable receipt dialog"
                    >
                      🖨️ Receipt
                    </button>
                    {selectedSale.status === 'COMPLETED' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => openModal('voidSale', selectedSale)}
                        title="Void entire sale and restore inventory"
                      >
                        🚫 Void
                      </button>
                    )}
                  </div>
                </div>

                {/* Financial Summary Card */}
                <div className="p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '8px' }}>
                  <div className="flex-between mb-xs">
                    <span className="label-small text-muted font-weight-bold">TRANSACTION TOTAL</span>
                    <span className="title-large text-primary">{formatCents(selectedSale.total_amount_cents)}</span>
                  </div>

                  <div className="grid-2col gap-xs pt-xs border-top" style={{ fontSize: '12px', color: 'var(--market-text-secondary)' }}>
                    <div>COGS: <strong>{formatCents(selectedSale.total_cogs_cents)}</strong></div>
                    <div className="text-right">
                      Gross Profit: <strong className="text-success">{formatCents((selectedSale.total_amount_cents || 0) - (selectedSale.total_cogs_cents || 0))}</strong>
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown Card */}
                <div className="card p-sm">
                  <div className="label-small text-muted font-weight-bold mb-xs">PAYMENT TENDER BREAKDOWN</div>
                  {isLoadingPayments ? (
                    <div className="body-small text-muted text-center p-xs">Loading payment details...</div>
                  ) : selectedSalePayments.length === 0 ? (
                    <div className="body-small text-muted font-italic">Standard tender recorded</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedSalePayments.map(p => (
                        <div key={p.sale_payment_id || p.payment_id} className="flex-between body-small">
                          <span>
                            {p.payment_type === 'CASH' ? '💵 Cash' :
                             p.payment_type === 'DIGITAL' ? `📱 Digital (${p.digital_provider || 'Card'})` :
                             p.payment_type === 'HOUSE_TAB' ? '📝 House Tab' :
                             p.payment_type === 'STORE_CREDIT' ? '🎁 Store Credit' :
                             p.payment_type === 'PREPAID_DELIVERY' ? '📦 Prepaid Delivery' : p.payment_type}
                          </span>
                          <span className="font-weight-bold">{formatCents(p.amount_cents)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Itemized Line Items List */}
                <div className="card p-sm">
                  <div className="flex-between mb-xs">
                    <div className="label-small text-muted font-weight-bold">
                      ITEMIZED LINE ITEMS ({selectedSaleItems.length})
                    </div>
                  </div>

                  {selectedSaleItems.length === 0 ? (
                    <div className="text-center p-sm text-muted body-small font-italic">
                      No line items recorded for this sale.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedSaleItems.map(si => {
                        const pigment = safePigments.find(p => Number(p.pigment_id) === Number(si.pigment_id));
                        const pName = pigment ? pigment.name : `Pigment #${si.pigment_id}`;

                        return (
                          <div
                            key={si.sale_item_id}
                            className="flex-between p-xs"
                            style={{ background: 'var(--market-surface)', borderRadius: '6px', border: '1px solid var(--market-border-light)' }}
                          >
                            <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                              {pigment && (
                                <div
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    backgroundColor: pigment.color_code,
                                    border: '1px solid rgba(0,0,0,0.1)'
                                  }}
                                />
                              )}
                              <div>
                                <div className="body-medium font-weight-bold">{pName}</div>
                                <div className="label-small text-muted">{formatMgToGrams(si.weight_mg)}</div>
                              </div>
                            </div>

                            <div className="flex-center gap-xs">
                              <span className="body-medium font-weight-bold">{formatCents(si.price_charged_cents)}</span>
                              {selectedSale.status === 'COMPLETED' && (
                                <button
                                  className="btn btn-warning btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '10px' }}
                                  onClick={() => openModal('returnItem', { saleItem: si, pigment })}
                                  title="Return this item back into inventory"
                                >
                                  Return
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-xl text-muted">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👈</div>
                <div className="title-medium mb-xs">Select a Transaction</div>
                <p className="body-small text-muted">Click any sale on the left to inspect full items, payment tenders, and reprint receipts.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
