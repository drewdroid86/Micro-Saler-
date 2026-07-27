import React from 'react';
import { usePos } from '../context/PosContext';
import { formatCents } from '../repository';

export const CustomerScreen = () => {
  const { customers, openModal } = usePos();

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">👥 CUSTOMER HOUSE TABS</h2>
        <button className="btn btn-primary btn-sm" onClick={() => openModal('addCustomer')}>
          + New Customer
        </button>
      </div>

      <div className="grid-2col">
        {customers.map(c => {
          const bal = c.current_balance_cents;
          const lim = c.credit_limit_cents;
          const pct = lim > 0 ? Math.min((bal / lim) * 100, 100) : 0;
          const badgeClass = c.trust_status === 'VIP'
            ? 'badge-vip'
            : c.trust_status === 'PAUSED'
            ? 'badge-paused'
            : 'badge-good-standing';

          return (
            <div key={c.customer_id} className="customer-card">
              <div className="customer-card-header">
                <div>
                  <div className="customer-name">{c.name}</div>
                  <div className="customer-phone">{c.phone_number || c.phone || 'No phone'}</div>
                </div>
                <span className={`badge ${badgeClass}`}>{c.trust_status}</span>
              </div>

              <div>
                <div className="flex-between body-medium mb-xs">
                  <span>Balance: <strong className={pct >= 100 ? 'text-error' : ''}>{formatCents(bal)}</strong></span>
                  <span className="text-muted">Limit: {formatCents(lim)}</span>
                </div>
                <div className="customer-balance-bar">
                  <div
                    className="customer-balance-fill"
                    style={{
                      width: `${pct}%`,
                      background: pct >= 90 ? 'var(--market-error)' : pct >= 75 ? 'var(--market-warning)' : 'var(--market-green-primary)'
                    }}
                  />
                </div>
              </div>

              <button className="btn btn-success btn-block mt-sm" onClick={() => openModal('settleTab', c)}>
                Settle Tab
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
