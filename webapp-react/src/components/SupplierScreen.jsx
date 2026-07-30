import React from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const SupplierScreen = () => {
  const { suppliers, pigments, stockReceipts, openModal } = usePos();
  const safeSuppliers = suppliers || [];
  const safeReceipts = stockReceipts || [];

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🏭 SUPPLIER MANAGEMENT & ACCOUNTS PAYABLE</h2>
          <p className="body-small text-muted">Manage pigment vendors, track restock balances, settle supplier payables, and void accidental restock entries.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openModal('addSupplier')}>
          + New Supplier
        </button>
      </div>

      <div className="grid-2col mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {safeSuppliers.length === 0 ? (
          <div className="card text-center p-lg text-muted" style={{ gridColumn: '1 / -1' }}>
            No suppliers created yet. Click <strong>+ New Supplier</strong> to add vendor contacts and manage supplier tabs.
          </div>
        ) : (
          safeSuppliers.map(s => {
            const bal = s.current_balance_cents || 0;
            const supplierNameLower = (s.name || '').toLowerCase();
            const supplierReceipts = safeReceipts.filter(r => Number(r.supplier_id) === Number(s.supplier_id) || (r.supplier_name && r.supplier_name.toLowerCase() === supplierNameLower));
            const totalRestockedCents = supplierReceipts.reduce((sum, r) => sum + (r.total_cost_cents || 0), 0);

            return (
              <div key={s.supplier_id} className="card">
                <div className="flex-between mb-sm">
                  <div>
                    <h3 className="title-medium">{s.name}</h3>
                    <div className="body-small text-muted">{s.phone_number || 'No phone number'}</div>
                  </div>
                  <span className={`badge ${bal > 0 ? 'badge-paused' : 'badge-good-standing'}`}>
                    {bal > 0 ? 'OWED UNPAID' : 'PAID UP'}
                  </span>
                </div>

                <div className="p-sm mb-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
                  <div className="flex-between body-medium mb-xs">
                    <span>Account Balance (Owed):</span>
                    <strong className={bal > 0 ? 'text-error' : 'text-success'}>
                      {formatCents(bal)}
                    </strong>
                  </div>
                  <div className="flex-between body-small text-muted">
                    <span>Total Purchase Receipts:</span>
                    <span>{formatCents(totalRestockedCents)}</span>
                  </div>
                </div>

                {s.notes && (
                  <p className="body-small text-muted mb-sm" style={{ fontStyle: 'italic' }}>
                    Note: {s.notes}
                  </p>
                )}

                <div className="flex-center gap-sm">
                  <button className="btn btn-warning btn-block" onClick={() => openModal('paySupplier', s)}>
                    💵 Pay Supplier Balance
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Restock Purchase Receipts Ledger */}
      <div className="card mt-lg">
        <div className="card-header border-bottom pb-sm mb-md">
          <h3 className="title-medium">📦 Recent Supplier Restock Receipts</h3>
        </div>

        {safeReceipts.length === 0 ? (
          <div className="text-center p-md text-muted">No restock receipts recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {safeReceipts.map(r => {
              const pigment = (pigments || []).find(p => Number(p.pigment_id) === Number(r.pigment_id));
              const isVoided = r.payment_status === 'VOIDED';

              return (
                <div key={r.stock_receipt_id || r.receipt_id} className="flex-between p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px', opacity: isVoided ? 0.6 : 1 }}>
                  <div>
                    <div className="body-medium font-weight-bold">
                      {pigment ? pigment.name : `Pigment #${r.pigment_id}`} — {formatMgToGrams(r.received_mg || 0)}
                    </div>
                    <div className="body-small text-muted">
                      Supplier: {r.supplier_name || 'Direct Restock'} • {new Date(r.received_at || Date.now()).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex-center gap-sm">
                    <div className="text-right">
                      <div className="body-medium font-weight-bold">{formatCents(r.total_cost_cents)}</div>
                      <span className={`badge ${isVoided ? 'badge-voided' : 'badge-completed'}`} style={{ fontSize: '10px' }}>
                        {r.payment_status || 'PAID'}
                      </span>
                    </div>
                    {!isVoided && (
                      <button className="btn btn-danger btn-sm" onClick={() => openModal('voidStockReceipt', r)}>
                        🗑️ Void
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
