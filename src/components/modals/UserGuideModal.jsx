import React, { useState, useMemo, useRef } from 'react';
import { usePos } from '../../context/PosContext';

const GUIDE_SECTIONS = [
  {
    id: 'quick-start',
    icon: '⚡',
    title: 'Quick Start (The 90% Case)',
    tags: ['checkout', 'sale', 'cart', 'preset', 'fast'],
    content: (
      <div>
        <ol style={{ paddingLeft: '20px', lineHeight: '1.7', margin: '8px 0' }}>
          <li><strong>Checkout tab (🛒)</strong> — tap the pigment you're selling.</li>
          <li><strong>Pick a weight preset</strong> (¼g, ½g, ¾g, 1g, 1.5g, 1.75g, 3.5g...) or enter a custom weight.</li>
          <li><strong>Repeat for more items</strong> — they stack in the cart.</li>
          <li><strong>Tap Checkout</strong>, choose how they're paying (Cash / Digital / Tab / Store Credit / Prepaid — or split across more than one), and confirm.</li>
          <li><strong>Done!</strong> Stock, sale record, and (if it's a customer with an account) their balance all update automatically.</li>
        </ol>
        <div className="p-sm mt-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px', borderLeft: '3px solid var(--market-primary)' }}>
          <small className="text-muted">
            💡 If that's all you need today, you're set. Everything below is for less-common workflows and financial edge cases.
          </small>
        </div>
      </div>
    )
  },
  {
    id: 'nine-tabs',
    icon: '📑',
    title: 'The 9 Tabs & What Each Is For',
    tags: ['tabs', 'navigation', 'modules', 'overview'],
    content: (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginTop: '6px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--market-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px 6px' }}>Tab</th>
              <th style={{ padding: '8px 6px' }}>Icon</th>
              <th style={{ padding: '8px 6px' }}>What you use it for</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Checkout</td>
              <td style={{ padding: '8px 6px' }}>🛒</td>
              <td style={{ padding: '8px 6px' }}>Ring up a sale with weight presets, split tender, and customer tabs.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Inventory</td>
              <td style={{ padding: '8px 6px' }}>📦</td>
              <td style={{ padding: '8px 6px' }}>See stock levels, restock a pigment, and log shrinkage/loss.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Pricing Calculator</td>
              <td style={{ padding: '8px 6px' }}>🧮</td>
              <td style={{ padding: '8px 6px' }}>Work out prices by Margin % or Markup %, and set weight tiers.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Customers</td>
              <td style={{ padding: '8px 6px' }}>👥</td>
              <td style={{ padding: '8px 6px' }}>Add/edit customers, track balances (debt vs credit), and prepayments.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Suppliers</td>
              <td style={{ padding: '8px 6px' }}>🏭</td>
              <td style={{ padding: '8px 6px' }}>Track vendor payables for restocks and record payment settlements.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Reports & P&L</td>
              <td style={{ padding: '8px 6px' }}>📊</td>
              <td style={{ padding: '8px 6px' }}>Operating profit & loss across custom date ranges.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Business Insights</td>
              <td style={{ padding: '8px 6px' }}>📈</td>
              <td style={{ padding: '8px 6px' }}>Velocity, top performers, receivables/payables, and shrinkage.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>History</td>
              <td style={{ padding: '8px 6px' }}>📋</td>
              <td style={{ padding: '8px 6px' }}>Review completed sales, print thermal receipts, void sales, or process returns.</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 6px', fontWeight: 'bold' }}>Audit</td>
              <td style={{ padding: '8px 6px' }}>🔒</td>
              <td style={{ padding: '8px 6px' }}>Immutable event log of every balance edit, transaction, and repair.</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  },
  {
    id: 'payment-types',
    icon: '💳',
    title: 'Checkout — Payment Types Explained',
    tags: ['cash', 'digital', 'tab', 'store credit', 'prepaid', 'split', 'credit limit'],
    content: (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginBottom: '12px' }}>
          <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong>💵 Cash</strong>
            <p className="body-small text-muted" style={{ margin: '4px 0 0 0' }}>Standard currency payment. Zero processing fee.</p>
          </div>
          <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong>📱 Digital</strong>
            <p className="body-small text-muted" style={{ margin: '4px 0 0 0' }}>Square, Venmo, Zelle, CashApp. Tracks processing fee automatically.</p>
          </div>
          <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong>📝 House Tab</strong>
            <p className="body-small text-muted" style={{ margin: '4px 0 0 0' }}>Customer pays later. Increases what they owe you. Requires an attached customer.</p>
          </div>
          <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong>🎁 Store Credit</strong>
            <p className="body-small text-muted" style={{ margin: '4px 0 0 0' }}>Spends credit on customer account (from returns or overpayments).</p>
          </div>
          <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong>📦 Prepaid Delivery</strong>
            <p className="body-small text-muted" style={{ margin: '4px 0 0 0' }}>Fulfills an order that was paid upfront in advance.</p>
          </div>
          <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong>⚖️ Split Payment</strong>
            <p className="body-small text-muted" style={{ margin: '4px 0 0 0' }}>Combine two or more methods on a single sale (e.g. $10 Cash + $15 Tab).</p>
          </div>
        </div>
        <div className="p-sm" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px' }}>
          <strong className="text-error">🛡️ Credit Limit Guard:</strong>
          <span className="body-small" style={{ display: 'block', marginTop: '2px', color: 'var(--market-text)' }}>
            Every customer account has a credit limit (default $25). If a Tab sale would exceed their limit, checkout flags the overage before finalizing.
          </span>
        </div>
      </div>
    )
  },
  {
    id: 'customer-balances',
    icon: '👥',
    title: 'Customers & Credit — How Balances Work',
    tags: ['customer', 'balance', 'ledger', 'prepayments', 'credit', 'debt'],
    content: (
      <div>
        <div className="flex-between gap-sm mb-sm" style={{ flexWrap: 'wrap' }}>
          <div className="p-sm flex-1" style={{ background: 'rgba(46, 125, 50, 0.15)', border: '1px solid rgba(46, 125, 50, 0.4)', borderRadius: '6px', minWidth: '180px' }}>
            <strong className="text-success">Positive Balance (+)</strong>
            <div className="body-small text-muted" style={{ marginTop: '2px' }}>
              Customer has <strong>Store Credit</strong> to spend on future purchases.
            </div>
          </div>
          <div className="p-sm flex-1" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', minWidth: '180px' }}>
            <strong className="text-error">Negative Balance (-)</strong>
            <div className="body-small text-muted" style={{ marginTop: '2px' }}>
              Customer is in <strong>Tab Debt</strong> owed to your shop.
            </div>
          </div>
        </div>
        <p className="body-small" style={{ lineHeight: '1.6', margin: '6px 0' }}>
          Every balance change (tab charge, payment received, credit adjustment) writes to that customer's <strong>permanent ledger</strong>. The ledger is the single source of financial truth.
        </p>
        <p className="body-small text-muted" style={{ lineHeight: '1.6', margin: '4px 0' }}>
          <strong>📦 Prepayments</strong> are tracked separately from balance/credit — representing money given upfront for orders awaiting fulfillment.
        </p>
      </div>
    )
  },
  {
    id: 'pricing-calculator',
    icon: '🧮',
    title: 'Pricing Calculator — Margin vs Markup',
    tags: ['margin', 'markup', 'tiers', 'cogs', 'wac', 'pricing'],
    content: (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          <div className="p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong className="text-primary">📊 Margin Mode</strong>
            <div className="body-small text-muted" style={{ margin: '4px 0' }}>
              <em>"What % of the sale price is gross profit?"</em>
            </div>
            <div className="body-small">
              Presets: <strong>20 / 30 / 40 / 50 / 60 / 70 / 75 / 80 / 90%</strong>
            </div>
          </div>
          <div className="p-sm" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
            <strong className="text-primary">📈 Markup Mode</strong>
            <div className="body-small text-muted" style={{ margin: '4px 0' }}>
              <em>"What % above cost are we charging?"</em>
            </div>
            <div className="body-small">
              Presets: <strong>25 / 50 / 75 / 100 / 150 / 200 / 300 / 400%</strong>
            </div>
          </div>
        </div>
        <div className="p-xs mt-sm" style={{ background: 'var(--market-background)', borderRadius: '4px', border: '1px solid var(--market-border)' }}>
          <small className="text-muted">
            ⚠️ 50% margin &ne; 50% markup. Margin is based on selling price; markup is based on cost. If numbers seem unexpected, verify which mode is active.
          </small>
        </div>
      </div>
    )
  },
  {
    id: 'inventory-restocks',
    icon: '📦',
    title: 'Inventory — Restocking & Shrinkage',
    tags: ['inventory', 'restock', 'shrinkage', 'wac', 'cost', 'loss'],
    content: (
      <div>
        <ul style={{ paddingLeft: '18px', lineHeight: '1.6', margin: '4px 0' }}>
          <li>
            <strong>Restock:</strong> Log incoming stock with weight and total cost. You can choose whether it was paid upfront or placed on a supplier tab. Your <strong>WAC</strong> (Weighted Average Cost) updates automatically to preserve true cost basis.
          </li>
          <li>
            <strong>Shrinkage:</strong> Log any loss not resulting from a sale (spillage, container residue, testing samples, breakage). Shrinkage keeps stock counts honest and surfaces in Business Insights.
          </li>
        </ul>
      </div>
    )
  },
  {
    id: 'suppliers',
    icon: '🏭',
    title: 'Suppliers & Accounts Payable',
    tags: ['supplier', 'vendor', 'payables', 'unpaid tab'],
    content: (
      <div>
        <p className="body-small" style={{ lineHeight: '1.6', margin: '4px 0' }}>
          Tracks vendor payables for pigment restocks. Restocking on credit adds to your supplier liability; recording supplier payments reduces what you owe.
        </p>
      </div>
    )
  },
  {
    id: 'insights-reports',
    icon: '📈',
    title: 'Business Insights, Reports & Audit',
    tags: ['insights', 'kpi', 'reports', 'profit', 'audit', 'history'],
    content: (
      <div>
        <ul style={{ paddingLeft: '18px', lineHeight: '1.6', margin: '4px 0' }}>
          <li><strong>Business Insights:</strong> KPIs, Inventory velocity with reorder flags, Receivables vs Payables, and Pigment profitability ranking.</li>
          <li><strong>Reports & P&L:</strong> Operating profit & loss for custom date ranges with merchant fee accounting.</li>
          <li><strong>History:</strong> Past sale drill-down, thermal receipt printing, voiding sales, and processing returns.</li>
          <li><strong>Audit:</strong> Append-only chronological record of every system event for immutable discrepancy tracing.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'backups',
    icon: '💾',
    title: 'Backups — Essential Practice',
    tags: ['backup', 'restore', 'export', 'offline', 'storage', 'json'],
    content: (
      <div>
        <div className="p-sm" style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px', marginBottom: '8px' }}>
          <strong className="text-error">⚠️ 100% Offline Local Architecture</strong>
          <p className="body-small" style={{ margin: '4px 0 0 0', lineHeight: '1.5' }}>
            Micro Saler runs entirely in your device's browser database (IndexedDB). There is no cloud sync. If browser storage is cleared or device is lost, unbacked data cannot be recovered.
          </p>
        </div>
        <p className="body-small" style={{ lineHeight: '1.6', margin: '4px 0' }}>
          Click <strong>💾 Backup / Restore</strong> in the header to download a complete `.json` backup of all 15 object stores. Store backups in safe cloud storage or external drives regularly!
        </p>
      </div>
    )
  },
  {
    id: 'faq',
    icon: '❓',
    title: 'FAQ & Common Register Situations',
    tags: ['faq', 'questions', 'void', 'return', 'offline', 'payment'],
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
          <strong>A customer wants to pay later.</strong>
          <p className="body-small text-muted" style={{ margin: '2px 0 0 0' }}>
            Select their customer account, choose <strong>Tab</strong> at checkout. The system validates their credit limit before completing.
          </p>
        </div>
        <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
          <strong>A customer wants to pay down their tab debt.</strong>
          <p className="body-small text-muted" style={{ margin: '2px 0 0 0' }}>
            Go to <strong>Customers</strong> &rarr; find customer &rarr; tap <strong>Settle Tab</strong>. Any overpayment automatically converts to store credit.
          </p>
        </div>
        <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
          <strong>I rang up an incorrect transaction.</strong>
          <p className="body-small text-muted" style={{ margin: '2px 0 0 0' }}>
            Go to <strong>History</strong> &rarr; find sale &rarr; tap <strong>Void</strong>. This safely restores inventory and reverses ledger/payment effects.
          </p>
        </div>
        <div className="p-xs" style={{ background: 'var(--market-surface-variant)', borderRadius: '6px' }}>
          <strong>Do I need internet to use this POS?</strong>
          <p className="body-small text-muted" style={{ margin: '2px 0 0 0' }}>
            No. Micro Saler is 100% offline-first and runs in any modern browser without network connectivity.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'glossary',
    icon: '📖',
    title: 'Financial & POS Glossary',
    tags: ['glossary', 'terms', 'definitions', 'tab', 'wac', 'cogs'],
    content: (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '6px', fontWeight: 'bold', width: '130px' }}>Tab / House Tab</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Customer owes shop, pays later.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>Store Credit</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Customer has positive credit on account to spend.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>Prepaid Delivery</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Customer paid upfront; goods owed to them.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>WAC</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Weighted Average Cost — running cost basis per mg/gram.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>Shrinkage</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Inventory lost to spills, residue, testing, or breakage.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--market-surface-variant)' }}>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>Margin</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Gross profit as a percentage of selling price.</td>
            </tr>
            <tr>
              <td style={{ padding: '6px', fontWeight: 'bold' }}>Markup</td>
              <td style={{ padding: '6px', color: 'var(--market-text-secondary)' }}>Price markup as a percentage above cost.</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
];

export const UserGuideModal = () => {
  const { closeModal } = usePos();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState(null);
  const bodyRef = useRef(null);

  const filteredSections = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return GUIDE_SECTIONS;
    return GUIDE_SECTIONS.filter(s => {
      if (s.title.toLowerCase().includes(q)) return true;
      if (s.tags.some(t => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [searchQuery]);

  const handleJumpToSection = (id) => {
    setActiveSectionId(id);
    const el = document.getElementById(`guide-sec-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div
        className="modal"
        style={{
          maxWidth: '780px',
          width: '94%',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header flex-between" style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>📖</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Micro Saler — User Guide & Reference</h2>
              <div className="body-small text-muted">Complete register guide, workflows & glossary</div>
            </div>
          </div>
          <button className="modal-close" onClick={closeModal} title="Close Guide" aria-label="Close Guide">
            &times;
          </button>
        </div>

        {/* Search & Section Navigation Chips */}
        <div style={{ padding: '10px 18px', background: 'var(--market-surface-variant)', borderBottom: '1px solid var(--market-border-light)' }}>
          <div style={{ position: 'relative', marginBottom: '8px' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', paddingLeft: '32px', fontSize: '0.9rem' }}
              placeholder="🔍 Search guide topics, workflows, or terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="customer-name-clear-btn"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => setSearchQuery('')}
              >
                &times;
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '2px',
              scrollbarWidth: 'none'
            }}
          >
            {GUIDE_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleJumpToSection(sec.id)}
                className={`badge ${activeSectionId === sec.id ? 'badge-primary' : 'badge-secondary'}`}
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  fontSize: '11px',
                  padding: '4px 8px'
                }}
              >
                {sec.icon} {sec.title.split(' (')[0].split(' — ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Body Content */}
        <div className="modal-body" ref={bodyRef} style={{ padding: '16px 18px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {filteredSections.length === 0 ? (
            <div className="text-center p-lg text-muted">
              <p style={{ fontSize: '1.2rem', margin: '0 0 6px 0' }}>🔍 No guide sections found</p>
              <small>Try a different keyword like "tab", "margin", "restock", or "split".</small>
            </div>
          ) : (
            filteredSections.map((sec) => (
              <div
                key={sec.id}
                id={`guide-sec-${sec.id}`}
                className="p-md"
                style={{
                  background: 'var(--market-surface)',
                  border: '1px solid var(--market-border-light)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', borderBottom: '1px solid var(--market-surface-variant)', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{sec.icon}</span>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--market-primary)' }}>
                    {sec.title}
                  </h3>
                </div>
                {sec.content}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer flex-between" style={{ padding: '10px 18px' }}>
          <small className="text-muted">
            📄 Based on <code style={{ color: 'var(--market-primary)' }}>src/UserGuide.md</code>
          </small>
          <button className="btn btn-primary" onClick={closeModal}>
            Done / Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
