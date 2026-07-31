import React from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const CustomerScreen = () => {
  const { customers, customerPrepayments, repo, openModal, refreshAllData, showToast } = usePos();
  const safeCustomers = customers || [];
  const safePrepayments = customerPrepayments || [];

  const handleFulfill = async (prepaymentId) => {
    try {
      await repo.fulfillCustomerPrepayment(prepaymentId);
      await refreshAllData();
      showToast('Prepayment marked as delivered / fulfilled!', 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2 className="section-title">👥 CUSTOMER ACCOUNTS & BACKORDERS</h2>
          <p className="body-small text-muted">Manage customer house tabs, credit limits, prepaid deliveries, and stock backorders.</p>
        </div>
        <div className="flex-center gap-xs">
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('addCustomerPrepayment')}>
            📦 + Prepaid / Backorder
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addCustomer')}>
            + New Customer
          </button>
        </div>
      </div>

      <div className="grid-2col mb-lg">
        {safeCustomers.map(c => {
          const bal = c.current_balance_cents;
          const lim = c.credit_limit_cents;
          const pct = lim > 0 ? Math.min((bal / lim) * 100, 100) : 0;
          const badgeClass = c.trust_status === 'VIP'
            ? 'badge-vip'
            : c.trust_status === 'PAUSED'
            ? 'badge-paused'
            : 'badge-good-standing';

          const activePrepayments = safePrepayments.filter(
            p => Number(p.customer_id) === Number(c.customer_id) && p.status !== 'FULFILLED'
          );
          const totalWeightOwedMg = activePrepayments.reduce((sum, p) => sum + (p.weight_mg || 0), 0);
          const totalCreditCents = activePrepayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0);

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

              {(totalWeightOwedMg > 0 || totalCreditCents > 0) && (
                <div className="p-xs mt-sm body-small flex-between" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px', alignItems: 'center' }}>
                  <div>
                    <div className="font-weight-bold text-success">
                      📦 Owed: {totalWeightOwedMg > 0 ? formatMgToGrams(totalWeightOwedMg) : ''} {totalCreditCents > 0 ? `(${formatCents(totalCreditCents)} Credit)` : ''}
                    </div>
                    <div className="text-muted font-italic" style={{ fontSize: '11px' }}>
                      {activePrepayments.length} pending delivery
                    </div>
                  </div>
                  <button
                    className="btn btn-success btn-sm"
                    style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                    onClick={async () => {
                      for (const p of activePrepayments) {
                        await handleFulfill(p.prepayment_id);
                      }
                    }}
                    title="Mark all pending prepayments for this customer as delivered"
                  >
                    ✅ Mark Delivered
                  </button>
                </div>
              )}

              <button className="btn btn-success btn-block mt-sm" onClick={() => openModal('settleTab', c)}>
                Settle Tab
              </button>
            </div>
          );
        })}
      </div>

      {/* Prepaid Deliveries & Backordered Stock Ledger */}
      <div className="card mt-lg">
        <div className="card-header border-bottom pb-sm mb-md flex-between">
          <h3 className="title-medium">📦 Customer Prepayments & Backordered Stock Ledger</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('addCustomerPrepayment')}>
            + Record Prepayment
          </button>
        </div>

        {safePrepayments.length === 0 ? (
          <div className="text-center p-md text-muted">No prepaid deliveries or backorders recorded yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {safePrepayments.map(p => {
              const customer = safeCustomers.find(c => Number(c.customer_id) === Number(p.customer_id));
              const isFulfilled = p.status === 'FULFILLED';
              const statusBadgeClass = p.status === 'FULFILLED'
                ? 'badge-good-standing'
                : p.status === 'AWAITING_STOCK'
                ? 'badge-paused'
                : 'badge-vip';

              return (
                <div key={p.prepayment_id} className="flex-between p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px', opacity: isFulfilled ? 0.6 : 1 }}>
                  <div>
                    <div className="body-medium font-weight-bold">
                      {customer ? customer.name : `Customer #${p.customer_id}`} — {p.pigment_name ? p.pigment_name : 'General Credit'}
                    </div>
                    <div className="body-small text-muted">
                      {p.weight_mg > 0 ? `Weight Owed: ${formatMgToGrams(p.weight_mg)} • ` : ''}
                      {p.amount_cents > 0 ? `Paid Credit: ${formatCents(p.amount_cents)} • ` : ''}
                      Date: {new Date(p.created_at || Date.now()).toLocaleDateString()}
                    </div>
                    {p.notes && (
                      <div className="body-small text-muted font-italic mt-xs">
                        Note: {p.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex-center gap-sm">
                    <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '10px' }}>
                      {p.status || 'PENDING_DELIVERY'}
                    </span>
                    {!isFulfilled && (
                      <button className="btn btn-success btn-sm" onClick={() => handleFulfill(p.prepayment_id)}>
                        ✅ Delivered
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
