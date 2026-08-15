import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { USER_GUIDE_SECTIONS } from '../../data/userGuideData';

export const HelpModal = ({ initialSection }) => {
  const { modal, closeModal } = usePos();
  const propSection = initialSection || modal?.payload?.section || modal?.payload?.initialSection || modal?.data?.section || modal?.data?.initialSection || (typeof modal?.payload === 'string' ? modal.payload : (typeof modal?.data === 'string' ? modal.data : null));

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(propSection || 'ALL');
  const [copiedText, setCopiedText] = useState('');
  const bodyRef = useRef(null);

  // Keyboard ESC support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal]);

  useEffect(() => {
    if (propSection) {
      setSelectedCategory(propSection);
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
    }
  }, [propSection]);

  // Filter sections based on search query or selected category
  const filteredSections = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    let sections = USER_GUIDE_SECTIONS;

    if (selectedCategory !== 'ALL') {
      sections = sections.filter(s => s.id === selectedCategory);
    }

    if (q) {
      sections = sections.filter(s => {
        if (s.title.toLowerCase().includes(q)) return true;
        if (s.summary.toLowerCase().includes(q)) return true;
        if (s.keywords && s.keywords.some(k => k.toLowerCase().includes(q))) return true;
        if (s.terms && s.terms.some(t => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q))) return true;
        if (s.faqList && s.faqList.some(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q))) return true;
        if (s.steps && s.steps.some(st => st.title.toLowerCase().includes(q) || st.desc.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    return sections;
  }, [searchQuery, selectedCategory]);

  const handleSelectCategory = (catId) => {
    setSelectedCategory(catId);
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label || 'Copied!');
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
      <div
        className="modal help-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
      >
        {/* Header */}
        <div className="modal-header flex-between">
          <div className="help-modal-title-group">
            <span className="help-modal-icon">❓</span>
            <div>
              <h2 id="help-modal-title" className="help-modal-title">Micro Saler — User Guide & Help</h2>
              <div className="body-small text-muted">Quick reference, workflows & register glossary (Esc to close)</div>
            </div>
          </div>
          <button
            className="modal-close"
            onClick={closeModal}
            title="Close Guide (Esc)"
            aria-label="Close Guide"
          >
            ✕
          </button>
        </div>

        {/* Search & Category Pills Bar */}
        <div className="help-modal-search-bar">
          <div className="help-modal-search-wrapper">
            <span className="help-modal-search-icon">🔍</span>
            <input
              type="text"
              className="form-input help-modal-search-input"
              placeholder="Search topics & glossary (e.g. Margin, WAC, Tab, Return, Split, Shrinkage)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value && selectedCategory !== 'ALL') {
                  setSelectedCategory('ALL');
                }
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="customer-name-clear-btn help-modal-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear Search"
                aria-label="Clear Search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Mobile Category Pills (< 768px) */}
          <div className="help-modal-pills-row">
            <button
              type="button"
              onClick={() => handleSelectCategory('ALL')}
              className={`help-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
            >
              🌟 All Topics
            </button>
            {USER_GUIDE_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectCategory(sec.id)}
                className={`help-pill ${selectedCategory === sec.id ? 'active' : ''}`}
              >
                {sec.icon} {sec.shortTitle || sec.title}
              </button>
            ))}
          </div>
        </div>

        {/* Split Container: Desktop Sidebar + Content Reader (>= 768px) */}
        <div className="help-modal-split-container">
          {/* Desktop Left Sidebar: Table of Contents + Topic Selector */}
          <aside className="help-modal-sidebar-desktop">
            <div className="body-small font-weight-bold text-muted px-xs py-xs" style={{ letterSpacing: '0.5px' }}>
              TABLE OF CONTENTS
            </div>
            <button
              type="button"
              onClick={() => handleSelectCategory('ALL')}
              className={`help-sidebar-btn ${selectedCategory === 'ALL' ? 'active' : ''}`}
            >
              <span>🌟</span>
              <span className="flex-1">All Topics</span>
              <span className="label-small text-muted">{USER_GUIDE_SECTIONS.length}</span>
            </button>
            {USER_GUIDE_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectCategory(sec.id)}
                className={`help-sidebar-btn ${selectedCategory === sec.id ? 'active' : ''}`}
              >
                <span>{sec.icon}</span>
                <span className="flex-1" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sec.shortTitle || sec.title}
                </span>
              </button>
            ))}
          </aside>

          {/* Scrollable Content Body Reader */}
          <div className="modal-body help-modal-body" ref={bodyRef}>
            {copiedText && (
              <div className="p-xs mb-sm text-center font-weight-bold text-success" style={{ background: 'rgba(46, 125, 50, 0.12)', borderRadius: '6px', fontSize: '12px' }}>
                ✓ {copiedText}
              </div>
            )}

            {filteredSections.length === 0 ? (
              <div className="text-center p-xl text-muted">
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
                <h3 style={{ margin: '0 0 6px 0', color: 'var(--market-text)' }}>No matching topics found</h3>
                <p className="body-small">Try searching for <em>Tab, Margin, WAC, Return, Restock,</em> or <em>Backup</em>.</p>
                <button className="btn btn-secondary mt-md" onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}>
                  Clear Search Filter
                </button>
              </div>
            ) : (
              filteredSections.map((section) => (
                <article key={section.id} className="help-section-card" id={`help-section-${section.id}`}>
                  {/* Section Header */}
                  <div className="help-section-header">
                    <span className="help-section-icon">{section.icon}</span>
                    <div className="flex-1">
                      <div className="flex-between">
                        <h3 className="help-section-title">{section.title}</h3>
                        <span className="badge badge-secondary" style={{ fontSize: '10px' }}>{section.category}</span>
                      </div>
                      <p className="help-section-summary">{section.summary}</p>
                    </div>
                  </div>

                  {/* Section Content */}
                  <div className="help-section-content">
                    {/* Steps (Quick Start) */}
                    {section.steps && (
                      <div className="help-steps-list">
                        {section.steps.map((st) => (
                          <div key={st.step} className="help-step-item">
                            <div className="help-step-number">{st.step}</div>
                            <div className="help-step-body">
                              <strong className="help-step-title">{st.title}</strong>
                              <p className="help-step-desc">{st.desc}</p>
                            </div>
                          </div>
                        ))}
                        {section.note && (
                          <div className="help-callout-note mt-sm">
                            💡 <em>{section.note}</em>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tabs Overview Table */}
                    {section.tabsTable && (
                      <div className="help-table-responsive">
                        <table className="help-table">
                          <thead>
                            <tr>
                              <th>Tab</th>
                              <th>Purpose & Key Features</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.tabsTable.map((t, idx) => (
                              <tr key={idx}>
                                <td className="help-table-tab-name">
                                  <span style={{ marginRight: '6px' }}>{t.icon}</span>
                                  <strong>{t.tab}</strong>
                                </td>
                                <td className="help-table-tab-desc">{t.purpose}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Payment Methods Grid */}
                    {section.paymentMethods && (
                      <div className="help-grid-cards">
                        {section.paymentMethods.map((pm, idx) => (
                          <div key={idx} className="help-sub-card">
                            <div className="help-sub-card-title">
                              <span>{pm.icon}</span>
                              <strong>{pm.name}</strong>
                            </div>
                            <p className="help-sub-card-desc">{pm.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Balance Rules */}
                    {section.balanceRules && (
                      <div>
                        <div className="help-balance-grid mb-sm">
                          {section.balanceRules.map((br, idx) => (
                            <div key={idx} className={`help-balance-card ${br.type}`}>
                              <strong className="help-balance-label">{br.label}</strong>
                              <div className="help-balance-meaning">{br.meaning}</div>
                              <p className="help-balance-desc">{br.desc}</p>
                            </div>
                          ))}
                        </div>
                        {section.details && (
                          <ul className="help-bullets-list">
                            {section.details.map((d, idx) => (
                              <li key={idx}>{d}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Pricing Modes */}
                    {section.modes && (
                      <div className="help-grid-cards">
                        {section.modes.map((m, idx) => (
                          <div key={idx} className="help-sub-card">
                            <div className="flex-between">
                              <strong className="help-sub-card-title text-primary">{m.name}</strong>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '11px', padding: '2px 6px' }}
                                onClick={() => handleCopy(m.formula, `${m.name} formula copied`)}
                                title="Copy formula"
                              >
                                📋 Copy
                              </button>
                            </div>
                            <div className="body-small font-weight-bold mt-xs">{m.formula}</div>
                            <div className="body-small text-muted mt-xs">Presets: {m.presets}</div>
                            <div className="help-example-box mt-xs">
                              <small><strong>Example:</strong> {m.example}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inventory / Shrinkage Items */}
                    {section.items && (
                      <div className="help-grid-cards">
                        {section.items.map((item, idx) => (
                          <div key={idx} className="help-sub-card">
                            <strong className="help-sub-card-title">{item.title}</strong>
                            <p className="help-sub-card-desc">{item.desc}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Plain Text Sections (Suppliers, etc) */}
                    {section.text && (
                      <p className="help-text-block">{section.text}</p>
                    )}

                    {/* Insights / Reports sub-sections */}
                    {section.sections && (
                      <div className="help-bullets-block">
                        {section.sections.map((secItem, idx) => (
                          <div key={idx} className="mb-sm">
                            <strong>{secItem.title}:</strong> <span className="text-muted">{secItem.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Alert Box */}
                    {section.alert && (
                      <div className={`help-alert-box ${section.alert.type} mt-sm`}>
                        <strong>{section.alert.type === 'warning' ? '⚠️' : 'ℹ️'} {section.alert.title}</strong>
                        <p className="body-small mt-xs mb-none">{section.alert.text}</p>
                      </div>
                    )}

                    {/* FAQ List */}
                    {section.faqList && (
                      <div className="help-faq-list">
                        {section.faqList.map((faq, idx) => (
                          <div key={idx} className="help-faq-item">
                            <div className="help-faq-q">❓ {faq.q}</div>
                            <div className="help-faq-a">{faq.a}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Glossary Table */}
                    {section.terms && (
                      <div className="help-table-responsive">
                        <table className="help-table help-glossary-table">
                          <thead>
                            <tr>
                              <th style={{ width: '160px' }}>Term</th>
                              <th>Definition</th>
                            </tr>
                          </thead>
                          <tbody>
                            {section.terms.map((t, idx) => (
                              <tr key={idx}>
                                <td className="help-glossary-term"><strong>{t.term}</strong></td>
                                <td className="help-glossary-def">{t.def}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer flex-between">
          <span className="body-small text-muted">
            100% Offline User Guide &bull; Micro Saler POS
          </span>
          <button className="btn btn-primary" onClick={closeModal}>
            Done / Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
