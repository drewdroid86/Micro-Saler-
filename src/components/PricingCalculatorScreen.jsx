import React, { useState, useMemo, useEffect } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams, calculateBusinessInsights } from '../repository';

// Mirrors the RETAIL/WHOLESALE margin floors used by the "Below Floor" recommendation
// rule in calculateBusinessInsights (repository.js). Keep these two in sync if that
// rule's thresholds ever change.
const FLOOR_MARGIN_RETAIL_PCT = 65;
const FLOOR_MARGIN_WHOLESALE_PCT = 50;
const STRETCH_MARGIN_BAND_PCT = 15; // stretch suggestion = floor + this many points

const TARGET_STORAGE_KEY = 'microsaler_daily_net_target_cents';

export const PricingCalculatorScreen = () => {
  const {
    pigments,
    addToCart,
    showToast,
    sales,
    saleItems,
    salePayments,
    customers,
    suppliers,
    shrinkageLogs,
    stockReceipts,
    openModal
  } = usePos();
  const activePigments = (pigments || []).filter(p => !p.is_archived && p.is_active !== false);

  // Input states
  const [selectedPigmentId, setSelectedPigmentId] = useState('');
  const [costPerGramInput, setCostPerGramInput] = useState('2.50');
  const [calcMode, setCalcMode] = useState('margin'); // 'margin' | 'markup' | 'target'
  const [targetPercentInput, setTargetPercentInput] = useState('50');
  const [businessType, setBusinessType] = useState('RETAIL'); // 'RETAIL' | 'WHOLESALE' — sets the floor for Target Mode

  // Target Mode: daily net-profit target, persisted locally per-device
  const [dailyTargetInput, setDailyTargetInput] = useState(() => {
    const saved = localStorage.getItem(TARGET_STORAGE_KEY);
    return saved ? String((Number(saved) / 100).toFixed(0)) : '';
  });

  // Custom Weight Quick-Add state
  const [customWeightGrams, setCustomWeightGrams] = useState('10');

  const handleSetCalcMode = (mode) => {
    setCalcMode(mode);
    if (mode === 'margin') {
      const current = parseFloat(targetPercentInput);
      if (isNaN(current) || current >= 100) {
        setTargetPercentInput('50');
      }
    }
  };

  // Today + trailing-30-day insights, reused from the same function Insights uses
  // (so "today so far" and net profit always match what the Insights tab shows —
  // no separate/parallel profit math here).
  const insightsArgs = { sales, saleItems, salePayments, pigments, customers, suppliers, shrinkageLogs, stockReceipts };
  const todayInsights = useMemo(
    () => calculateBusinessInsights({ ...insightsArgs, timeRange: 'TODAY' }),
    [sales, saleItems, salePayments, pigments, customers, suppliers, shrinkageLogs, stockReceipts]
  );
  const monthInsights = useMemo(
    () => calculateBusinessInsights({ ...insightsArgs, timeRange: 'MONTH' }),
    [sales, saleItems, salePayments, pigments, customers, suppliers, shrinkageLogs, stockReceipts]
  );

  // Auto-suggested target = average net profit per day-with-a-sale over the last 30 days.
  // Only used to prefill the input the first time; editing it overrides and persists.
  const suggestedTargetCents = useMemo(() => {
    const daySet = new Set(
      (sales || [])
        .filter(s => s.status === 'COMPLETED' || !s.status || s.status === 'PAID')
        .map(s => {
          const ts = s.created_at || s.timestamp || s.date;
          return ts ? new Date(ts).toDateString() : null;
        })
        .filter(Boolean)
    );
    const dayCount = daySet.size;
    return dayCount > 0 ? Math.round(monthInsights.netProfitCents / dayCount) : 10000; // fallback $100
  }, [sales, monthInsights.netProfitCents]);

  const dailyTargetCents = useMemo(() => {
    const val = parseFloat(dailyTargetInput);
    return isNaN(val) || val < 0 ? suggestedTargetCents : Math.round(val * 100);
  }, [dailyTargetInput, suggestedTargetCents]);

  // Persist target whenever it's a real (non-empty) user value
  useEffect(() => {
    if (dailyTargetInput !== '') {
      localStorage.setItem(TARGET_STORAGE_KEY, String(dailyTargetCents));
    }
  }, [dailyTargetCents, dailyTargetInput]);

  const netProfitSoFarCents = todayInsights.netProfitCents;
  const gapCents = dailyTargetCents - netProfitSoFarCents;
  const targetHit = gapCents <= 0;

  const floorMarginPct = businessType === 'WHOLESALE' ? FLOOR_MARGIN_WHOLESALE_PCT : FLOOR_MARGIN_RETAIL_PCT;
  const stretchMarginPct = floorMarginPct + STRETCH_MARGIN_BAND_PCT;

  // Heuristic, not an optimizer: the further behind target you are (as a fraction of
  // the target itself), the closer the "on pace" suggestion is pushed toward stretch.
  // Already past target -> collapses to the floor (no need to push margins once the
  // day's covered).
  const behindRatio = targetHit ? 0 : Math.min(1, Math.max(0, gapCents / Math.max(1, dailyTargetCents)));
  const onPaceMarginPct = floorMarginPct + behindRatio * STRETCH_MARGIN_BAND_PCT;

  // When a pigment is selected, auto-fill its cost per gram (WAC)
  const handlePigmentSelect = (e) => {
    const id = e.target.value;
    setSelectedPigmentId(id);
    if (!id) return;
    const p = activePigments.find(pig => Number(pig.pigment_id) === Number(id));
    if (p) {
      const wacDollarsPerGram = p.stock_mg > 0 ? (p.total_cost_cents / p.stock_mg) * 10 : 0;
      const dollarsPerGram = wacDollarsPerGram.toFixed(2);
      setCostPerGramInput(dollarsPerGram);
    }
  };

  // Convert inputs to numbers
  const costPerGram = useMemo(() => {
    const val = parseFloat(costPerGramInput);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [costPerGramInput]);

  const targetPercent = useMemo(() => {
    const val = parseFloat(targetPercentInput);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [targetPercentInput]);

  // Quick weight presets combining CheckoutScreen presets and standard tiers
  const weightPresets = [
    { label: '¼g', grams: 0.25 },
    { label: '½g', grams: 0.5 },
    { label: '¾g', grams: 0.75 },
    { label: '1g', grams: 1 },
    { label: '1.5g', grams: 1.5 },
    { label: '1.75g', grams: 1.75 },
    { label: '3.5g (⅛ oz)', grams: 3.5 },
    { label: '7g (¼ oz)', grams: 7 },
    { label: '14g (½ oz)', grams: 14 },
    { label: '28g (1 oz)', grams: 28 }
  ];

  // Core pricing calculations per weight row
  const calculateRow = (weightInGrams) => {
    const totalCostCents = Math.round(weightInGrams * costPerGram * 100);
    const cogsDollars = (totalCostCents / 100).toFixed(2);

    if (weightInGrams <= 0 || costPerGram <= 0) {
      return {
        cogsDollars: '0.00',
        totalCostCents: 0,
        suggestedPriceDollars: '0.00',
        suggestedPriceCents: 0,
        profitDollars: '0.00',
        profitCents: 0,
        marginPct: 0,
        markupPct: 0,
        floorPriceCents: 0,
        onPacePriceCents: 0,
        stretchPriceCents: 0
      };
    }

    const floorDecimal = floorMarginPct / 100;
    const onPaceDecimal = onPaceMarginPct / 100;
    const stretchDecimal = stretchMarginPct / 100;

    const floorPriceCents = floorDecimal < 1 ? Math.round(totalCostCents / (1 - floorDecimal)) : 0;
    const onPacePriceCents = onPaceDecimal < 1 ? Math.round(totalCostCents / (1 - onPaceDecimal)) : 0;
    const stretchPriceCents = stretchDecimal < 1 ? Math.round(totalCostCents / (1 - stretchDecimal)) : 0;

    let suggestedPriceCents = 0;

    if (calcMode === 'target') {
      suggestedPriceCents = onPacePriceCents;
    } else if (calcMode === 'margin') {
      const marginDecimal = targetPercent / 100;
      suggestedPriceCents = marginDecimal < 1 ? Math.round(totalCostCents / (1 - marginDecimal)) : 0;
    } else {
      const markupDecimal = targetPercent / 100;
      suggestedPriceCents = Math.round(totalCostCents * (1 + markupDecimal));
    }

    const profitCents = suggestedPriceCents - totalCostCents;
    const marginPct = suggestedPriceCents > 0 ? (profitCents / suggestedPriceCents) * 100 : 0;
    const markupPct = totalCostCents > 0 ? (profitCents / totalCostCents) * 100 : 0;

    return {
      cogsDollars,
      totalCostCents,
      suggestedPriceDollars: (suggestedPriceCents / 100).toFixed(2),
      suggestedPriceCents,
      profitDollars: (profitCents / 100).toFixed(2),
      profitCents,
      marginPct,
      markupPct,
      floorPriceCents,
      onPacePriceCents,
      stretchPriceCents
    };
  };

  // Pre-calculate rows for matrix
  const tableRows = useMemo(() => {
    return weightPresets.map(preset => {
      const calc = calculateRow(preset.grams);
      return {
        ...preset,
        ...calc
      };
    });
  }, [costPerGram, calcMode, targetPercent, floorMarginPct, onPaceMarginPct, stretchMarginPct]);

  // Single custom weight calculation
  const customCalc = useMemo(() => {
    const w = parseFloat(customWeightGrams) || 0;
    return calculateRow(w);
  }, [customWeightGrams, costPerGram, calcMode, targetPercent, floorMarginPct, onPaceMarginPct, stretchMarginPct]);

  // Handle adding calculated custom item to POS Cart
  const handleAddToCart = () => {
    const selectedPigment = activePigments.find(p => Number(p.pigment_id) === Number(selectedPigmentId));
    if (!selectedPigment) {
      showToast('Select an active pigment from inventory to add directly to POS Cart.', 'warning');
      return;
    }
    const weightMg = Math.round((parseFloat(customWeightGrams) || 0) * 1000);
    if (weightMg <= 0) {
      showToast('Enter a valid weight in grams.', 'error');
      return;
    }

    addToCart(selectedPigment, weightMg, customCalc.suggestedPriceCents);
    showToast(`Added ${formatMgToGrams(weightMg)} of ${selectedPigment.name} (${formatCents(customCalc.suggestedPriceCents)}) to cart!`, 'success');
  };

  // Helper for status badge
  const getBadgeStyle = (marginPct) => {
    if (marginPct >= 50) return { background: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' };
    if (marginPct >= 25) return { background: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9' };
    if (marginPct >= 0) return { background: '#fff8e1', color: '#f57f17', border: '1px solid #ffe082' };
    return { background: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' };
  };

  return (
    <div className="pricing-calculator-screen">
      {/* Header */}
      <div className="section-header">
        <div>
          <h2 className="section-title">🧮 PRICING CALCULATOR</h2>
          <p className="body-medium text-muted" style={{ marginTop: '2px' }}>
            Calculate target selling prices, profit margins, and markup across standard weight tiers.
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => openModal('HELP', { section: 'pricing-calculator' })}
          title="Open Margin vs Markup Pricing Guide"
        >
          ❓ Pricing Guide
        </button>
      </div>

      {/* Input Form Controls Card */}
      <div className="card mb-lg p-md">
        <h3 className="title-medium mb-md" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️ Pricing Inputs</span>
        </h3>

        <div className="grid-3col gap-md">
          {/* Optional Pigment Quick-Fill */}
          <div className="form-group">
            <label className="label-large">Select Pigment (Optional Auto-Fill)</label>
            <select
              className="form-input"
              value={selectedPigmentId}
              onChange={handlePigmentSelect}
            >
              <option value="">-- Manual Cost Entry --</option>
              {activePigments.map(p => {
                const wacPerGramCents = p.stock_mg > 0 ? Math.round((p.total_cost_cents / p.stock_mg) * 1000) : 0;
                return (
                  <option key={p.pigment_id} value={p.pigment_id}>
                    {p.name} (WAC: {formatCents(wacPerGramCents)}/g)
                  </option>
                );
              })}
            </select>
            <span className="label-small text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Auto-fills Cost / Gram from inventory WAC cost basis.
            </span>
          </div>

          {/* Cost Per Gram Input */}
          <div className="form-group">
            <label className="label-large">Cost Per Gram ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-input text-large font-bold"
              value={costPerGramInput}
              onChange={e => setCostPerGramInput(e.target.value)}
              placeholder="e.g. 2.50"
            />
            <span className="label-small text-muted" style={{ display: 'block', marginTop: '4px' }}>
              Base cost of raw material per gram.
            </span>
          </div>

          {/* Calculation Mode Toggle & Target Percent Input */}
          <div className="form-group">
            <div className="flex-between align-center mb-xs">
              <label className="label-large">Target Mode</label>
              <div className="pricing-toggle" style={{ margin: 0 }}>
                <button
                  type="button"
                  className={`toggle-option ${calcMode === 'margin' ? 'active' : ''}`}
                  onClick={() => handleSetCalcMode('margin')}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Margin %
                </button>
                <button
                  type="button"
                  className={`toggle-option ${calcMode === 'markup' ? 'active' : ''}`}
                  onClick={() => handleSetCalcMode('markup')}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Markup %
                </button>
                <button
                  type="button"
                  className={`toggle-option ${calcMode === 'target' ? 'active' : ''}`}
                  onClick={() => handleSetCalcMode('target')}
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  🎯 Target
                </button>
              </div>
            </div>

            {calcMode === 'target' ? (
              <>
                <input
                  type="number"
                  step="1"
                  min="0"
                  className="form-input text-large font-bold"
                  value={dailyTargetInput}
                  onChange={e => setDailyTargetInput(e.target.value)}
                  placeholder={String(Math.round(suggestedTargetCents / 100))}
                />
                <span className="label-small text-muted" style={{ display: 'block', marginTop: '4px' }}>
                  Today's net profit target ($) — auto-suggested from your 30-day average, editable.
                </span>
              </>
            ) : (
              <>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max={calcMode === 'margin' ? '99' : '1000'}
                  className="form-input text-large font-bold"
                  value={targetPercentInput}
                  onChange={e => setTargetPercentInput(e.target.value)}
                  placeholder="50"
                />
                <span className="label-small text-muted" style={{ display: 'block', marginTop: '4px' }}>
                  {calcMode === 'margin' ? 'Desired Gross Margin %' : 'Desired Cost Markup %'}
                </span>
              </>
            )}
          </div>
        </div>

        {calcMode === 'target' ? (
          <div className="mt-md pt-sm" style={{ borderTop: '1px solid var(--market-border-light)' }}>
            <div className="pricing-toggle" style={{ display: 'inline-flex' }}>
              <button
                type="button"
                className={`toggle-option ${businessType === 'RETAIL' ? 'active' : ''}`}
                onClick={() => setBusinessType('RETAIL')}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Retail floor (65%)
              </button>
              <button
                type="button"
                className={`toggle-option ${businessType === 'WHOLESALE' ? 'active' : ''}`}
                onClick={() => setBusinessType('WHOLESALE')}
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Wholesale floor (50%)
              </button>
            </div>

            <div className="grid-3col gap-md mt-md">
              <div className="stat-card p-sm" style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
                <div className="label-small text-muted">Net Profit Today</div>
                <div className="title-medium font-bold">{formatCents(netProfitSoFarCents)}</div>
              </div>
              <div className="stat-card p-sm" style={{ background: '#fff', borderRadius: 'var(--radius-md)' }}>
                <div className="label-small text-muted">Target</div>
                <div className="title-medium font-bold">{formatCents(dailyTargetCents)}</div>
              </div>
              <div className="stat-card p-sm" style={{ background: targetHit ? '#e8f5e9' : '#fff8e1', borderRadius: 'var(--radius-md)' }}>
                <div className="label-small text-muted">{targetHit ? 'Past Target By' : 'Gap Remaining'}</div>
                <div className={`title-medium font-bold ${targetHit ? 'text-success' : ''}`}>
                  {targetHit ? '+' : ''}{formatCents(Math.abs(gapCents))}
                </div>
              </div>
            </div>
            <p className="label-small text-muted mt-sm">
              Suggested margins below range from your {floorMarginPct}% floor up to a {stretchMarginPct}% stretch —
              pushed toward stretch the further behind target you are today. These are suggestions, not
              auto-applied prices.
            </p>
          </div>
        ) : (
          <div className="mt-md pt-sm" style={{ borderTop: '1px solid var(--market-border-light)' }}>
            <div className="preset-pills-container flex-wrap gap-xs align-center">
              <span className="label-small text-muted" style={{ marginRight: '8px' }}>
                {calcMode === 'margin' ? 'Margin Presets (<100%):' : 'Markup Presets:'}
              </span>
              {(calcMode === 'margin'
                ? [20, 30, 40, 50, 60, 70, 75, 80, 90]
                : [25, 50, 75, 100, 150, 200, 300, 400]
              ).map(val => (
                <button
                  key={val}
                  type="button"
                  className={`preset-pill ${parseFloat(targetPercentInput) === val ? 'active' : ''}`}
                  onClick={() => setTargetPercentInput(String(val))}
                >
                  {val}% {calcMode === 'margin' ? 'Margin' : 'Markup'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Weight Tier Output Table */}
      <div className="card mb-lg p-md">
        <div className="flex-between align-center mb-md">
          <h3 className="title-medium">
            📊 Weight Tier Pricing Matrix (${costPerGram.toFixed(2)}/g
            {calcMode === 'target'
              ? ` @ ${floorMarginPct}–${stretchMarginPct}% TARGET`
              : ` @ ${targetPercent}% ${calcMode.toUpperCase()}`})
          </h3>
          <span className="label-small text-muted">
            {calcMode === 'target'
              ? 'Price = Cost / (1 − Margin%), margin picked per-tier from the floor/pace/stretch band'
              : `Formulas: Price = ${calcMode === 'margin' ? 'Cost / (1 − Margin%)' : 'Cost × (1 + Markup%)'}`}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Weight Step</th>
                <th>Total Cost</th>
                {calcMode === 'target' ? (
                  <>
                    <th>Floor</th>
                    <th>On Pace</th>
                    <th>Stretch</th>
                  </>
                ) : (
                  <>
                    <th>Suggested Price</th>
                    <th>Markup %</th>
                    <th>Margin %</th>
                    <th>Profit ($)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {calcMode === 'target' ? tableRows.map(row => (
                <tr key={row.label}>
                  <td className="font-bold">{row.label} ({row.grams}g)</td>
                  <td className="text-muted">{formatCents(row.totalCostCents)}</td>
                  <td>{formatCents(row.floorPriceCents)}</td>
                  <td className="font-bold text-primary" style={{ fontSize: '1.05rem' }}>
                    {formatCents(row.onPacePriceCents)}
                  </td>
                  <td>{formatCents(row.stretchPriceCents)}</td>
                </tr>
              )) : tableRows.map(row => (
                <tr key={row.label}>
                  <td className="font-bold">{row.label} ({row.grams}g)</td>
                  <td className="text-muted">{formatCents(row.totalCostCents)}</td>
                  <td className="font-bold text-primary" style={{ fontSize: '1.05rem' }}>
                    {formatCents(row.suggestedPriceCents)}
                  </td>
                  <td>{row.markupPct.toFixed(1)}%</td>
                  <td>
                    <span
                      className="badge"
                      style={getBadgeStyle(row.marginPct)}
                    >
                      {row.marginPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className={row.profitCents >= 0 ? 'text-success font-bold' : 'text-error font-bold'}>
                    {row.profitCents >= 0 ? '+' : ''}{formatCents(row.profitCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Custom Weight Estimator & POS Cart Add */}
      <div className="card p-md" style={{ background: 'var(--market-surface-variant)' }}>
        <h3 className="title-medium mb-sm">⚡ Quick Custom Weight Quote & Add to Cart</h3>
        <p className="body-medium text-muted mb-md">
          Test any custom gram weight and optionally add it directly to the active checkout cart.
        </p>

        <div className="grid-2col gap-md align-center">
          <div className="flex-center gap-sm">
            <div className="form-group flex-1" style={{ marginBottom: 0 }}>
              <label className="label-small text-muted">Custom Weight (g)</label>
              <input
                type="number"
                step="any"
                min="0.01"
                className="form-input text-large font-bold"
                value={customWeightGrams}
                onChange={e => setCustomWeightGrams(e.target.value)}
                placeholder="e.g. 12.5"
              />
            </div>
            <div className="stat-card p-sm" style={{ background: '#fff', borderRadius: 'var(--radius-md)', flex: 1 }}>
              <div className="label-small text-muted">{calcMode === 'target' ? 'On-Pace Price' : 'Suggested Price'}</div>
              <div className="title-medium font-bold text-primary">{formatCents(customCalc.suggestedPriceCents)}</div>
            </div>
            <div className="stat-card p-sm" style={{ background: '#fff', borderRadius: 'var(--radius-md)', flex: 1 }}>
              <div className="label-small text-muted">Profit ($)</div>
              <div className={`title-medium font-bold ${customCalc.profitCents >= 0 ? 'text-success' : 'text-error'}`}>
                {customCalc.profitCents >= 0 ? '+' : ''}{formatCents(customCalc.profitCents)}
              </div>
            </div>
          </div>

          <div>
            <button
              className="btn btn-primary w-full py-sm font-bold"
              onClick={handleAddToCart}
              disabled={!selectedPigmentId || parseFloat(customWeightGrams) <= 0}
            >
              🛒 Add {customWeightGrams || 0}g Quote to POS Cart
            </button>
            {!selectedPigmentId && (
              <span className="label-small text-muted text-center" style={{ display: 'block', marginTop: '4px' }}>
                (Select a pigment in inputs above to enable POS Cart adding)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingCalculatorScreen;
