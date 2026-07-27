import { MicroSalerDB } from './db.js';
import { PosRepository, formatCents, formatMgToGrams } from './repository.js';

const state = {
  db: null,
  repo: null,
  currentTab: 'checkout',
  pigments: [],
  customers: [],
  sales: [],
  saleItems: [],
  auditLogs: [],
  shrinkageLogs: [],
  cart: [],
  selectedCustomer: null,
  selectedPigment: null,
  pricingMode: 'RETAIL',
  isHandshakeOverride: false
};

// --- Initialization ---

async function init() {
  state.db = new MicroSalerDB();
  await state.db.init();
  state.repo = new PosRepository(state.db);
  await refreshAllData();
  setupNavigation();
  renderCurrentScreen();
}

// --- Data Refresh ---

async function refreshAllData() {
  try {
    state.pigments = await state.db.getActivePigments();
    state.customers = await state.db.getAllCustomers();
    state.sales = await state.db.getAllSales();
    state.saleItems = await state.db.getAll('sale_items');
    
    const auditLogs = await state.db.getAll('audit_log');
    state.auditLogs = auditLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    const shrinkageLogs = await state.db.getAll('shrinkage_logs');
    state.shrinkageLogs = shrinkageLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    showToast('Failed to load data: ' + error.message, 'error');
  }
}

// --- Navigation ---

function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentTab = tab.dataset.tab;
      
      document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
      });
      const currentScreen = document.getElementById(`${state.currentTab}-screen`);
      if (currentScreen) {
        currentScreen.style.display = 'block';
      }
      
      renderCurrentScreen();
    });
  });
}

function renderCurrentScreen() {
  switch (state.currentTab) {
    case 'checkout':
      renderCheckout();
      break;
    case 'inventory':
      renderInventory();
      break;
    case 'customers':
      renderCustomers();
      break;
    case 'history':
      renderHistory();
      break;
    case 'audit':
      renderAudit();
      break;
  }
}

// --- Checkout Screen ---

function renderCheckout() {
  const screen = document.getElementById('checkout-screen');
  if (!screen) return;
  
  let html = `<div class="checkout-layout" style="display: flex; gap: 20px; height: 100%;">
    <div class="checkout-main" style="flex: 2; display: flex; flex-direction: column;">
      <div class="checkout-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div class="customer-selector pill" onclick="openCustomerPickerModal()" style="cursor: pointer; padding: 10px 15px; background: var(--glass-bg, rgba(255,255,255,0.1)); border-radius: 20px; border: 1px solid var(--border-color, #ccc);">
          ${state.selectedCustomer ? `👤 ${escapeHtml(state.selectedCustomer.name)}` : '👤 Walk-in Customer'}
        </div>
        <div class="pricing-toggle" style="display: flex; background: var(--glass-bg, rgba(0,0,0,0.1)); border-radius: 8px; overflow: hidden;">
          <button class="${state.pricingMode === 'RETAIL' ? 'active' : ''}" onclick="setPricingMode('RETAIL')" style="padding: 10px 20px; border: none; background: ${state.pricingMode === 'RETAIL' ? 'var(--primary-color, #007bff)' : 'transparent'}; color: ${state.pricingMode === 'RETAIL' ? '#fff' : 'inherit'}; cursor: pointer;">RETAIL</button>
          <button class="${state.pricingMode === 'WHOLESALE' ? 'active' : ''}" onclick="setPricingMode('WHOLESALE')" style="padding: 10px 20px; border: none; background: ${state.pricingMode === 'WHOLESALE' ? 'var(--primary-color, #007bff)' : 'transparent'}; color: ${state.pricingMode === 'WHOLESALE' ? '#fff' : 'inherit'}; cursor: pointer;">WHOLESALE</button>
        </div>
      </div>
      
      <div class="pigment-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; overflow-y: auto; flex: 1; margin-bottom: 20px;">
        ${state.pigments.map(p => `
          <div class="pigment-card ${state.selectedPigment && state.selectedPigment.pigment_id === p.pigment_id ? 'selected' : ''}" onclick="selectPigment('${p.pigment_id}')" style="cursor: pointer; padding: 15px; border-radius: 12px; border: 2px solid ${state.selectedPigment && state.selectedPigment.pigment_id === p.pigment_id ? 'var(--primary-color, #007bff)' : 'var(--border-color, #ddd)'}; display: flex; align-items: center; gap: 15px;">
            <div class="color-swatch" style="width: 50px; height: 50px; border-radius: 50%; background-color: ${p.color_code}; border: 1px solid rgba(0,0,0,0.1);"></div>
            <div class="pigment-info">
              <div style="font-weight: bold; font-size: 1.1em;">${escapeHtml(p.name)}</div>
              <div style="font-size: 0.9em; opacity: 0.8;">${escapeHtml(p.finish_type)}</div>
              <div class="stock ${p.stock_mg < 10000 ? 'low-stock' : ''}" style="font-size: 0.8em; margin-top: 5px; color: ${p.stock_mg < 10000 ? '#dc3545' : 'inherit'}">${formatMgToGrams(p.stock_mg)}g in stock</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="weight-presets" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px;">
        ${[
          {label:'¼g', mg:250}, {label:'½g', mg:500}, {label:'¾g', mg:750}, {label:'1g', mg:1000},
          {label:'1.5g', mg:1500}, {label:'1.75g', mg:1750}, {label:'3.5g', mg:3500}, {label:'7g', mg:7000},
          {label:'14g', mg:14000}, {label:'28g', mg:28000}
        ].map(preset => `
          <button onclick="addToCart(${preset.mg})" style="padding: 10px 15px; min-width: 60px; border-radius: 8px; border: 1px solid var(--border-color, #ccc); background: var(--glass-bg, rgba(255,255,255,0.05)); cursor: pointer;">${preset.label}</button>
        `).join('')}
        <button onclick="addCustomWeightToCart()" style="padding: 10px 15px; min-width: 80px; border-radius: 8px; border: 1px solid var(--primary-color, #007bff); background: rgba(0,123,255,0.1); color: var(--primary-color, #007bff); cursor: pointer; font-weight: bold;">Custom</button>
      </div>
    </div>
    
    <div class="checkout-sidebar" style="flex: 1; display: flex; flex-direction: column; background: var(--glass-bg, rgba(255,255,255,0.05)); border-radius: 12px; padding: 20px; border: 1px solid var(--border-color, #eee);">
      <h3 style="margin-top: 0; margin-bottom: 15px;">Cart</h3>
      <div class="cart-items" style="flex: 1; overflow-y: auto;">
        ${state.cart.length === 0 ? '<div style="text-align: center; opacity: 0.5; margin-top: 50px;">Cart is empty</div>' : 
          state.cart.map((item, index) => `
            <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color, #eee);">
              <div>
                <div style="font-weight: bold;">${escapeHtml(item.pigment.name)}</div>
                <div style="font-size: 0.85em; opacity: 0.7;">${formatMgToGrams(item.weight_mg)}g</div>
              </div>
              <div style="display: flex; align-items: center; gap: 15px;">
                <div style="font-weight: bold;">${formatCents(item.price_charged_cents)}</div>
                <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 1.2em;">×</button>
              </div>
            </div>
          `).join('')
        }
      </div>
      
      <div class="cart-summary" style="margin-top: 20px; padding-top: 15px; border-top: 2px solid var(--border-color, #ddd);">
        ${(() => {
          const totalCharged = state.cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
          const totalCogs = state.cart.reduce((sum, item) => sum + item.unit_cogs_cents, 0);
          const margin = totalCharged > 0 ? Math.round(((totalCharged - totalCogs) / totalCharged) * 100) : 0;
          return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; opacity: 0.7; font-size: 0.9em;">
              <span>COGS</span>
              <span>${formatCents(totalCogs)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; opacity: 0.7; font-size: 0.9em;">
              <span>Est. Margin</span>
              <span>${margin}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 1.5em; font-weight: bold;">
              <span>Total</span>
              <span>${formatCents(totalCharged)}</span>
            </div>
          `;
        })()}
        ${state.cart.length > 0 ? `<button onclick="clearCart()" style="width: 100%; padding: 10px; margin-bottom: 10px; background: transparent; border: 1px solid #dc3545; color: #dc3545; border-radius: 8px; cursor: pointer;">Clear Cart</button>` : ''}
      </div>
      
      <div class="bottom-action-bar" style="margin-top: auto;">
        <button class="btn-collect-cash" onclick="quickCollectCash()" style="width: 100%; padding: 15px; margin-bottom: 10px; background: #28a745; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; cursor: pointer;">💵 COLLECT CASH</button>
        <button onclick="openPaymentDrawer()" style="width: 100%; padding: 15px; background: var(--primary-color, #007bff); color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Digital / Tab / Split</button>
      </div>
    </div>
  </div>`;
  
  screen.innerHTML = html;
}

window.setPricingMode = (mode) => {
  state.pricingMode = mode;
  renderCheckout();
};

window.selectPigment = (id) => {
  state.selectedPigment = state.pigments.find(p => p.pigment_id === id);
  renderCheckout();
};

window.addToCart = (weightMg, customPriceCents = null) => {
  if (!state.selectedPigment) {
    showToast('Please select a pigment first.', 'error');
    return;
  }
  
  const p = state.selectedPigment;
  const pricePerGramCents = state.pricingMode === 'RETAIL' ? p.retail_price_per_gram_cents : p.wholesale_price_per_gram_cents;
  
  let priceChargedCents = customPriceCents !== null 
    ? customPriceCents 
    : Math.round((weightMg / 1000) * pricePerGramCents) + p.default_pkg_cents;
    
  let unitCogsCents = p.stock_mg > 0 
    ? Math.round((p.total_cost_cents / p.stock_mg) * weightMg) 
    : 0;
    
  state.cart.push({
    pigment: { ...p },
    weight_mg: weightMg,
    price_charged_cents: priceChargedCents,
    unit_cogs_cents: unitCogsCents
  });
  
  renderCheckout();
};

window.addCustomWeightToCart = () => {
  if (!state.selectedPigment) {
    showToast('Please select a pigment first.', 'error');
    return;
  }
  const weightGrams = prompt('Enter weight in grams:');
  if (weightGrams && !isNaN(weightGrams) && Number(weightGrams) > 0) {
    const customPriceStr = prompt('Enter custom price ($) or leave blank to auto-calculate:');
    let customPriceCents = null;
    if (customPriceStr && !isNaN(customPriceStr)) {
      customPriceCents = Math.round(Number(customPriceStr) * 100);
    }
    addToCart(Math.round(Number(weightGrams) * 1000), customPriceCents);
  }
};

window.removeFromCart = (index) => {
  state.cart.splice(index, 1);
  renderCheckout();
};

window.clearCart = () => {
  state.cart = [];
  renderCheckout();
};

window.quickCollectCash = async () => {
  if (state.cart.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }
  const totalAmountCents = state.cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
  const customerId = state.selectedCustomer?.customer_id || null;
  const payments = [{payment_type: 'CASH', digital_provider: null, amount_cents: totalAmountCents, merchant_fee_cents: 0}];
  
  try {
    await state.repo.completeSale(customerId, state.cart, payments, false);
    state.cart = [];
    state.selectedCustomer = null;
    state.selectedPigment = null;
    await refreshAllData();
    renderCheckout();
    showToast('Sale completed successfully!', 'success');
  } catch (error) {
    showToast('Checkout failed: ' + error.message, 'error');
  }
};

// --- Inventory Screen ---

function renderInventory() {
  const screen = document.getElementById('inventory-screen');
  if (!screen) return;
  
  let html = `
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>INVENTORY MANAGEMENT</h2>
      <button onclick="openAddPigmentModal()" style="padding: 10px 20px; background: var(--primary-color, #007bff); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">+ New Pigment</button>
    </div>
    
    <div style="margin-bottom: 30px; padding: 20px; background: var(--glass-bg, rgba(255,255,255,0.05)); border-radius: 12px; border: 1px solid var(--border-color, #eee);">
      <h3 style="margin-top: 0;">Cost vs Revenue Chart</h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        ${state.pigments.map(p => {
          const cost = p.total_cost_cents;
          const rev = state.saleItems.filter(si => si.pigment_id === p.pigment_id).reduce((sum, si) => sum + si.price_charged_cents, 0);
          const maxVal = Math.max(cost, rev, 1);
          const costPct = (cost / maxVal) * 100;
          const revPct = (rev / maxVal) * 100;
          const isProfit = rev >= cost;
          return `
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="width: 100px; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(p.name)}</div>
              <div style="flex: 1;">
                <div style="display: flex; height: 8px; margin-bottom: 4px;">
                  <div style="width: ${costPct}%; background: #dc3545; border-radius: 4px 0 0 4px;" title="Cost: ${formatCents(cost)}"></div>
                </div>
                <div style="display: flex; height: 8px;">
                  <div style="width: ${revPct}%; background: #28a745; border-radius: 4px 0 0 4px;" title="Revenue: ${formatCents(rev)}"></div>
                </div>
              </div>
              <div style="width: 80px; text-align: right; font-size: 0.9em; font-weight: bold; color: ${isProfit ? '#28a745' : '#dc3545'};">
                ${isProfit ? '+' : ''}${formatCents(rev - cost)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    
    <div class="inventory-cards-grid grid-2col" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
      ${state.pigments.map(p => {
        const wac = p.stock_mg > 0 ? (p.total_cost_cents / p.stock_mg) * 1000 : 0;
        return `
          <div class="inventory-card" style="padding: 20px; background: var(--glass-bg, rgba(255,255,255,0.05)); border-radius: 12px; border: 1px solid var(--border-color, #eee);">
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${p.color_code}; border: 1px solid rgba(0,0,0,0.1);"></div>
              <div>
                <div style="font-weight: bold; font-size: 1.2em;">${escapeHtml(p.name)}</div>
                <div style="opacity: 0.7; font-size: 0.9em;">${escapeHtml(p.finish_type)}</div>
              </div>
              <div style="margin-left: auto; text-align: right;">
                <div class="${p.stock_mg < 10000 ? 'low-stock' : ''}" style="font-weight: bold; font-size: 1.2em; color: ${p.stock_mg < 10000 ? '#dc3545' : 'inherit'}">${formatMgToGrams(p.stock_mg)}g</div>
                <div style="opacity: 0.7; font-size: 0.8em;">In Stock</div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; text-align: center; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 8px;">
              <div>
                <div style="opacity: 0.6; font-size: 0.75em; text-transform: uppercase;">WAC / g</div>
                <div style="font-weight: bold;">${formatCents(Math.round(wac))}</div>
              </div>
              <div>
                <div style="opacity: 0.6; font-size: 0.75em; text-transform: uppercase;">Retail / g</div>
                <div style="font-weight: bold;">${formatCents(p.retail_price_per_gram_cents)}</div>
              </div>
              <div>
                <div style="opacity: 0.6; font-size: 0.75em; text-transform: uppercase;">Wholesale / g</div>
                <div style="font-weight: bold;">${formatCents(p.wholesale_price_per_gram_cents)}</div>
              </div>
            </div>
            
            <div style="display: flex; gap: 10px;">
              <button onclick="openShrinkageModal('${p.pigment_id}')" style="flex: 1; padding: 8px; border: 1px solid #ffc107; background: transparent; color: #ffc107; border-radius: 6px; cursor: pointer;">Spillage</button>
              <button onclick="openRestockModal('${p.pigment_id}')" style="flex: 1; padding: 8px; border: 1px solid #17a2b8; background: transparent; color: #17a2b8; border-radius: 6px; cursor: pointer;">Restock</button>
              <button onclick="openEditPriceModal('${p.pigment_id}')" style="flex: 1; padding: 8px; border: 1px solid var(--primary-color, #007bff); background: transparent; color: var(--primary-color, #007bff); border-radius: 6px; cursor: pointer;">Edit Price</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  screen.innerHTML = html;
}

// --- Customers Screen ---

function renderCustomers() {
  const screen = document.getElementById('customers-screen');
  if (!screen) return;
  
  let html = `
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2>CUSTOMER HOUSE TABS</h2>
      <button onclick="openAddCustomerModal()" style="padding: 10px 20px; background: var(--primary-color, #007bff); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">+ New Customer</button>
    </div>
    
    <div class="customer-cards-grid grid-2col" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
      ${state.customers.map(c => {
        const bal = c.current_balance_cents;
        const lim = c.credit_limit_cents;
        const pct = lim > 0 ? Math.min((bal / lim) * 100, 100) : 0;
        const trustColor = c.trust_status === 'VIP' ? '#6f42c1' : c.trust_status === 'PAUSED' ? '#dc3545' : '#28a745';
        
        return `
          <div class="customer-card" style="padding: 20px; background: var(--glass-bg, rgba(255,255,255,0.05)); border-radius: 12px; border: 1px solid var(--border-color, #eee); position: relative;">
            <div style="position: absolute; top: 20px; right: 20px; padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold; background: ${trustColor}20; color: ${trustColor};">
              ${escapeHtml(c.trust_status)}
            </div>
            
            <div style="font-weight: bold; font-size: 1.3em; margin-bottom: 5px;">${escapeHtml(c.name)}</div>
            <div style="opacity: 0.7; font-size: 0.9em; margin-bottom: 20px;">${escapeHtml(c.phone_number || 'No phone')}</div>
            
            <div style="margin-bottom: 15px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85em; margin-bottom: 5px;">
                <span>Balance: <strong style="color: ${pct >= 100 ? '#dc3545' : 'inherit'}">${formatCents(bal)}</strong></span>
                <span style="opacity: 0.7;">Limit: ${formatCents(lim)}</span>
              </div>
              <div style="height: 6px; background: rgba(0,0,0,0.1); border-radius: 3px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${pct >= 90 ? '#dc3545' : pct >= 75 ? '#ffc107' : '#007bff'};"></div>
              </div>
            </div>
            
            <button onclick="openSettleTabModal('${c.customer_id}')" style="width: 100%; padding: 10px; border: none; background: rgba(40, 167, 69, 0.1); color: #28a745; border-radius: 8px; font-weight: bold; cursor: pointer;">Settle Tab</button>
          </div>
        `;
      }).join('')}
    </div>
  `;
  screen.innerHTML = html;
}

// --- History Screen ---

function renderHistory() {
  const screen = document.getElementById('history-screen');
  if (!screen) return;
  
  let html = `
    <div class="section-header" style="margin-bottom: 20px;">
      <h2>SALES HISTORY</h2>
    </div>
    <div style="display: flex; flex-direction: column; gap: 15px;">
      ${state.sales.map(s => {
        const cust = state.customers.find(c => c.customer_id === s.customer_id);
        const custName = cust ? cust.name : 'Walk-in';
        const items = state.saleItems.filter(si => si.sale_id === s.sale_id);
        const badgeColor = s.status === 'COMPLETED' ? '#28a745' : s.status === 'VOIDED' ? '#dc3545' : '#ffc107';
        
        return `
          <div class="sale-card" style="padding: 20px; background: var(--glass-bg, rgba(255,255,255,0.05)); border-radius: 12px; border: 1px solid var(--border-color, #eee);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,0,0,0.05);">
              <div>
                <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px;">${escapeHtml(custName)}</div>
                <div style="font-size: 0.85em; opacity: 0.6; font-family: monospace;">ID: ${s.sale_id.substring(0,8)} • ${formatDate(s.created_at)}</div>
              </div>
              <div style="padding: 4px 10px; border-radius: 12px; font-size: 0.8em; font-weight: bold; background: ${badgeColor}20; color: ${badgeColor};">
                ${s.status}
              </div>
            </div>
            
            <div style="margin-bottom: 15px;">
              ${items.map(si => {
                const p = state.pigments.find(p => p.pigment_id === si.pigment_id);
                const pName = p ? p.name : 'Unknown Pigment';
                return `
                  <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 0.95em;">
                    <div>
                      <span>${escapeHtml(pName)}</span>
                      <span style="opacity: 0.6; margin-left: 10px;">${formatMgToGrams(si.weight_mg)}g</span>
                    </div>
                    <div>
                      <strong>${formatCents(si.price_charged_cents)}</strong>
                      ${s.status === 'COMPLETED' ? `<button onclick="openReturnItemModal('${si.sale_item_id}')" style="margin-left: 10px; padding: 2px 8px; font-size: 0.8em; border: 1px solid #ffc107; background: transparent; color: #ffc107; border-radius: 4px; cursor: pointer;">Return</button>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(0,0,0,0.05);">
              <div style="font-weight: bold; font-size: 1.1em;">Total: ${formatCents(s.total_amount_cents)}</div>
              ${s.status === 'COMPLETED' ? `
                <button onclick="openVoidSaleModal('${s.sale_id}')" style="padding: 6px 15px; border: 1px solid #dc3545; background: transparent; color: #dc3545; border-radius: 6px; cursor: pointer; font-weight: bold;">Void Sale</button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  screen.innerHTML = html;
}

// --- Audit Screen ---

function renderAudit() {
  const screen = document.getElementById('audit-screen');
  if (!screen) return;
  
  let html = `
    <div class="section-header" style="margin-bottom: 20px;">
      <h2>🔒 AUDIT LOG & SECURITY OVERRIDES</h2>
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${state.auditLogs.map(log => {
        const isSecurity = log.action === 'HANDSHAKE_CREDIT_OVERRIDE';
        return `
          <div class="audit-card ${isSecurity ? 'security-override' : ''}" style="padding: 15px; background: ${isSecurity ? 'rgba(220, 53, 69, 0.05)' : 'var(--glass-bg, rgba(255,255,255,0.05))'}; border-radius: 8px; border: 1px solid ${isSecurity ? 'rgba(220, 53, 69, 0.3)' : 'var(--border-color, #eee)'}; border-left: 4px solid ${isSecurity ? '#dc3545' : 'var(--primary-color, #007bff)'};">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span style="font-weight: bold; color: ${isSecurity ? '#dc3545' : 'inherit'};">${escapeHtml(log.action)}</span>
              <span style="opacity: 0.6; font-size: 0.85em;">${formatDate(log.created_at)}</span>
            </div>
            <div style="font-size: 0.9em; margin-bottom: 5px;">
              Entity: ${escapeHtml(log.entity_type)} (${escapeHtml(log.entity_id)})
            </div>
            <pre style="margin: 0; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 4px; font-size: 0.8em; overflow-x: auto; white-space: pre-wrap;">${escapeHtml(log.details_json)}</pre>
          </div>
        `;
      }).join('')}
    </div>
  `;
  screen.innerHTML = html;
}

// --- Modal System ---

function showModal(title, bodyHTML, footerHTML) {
  const overlay = document.getElementById('modal-overlay');
  const modalContent = overlay.querySelector('.modal-content');
  
  // Create if missing
  if (!modalContent.querySelector('.modal-header-container')) {
    modalContent.innerHTML = `
      <div class="modal-header-container" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color, #eee); padding-bottom: 15px; margin-bottom: 15px;">
        <h2 id="modal-title" style="margin: 0;"></h2>
        <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5em; cursor: pointer;">&times;</button>
      </div>
      <div id="modal-body" style="margin-bottom: 20px;"></div>
      <div id="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px;"></div>
    `;
  }
  
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML;
  
  overlay.classList.add('active');
  overlay.style.display = 'flex';
}

window.closeModal = () => {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  overlay.style.display = 'none';
  
  // Also close payment drawer if open
  const pd = document.getElementById('payment-drawer-modal');
  if (pd) pd.classList.remove('active');
};

// --- Modals Implementation ---

window.openCustomerPickerModal = () => {
  let body = `<div style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto;">
    <button onclick="selectCustomer(null)" style="padding: 15px; text-align: left; background: var(--glass-bg, rgba(0,0,0,0.05)); border: 1px solid var(--border-color, #ccc); border-radius: 8px; cursor: pointer;">
      <strong>👤 Walk-in Customer</strong>
    </button>
  `;
  
  state.customers.forEach(c => {
    body += `
      <button onclick="selectCustomer('${c.customer_id}')" style="padding: 15px; text-align: left; background: var(--glass-bg, rgba(0,0,0,0.05)); border: 1px solid var(--border-color, #ccc); border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between;">
        <span><strong>${escapeHtml(c.name)}</strong><br><small>${escapeHtml(c.phone_number || '')}</small></span>
        <span style="font-size: 0.85em; opacity: 0.7;">Bal: ${formatCents(c.current_balance_cents)}</span>
      </button>
    `;
  });
  body += `</div>`;
  
  showModal('Select Customer', body, `<button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>`);
};

window.selectCustomer = (id) => {
  if (id === null) {
    state.selectedCustomer = null;
  } else {
    state.selectedCustomer = state.customers.find(c => c.customer_id === id);
  }
  closeModal();
  renderCheckout();
};

window.openRestockModal = (pigmentId) => {
  const p = state.pigments.find(p => p.pigment_id === pigmentId);
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <p>Restocking: <strong>${escapeHtml(p.name)}</strong></p>
      <div>
        <label style="display: block; margin-bottom: 5px;">Weight Added (grams)</label>
        <input type="number" id="restock-weight" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.1" min="0.1">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Total Cost ($)</label>
        <input type="number" id="restock-cost" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.01" min="0">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Supplier Notes</label>
        <input type="text" id="restock-supplier" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
      </div>
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitRestock('${pigmentId}')" style="padding: 10px 20px; border-radius: 6px; border: none; background: #17a2b8; color: white; cursor: pointer; font-weight: bold;">Confirm Restock</button>
  `;
  showModal('Restock Pigment', body, footer);
};

window.submitRestock = async (pigmentId) => {
  const weightG = parseFloat(document.getElementById('restock-weight').value);
  const costD = parseFloat(document.getElementById('restock-cost').value);
  const supplier = document.getElementById('restock-supplier').value;
  
  if (!weightG || weightG <= 0 || isNaN(costD) || costD < 0) {
    showToast('Invalid input', 'error');
    return;
  }
  
  try {
    await state.repo.restockPigment(pigmentId, Math.round(weightG * 1000), Math.round(costD * 100), supplier);
    await refreshAllData();
    closeModal();
    renderInventory();
    showToast('Restock successful', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openShrinkageModal = (pigmentId) => {
  const p = state.pigments.find(p => p.pigment_id === pigmentId);
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <p>Log Shrinkage for: <strong>${escapeHtml(p.name)}</strong></p>
      <div>
        <label style="display: block; margin-bottom: 5px;">Weight Lost (grams)</label>
        <input type="number" id="shrinkage-weight" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.1" min="0.1">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Reason</label>
        <select id="shrinkage-reason" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
          <option value="Spillage">Spillage</option>
          <option value="Sample/Gift">Sample/Gift</option>
          <option value="Container Residue">Container Residue</option>
          <option value="Quality Defect">Quality Defect</option>
        </select>
      </div>
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitShrinkage('${pigmentId}')" style="padding: 10px 20px; border-radius: 6px; border: none; background: #ffc107; color: #000; cursor: pointer; font-weight: bold;">Log Shrinkage</button>
  `;
  showModal('Log Shrinkage', body, footer);
};

window.submitShrinkage = async (pigmentId) => {
  const weightG = parseFloat(document.getElementById('shrinkage-weight').value);
  const reason = document.getElementById('shrinkage-reason').value;
  
  if (!weightG || weightG <= 0) {
    showToast('Invalid weight', 'error');
    return;
  }
  
  try {
    await state.repo.logShrinkage(pigmentId, Math.round(weightG * 1000), reason);
    await refreshAllData();
    closeModal();
    renderInventory();
    showToast('Shrinkage logged', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openAddPigmentModal = () => {
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <input type="text" id="add-pigment-name" placeholder="Pigment Name" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
      <div style="display: flex; gap: 10px; align-items: center;">
        <input type="color" id="add-pigment-color" value="#000000" style="padding: 0; width: 40px; height: 40px; border: none;">
        <span>Color Hex</span>
      </div>
      <select id="add-pigment-finish" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
        <option value="Matte">Matte</option>
        <option value="Metallic">Metallic</option>
        <option value="Pearl">Pearl</option>
        <option value="ColorShift">ColorShift</option>
        <option value="Glow">Glow</option>
      </select>
      <input type="number" id="add-pigment-stock" placeholder="Initial Stock (g)" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;" min="0" step="1">
      <input type="number" id="add-pigment-cost" placeholder="Initial Cost ($)" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;" min="0" step="0.01">
      <input type="number" id="add-pigment-retail" placeholder="Retail Price/g ($)" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;" min="0" step="0.01">
      <input type="number" id="add-pigment-wholesale" placeholder="Wholesale Price/g ($)" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;" min="0" step="0.01">
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitAddPigment()" style="padding: 10px 20px; border-radius: 6px; border: none; background: var(--primary-color, #007bff); color: white; cursor: pointer; font-weight: bold;">Add Pigment</button>
  `;
  showModal('Add New Pigment', body, footer);
};

window.submitAddPigment = async () => {
  const name = document.getElementById('add-pigment-name').value;
  const color = document.getElementById('add-pigment-color').value;
  const finish = document.getElementById('add-pigment-finish').value;
  const stockG = parseFloat(document.getElementById('add-pigment-stock').value || 0);
  const costD = parseFloat(document.getElementById('add-pigment-cost').value || 0);
  const retailD = parseFloat(document.getElementById('add-pigment-retail').value || 0);
  const wholeD = parseFloat(document.getElementById('add-pigment-wholesale').value || 0);
  
  if (!name || retailD <= 0 || wholeD <= 0) {
    showToast('Missing required fields', 'error');
    return;
  }
  
  const p = {
    name, color_code: color, finish_type: finish,
    stock_mg: Math.round(stockG * 1000),
    total_cost_cents: Math.round(costD * 100),
    retail_price_per_gram_cents: Math.round(retailD * 100),
    wholesale_price_per_gram_cents: Math.round(wholeD * 100),
    default_pkg_cents: 0
  };
  
  try {
    await state.repo.createPigment(p);
    await refreshAllData();
    closeModal();
    renderInventory();
    showToast('Pigment created', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openEditPriceModal = (pigmentId) => {
  const p = state.pigments.find(p => p.pigment_id === pigmentId);
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <p>Edit Pricing: <strong>${escapeHtml(p.name)}</strong></p>
      <div>
        <label style="display: block; margin-bottom: 5px;">Retail Price/g ($)</label>
        <input type="number" id="edit-price-retail" value="${(p.retail_price_per_gram_cents / 100).toFixed(2)}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.01" min="0">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Wholesale Price/g ($)</label>
        <input type="number" id="edit-price-wholesale" value="${(p.wholesale_price_per_gram_cents / 100).toFixed(2)}" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.01" min="0">
      </div>
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitEditPrice('${pigmentId}')" style="padding: 10px 20px; border-radius: 6px; border: none; background: var(--primary-color, #007bff); color: white; cursor: pointer; font-weight: bold;">Save Prices</button>
  `;
  showModal('Edit Price', body, footer);
};

window.submitEditPrice = async (pigmentId) => {
  const retailD = parseFloat(document.getElementById('edit-price-retail').value);
  const wholeD = parseFloat(document.getElementById('edit-price-wholesale').value);
  
  if (retailD <= 0 || wholeD <= 0 || isNaN(retailD) || isNaN(wholeD)) {
    showToast('Invalid prices', 'error');
    return;
  }
  
  try {
    await state.repo.updatePigmentPricing(pigmentId, Math.round(retailD * 100), Math.round(wholeD * 100), 0);
    await refreshAllData();
    closeModal();
    renderInventory();
    showToast('Prices updated', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openAddCustomerModal = () => {
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <input type="text" id="add-cust-name" placeholder="Full Name" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
      <input type="text" id="add-cust-phone" placeholder="Phone Number" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
      <input type="number" id="add-cust-limit" placeholder="Credit Limit ($)" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;" min="0" step="1">
      <select id="add-cust-status" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
        <option value="GOOD_STANDING">Good Standing</option>
        <option value="VIP">VIP</option>
        <option value="PAUSED">Paused</option>
      </select>
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitAddCustomer()" style="padding: 10px 20px; border-radius: 6px; border: none; background: var(--primary-color, #007bff); color: white; cursor: pointer; font-weight: bold;">Add Customer</button>
  `;
  showModal('Add New Customer', body, footer);
};

window.submitAddCustomer = async () => {
  const name = document.getElementById('add-cust-name').value;
  const phone = document.getElementById('add-cust-phone').value;
  const limitD = parseFloat(document.getElementById('add-cust-limit').value || 0);
  const status = document.getElementById('add-cust-status').value;
  
  if (!name) {
    showToast('Name is required', 'error');
    return;
  }
  
  try {
    await state.repo.createCustomer({
      name, phone_number: phone, credit_limit_cents: Math.round(limitD * 100), trust_status: status
    });
    await refreshAllData();
    closeModal();
    renderCustomers();
    showToast('Customer created', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openSettleTabModal = (customerId) => {
  const c = state.customers.find(c => c.customer_id === customerId);
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <p>Settle balance for <strong>${escapeHtml(c.name)}</strong> (Owes: ${formatCents(c.current_balance_cents)})</p>
      <div>
        <label style="display: block; margin-bottom: 5px;">Payment Amount ($)</label>
        <input type="number" id="settle-amount" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.01" min="0.01" max="${(c.current_balance_cents / 100).toFixed(2)}">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Payment Type</label>
        <select id="settle-type" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" onchange="document.getElementById('settle-provider-div').style.display = this.value === 'DIGITAL' ? 'block' : 'none'">
          <option value="CASH">Cash</option>
          <option value="DIGITAL">Digital</option>
        </select>
      </div>
      <div id="settle-provider-div" style="display: none;">
        <label style="display: block; margin-bottom: 5px;">Provider</label>
        <select id="settle-provider" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
          <option value="Square">Square</option>
          <option value="Venmo">Venmo</option>
          <option value="Zelle">Zelle</option>
        </select>
      </div>
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitSettleTab('${customerId}')" style="padding: 10px 20px; border-radius: 6px; border: none; background: #28a745; color: white; cursor: pointer; font-weight: bold;">Apply Payment</button>
  `;
  showModal('Settle Tab', body, footer);
};

window.submitSettleTab = async (customerId) => {
  const amtD = parseFloat(document.getElementById('settle-amount').value);
  const type = document.getElementById('settle-type').value;
  const provider = document.getElementById('settle-provider').value;
  
  if (!amtD || amtD <= 0) {
    showToast('Invalid amount', 'error');
    return;
  }
  
  try {
    await state.repo.settleTabPayment(customerId, Math.round(amtD * 100), type, type === 'DIGITAL' ? provider : null);
    await refreshAllData();
    closeModal();
    renderCustomers();
    showToast('Payment applied successfully', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openVoidSaleModal = (saleId) => {
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <p>Are you sure you want to void sale <strong>${saleId.substring(0,8)}</strong>?</p>
      <input type="text" id="void-reason" placeholder="Reason for voiding" style="padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitVoidSale('${saleId}')" style="padding: 10px 20px; border-radius: 6px; border: none; background: #dc3545; color: white; cursor: pointer; font-weight: bold;">Confirm Void</button>
  `;
  showModal('Void Sale', body, footer);
};

window.submitVoidSale = async (saleId) => {
  const reason = document.getElementById('void-reason').value;
  if (!reason) {
    showToast('Reason required', 'error');
    return;
  }
  try {
    await state.repo.voidSale(saleId, reason);
    await refreshAllData();
    closeModal();
    renderHistory();
    showToast('Sale voided', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

window.openReturnItemModal = (saleItemId) => {
  const item = state.saleItems.find(si => si.sale_item_id === saleItemId);
  const p = state.pigments.find(p => p.pigment_id === item.pigment_id);
  const returnedMg = item.returned_weight_mg || 0;
  const availMg = item.weight_mg - returnedMg;
  
  if (availMg <= 0) {
    showToast('Item already fully returned', 'error');
    return;
  }
  
  const body = `
    <div style="display: flex; flex-direction: column; gap: 15px;">
      <p>Returning: <strong>${escapeHtml(p.name)}</strong></p>
      <p style="font-size: 0.9em; opacity: 0.8;">Purchased: ${formatMgToGrams(item.weight_mg)}g (Max eligible: ${formatMgToGrams(availMg)}g)</p>
      
      <div>
        <label style="display: block; margin-bottom: 5px;">Weight to Return (g)</label>
        <input type="number" id="return-weight" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;" step="0.1" min="0.1" max="${formatMgToGrams(availMg)}">
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Reason</label>
        <input type="text" id="return-reason" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc;">
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" id="return-restock" checked style="width: 20px; height: 20px;">
        <label for="return-restock">Restock into inventory</label>
      </div>
    </div>
  `;
  const footer = `
    <button onclick="closeModal()" style="padding: 10px 20px; border-radius: 6px; border: 1px solid #ccc; background: white; cursor: pointer;">Cancel</button>
    <button onclick="submitReturnItem('${saleItemId}')" style="padding: 10px 20px; border-radius: 6px; border: none; background: #ffc107; color: #000; cursor: pointer; font-weight: bold;">Process Return</button>
  `;
  showModal('Return Item', body, footer);
};

window.submitReturnItem = async (saleItemId) => {
  const w = parseFloat(document.getElementById('return-weight').value);
  const reason = document.getElementById('return-reason').value;
  const restock = document.getElementById('return-restock').checked;
  
  if (!w || w <= 0 || !reason) {
    showToast('Invalid weight or missing reason', 'error');
    return;
  }
  
  try {
    await state.repo.processReturn(saleItemId, Math.round(w * 1000), reason, restock);
    await refreshAllData();
    closeModal();
    renderHistory();
    showToast('Return processed', 'success');
  } catch (e) {
    showToast(e.message, 'error');
  }
};

// --- Payment Drawer (Digital/Tab/Split) ---

window.openPaymentDrawer = () => {
  if (state.cart.length === 0) {
    showToast('Cart is empty', 'error');
    return;
  }
  
  const totalAmountCents = state.cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
  state.isHandshakeOverride = false;
  
  // Custom modal UI for payment drawer
  let drawer = document.getElementById('payment-drawer-modal');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'payment-drawer-modal';
    drawer.className = 'payment-drawer';
    drawer.style.cssText = `
      position: fixed; bottom: -100%; left: 0; right: 0;
      background: #fff; padding: 20px; border-radius: 20px 20px 0 0;
      box-shadow: 0 -5px 15px rgba(0,0,0,0.2);
      transition: bottom 0.3s ease-out; z-index: 1000;
    `;
    document.body.appendChild(drawer);
    
    // Add overlay if doesn't exist
    if (!document.getElementById('drawer-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'drawer-overlay';
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); z-index: 999; display: none;
      `;
      overlay.onclick = closeModal;
      document.body.appendChild(overlay);
    }
  }
  
  const drawerHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0;">Payment: ${formatCents(totalAmountCents)}</h2>
      <button onclick="closeModal()" style="background: none; border: none; font-size: 1.5em; cursor: pointer;">&times;</button>
    </div>
    
    <div style="display: flex; gap: 10px; margin-bottom: 20px; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 8px;">
      <button class="drawer-tab active" onclick="switchDrawerTab('digital')" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-weight: bold; cursor: pointer;">DIGITAL</button>
      <button class="drawer-tab" onclick="switchDrawerTab('tab')" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: transparent; cursor: pointer;">HOUSE TAB</button>
      <button class="drawer-tab" onclick="switchDrawerTab('split')" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: transparent; cursor: pointer;">SPLIT</button>
    </div>
    
    <div id="drawer-content-digital" class="drawer-content">
      <div style="display: flex; gap: 15px; margin-bottom: 20px;">
        <button onclick="selectDigitalProvider('Square')" class="digital-provider-btn" style="flex: 1; padding: 20px; border: 2px solid #ccc; border-radius: 12px; background: #fff; cursor: pointer; font-size: 1.1em;">Square</button>
        <button onclick="selectDigitalProvider('Venmo')" class="digital-provider-btn" style="flex: 1; padding: 20px; border: 2px solid #ccc; border-radius: 12px; background: #fff; cursor: pointer; font-size: 1.1em;">Venmo</button>
        <button onclick="selectDigitalProvider('Zelle')" class="digital-provider-btn" style="flex: 1; padding: 20px; border: 2px solid #ccc; border-radius: 12px; background: #fff; cursor: pointer; font-size: 1.1em;">Zelle</button>
      </div>
      <div id="merchant-fee-preview" style="text-align: center; margin-bottom: 20px; opacity: 0.7; font-size: 0.9em;">
        Select provider to see estimated fee (2.9% + $0.30)
      </div>
      <button onclick="submitDigitalPayment()" id="btn-submit-digital" disabled style="width: 100%; padding: 15px; background: var(--primary-color, #007bff); color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; cursor: pointer; opacity: 0.5;">Charge Digital</button>
    </div>
    
    <div id="drawer-content-tab" class="drawer-content" style="display: none;">
      ${!state.selectedCustomer ? `
        <div style="text-align: center; padding: 30px; color: #dc3545;">Please select a customer first.</div>
      ` : `
        <div style="padding: 15px; background: rgba(0,0,0,0.05); border-radius: 8px; margin-bottom: 20px;">
          <h3 style="margin-top: 0; margin-bottom: 10px;">${escapeHtml(state.selectedCustomer.name)}</h3>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Current Balance:</span> <strong>${formatCents(state.selectedCustomer.current_balance_cents)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Credit Limit:</span> <strong>${formatCents(state.selectedCustomer.credit_limit_cents)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; color: ${state.selectedCustomer.current_balance_cents + totalAmountCents > state.selectedCustomer.credit_limit_cents ? '#dc3545' : '#28a745'};">
            <span>New Balance:</span> <strong>${formatCents(state.selectedCustomer.current_balance_cents + totalAmountCents)}</strong>
          </div>
        </div>
        
        <div style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" id="handshake-override" onchange="toggleHandshakeOverride(this.checked)" style="width: 20px; height: 20px;">
          <label for="handshake-override">Handshake Credit Override (Ignore limit rules)</label>
        </div>
        
        <button onclick="submitTabPayment()" style="width: 100%; padding: 15px; background: #ffc107; color: #000; border: none; border-radius: 8px; font-weight: bold; font-size: 1.1em; cursor: pointer;">Charge to Tab</button>
      `}
    </div>
    
    <div id="drawer-content-split" class="drawer-content" style="display: none;">
      <div style="text-align: center; padding: 20px;">
        <p>Split payments feature is currently simplified for this demo.</p>
        <button onclick="closeModal(); showToast('Split payment coming soon!', 'success');" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Acknowledge</button>
      </div>
    </div>
  `;
  
  drawer.innerHTML = drawerHtml;
  document.getElementById('drawer-overlay').style.display = 'block';
  setTimeout(() => {
    drawer.style.bottom = '0';
  }, 10);
  
  // Store state for digital selection
  window.selectedDigitalProvider = null;
};

window.switchDrawerTab = (tabName) => {
  document.querySelectorAll('.drawer-tab').forEach(t => {
    t.classList.remove('active');
    t.style.background = 'transparent';
    t.style.boxShadow = 'none';
  });
  event.target.classList.add('active');
  event.target.style.background = '#fff';
  event.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  
  document.querySelectorAll('.drawer-content').forEach(c => c.style.display = 'none');
  document.getElementById(`drawer-content-${tabName}`).style.display = 'block';
};

window.selectDigitalProvider = (provider) => {
  window.selectedDigitalProvider = provider;
  
  document.querySelectorAll('.digital-provider-btn').forEach(b => {
    b.style.borderColor = '#ccc';
    b.style.background = '#fff';
  });
  event.target.style.borderColor = 'var(--primary-color, #007bff)';
  event.target.style.background = 'rgba(0,123,255,0.05)';
  
  const totalAmountCents = state.cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
  const feeCents = Math.round((totalAmountCents * 0.029) + 30);
  
  document.getElementById('merchant-fee-preview').innerHTML = `
    Estimated ${provider} Fee: <strong>${formatCents(feeCents)}</strong><br>
    Net Revenue: <strong>${formatCents(totalAmountCents - feeCents)}</strong>
  `;
  
  const btn = document.getElementById('btn-submit-digital');
  btn.disabled = false;
  btn.style.opacity = '1';
};

window.submitDigitalPayment = async () => {
  if (!window.selectedDigitalProvider) return;
  
  const totalAmountCents = state.cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
  const feeCents = Math.round((totalAmountCents * 0.029) + 30);
  const customerId = state.selectedCustomer?.customer_id || null;
  
  const payments = [{
    payment_type: 'DIGITAL',
    digital_provider: window.selectedDigitalProvider,
    amount_cents: totalAmountCents,
    merchant_fee_cents: feeCents
  }];
  
  try {
    await state.repo.completeSale(customerId, state.cart, payments, false);
    
    // Close payment drawer specific logic
    document.getElementById('payment-drawer-modal').style.bottom = '-100%';
    setTimeout(() => {
      document.getElementById('drawer-overlay').style.display = 'none';
      state.cart = [];
      state.selectedCustomer = null;
      state.selectedPigment = null;
      refreshAllData().then(() => {
        renderCheckout();
        showToast('Digital sale completed!', 'success');
      });
    }, 300);
  } catch (error) {
    showToast('Checkout failed: ' + error.message, 'error');
  }
};

window.toggleHandshakeOverride = (isChecked) => {
  state.isHandshakeOverride = isChecked;
};

window.submitTabPayment = async () => {
  if (!state.selectedCustomer) return;
  
  const totalAmountCents = state.cart.reduce((sum, item) => sum + item.price_charged_cents, 0);
  const customerId = state.selectedCustomer.customer_id;
  
  const payments = [{
    payment_type: 'HOUSE_TAB',
    digital_provider: null,
    amount_cents: totalAmountCents,
    merchant_fee_cents: 0
  }];
  
  try {
    await state.repo.completeSale(customerId, state.cart, payments, state.isHandshakeOverride);
    
    document.getElementById('payment-drawer-modal').style.bottom = '-100%';
    setTimeout(() => {
      document.getElementById('drawer-overlay').style.display = 'none';
      state.cart = [];
      state.selectedCustomer = null;
      state.selectedPigment = null;
      refreshAllData().then(() => {
        renderCheckout();
        showToast('Charged to house tab!', 'success');
      });
    }, 300);
  } catch (error) {
    showToast('Tab charge failed: ' + error.message, 'error');
  }
};

// --- Toast System ---

function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
  
  toast.style.cssText = `
    background: ${bgColor}; color: white; padding: 15px 25px;
    border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-weight: bold; opacity: 0; transform: translateY(-20px);
    transition: all 0.3s ease;
  `;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  
  // Animate out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// --- Utils ---

function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return (unsafe + '')
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${months[d.getMonth()]} ${dd}, ${yy} ${hh}:${mm}`;
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', init);
