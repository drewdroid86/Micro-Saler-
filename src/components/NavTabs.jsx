import React, { useState } from 'react';
import { usePos } from '../context/PosContext';

export const NavTabs = () => {
  const { currentTab, setCurrentTab, cart, pigments, customerPrepayments, openModal } = usePos();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const cartCount = (cart || []).length;
  const lowStockCount = (pigments || []).filter(p => (p.stock_mg || 0) < 10000).length;
  const openPrepaymentsCount = (customerPrepayments || []).filter(
    p => !['FULFILLED', 'DELIVERED', 'CANCELLED', 'VOIDED'].includes((p.status || '').toUpperCase())
  ).length;

  const navGroups = [
    {
      label: 'Point of Sale',
      items: [
        { id: 'checkout', icon: '🛒', label: 'Register', shortLabel: 'Register', badge: cartCount > 0 ? cartCount : null, badgeType: 'primary' },
        { id: 'history', icon: '📋', label: 'Sales History', shortLabel: 'History' },
      ]
    },
    {
      label: 'Catalog & Stock',
      items: [
        { id: 'inventory', icon: '📦', label: 'Inventory', shortLabel: 'Inventory', badge: lowStockCount > 0 ? `${lowStockCount} low` : null, badgeType: 'warning' },
        { id: 'pricing', icon: '🧮', label: 'Pricing Lab', shortLabel: 'Pricing' },
      ]
    },
    {
      label: 'Accounts & Tabs',
      items: [
        { id: 'customers', icon: '👥', label: 'Customers', shortLabel: 'Customers', badge: openPrepaymentsCount > 0 ? openPrepaymentsCount : null, badgeType: 'info' },
        { id: 'suppliers', icon: '🏭', label: 'Suppliers', shortLabel: 'Suppliers' },
      ]
    },
    {
      label: 'Analytics & System',
      items: [
        { id: 'reports', icon: '📊', label: 'Reports & P&L', shortLabel: 'Reports' },
        { id: 'insights', icon: '📈', label: 'Business Insights', shortLabel: 'Insights' },
        { id: 'audit', icon: '🔒', label: 'Audit Trail', shortLabel: 'Audit' },
      ]
    }
  ];

  const allTabs = navGroups.flatMap(g => g.items);
  const primaryMobileIds = ['checkout', 'inventory', 'customers', 'history'];
  const primaryMobileTabs = allTabs.filter(t => primaryMobileIds.includes(t.id));
  const secondaryMobileTabs = allTabs.filter(t => !primaryMobileIds.includes(t.id));
  const isSecondaryActive = secondaryMobileTabs.some(t => t.id === currentTab);

  const handleSelectTab = (id) => {
    setCurrentTab(id);
    setMoreMenuOpen(false);
  };

  return (
    <>
      {/* Desktop Categorized Sidebar */}
      <aside className="app-sidebar" aria-label="Main Navigation">
        <div className="sidebar-scroll-area">
          {navGroups.map(group => (
            <div key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              <div className="sidebar-group-items">
                {group.items.map(tab => {
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectTab(tab.id)}
                    >
                      <span className="sidebar-nav-icon">{tab.icon}</span>
                      <span className="sidebar-nav-label">{tab.label}</span>
                      {tab.badge !== null && tab.badge !== undefined && (
                        <span className={`sidebar-nav-badge badge-${tab.badgeType || 'primary'}`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-shortcut-card"
            onClick={() => openModal('HELP')}
          >
            <span style={{ fontSize: '15px' }}>💡</span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--market-text-primary)' }}>Quick Help Guide</div>
              <div style={{ fontSize: '10px', color: 'var(--market-text-secondary)' }}>Press <kbd>?</kbd> or <kbd>F1</kbd> anytime</div>
            </div>
          </button>
        </div>
      </aside>

      {/* Mobile / Tablet Compact Top Strip */}
      <nav className="nav-tabs" aria-label="Mobile Navigation Strip">
        {allTabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => handleSelectTab(tab.id)}
          >
            <span className="nav-tab-icon">{tab.icon}</span>
            <span>{tab.shortLabel}</span>
            {tab.badge !== null && tab.badge !== undefined && (
              <span className={`nav-tab-pill-badge badge-${tab.badgeType || 'primary'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Mobile Bottom Dock */}
      <nav className="mobile-bottom-nav" aria-label="Bottom Dock Navigation">
        {primaryMobileTabs.map(tab => (
          <button
            key={tab.id}
            className={`mobile-dock-btn ${currentTab === tab.id && !moreMenuOpen ? 'active' : ''}`}
            onClick={() => handleSelectTab(tab.id)}
          >
            <span className="mobile-dock-icon-wrap">
              <span className="mobile-dock-icon">{tab.icon}</span>
              {tab.badge !== null && tab.badge !== undefined && (
                <span className="mobile-dock-dot" />
              )}
            </span>
            <span className="mobile-dock-label">{tab.shortLabel}</span>
          </button>
        ))}
        <button
          className={`mobile-dock-btn ${isSecondaryActive || moreMenuOpen ? 'active' : ''}`}
          onClick={() => setMoreMenuOpen(prev => !prev)}
        >
          <span className="mobile-dock-icon-wrap">
            <span className="mobile-dock-icon">⚡</span>
          </span>
          <span className="mobile-dock-label">More</span>
        </button>
      </nav>

      {/* Mobile "More" Drawer Sheet */}
      {moreMenuOpen && (
        <div className="mobile-more-overlay" onClick={() => setMoreMenuOpen(false)}>
          <div className="mobile-more-sheet" onClick={e => e.stopPropagation()}>
            <div className="flex-between mb-sm">
              <span className="label-small text-muted">MORE TOOLS & ANALYTICS</span>
              <button className="modal-close" style={{ fontSize: '18px' }} onClick={() => setMoreMenuOpen(false)}>&times;</button>
            </div>
            <div className="mobile-more-grid">
              {secondaryMobileTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`mobile-more-card ${currentTab === tab.id ? 'active' : ''}`}
                  onClick={() => handleSelectTab(tab.id)}
                >
                  <span style={{ fontSize: '20px' }}>{tab.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700 }}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
