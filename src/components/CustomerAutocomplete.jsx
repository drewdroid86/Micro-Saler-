import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { formatCents, filterCustomers, calculateCustomerBalance } from '../repository';

/**
 * Highlight matched search query in text
 */
function HighlightedText({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  const index = lower.indexOf(q);
  if (index === -1) return <span>{text}</span>;

  const before = text.substring(0, index);
  const match = text.substring(index, index + q.length);
  const after = text.substring(index + q.length);

  return (
    <span>
      {before}
      <mark className="autocomplete-highlight">{match}</mark>
      {after}
    </span>
  );
}

export const CustomerAutocomplete = ({
  customers = [],
  customerPrepayments = [],
  selectedCustomer = null,
  onSelectCustomer,
  onOpenAddCustomer,
  onOpenCustomerPicker
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Map of active customer prepayments
  const prepaymentsByCustomerId = useMemo(() => {
    const map = new Map();
    (customerPrepayments || []).forEach(p => {
      if (p.status !== 'FULFILLED') {
        const id = Number(p.customer_id);
        map.set(id, (map.get(id) || 0) + 1);
      }
    });
    return map;
  }, [customerPrepayments]);

  // Filtered matching customers
  const filteredCustomers = useMemo(() => {
    return filterCustomers(customers, searchQuery);
  }, [customers, searchQuery]);

  const trimmedQuery = searchQuery.trim();
  const hasExactMatch = useMemo(() => {
    if (!trimmedQuery) return false;
    const lower = trimmedQuery.toLowerCase();
    return (customers || []).some(c => (c.name || '').toLowerCase() === lower);
  }, [customers, trimmedQuery]);

  // Construct navigable list:
  // Item 0: Walk-in customer option
  // Items 1..N: Filtered customers
  // Optional Last item: "Add new customer" if query is non-empty and no exact match
  const showAddNew = trimmedQuery.length > 0 && !hasExactMatch;

  const navigableItems = useMemo(() => {
    const items = [{ type: 'walk-in' }];
    filteredCustomers.forEach(c => {
      items.push({ type: 'customer', data: c });
    });
    if (showAddNew) {
      items.push({ type: 'add-new', name: trimmedQuery });
    }
    return items;
  }, [filteredCustomers, showAddNew, trimmedQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsSearching(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Scroll active item into view when navigating via keyboard
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('.customer-autocomplete-item');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleStartSearch = () => {
    setIsSearching(true);
    setIsOpen(true);
    setSearchQuery('');
    setHighlightedIndex(0);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const handleSelectCustomer = useCallback((customer) => {
    onSelectCustomer(customer);
    setIsOpen(false);
    setIsSearching(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, [onSelectCustomer]);

  const handleSelectWalkIn = useCallback(() => {
    onSelectCustomer(null);
    setIsOpen(false);
    setIsSearching(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  }, [onSelectCustomer]);

  const handleAddNew = useCallback((name) => {
    setIsOpen(false);
    setIsSearching(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    if (onOpenAddCustomer) {
      onOpenAddCustomer(name);
    }
  }, [onOpenAddCustomer]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % navigableItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + navigableItems.length) % navigableItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < navigableItems.length) {
        const item = navigableItems[highlightedIndex];
        if (item.type === 'walk-in') {
          handleSelectWalkIn();
        } else if (item.type === 'customer') {
          handleSelectCustomer(item.data);
        } else if (item.type === 'add-new') {
          handleAddNew(item.name);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsSearching(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setIsSearching(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  };

  const selectedPrepaymentCount = selectedCustomer
    ? (prepaymentsByCustomerId.get(Number(selectedCustomer.customer_id)) || 0)
    : 0;

  return (
    <div className="customer-autocomplete-container" ref={containerRef}>
      {/* Selected Customer Pill Display */}
      {!isSearching && selectedCustomer ? (
        <div className="customer-pill-selected flex-between">
          <div
            className="customer-pill-info"
            onClick={handleStartSearch}
            title="Click to search or change customer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleStartSearch(); }}
          >
            <span className="customer-pill-icon">👤</span>
            <span className="customer-pill-name">{selectedCustomer.name}</span>
            {(() => {
              const b = calculateCustomerBalance(selectedCustomer);
              if (b.hasDebt) {
                return (
                  <span className="customer-pill-bal text-error" title="Customer owes money (debt)">
                    (Debt: -{formatCents(b.debtCents)})
                  </span>
                );
              }
              if (b.hasStoreCredit) {
                return (
                  <span className="customer-pill-bal text-success" title="Customer has store credit">
                    (Credit: +{formatCents(b.storeCreditCents)})
                  </span>
                );
              }
              return null;
            })()}
            {selectedPrepaymentCount > 0 && (
              <span className="customer-pill-prepay badge badge-good-standing" title="Active prepaid orders">
                📦 {selectedPrepaymentCount}
              </span>
            )}
          </div>
          <div className="customer-pill-actions">
            <button
              type="button"
              className="customer-pill-action-btn edit"
              onClick={handleStartSearch}
              title="Search / Change customer"
              aria-label="Change customer"
            >
              🔍
            </button>
            <button
              type="button"
              className="customer-pill-action-btn clear"
              onClick={handleSelectWalkIn}
              title="Clear customer (Switch to Walk-in)"
              aria-label="Clear customer"
            >
              &times;
            </button>
          </div>
        </div>
      ) : (
        /* Autocomplete Search Input */
        <div className="customer-autocomplete-input-wrapper">
          <span className="customer-autocomplete-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="customer-autocomplete-input"
            placeholder={selectedCustomer ? `Selected: ${selectedCustomer.name}` : "Search customer (name or phone)..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(0);
            }}
            onFocus={() => {
              setIsSearching(true);
              setIsOpen(true);
              if (highlightedIndex === -1) setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
          />

          {searchQuery.length > 0 && (
            <button
              type="button"
              className="customer-autocomplete-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setHighlightedIndex(0);
                if (inputRef.current) inputRef.current.focus();
              }}
              title="Clear search text"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}

          {/* Quick browse / customer picker modal button */}
          <button
            type="button"
            className="customer-autocomplete-browse-btn"
            onClick={() => {
              setIsOpen(false);
              setIsSearching(false);
              if (onOpenCustomerPicker) onOpenCustomerPicker();
            }}
            title="Browse full customer list"
            aria-label="Browse full customer list"
          >
            👥
          </button>

          {/* Cancel button if exiting search mode with a pre-selected customer */}
          {selectedCustomer && (
            <button
              type="button"
              className="customer-autocomplete-cancel-btn"
              onClick={() => {
                setIsSearching(false);
                setIsOpen(false);
                setSearchQuery('');
              }}
              title="Keep current customer"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Autocomplete Dropdown Menu */}
      {isOpen && (
        <div className="customer-autocomplete-dropdown" ref={dropdownRef} role="listbox">
          {/* 1. Walk-in Customer Option */}
          <div
            className={`customer-autocomplete-item walk-in ${highlightedIndex === 0 ? 'highlighted' : ''}`}
            onClick={handleSelectWalkIn}
            onMouseEnter={() => setHighlightedIndex(0)}
            role="option"
            aria-selected={highlightedIndex === 0}
          >
            <div className="customer-autocomplete-item-main">
              <span className="customer-item-icon">👤</span>
              <div>
                <strong className="customer-item-name">Walk-in Customer</strong>
                <div className="customer-item-sub text-muted">No account / Standard checkout</div>
              </div>
            </div>
            {!selectedCustomer && (
              <span className="customer-item-active-tag">Active</span>
            )}
          </div>

          {/* 2. Matching Customer Results */}
          {filteredCustomers.map((c, idx) => {
            const navIndex = idx + 1;
            const isHighlighted = highlightedIndex === navIndex;
            const isSelected = selectedCustomer && Number(selectedCustomer.customer_id) === Number(c.customer_id);
            const prepCount = prepaymentsByCustomerId.get(Number(c.customer_id)) || 0;
            const hasBalance = (c.current_balance_cents || 0) > 0;

            const badgeClass = c.trust_status === 'VIP'
              ? 'badge-vip'
              : c.trust_status === 'PAUSED'
              ? 'badge-paused'
              : 'badge-good-standing';

            return (
              <div
                key={c.customer_id}
                className={`customer-autocomplete-item ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectCustomer(c)}
                onMouseEnter={() => setHighlightedIndex(navIndex)}
                role="option"
                aria-selected={isHighlighted}
              >
                <div className="customer-autocomplete-item-main">
                  <span className="customer-item-icon">👤</span>
                  <div className="customer-item-details">
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                      <strong className="customer-item-name">
                        <HighlightedText text={c.name} query={searchQuery} />
                      </strong>
                      {c.trust_status && (
                        <span className={`badge ${badgeClass}`} style={{ fontSize: '10px', padding: '1px 5px' }}>
                          {c.trust_status}
                        </span>
                      )}
                      {prepCount > 0 && (
                        <span className="badge badge-good-standing" style={{ fontSize: '10px', padding: '1px 5px' }}>
                          📦 {prepCount} Prepaid
                        </span>
                      )}
                    </div>
                    <div className="customer-item-sub text-muted">
                      {c.phone_number || c.phone ? (
                        <span>
                          📞 <HighlightedText text={c.phone_number || c.phone} query={searchQuery} />
                        </span>
                      ) : (
                        <span>No phone</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="customer-item-balance-col text-right">
                  {(() => {
                    const b = calculateCustomerBalance(c);
                    return (
                      <span className={`customer-item-bal ${b.hasDebt ? 'text-error font-weight-bold' : b.hasStoreCredit ? 'text-success font-weight-bold' : 'text-muted'}`}>
                        {b.hasDebt
                          ? `Debt: -${formatCents(b.debtCents)}`
                          : b.hasStoreCredit
                          ? `Credit: +${formatCents(b.storeCreditCents)}`
                          : 'Bal: $0.00'}
                      </span>
                    );
                  })()}
                  {c.credit_limit_cents > 0 && (
                    <span className="customer-item-limit text-muted">
                      Limit: {formatCents(c.credit_limit_cents)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* 3. Add New Customer Option */}
          {showAddNew && (
            <div
              className={`customer-autocomplete-item add-new ${highlightedIndex === navigableItems.length - 1 ? 'highlighted' : ''}`}
              onClick={() => handleAddNew(trimmedQuery)}
              onMouseEnter={() => setHighlightedIndex(navigableItems.length - 1)}
              role="option"
              aria-selected={highlightedIndex === navigableItems.length - 1}
            >
              <div className="customer-autocomplete-item-main">
                <span className="customer-item-icon text-success">➕</span>
                <div>
                  <strong className="text-success">Add new customer: "{trimmedQuery}"</strong>
                  <div className="customer-item-sub text-muted">Create customer profile & auto-select</div>
                </div>
              </div>
              <span className="badge badge-good-standing" style={{ fontSize: '11px' }}>New</span>
            </div>
          )}

          {/* Empty results message when query doesn't match and no add-new */}
          {filteredCustomers.length === 0 && !showAddNew && (
            <div className="customer-autocomplete-empty text-muted">
              No matching customers found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
