/**
 * @fileoverview IndexedDB database layer for Micro Saler POS.
 * Replaces Android Room database with a Promise-based IndexedDB wrapper.
 * Database version: 3, 10 object stores.
 */

const DB_NAME = 'MicroSalerDB';
const DB_VERSION = 3;

export default class MicroSalerDB {
  constructor() {
    /** @type {IDBDatabase|null} */
    this.db = null;
  }

  /**
   * Opens (or creates) the database and seeds initial data if empty.
   * @returns {Promise<MicroSalerDB>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this._createStores(db);
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        await this.seedInitialData();
        resolve(this);
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to open database: ${event.target.error}`));
      };
    });
  }

  /**
   * Creates all 10 object stores with indexes.
   * @param {IDBDatabase} db
   * @private
   */
  _createStores(db) {
    // 1. pigments
    if (!db.objectStoreNames.contains('pigments')) {
      const store = db.createObjectStore('pigments', { keyPath: 'pigment_id', autoIncrement: true });
      store.createIndex('name', 'name', { unique: true });
      store.createIndex('is_archived', 'is_archived', { unique: false });
    }

    // 2. stock_receipts
    if (!db.objectStoreNames.contains('stock_receipts')) {
      const store = db.createObjectStore('stock_receipts', { keyPath: 'receipt_id', autoIncrement: true });
      store.createIndex('pigment_id', 'pigment_id', { unique: false });
    }

    // 3. customers
    if (!db.objectStoreNames.contains('customers')) {
      const store = db.createObjectStore('customers', { keyPath: 'customer_id', autoIncrement: true });
      store.createIndex('name', 'name', { unique: false });
    }

    // 4. sales
    if (!db.objectStoreNames.contains('sales')) {
      const store = db.createObjectStore('sales', { keyPath: 'sale_id', autoIncrement: true });
      store.createIndex('customer_id', 'customer_id', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
      store.createIndex('status', 'status', { unique: false });
    }

    // 5. sale_payments
    if (!db.objectStoreNames.contains('sale_payments')) {
      const store = db.createObjectStore('sale_payments', { keyPath: 'payment_id', autoIncrement: true });
      store.createIndex('sale_id', 'sale_id', { unique: false });
    }

    // 6. sale_items
    if (!db.objectStoreNames.contains('sale_items')) {
      const store = db.createObjectStore('sale_items', { keyPath: 'sale_item_id', autoIncrement: true });
      store.createIndex('sale_id', 'sale_id', { unique: false });
      store.createIndex('pigment_id', 'pigment_id', { unique: false });
    }

    // 7. returns
    if (!db.objectStoreNames.contains('returns')) {
      const store = db.createObjectStore('returns', { keyPath: 'return_id', autoIncrement: true });
      store.createIndex('sale_item_id', 'sale_item_id', { unique: false });
    }

    // 8. tab_payments
    if (!db.objectStoreNames.contains('tab_payments')) {
      const store = db.createObjectStore('tab_payments', { keyPath: 'payment_id', autoIncrement: true });
      store.createIndex('customer_id', 'customer_id', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
    }

    // 9. shrinkage_logs
    if (!db.objectStoreNames.contains('shrinkage_logs')) {
      const store = db.createObjectStore('shrinkage_logs', { keyPath: 'log_id', autoIncrement: true });
      store.createIndex('pigment_id', 'pigment_id', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
    }

    // 10. audit_log
    if (!db.objectStoreNames.contains('audit_log')) {
      const store = db.createObjectStore('audit_log', { keyPath: 'audit_id', autoIncrement: true });
      store.createIndex('entity_type', 'entity_type', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  // ========================================
  // Generic CRUD Operations
  // ========================================

  /**
   * Get all records from a store.
   * @param {string} storeName
   * @returns {Promise<Array>}
   */
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get a single record by primary key.
   * @param {string} storeName
   * @param {*} id
   * @returns {Promise<Object|undefined>}
   */
  getById(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Get all records matching an index value.
   * @param {string} storeName
   * @param {string} indexName
   * @param {*} value
   * @returns {Promise<Array>}
   */
  getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const req = index.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Insert or update (upsert) a record.
   * @param {string} storeName
   * @param {Object} record
   * @returns {Promise<*>} The key of the record
   */
  put(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Insert a new record (auto-incremented key).
   * @param {string} storeName
   * @param {Object} record - Should NOT include the keyPath field
   * @returns {Promise<number>} The generated key
   */
  add(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Delete a record by primary key.
   * @param {string} storeName
   * @param {*} id
   * @returns {Promise<void>}
   */
  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ========================================
  // Specialized: Pigments
  // ========================================

  /** @returns {Promise<Array>} Active pigments sorted by name */
  async getActivePigments() {
    const all = await this.getAll('pigments');
    return all.filter(p => !p.is_archived).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** @returns {Promise<Array>} All pigments (including archived) sorted by name */
  async getAllPigmentsIncludingArchived() {
    const all = await this.getAll('pigments');
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Update pigment stock and cost atomically.
   * @param {number} pigmentId
   * @param {number} newStockMg
   * @param {number} newTotalCostCents
   */
  async updateStockAndCost(pigmentId, newStockMg, newTotalCostCents) {
    const pigment = await this.getById('pigments', pigmentId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);
    pigment.stock_mg = newStockMg;
    pigment.total_cost_cents = newTotalCostCents;
    await this.put('pigments', pigment);
  }

  /**
   * Update pigment retail and wholesale pricing.
   * @param {number} pigmentId
   * @param {number} retailPricePerGramCents
   * @param {number} wholesalePricePerGramCents
   */
  async updatePricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents) {
    const pigment = await this.getById('pigments', pigmentId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);
    pigment.retail_price_per_gram_cents = retailPricePerGramCents;
    pigment.wholesale_price_per_gram_cents = wholesalePricePerGramCents;
    await this.put('pigments', pigment);
  }

  // ========================================
  // Specialized: Customers
  // ========================================

  /** @returns {Promise<Array>} All customers sorted by name */
  async getAllCustomers() {
    const all = await this.getAll('customers');
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Add delta to customer balance.
   * @param {number} customerId
   * @param {number} amountDeltaCents - positive increases balance, negative decreases
   */
  async updateCustomerBalance(customerId, amountDeltaCents) {
    const customer = await this.getById('customers', customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);
    customer.current_balance_cents += amountDeltaCents;
    await this.put('customers', customer);
  }

  // ========================================
  // Specialized: Sales
  // ========================================

  /** @returns {Promise<Array>} All sales sorted by created_at DESC */
  async getAllSales() {
    const all = await this.getAll('sales');
    return all.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Update sale status.
   * @param {number} saleId
   * @param {string} status
   */
  async updateSaleStatus(saleId, status) {
    const sale = await this.getById('sales', saleId);
    if (!sale) throw new Error(`Sale ${saleId} not found`);
    sale.status = status;
    await this.put('sales', sale);
  }

  // ========================================
  // Specialized: Returns
  // ========================================

  /**
   * Get total mg already returned for a sale item.
   * @param {number} saleItemId
   * @returns {Promise<number>}
   */
  async getTotalReturnedMgForSaleItem(saleItemId) {
    const returns = await this.getAllByIndex('returns', 'sale_item_id', saleItemId);
    return returns.reduce((sum, r) => sum + r.mg_returned, 0);
  }

  // ========================================
  // Seed Data
  // ========================================

  /** Populate sample data only if the pigments store is empty. */
  async seedInitialData() {
    const existing = await this.getAll('pigments');
    if (existing.length > 0) return;

    const pigments = [
      { name: 'Super Gold', color_code: '#FFD700', finish_type: 'Metallic', stock_mg: 84500, total_cost_cents: 3481, default_pkg_cents: 35, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 150, is_archived: false },
      { name: 'Deep Sea Blue', color_code: '#4169E1', finish_type: 'Mica Pearl', stock_mg: 112000, total_cost_cents: 4256, default_pkg_cents: 35, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 150, is_archived: false },
      { name: 'Ruby Spark', color_code: '#E0115F', finish_type: 'Chameleon', stock_mg: 45200, total_cost_cents: 2260, default_pkg_cents: 35, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 150, is_archived: false },
      { name: 'Lavender Satin', color_code: '#E6E6FA', finish_type: 'Satin', stock_mg: 200000, total_cost_cents: 6000, default_pkg_cents: 35, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 150, is_archived: false },
      { name: 'Emerald Sheen', color_code: '#50C878', finish_type: 'Mica Pearl', stock_mg: 95000, total_cost_cents: 3990, default_pkg_cents: 35, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 150, is_archived: false },
      { name: 'Copper Dust', color_code: '#B87333', finish_type: 'Matte Powder', stock_mg: 150000, total_cost_cents: 5250, default_pkg_cents: 35, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 150, is_archived: false },
    ];

    const customers = [
      { name: 'Sarah Jenkins (Resin Crafts)', phone: '555-0192', credit_limit_cents: 5000, current_balance_cents: 1250, trust_status: 'GOOD_STANDING' },
      { name: 'Marcus Vance', phone: '555-0148', credit_limit_cents: 2500, current_balance_cents: 0, trust_status: 'VIP' },
      { name: 'Elena Rostova', phone: '555-0173', credit_limit_cents: 2500, current_balance_cents: 2100, trust_status: 'PAUSED' },
    ];

    for (const p of pigments) {
      await this.add('pigments', p);
    }
    for (const c of customers) {
      await this.add('customers', c);
    }
  }
}
