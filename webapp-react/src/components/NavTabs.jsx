import React from 'react';
import { usePos } from '../context/PosContext';

export const NavTabs = () => {
  const { currentTab, setCurrentTab } = usePos();

  const tabs = [
    { id: 'checkout', icon: '🛒', label: 'Checkout' },
    { id: 'inventory', icon: '📦', label: 'Inventory' },
    { id: 'pricing', icon: '🧮', label: 'Pricing Calculator' },
    { id: 'customers', icon: '👥', label: 'Customers' },
    { id: 'suppliers', icon: '🏭', label: 'Suppliers' },
    { id: 'reports', icon: '📊', label: 'Reports & P&L' },
    { id: 'history', icon: '📋', label: 'History' },
    { id: 'audit', icon: '🔒', label: 'Audit' },
  ];

  return (
    <nav className="nav-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-tab ${currentTab === tab.id ? 'active' : ''}`}
          onClick={() => setCurrentTab(tab.id)}
        >
          <span className="nav-tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
};
