/**
 * @fileoverview IndexedDB database layer for Micro Saler POS (React Version).
 * Replaces Android Room database with a Promise-based IndexedDB wrapper.
 * Database version: 3, 10 object stores.
 */

const DB_NAME = 'MicroSalerDB';
export const DB_VERSION = 4;

export default class MicroSalerDB {
  constructor() {
    /** @type {IDBDatabase|null} */
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        // Version 3 -> 4 migration: no-op check to ensure object stores exist
        if (oldVersion < 4) {
          this._createStores(db);
        }
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


  _createStores(db) {
    if (!db.objectStoreNames.contains('pigments')) {
      const store = db.createObjectStore('pigments', { keyPath: 'pigment_id', autoIncrement: true });
      store.createIndex('name', 'name', { unique: true });
      store.createIndex('is_archived', 'is_archived', { unique: false });
    }

    if (!db.objectStoreNames.contains('stock_receipts')) {
      const store = db.createObjectStore('stock_receipts', { keyPath: 'receipt_id', autoIncrement: true });
      store.createIndex('pigment_id', 'pigment_id', { unique: false });
    }

    if (!db.objectStoreNames.contains('customers')) {
      const store = db.createObjectStore('customers', { keyPath: 'customer_id', autoIncrement: true });
      store.createIndex('name', 'name', { unique: false });
    }

    if (!db.objectStoreNames.contains('sales')) {
      const store = db.createObjectStore('sales', { keyPath: 'sale_id', autoIncrement: true });
      store.createIndex('customer_id', 'customer_id', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
      store.createIndex('status', 'status', { unique: false });
    }

    if (!db.objectStoreNames.contains('sale_payments')) {
      const store = db.createObjectStore('sale_payments', { keyPath: 'payment_id', autoIncrement: true });
      store.createIndex('sale_id', 'sale_id', { unique: false });
    }

    if (!db.objectStoreNames.contains('sale_items')) {
      const store = db.createObjectStore('sale_items', { keyPath: 'sale_item_id', autoIncrement: true });
      store.createIndex('sale_id', 'sale_id', { unique: false });
      store.createIndex('pigment_id', 'pigment_id', { unique: false });
    }

    if (!db.objectStoreNames.contains('returns')) {
      const store = db.createObjectStore('returns', { keyPath: 'return_id', autoIncrement: true });
      store.createIndex('sale_item_id', 'sale_item_id', { unique: false });
    }

    if (!db.objectStoreNames.contains('tab_payments')) {
      const store = db.createObjectStore('tab_payments', { keyPath: 'payment_id', autoIncrement: true });
      store.createIndex('customer_id', 'customer_id', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('shrinkage_logs')) {
      const store = db.createObjectStore('shrinkage_logs', { keyPath: 'log_id', autoIncrement: true });
      store.createIndex('pigment_id', 'pigment_id', { unique: false });
      store.createIndex('created_at', 'created_at', { unique: false });
    }

    if (!db.objectStoreNames.contains('audit_log')) {
      const store = db.createObjectStore('audit_log', { keyPath: 'audit_id', autoIncrement: true });
      store.createIndex('entity_type', 'entity_type', { unique: false });
      store.createIndex('timestamp', 'timestamp', { unique: false });
    }
  }

  getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  getById(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

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

  put(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  add(storeName, record) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getActivePigments() {
    const all = await this.getAll('pigments');
    return all.filter(p => !p.is_archived).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getAllPigmentsIncludingArchived() {
    const all = await this.getAll('pigments');
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateStockAndCost(pigmentId, newStockMg, newTotalCostCents) {
    const pigment = await this.getById('pigments', pigmentId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);
    pigment.stock_mg = newStockMg;
    pigment.total_cost_cents = newTotalCostCents;
    await this.put('pigments', pigment);
  }

  async updatePricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents) {
    const pigment = await this.getById('pigments', pigmentId);
    if (!pigment) throw new Error(`Pigment ${pigmentId} not found`);
    pigment.retail_price_per_gram_cents = retailPricePerGramCents;
    pigment.wholesale_price_per_gram_cents = wholesalePricePerGramCents;
    await this.put('pigments', pigment);
  }

  async getAllCustomers() {
    const all = await this.getAll('customers');
    return all.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateCustomerBalance(customerId, amountDeltaCents) {
    const customer = await this.getById('customers', customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);
    customer.current_balance_cents += amountDeltaCents;
    await this.put('customers', customer);
  }

  async getAllSales() {
    const all = await this.getAll('sales');
    return all.sort((a, b) => b.created_at - a.created_at);
  }

  async updateSaleStatus(saleId, status) {
    const sale = await this.getById('sales', saleId);
    if (!sale) throw new Error(`Sale ${saleId} not found`);
    sale.status = status;
    await this.put('sales', sale);
  }

  async getTotalReturnedMgForSaleItem(saleItemId) {
    const returns = await this.getAllByIndex('returns', 'sale_item_id', saleItemId);
    return returns.reduce((sum, r) => sum + r.mg_returned, 0);
  }

  clearStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async exportAllStores() {
    const storeNames = [
      'pigments',
      'stock_receipts',
      'customers',
      'sales',
      'sale_payments',
      'sale_items',
      'returns',
      'tab_payments',
      'shrinkage_logs',
      'audit_log'
    ];
    const storesData = {};
    for (const name of storeNames) {
      storesData[name] = await this.getAll(name);
    }
    return {
      exported_at: new Date().toISOString(),
      db_version: DB_VERSION,
      stores: storesData
    };
  }

  async importAllStores(backupData) {
    if (!backupData || typeof backupData !== 'object' || !backupData.stores) {
      throw new Error('Invalid backup file format: missing "stores" object.');
    }
    const backupVersion = backupData.db_version || backupData.schema_version;
    if (!backupVersion || backupVersion > DB_VERSION) {
      throw new Error(`Backup database version (${backupVersion || 'unknown'}) is newer than current database version (${DB_VERSION}).`);
    }

    const storeNames = [
      'pigments',
      'stock_receipts',
      'customers',
      'sales',
      'sale_payments',
      'sale_items',
      'returns',
      'tab_payments',
      'shrinkage_logs',
      'audit_log'
    ];

    for (const name of storeNames) {
      await this.clearStore(name);
    }

    for (const name of storeNames) {
      const records = backupData.stores[name] || [];
      for (const record of records) {
        await this.put(name, record);
      }
    }
  }


  async seedInitialData() {
    return;
  }
}

