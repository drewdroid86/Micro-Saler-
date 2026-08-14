import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams, formatMgToOz } from '../repository';

export const InventoryScreen = () => {
  const { pigments, saleItems, priceTiers, openModal } = usePos();
  const safePigments = pigments || [];
  const safeSaleItems = saleItems || [];
  const safePriceTiers = priceTiers || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'LOW' | 'IN_STOCK'
  const [selectedPigmentId, setSelectedPigmentId] = useState(null);

  // Filtered pigments
  const filteredPigments = useMemo(() => {
    return safePigments.filter(p => {
      // 1. Stock Filter
      if (stockFilter === 'LOW' && (p.stock_mg || 0) >= 10000) return false;
      if (stockFilter === 'IN_STOCK' && (p.stock_mg || 0) <= 0) return false;

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const finishMatch = (p.finish_type || '').toLowerCase().includes(q);
        if (!nameMatch && !finishMatch) return false;
      }

      return true;
    });
  }, [safePigments, stockFilter, searchQuery]);

  // Selected pigment for detail inspector
  const selectedPigment = useMemo(() => {
    if (selectedPigmentId) {
      const found = filteredPigments.find(p => Number(p.pigment_id) === Number(selectedPigmentId));
      if (found) return found;
      const foundInAll = safePigments.find(p => Number(p.pigment_id) === Number(selectedPigmentId));
      if (foundInAll) return foundInAll;
    }
    return filteredPigments[0] || null;
  }, [selectedPigmentId, filteredPigments, safePigments]);

  // Selected pigment tiers
  const selectedPigmentTiers = useMemo(() => {
    if (!selectedPigment) return [];
    return safePriceTiers.filter(t => Number(t.pigment_id) === Number(selectedPigment.pigment_id));
  }, [selectedPigment, safePriceTiers]);

  // Total stock stats
  const inventoryStats = useMemo(() => {
    let totalStockMg = 0;
    let totalValueCents = 0;
    let lowStockCount = 0;

    safePigments.forEach(p => {
      totalStockMg += p.stock_mg || 0;
      totalValueCents += p.total_cost_cents || 0;
      if ((p.stock_mg || 0) < 10000) {
        lowStockCount += 1;
      }
    });

    return {
      totalStockMg,
      totalValueCents,
      lowStockCount,
      totalCount: safePigments.length
    };
  }, [safePigments]);

  return (
    <div className="inventory-screen-container">
      {/* Section Header */}
      <div className="section-header mb-md">
        <div>
          <h2 className="section-title">📦 INVENTORY & PIGMENT MANAGEMENT</h2>
          <p className="body-small text-muted">Manage mica pigment stock weights, track Weighted Average Cost (WAC), log shrinkage, and configure tier pricing.</p>
        </div>
        <div className="flex-center gap-xs">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => openModal('HELP', { section: 'inventory-shrinkage' })}
            title="Open Inventory & Shrinkage Guide"
          >
            ❓ Inventory Guide
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('clearInventory')}>
            🧹 Clear Inventory
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addPigment')}>
            + New Pigment
          </button>
        </div>
      </div>

      {/* KPI Overview Summary Bar */}
      <div className="grid-4col mb-md" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-primary)' }}>
          <div className="label-small text-muted">TOTAL STOCK ON HAND</div>
          <div className="title-medium text-primary mt-xs">{formatMgToGrams(inventoryStats.totalStockMg)}</div>
          <div className="body-small text-muted">{formatMgToOz(inventoryStats.totalStockMg)} total weight</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-green-primary)' }}>
          <div className="label-small text-muted">TOTAL COST BASIS (WAC)</div>
          <div className="title-medium text-success mt-xs">{formatCents(inventoryStats.totalValueCents)}</div>
          <div className="body-small text-muted">Aggregate inventory valuation</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-warning)' }}>
          <div className="label-small text-muted">LOW STOCK ALERTS (&lt;10g)</div>
          <div className={`title-medium mt-xs ${inventoryStats.lowStockCount > 0 ? 'text-warning' : 'text-success'}`}>
            {inventoryStats.lowStockCount} Pigment(s)
          </div>
          <div className="body-small text-muted">Need restock attention</div>
        </div>

        <div className="card p-sm" style={{ borderLeft: '4px solid var(--market-border)' }}>
          <div className="label-small text-muted">PIGMENT CATALOG</div>
          <div className="title-medium mt-xs">{inventoryStats.totalCount} Types</div>
          <div className="body-small text-muted">Active mica pigments</div>
        </div>
      </div>

      {/* Cost vs Revenue Chart */}
      <div className="chart-container mb-md">
        <div className="flex-between mb-sm">
          <h3 className="title-medium">Cost vs Revenue Performance</h3>
          <span className="body-small text-muted">Revenue earned vs total purchase cost</span>
        </div>
        <div>
          {safePigments.map(p => {
            const cost = p.total_cost_cents || 0;
            const rev = safeSaleItems.filter(si => Number(si.pigment_id) === Number(p.pigment_id)).reduce((sum, si) => sum + (si.price_charged_cents || 0), 0);
            const maxVal = Math.max(cost, rev, 1);
            const costPct = (cost / maxVal) * 100;
            const revPct = (rev / maxVal) * 100;
            const isProfit = rev >= cost;

            return (
              <div key={p.pigment_id} className="chart-row">
                <div className="chart-label">
                  <span className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: p.color_code, display: 'inline-block' }} />
                    {p.name}
                  </span>
                  <span className={isProfit ? 'text-success font-weight-bold' : 'text-error font-weight-bold'}>
                    {isProfit ? '+' : ''}{formatCents(rev - cost)}
                  </span>
                </div>
                <div className="chart-bar-bg mb-xs" title={`Cost: ${formatCents(cost)}`}>
                  <div className="chart-bar" style={{ width: `${costPct}%`, background: 'var(--market-error)' }} />
                </div>
                <div className="chart-bar-bg" title={`Revenue: ${formatCents(rev)}`}>
                  <div className="chart-bar revenue" style={{ width: `${revPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Stock Filter Toolbar */}
      <div className="card p-sm mb-md flex-between" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '220px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Search pigments by name or finish type..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="flex-center gap-xs">
          <button
            className={`btn btn-sm ${stockFilter === 'ALL' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStockFilter('ALL')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            All Stock ({safePigments.length})
          </button>
          <button
            className={`btn btn-sm ${stockFilter === 'LOW' ? 'btn-danger' : 'btn-ghost'}`}
            onClick={() => setStockFilter('LOW')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            ⚠️ Low Stock ({inventoryStats.lowStockCount})
          </button>
          <button
            className={`btn btn-sm ${stockFilter === 'IN_STOCK' ? 'btn-success' : 'btn-ghost'}`}
            onClick={() => setStockFilter('IN_STOCK')}
            style={{ fontSize: '11px', padding: '4px 8px' }}
          >
            📦 In Stock
          </button>
        </div>
      </div>

      {/* Responsive Split-Pane Layout */}
      {filteredPigments.length === 0 ? (
        <div className="card text-center p-xl mb-lg">
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📦</div>
          <div className="title-medium mb-xs">No pigments found</div>
          <p className="body-small text-muted mb-md">
            {searchQuery ? `No pigments matching "${searchQuery}" under filter.` : 'No pigments added to inventory yet.'}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addPigment')}>
            + Add New Pigment
          </button>
        </div>
      ) : (
        <div className="split-pane-layout mb-lg">
          {/* Left Panel: Pigment Directory Cards */}
          <div className="split-pane-list-panel">
            <div className="body-small text-muted px-xs flex-between">
              <span>Showing {filteredPigments.length} pigment(s)</span>
              <span>Tap to inspect</span>
            </div>

            {filteredPigments.map(p => {
              const isSelected = selectedPigment && Number(selectedPigment.pigment_id) === Number(p.pigment_id);
              const isLowStock = (p.stock_mg || 0) < 10000;
              const wac = p.stock_mg > 0 ? (p.total_cost_cents / p.stock_mg) * 1000 : 0;

              return (
                <div
                  key={p.pigment_id}
                  className={`card split-pane-selectable-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedPigmentId(p.pigment_id)}
                  style={{ padding: '12px 14px' }}
                >
                  <div className="flex-between mb-xs">
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: p.color_code,
                          border: '1px solid rgba(0,0,0,0.15)',
                          flexShrink: 0
                        }}
                      />
                      <strong className="body-large" style={{ color: isSelected ? 'var(--market-primary)' : 'inherit' }}>
                        {p.name}
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className={`body-medium font-weight-bold ${isLowStock ? 'text-error' : ''}`}>
                        {formatMgToGrams(p.stock_mg || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-between body-small text-muted">
                    <span>{p.finish_type}</span>
                    <span>WAC: {formatCents(Math.round(wac))}/g &bull; Retail: {formatCents(p.retail_price_per_gram_cents)}/g</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Panel: Sticky Pigment Detail Inspector */}
          <div className="split-pane-detail-panel">
            {selectedPigment ? (
              <>
                {/* Header */}
                <div className="flex-between border-bottom pb-sm">
                  <div className="flex-center gap-sm" style={{ justifyContent: 'flex-start' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: selectedPigment.color_code,
                        border: '2px solid rgba(0,0,0,0.15)',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    />
                    <div>
                      <h3 className="title-large" style={{ margin: 0 }}>{selectedPigment.name}</h3>
                      <div className="body-small text-muted">
                        Finish: <strong>{selectedPigment.finish_type}</strong> &bull; Pigment ID #{selectedPigment.pigment_id}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openModal('editPigment', selectedPigment)}
                    title="Edit Pigment Details, Colors & Prices"
                  >
                    ✏️ Edit Pigment
                  </button>
                </div>

                {/* Stock & Value Metrics Card */}
                <div className="p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '8px' }}>
                  <div className="flex-between mb-xs">
                    <span className="label-small text-muted font-weight-bold">CURRENT STOCK LEVEL</span>
                    <span className={`title-large ${(selectedPigment.stock_mg || 0) < 10000 ? 'text-error' : 'text-success'}`}>
                      {formatMgToGrams(selectedPigment.stock_mg || 0)}
                    </span>
                  </div>

                  <div className="grid-3col gap-xs pt-xs border-top" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', fontSize: '12px' }}>
                    <div>
                      <div className="label-small text-muted">WAC Cost/g</div>
                      <strong className="body-medium">
                        {formatCents(Math.round(selectedPigment.stock_mg > 0 ? (selectedPigment.total_cost_cents / selectedPigment.stock_mg) * 1000 : 0))}
                      </strong>
                    </div>
                    <div>
                      <div className="label-small text-muted">Retail/g</div>
                      <strong className="body-medium">{formatCents(selectedPigment.retail_price_per_gram_cents)}</strong>
                    </div>
                    <div>
                      <div className="label-small text-muted">Wholesale/g</div>
                      <strong className="body-medium">{formatCents(selectedPigment.wholesale_price_per_gram_cents)}</strong>
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="grid-2col gap-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => openModal('restock', selectedPigment)}
                    title="Log new shipment and recalculate WAC cost basis"
                  >
                    📦 Restock Stock
                  </button>
                  <button
                    className="btn btn-warning btn-sm"
                    onClick={() => openModal('shrinkage', selectedPigment)}
                    title="Record spillage, residue, or testing loss"
                  >
                    ⚠️ Log Spillage / Loss
                  </button>
                </div>

                {/* Tier Pricing Schedule (if any) */}
                {selectedPigmentTiers.length > 0 && (
                  <div className="card p-sm">
                    <div className="label-small text-muted font-weight-bold mb-xs">WEIGHT TIER PRICING SCHEDULE</div>
                    <div className="help-table-responsive">
                      <table className="help-table" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Weight</th>
                            <th>Retail Price</th>
                            <th>Wholesale Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPigmentTiers.map(t => (
                            <tr key={t.tier_id || t.weight_mg}>
                              <td><strong>{formatMgToGrams(t.weight_mg)}</strong></td>
                              <td>{formatCents(t.retail_price_cents)}</td>
                              <td>{formatCents(t.wholesale_price_cents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center p-xl text-muted">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>👈</div>
                <div className="title-medium mb-xs">Select a Pigment</div>
                <p className="body-small text-muted">Click any pigment on the left to inspect WAC cost, restock, or log spillage.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
