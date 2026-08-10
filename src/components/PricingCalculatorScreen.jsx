import React, { useState, useMemo } from 'react';
import { usePos } from '../context/PosContext';
import { formatCents, formatMgToGrams } from '../repository';

export const PricingCalculatorScreen = () => {
  const { pigments, addToCart, showToast } = usePos();
  const activePigments = (pigments || []).filter(p => !p.is_archived && p.is_active !== false);

  // Input states
  const [selectedPigmentId, setSelectedPigmentId] = useState('');
  const [costPerGramInput, setCostPerGramInput] = useState('2.50');
  const [calcMode, setCalcMode] = useState('margin'); // 'margin' | 'markup'
  const [targetPercentInput, setTargetPercentInput] = useState('50');

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
    { label: '3.5g', grams: 3.5 },
    { label: '5g', grams: 5 },
    { label: '7g', grams: 7 },
    { label: '10g', grams: 10 },
    { label: '14g', grams: 14 },
    { label: '25g', grams: 25 },
    { label: '28g', grams: 28 },
    { label: '50g', grams: 50 },
    { label: '100g', grams: 100 }
  ];

  /**
   * Price calculation formula:
   * Total Cost = costPerGram * weightGrams
   * Mode = 'margin':
   *   Given cost + target margin: Price = Cost / (1 - Margin%)
   * Mode = 'markup':
   *   Given cost + target markup: Price = Cost * (1 + Markup%)
   */
  const calculateRow = (weightGrams) => {
    const totalCost = costPerGram * weightGrams;

    let suggestedPrice = 0;
    if (calcMode === 'margin') {
      const marginDecimal = targetPercent / 100;
      if (marginDecimal >= 1) {
        suggestedPrice = 0; // Prevent divide by zero or negative
      } else {
        suggestedPrice = totalCost / (1 - marginDecimal);
      }
    } else {
      const markupDecimal = targetPercent / 100;
      suggestedPrice = totalCost * (1 + markupDecimal);
    }

    const profit = suggestedPrice - totalCost;
    const markupPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const marginPct = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;

    return {
      weightGrams,
      totalCostCents: Math.round(totalCost * 100),
      suggestedPriceCents: Math.round(suggestedPrice * 100),
      profitCents: Math.round(profit * 100),
      markupPct,
      marginPct
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
  }, [costPerGram, calcMode, targetPercent]);

  // Single custom weight calculation
  const customCalc = useMemo(() => {
    const w = parseFloat(customWeightGrams) || 0;
    return calculateRow(w);
  }, [customWeightGrams, costPerGram, calcMode, targetPercent]);

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
              </div>
            </div>

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
          </div>
        </div>

        {/* Quick Percent Presets */}
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
      </div>

      {/* Main Weight Tier Output Table */}
      <div className="card mb-lg p-md">
        <div className="flex-between align-center mb-md">
          <h3 className="title-medium">
            📊 Weight Tier Pricing Matrix (${costPerGram.toFixed(2)}/g @ {targetPercent}% {calcMode.toUpperCase()})
          </h3>
          <span className="label-small text-muted">
            Formulas: Price = {calcMode === 'margin' ? 'Cost / (1 − Margin%)' : 'Cost × (1 + Markup%)'}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Weight Step</th>
                <th>Total Cost</th>
                <th>Suggested Price</th>
                <th>Markup %</th>
                <th>Margin %</th>
                <th>Profit ($)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(row => (
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
              <div className="label-small text-muted">Suggested Price</div>
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
