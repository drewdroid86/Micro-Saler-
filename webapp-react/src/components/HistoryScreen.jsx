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
  const { sales, saleItems, pigments, customers, openModal } = usePos();

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📋 SALES HISTORY</h2>
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
                  {s.status === 'COMPLETED' && (
                    <button className="btn btn-danger btn-sm" onClick={() => openModal('voidSale', s)}>
                      Void Sale
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
