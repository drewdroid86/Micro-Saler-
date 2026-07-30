import React from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const InventoryScreen = () => {
  const { pigments, saleItems, openModal } = usePos();

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📦 INVENTORY MANAGEMENT</h2>
        <div className="flex-center gap-xs">
          <button className="btn btn-secondary btn-sm" onClick={() => openModal('clearInventory')}>
            🧹 Clear Inventory
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => openModal('addPigment')}>
            + New Pigment
          </button>
        </div>
      </div>

      <div className="chart-container">
        <h3 className="title-medium mb-md">Cost vs Revenue Chart</h3>
        <div>
          {pigments.map(p => {
            const cost = p.total_cost_cents;
            const rev = saleItems.filter(si => Number(si.pigment_id) === Number(p.pigment_id)).reduce((sum, si) => sum + si.price_charged_cents, 0);
            const maxVal = Math.max(cost, rev, 1);
            const costPct = (cost / maxVal) * 100;
            const revPct = (rev / maxVal) * 100;
            const isProfit = rev >= cost;

            return (
              <div key={p.pigment_id} className="chart-row">
                <div className="chart-label">
                  <span>{p.name}</span>
                  <span className={isProfit ? 'text-success' : 'text-error'}>
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

      <div className="grid-2col">
        {pigments.map(p => {
          const wac = p.stock_mg > 0 ? (p.total_cost_cents / p.stock_mg) * 1000 : 0;
          return (
            <div key={p.pigment_id} className="inventory-card">
              <div className="inventory-card-header">
                <div className="color-swatch" style={{ backgroundColor: p.color_code }} />
                <div>
                  <div className="title-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {p.name}
                    {Boolean(p.tier_pricing_json) && (
                      <span
                        title="Per-pigment weight-tier pricing configured"
                        style={{
                          fontSize: '10px',
                          background: 'var(--market-primary-light, rgba(59, 130, 246, 0.15))',
                          color: 'var(--market-primary, #3b82f6)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: '600'
                        }}
                      >
                        🏷️ Tiers
                      </span>
                    )}
                  </div>
                  <div className="body-medium text-muted">{p.finish_type}</div>
                </div>
                <div className="text-right" style={{ marginLeft: 'auto' }}>
                  <div className={`title-large ${p.stock_mg < 10000 ? 'text-error' : ''}`}>
                    {formatMgToGrams(p.stock_mg)}
                  </div>
                  <div className="label-small text-muted">In Stock</div>
                </div>
              </div>

              <div className="inventory-card-stats">
                <div className="stat-cell">
                  <div className="stat-label">WAC / g</div>
                  <div className="stat-value">{formatCents(Math.round(wac))}</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Retail / g</div>
                  <div className="stat-value">{formatCents(p.retail_price_per_gram_cents)}</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-label">Wholesale / g</div>
                  <div className="stat-value">{formatCents(p.wholesale_price_per_gram_cents)}</div>
                </div>
              </div>

              <div className="inventory-card-actions">
                <button className="btn btn-warning btn-sm flex-1" onClick={() => openModal('shrinkage', p)}>
                  Spillage
                </button>
                <button className="btn btn-secondary btn-sm flex-1" onClick={() => openModal('restock', p)}>
                  Restock
                </button>
                <button className="btn btn-ghost btn-sm flex-1" onClick={() => openModal('editPigment', p)}>
                  Edit Pigment
                </button>
              </div>
            </div>

          );
        })}
      </div>
    </div>
  );
};
