import React from 'react';
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

  const handleExportCsv = () => {
    if (safeSales.length === 0) return;

    const headers = ['Sale ID', 'Date', 'Customer', 'Status', 'Total Amount ($)', 'COGS ($)', 'Gross Profit ($)'];
    const rows = safeSales.map(s => {
      const cust = (customers || []).find(c => Number(c.customer_id) === Number(s.customer_id));
      const custName = cust ? cust.name : 'Walk-in';
      const totalD = ((s.total_amount_cents || 0) / 100).toFixed(2);
      const cogsD = ((s.total_cogs_cents || 0) / 100).toFixed(2);
      const profitD = (((s.total_amount_cents || 0) - (s.total_cogs_cents || 0)) / 100).toFixed(2);
      const dateStr = s.created_at ? new Date(s.created_at).toISOString() : '';

      return [
        s.sale_id,
        `"${dateStr}"`,
        `"${custName}"`,
        s.status,
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

  const handleViewReceipt = async (sale, items, cust) => {
    if (!db) return;
    try {
      const allPayments = await db.getAll('sale_payments');
      const payments = allPayments.filter(p => Number(p.sale_id) === Number(sale.sale_id));
      openModal('receiptModal', { sale, items, customer: cust, payments });
    } catch (e) {
      openModal('receiptModal', { sale, items, customer: cust, payments: [] });
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">📋 SALES HISTORY</h2>
          <p className="body-small text-muted">View past transactions, process returns, void sales, and print customer receipts.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} disabled={safeSales.length === 0}>
          📥 Export Sales CSV
        </button>
      </div>

      <div>
        {sales.map(s => {
          const cust = customers.find(c => Number(c.customer_id) === Number(s.customer_id));
          const custName = cust ? cust.name : 'Walk-in';
          const items = saleItems.filter(si => Number(si.sale_id) === Number(s.sale_id));
          const badgeClass = s.status === 'COMPLETED' ? 'badge-completed' : s.status === 'VOIDED' ? 'badge-voided' : 'badge-refunded';

          return (
            <div key={s.sale_id} className="sale-card">
              <div className="sale-card-header">
                <div>
                  <div className="title-medium">{custName}</div>
                  <div className="audit-time">
                    ID: {String(s.sale_id).substring(0, 8)} • {formatDate(s.created_at)}
                  </div>
                </div>
                <span className={`badge ${badgeClass}`}>{s.status}</span>
              </div>

              <div className="sale-card-body">
                {items.map(si => {
                  const p = pigments.find(pig => Number(pig.pigment_id) === Number(si.pigment_id));
                  const pName = p ? p.name : 'Unknown Pigment';
                  return (
                    <div key={si.sale_item_id} className="sale-item-row">
                      <div>
                        <span>{pName}</span>
                        <span className="text-muted" style={{ marginLeft: '10px' }}>{formatMgToGrams(si.weight_mg)}</span>
                      </div>
                      <div>
                        <strong>{formatCents(si.price_charged_cents)}</strong>
                        {s.status === 'COMPLETED' && (
                          <button
                            className="btn btn-warning btn-sm"
                            style={{ marginLeft: '10px' }}
                            onClick={() => openModal('returnItem', { saleItem: si, pigment: p })}
                          >
                            Return
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="divider" />

                <div className="flex-between">
                  <span className="title-medium">Total: {formatCents(s.total_amount_cents)}</span>
                  <div className="flex-center gap-xs">
                    <button className="btn btn-ghost btn-sm text-primary" onClick={() => handleViewReceipt(s, items, cust)}>
                      🖨️ Receipt
                    </button>
                    {s.status === 'COMPLETED' && (
                      <button className="btn btn-danger btn-sm" onClick={() => openModal('voidSale', s)}>
                        Void Sale
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
