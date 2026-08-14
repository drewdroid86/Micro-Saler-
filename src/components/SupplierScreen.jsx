import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const SupplierScreen = () => {
  const { suppliers, pigments, stockReceipts, openModal } = usePos();
  const safeSuppliers = suppliers || [];
  const safeReceipts = stockReceipts || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('ALL'); // 'ALL' | 'OWED' | 'PAID'
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);

  // High-level supplier KPIs
  const supplierMetrics = useMemo(() => {
    let totalPayablesCents = 0;
    let owedSuppliersCount = 0;
    let paidSuppliersCount = 0;

    safeSuppliers.forEach(s => {
      const bal = Number(s.current_balance_cents) || 0;
      if (bal > 0) {
        totalPayablesCents += bal;
        owedSuppliersCount += 1;
      } else {
        paidSuppliersCount += 1;
      }
    });

    const totalReceiptsCostCents = safeReceipts
      .filter(r => r.payment_status !== 'VOIDED')
      .reduce((sum, r) => sum + (r.total_cost_cents || 0), 0);

    return {
      totalPayablesCents,
      owedSuppliersCount,
      paidSuppliersCount,
      totalSuppliers: safeSuppliers.length,
      totalReceiptsCostCents,
      totalReceiptsCount: safeReceipts.length
    };
  }, [safeSuppliers, safeReceipts]);

  // Filtered suppliers based on search query and balance filter
  const filteredSuppliers = useMemo(() => {
    return safeSuppliers.filter(s => {
      const bal = Number(s.current_balance_cents) || 0;
      if (balanceFilter === 'OWED' && bal <= 0) return false;
      if (balanceFilter === 'PAID' && bal > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (s.name || '').toLowerCase().includes(q);
        const phoneMatch = (s.phone_number || '').toLowerCase().includes(q);
        const notesMatch = (s.notes || '').toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !notesMatch) return false;
      }

      return true;
    });
  }, [safeSuppliers, balanceFilter, searchQuery]);

  // Active selected supplier
  const selectedSupplier = useMemo(() => {
    if (selectedSupplierId) {
      const found = filteredSuppliers.find(s => Number(s.supplier_id) === Number(selectedSupplierId));
      if (found) return found;
      const foundInAll = safeSuppliers.find(s => Number(s.supplier_id) === Number(selectedSupplierId));
      if (foundInAll) return foundInAll;
    }
    return filteredSuppliers[0] || null;
  }, [selectedSupplierId, filteredSuppliers, safeSuppliers]);

  // Receipts for the selected supplier
  const selectedSupplierReceipts = useMemo(() => {
    if (!selectedSupplier) return [];
    const nameLower = (selectedSupplier.name || '').toLowerCase();
    return safeReceipts.filter(
      r => Number(r.supplier_id) === Number(selectedSupplier.supplier_id) || (r.supplier_name && r.supplier_name.toLowerCase() === nameLower)
    );
  }, [selectedSupplier, safeReceipts]);

  const selectedSupplierTotalRestockedCents = useMemo(() => {
    return selectedSupplierReceipts
      .filter(r => r.payment_status !== 'VOIDED')
      .reduce((sum, r) => sum + (r.total_cost_cents || 0), 0);
  }, [selectedSupplierReceipts]);

  return (
    <div className="supplier-screen-container">
      {/* Section Header */}
      <div className="section-header mb-md">
        <div>
          <h2 className="section-title">🏭 SUPPLIER MANAGEMENT & ACCOUNTS PAYABLE</h2>
          <p className="body-small text-muted">Manage pigment vendors, track restock balances, settle supplier payables, and void accidental restock entries.</p>
        </div>
        <div className="flex-center gap-xs">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => openModal('HELP', { section: 'suppliers' })}
            title="Open Suppliers & Accounts Payable Guide"
          >
            ❓ Supplier Guide
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addSupplier')}>
            + New Supplier
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      <div className="grid-4col mb-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-warning)' }}>
          <div className="label-small text-muted">ACCOUNTS PAYABLE (OWED)</div>
          <div className="title-medium text-error mt-xs">{formatCents(supplierMetrics.totalPayablesCents)}</div>
          <div className="body-small text-muted">{supplierMetrics.owedSuppliersCount} vendor(s) with unpaid balance</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-success)' }}>
          <div className="label-small text-muted">SETTLED VENDORS</div>
          <div className="title-medium text-success mt-xs">{supplierMetrics.paidSuppliersCount} Paid Up</div>
          <div className="body-small text-muted">Zero outstanding restock tabs</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-primary)' }}>
          <div className="label-small text-muted">TOTAL RESTOCK EXPENSES</div>
          <div className="title-medium text-primary mt-xs">{formatCents(supplierMetrics.totalReceiptsCostCents)}</div>
          <div className="body-small text-muted">{supplierMetrics.totalReceiptsCount} total stock receipts</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-border)' }}>
          <div className="label-small text-muted">REGISTERED SUPPLIERS</div>
          <div className="title-medium mt-xs">{supplierMetrics.totalSuppliers} Vendors</div>
          <div className="body-small text-muted">Vendor contacts on file</div>
        </div>
      </div>

      {/* Toolbar: Search and Filter Pills */}
      <div className="card p-sm mb-md flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search suppliers by name, phone, or notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="flex-center gap-xs">
          <button
            className={`btn btn-sm ${balanceFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setBalanceFilter('ALL')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            All Vendors ({supplierMetrics.totalSuppliers})
          </button>
          <button
            className={`btn btn-sm ${balanceFilter === 'OWED' ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => setBalanceFilter('OWED')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            🔴 Owed ({supplierMetrics.owedSuppliersCount})
          </button>
          <button
            className={`btn btn-sm ${balanceFilter === 'PAID' ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => setBalanceFilter('PAID')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            🟢 Paid Up ({supplierMetrics.paidSuppliersCount})
          </button>
        </div>
      </div>

      {/* Responsive Split-Pane Layout */}
      {filteredSuppliers.length === 0 ? (
        <div className="card text-center p-xl mb-lg">
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🏭</div>
          <div className="title-medium mb-xs">No matching suppliers found</div>
          <p className="body-small text-muted mb-md">
            {searchQuery ? `No supplier records matching "${searchQuery}" under filter.` : 'No suppliers registered in this category.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addSupplier')}>
            + Add New Supplier
          </button>
        </div>
      ) : (
        <div className="split-pane-layout mb-lg">
          {/* Left Panel: Supplier Directory Cards */}
          <div className="split-pane-list-panel">
            <div className="body-small text-muted px-xs flex-between">
              <span>Showing {filteredSuppliers.length} supplier(s)</span>
              <span>Tap to inspect & settle</span>
            </div>

            {filteredSuppliers.map(s => {
              const bal = Number(s.current_balance_cents) || 0;
              const isSelected = selectedSupplier && Number(selectedSupplier.supplier_id) === Number(s.supplier_id);
              const nameLower = (s.name || '').toLowerCase();
              const receiptsCount = safeReceipts.filter(
                r => Number(r.supplier_id) === Number(s.supplier_id) || (r.supplier_name && r.supplier_name.toLowerCase() === nameLower)
              ).length;

              return (
                <div
                  key={s.supplier_id}
                  className={`card split-pane-selectable-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedSupplierId(s.supplier_id)}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex-between mb-xs">
                    <strong className="body-large" style={{ color: isSelected ? 'var(--market-primary)' : 'inherit' }}>
                      {s.name}
                    </strong>
                    <span className={`badge ${bal > 0 ? 'badge-paused' : 'badge-good-standing'}`} style={{ fontSize: '10px' }}>
                      {bal > 0 ? `OWED ${formatCents(bal)}` : 'PAID UP'}
                    </span>
                  </div>

                  <div className="flex-between body-small text-muted">
                    <span>{s.phone_number || 'No phone recorded'}</span>
                    <span>{receiptsCount} purchase receipt(s)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Panel: Sticky Supplier Detail Inspector */}
          <div className="split-pane-detail-panel">
            {selectedSupplier ? (
              <>
                {/* Header */}
                <div className="flex-between border-bottom pb-sm">
                  <div>
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      <h3 className="title-large" style={{ margin: 0 }}>{selectedSupplier.name}</h3>
                      <span
                        className={`badge ${
                          (Number(selectedSupplier.current_balance_cents) || 0) > 0 ? 'badge-paused' : 'badge-good-standing'
                        }`}
                        style={{ fontSize: '10px' }}
                      >
                        {(Number(selectedSupplier.current_balance_cents) || 0) > 0 ? 'OWED UNPAID' : 'PAID UP'}
                      </span>
                    </div>
                    <div className="body-small text-muted mt-xs">
                      📞 {selectedSupplier.phone_number || 'No phone number'} &bull; Vendor ID #{selectedSupplier.supplier_id}
                    </div>
                    {selectedSupplier.notes && (
                      <div className="body-small text-muted font-italic mt-xs">
                        📝 {selectedSupplier.notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Balance Summary Card */}
                <div
                  className="p-md"
                  style={{
                    background: (Number(selectedSupplier.current_balance_cents) || 0) > 0
                      ? 'rgba(217, 119, 6, 0.08)'
                      : 'var(--market-surface-variant)',
                    borderRadius: '8px',
                    border: `1px solid ${
                      (Number(selectedSupplier.current_balance_cents) || 0) > 0
                        ? 'rgba(217, 119, 6, 0.3)'
                        : 'var(--market-border-light)'
                    }`
                  }}
                >
                  <div className="flex-between mb-xs">
                    <span className="label-small text-muted" style={{ fontWeight: 700 }}>
                      {(Number(selectedSupplier.current_balance_cents) || 0) > 0
                        ? '🔴 SUPPLIER TAB LIABILITY (OWED BY YOU)'
                        : '🟢 SUPPLIER ACCOUNT SETTLED'}
                    </span>
                    <span
                      className={`title-large ${
                        (Number(selectedSupplier.current_balance_cents) || 0) > 0 ? 'text-error' : 'text-success'
                      }`}
                    >
                      {formatCents(selectedSupplier.current_balance_cents || 0)}
                    </span>
                  </div>

                  <div className="flex-between body-small text-muted mt-sm pt-xs border-top">
                    <span>Lifetime Restock Purchases:</span>
                    <strong>{formatCents(selectedSupplierTotalRestockedCents)}</strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex-center gap-xs">
                  <button
                    className="btn btn-warning btn-block"
                    onClick={() => openModal('paySupplier', selectedSupplier)}
                    title="Record a cash/digital payout against this supplier balance"
                  >
                    💵 Pay Supplier Balance
                  </button>
                </div>

                {/* Supplier Specific Restock Receipts */}
                <div className="card p-sm">
                  <div className="flex-between mb-xs">
                    <div className="label-small text-muted font-weight-bold">
                      RESTOCK RECEIPTS FOR {selectedSupplier.name.toUpperCase()} ({selectedSupplierReceipts.length})
                    </div>
                  </div>

                  {selectedSupplierReceipts.length === 0 ? (
                    <div className="text-center p-md text-muted body-small font-italic">
                      No stock receipts recorded for this vendor yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                      {selectedSupplierReceipts.map(r => {
                        const pigment = (pigments || []).find(p => Number(p.pigment_id) === Number(r.pigment_id));
                        const isVoided = r.payment_status === 'VOIDED';

                        return (
                          <div
                            key={r.stock_receipt_id || r.receipt_id}
                            className="flex-between p-xs"
                            style={{
                              background: 'var(--market-surface)',
                              borderRadius: '6px',
                              border: '1px solid var(--market-border-light)',
                              opacity: isVoided ? 0.6 : 1
                            }}
                          >
                            <div>
                              <div className="body-medium font-weight-bold">
                                {pigment ? pigment.name : `Pigment #${r.pigment_id}`} — {formatMgToGrams(r.received_mg || 0)}
                              </div>
                              <div className="label-small text-muted">
                                {new Date(r.received_at || Date.now()).toLocaleDateString()} &bull; Total: <strong>{formatCents(r.total_cost_cents)}</strong>
                              </div>
                            </div>

                            <div className="flex-center gap-xs">
                              <span className={`badge ${isVoided ? 'badge-voided' : 'badge-completed'}`} style={{ fontSize: '9px', padding: '2px 5px' }}>
                                {r.payment_status || 'PAID'}
                              </span>
                              {!isVoided && (
                                <>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '2px 6px', fontSize: '10px' }}
                                    onClick={() => openModal('editRestockTerms', r)}
                                    title="Edit restock payment terms"
                                  >
                                    ✏️ Terms
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '2px 6px', fontSize: '10px' }}
                                    onClick={() => openModal('voidStockReceipt', r)}
                                    title="Void accidental restock receipt"
                                  >
                                    🗑️ Void
                                  </button>
                                </>
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
                <div className="title-medium mb-xs">Select a Supplier</div>
                <p className="body-small text-muted">Click any supplier on the left to view restock history and settle accounts payable.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global Restock Purchase Receipts Ledger */}
      <div className="card mt-lg">
        <div className="card-header border-bottom pb-sm mb-md">
          <h3 className="title-medium">📦 Global Supplier Restock Receipts History</h3>
          <p className="body-small text-muted" style={{ margin: 0 }}>Chronological log of all inventory purchases, vendor bills, and stock intake receipts.</p>
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
                      Supplier: <strong>{r.supplier_name || 'Direct Restock'}</strong> &bull; Date: {new Date(r.received_at || Date.now()).toLocaleDateString()}
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
                      <div className="flex-center gap-xs">
                        <button className="btn btn-secondary btn-sm" onClick={() => openModal('editRestockTerms', r)}>
                          ✏️ Terms
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => openModal('voidStockReceipt', r)}>
                          🗑️ Void
                        </button>
                      </div>
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
