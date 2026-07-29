import React from 'react';
import { usePos } from '../context/PosContext';
import { formatCents } from '../repository';

export const SupplierScreen = () => {
  const { suppliers, stockReceipts, openModal } = usePos();
  const safeSuppliers = suppliers || [];
  const safeReceipts = stockReceipts || [];

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">🏭 SUPPLIER MANAGEMENT & ACCOUNTS PAYABLE</h2>
          <p className="body-small text-muted">Manage pigment vendors, track restock balances, and settle supplier payables.</p>
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
    </div>
  );
};
