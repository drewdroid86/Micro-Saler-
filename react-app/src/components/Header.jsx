import React, { useState } from 'react';

const Header = ({ activeTab, onTabChange }) => {
  const tabs = ['Checkout', 'Inventory', 'Customers', 'History', 'Audit'];

  return (
    <header className="brand-header">
      <div className="top-bar">
        <div className="logo-container">
          <h1 className="logo">Micro-Saler</h1>
        </div>
        <div className="status-badge offline-badge">
          <span className="dot"></span>
          Offline Ready
        </div>
      </div>
      <nav className="tab-navigation">
        <ul className="tab-list">
          {tabs.map((tab) => (
            <li
              key={tab}
              className={`tab-item ${activeTab === tab ? 'active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              {tab}
            </li>
          ))}
        </ul>
      </nav>
      
      <style>{`
        .brand-header {
          background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
          color: white;
          padding-top: 16px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 16px 16px;
        }
        .logo {
          margin: 0;
          font-size: 24px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .status-badge {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.2);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .dot {
          width: 8px;
          height: 8px;
          background-color: #69f0ae;
          border-radius: 50%;
          margin-right: 6px;
          box-shadow: 0 0 5px #69f0ae;
        }
        .tab-navigation {
          background: rgba(0,0,0,0.15);
        }
        .tab-list {
          display: flex;
          list-style: none;
          margin: 0;
          padding: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .tab-list::-webkit-scrollbar {
          display: none;
        }
        .tab-item {
          padding: 12px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
          opacity: 0.8;
          transition: all 0.2s ease;
        }
        .tab-item.active {
          opacity: 1;
          border-bottom-color: #69f0ae;
          color: #69f0ae;
        }
      `}</style>
    </header>
  );
};

export default Header;
