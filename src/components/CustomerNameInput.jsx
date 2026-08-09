import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { formatCents, filterCustomerSuggestions, calculateCustomerBalance } from '../repository';

/**
 * Highlight matching prefix in suggestion text
 */
function HighlightPrefix({ text, query }) {
  if (!query || !text) return <span>{text}</span>;
  const q = query.trim().toLowerCase();
  const lower = text.toLowerCase();
  if (!lower.startsWith(q)) return <span>{text}</span>;

  const match = text.substring(0, q.length);
  const rest = text.substring(q.length);

  return (
    <span>
      <strong className="customer-name-match">{match}</strong>
      {rest}
    </span>
  );
}

/**
 * CustomerNameInput Component
 * 
 * Controlled input for customer name with in-memory startsWith filtering (>= 2 chars, max 5 suggestions).
 * Selecting a suggestion fills the input and attaches the full customer record (id, balance, credit limit, prepayments).
 * Free-text typed names without exact match are treated as new customer input without hardcoding database writes.
 */
export const CustomerNameInput = ({
  value = '',
  onChange,
  customers = [],
  customerPrepayments = [],
  selectedCustomer = null,
  onSelectCustomer,
  onOpenCustomerPicker,
  placeholder = 'Customer Name (or Walk-in)...',
  disabled = false,
  autoFocus = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Prepayment counts lookup
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

  // Compute filtered suggestions in-memory (starts-with, max 5)
  const suggestions = useMemo(() => {
    return filterCustomerSuggestions(customers, value);
  }, [customers, value]);

  // Close suggestions when input length drops below 2 chars
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }, [value]);

  // Handle click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
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

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('.customer-name-suggestion-item');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Handle text input change
  const handleInputChange = (e) => {
    const typedText = e.target.value;
    const trimmed = typedText.trim();

    // Check if typed text exactly matches an existing customer name (case-insensitive)
    const exactMatch = (customers || []).find(
      c => c && typeof c.name === 'string' && c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    let customerPayload = null;
    if (trimmed === '') {
      customerPayload = null; // Walk-in
    } else if (exactMatch) {
      customerPayload = exactMatch;
    } else {
      // New / unpersisted customer free-text representation
      customerPayload = {
        customer_id: null,
        name: trimmed,
        current_balance_cents: 0,
        credit_limit_cents: 0,
        isNew: true
      };
    }

    if (onChange) {
      onChange(typedText, customerPayload);
    }
    if (onSelectCustomer) {
      onSelectCustomer(customerPayload);
    }

    if (trimmed.length >= 2) {
      setIsOpen(true);
      setHighlightedIndex(0);
    } else {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Handle choosing a suggestion
  const handleSelectSuggestion = useCallback((customer) => {
    if (onChange) {
      onChange(customer.name, customer);
    }
    if (onSelectCustomer) {
      onSelectCustomer(customer);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onChange, onSelectCustomer]);

  // Handle clearing input back to Walk-in
  const handleClear = () => {
    if (onChange) {
      onChange('', null);
    }
    if (onSelectCustomer) {
      onSelectCustomer(null);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if ((e.key === 'ArrowDown' || e.key === 'Enter') && value.trim().length >= 2) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
      if (inputRef.current) {
        inputRef.current.blur();
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const hasAttachedCustomer = selectedCustomer && selectedCustomer.customer_id;
  const activePrepayCount = hasAttachedCustomer
    ? (prepaymentsByCustomerId.get(Number(selectedCustomer.customer_id)) || 0)
    : 0;

  return (
    <div className="customer-name-input-container" ref={containerRef}>
      <div className="customer-name-input-wrapper">
        <span className="customer-name-input-icon" title={hasAttachedCustomer ? `Customer ID: #${selectedCustomer.customer_id}` : "Customer"}>
          👤
        </span>

        <input
          ref={inputRef}
          type="text"
          className={`form-input customer-name-input-field ${hasAttachedCustomer ? 'has-customer' : ''}`}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (value.trim().length >= 2) {
              setIsOpen(true);
              if (highlightedIndex === -1) setHighlightedIndex(0);
            }
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-autocomplete="list"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-haspopup="listbox"
        />

        {/* Badges / indicators for selected customer */}
        {hasAttachedCustomer && (
          <div className="customer-name-badge-group">
            {(() => {
              const b = calculateCustomerBalance(selectedCustomer);
              if (b.hasDebt) {
                return (
                  <span className="badge badge-paused" title="Customer owes money (debt)" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    Debt: -{formatCents(b.debtCents)}
                  </span>
                );
              }
              if (b.hasStoreCredit) {
                return (
                  <span className="badge badge-good-standing" title="Customer has store credit" style={{ fontSize: '11px', padding: '2px 6px' }}>
                    Credit: +{formatCents(b.storeCreditCents)}
                  </span>
                );
              }
              return null;
            })()}
            {activePrepayCount > 0 && (
              <span className="badge badge-good-standing" title="Active prepayments" style={{ fontSize: '11px', padding: '2px 6px' }}>
                📦 {activePrepayCount}
              </span>
            )}
          </div>
        )}

        {/* Clear Button */}
        {value.length > 0 && (
          <button
            type="button"
            className="customer-name-clear-btn"
            onClick={handleClear}
            title="Clear customer / Reset to Walk-in"
            aria-label="Clear customer"
          >
            &times;
          </button>
        )}

        {/* Modal Browse List Button */}
        {onOpenCustomerPicker && (
          <button
            type="button"
            className="customer-name-browse-btn"
            onClick={() => {
              setIsOpen(false);
              onOpenCustomerPicker();
            }}
            title="Browse all customer accounts"
            aria-label="Browse all customer accounts"
          >
            📋
          </button>
        )}
      </div>

      {/* Dropdown Suggestions List (up to 5 items) */}
      {isOpen && suggestions.length > 0 && (
        <div className="customer-name-suggestions-dropdown" ref={dropdownRef} role="listbox">
          <div className="customer-name-suggestions-header">
            <span>Existing Customers ({suggestions.length})</span>
            <small className="text-muted">Tap to attach account</small>
          </div>
          {suggestions.map((c, idx) => {
            const isHighlighted = highlightedIndex === idx;
            const isAttached = selectedCustomer && Number(selectedCustomer.customer_id) === Number(c.customer_id);
            const prepCount = prepaymentsByCustomerId.get(Number(c.customer_id)) || 0;
            const hasTabBalance = (c.current_balance_cents || 0) > 0;

            const badgeClass = c.trust_status === 'VIP'
              ? 'badge-vip'
              : c.trust_status === 'PAUSED'
              ? 'badge-paused'
              : 'badge-good-standing';

            return (
              <div
                key={c.customer_id}
                className={`customer-name-suggestion-item ${isHighlighted ? 'highlighted' : ''} ${isAttached ? 'selected' : ''}`}
                onClick={() => handleSelectSuggestion(c)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                role="option"
                aria-selected={isHighlighted}
              >
                <div className="customer-suggestion-main">
                  <span className="customer-suggestion-icon">👤</span>
                  <div className="customer-suggestion-text">
                    <div className="flex-center gap-xs" style={{ justifyContent: 'flex-start' }}>
                      <span className="customer-suggestion-name">
                        <HighlightPrefix text={c.name} query={value} />
                      </span>
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
                    {c.phone_number || c.phone ? (
                      <small className="customer-suggestion-sub text-muted">
                        📞 {c.phone_number || c.phone}
                      </small>
                    ) : null}
                  </div>
                </div>

                <div className="customer-suggestion-balance text-right">
                  {(() => {
                    const b = calculateCustomerBalance(c);
                    return (
                      <span className={`body-small ${b.hasDebt ? 'text-error font-weight-bold' : b.hasStoreCredit ? 'text-success font-weight-bold' : 'text-muted'}`}>
                        {b.hasDebt
                          ? `Debt: -${formatCents(b.debtCents)}`
                          : b.hasStoreCredit
                          ? `Credit: +${formatCents(b.storeCreditCents)}`
                          : 'Bal: $0.00'}
                      </span>
                    );
                  })()}
                  {c.credit_limit_cents > 0 && (
                    <div className="text-muted" style={{ fontSize: '10px' }}>
                      Limit: {formatCents(c.credit_limit_cents)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
