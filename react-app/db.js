export class MicroSalerDB {
    constructor() {
        this.dbName = 'MicroSalerDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.errorCode);
                reject("Database error");
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. pigments
                if (!db.objectStoreNames.contains('pigments')) {
                    const store = db.createObjectStore('pigments', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }

                // 2. stock_receipts
                if (!db.objectStoreNames.contains('stock_receipts')) {
                    const store = db.createObjectStore('stock_receipts', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('pigment_id', 'pigment_id', { unique: false });
                }

                // 3. customers
                if (!db.objectStoreNames.contains('customers')) {
                    const store = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: true });
                }

                // 4. sales
                if (!db.objectStoreNames.contains('sales')) {
                    const store = db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('customer_id', 'customer_id', { unique: false });
                    store.createIndex('date', 'date', { unique: false });
                }

                // 5. sale_payments
                if (!db.objectStoreNames.contains('sale_payments')) {
                    const store = db.createObjectStore('sale_payments', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sale_id', 'sale_id', { unique: false });
                }

                // 6. sale_items
                if (!db.objectStoreNames.contains('sale_items')) {
                    const store = db.createObjectStore('sale_items', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sale_id', 'sale_id', { unique: false });
                    store.createIndex('pigment_id', 'pigment_id', { unique: false });
                }

                // 7. returns
                if (!db.objectStoreNames.contains('returns')) {
                    const store = db.createObjectStore('returns', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sale_item_id', 'sale_item_id', { unique: false });
                }

                // 8. tab_payments
                if (!db.objectStoreNames.contains('tab_payments')) {
                    const store = db.createObjectStore('tab_payments', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('customer_id', 'customer_id', { unique: false });
                }

                // 9. shrinkage_logs
                if (!db.objectStoreNames.contains('shrinkage_logs')) {
                    const store = db.createObjectStore('shrinkage_logs', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('pigment_id', 'pigment_id', { unique: false });
                }

                // 10. audit_log
                if (!db.objectStoreNames.contains('audit_log')) {
                    db.createObjectStore('audit_log', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async getTransaction(storeNames, mode) {
        if (!this.db) await this.init();
        return this.db.transaction(storeNames, mode);
    }

    async add(storeName, data) {
        const tx = await this.getTransaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        const tx = await this.getTransaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        const tx = await this.getTransaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        const tx = await this.getTransaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async seedInitialData() {
        if (!this.db) await this.init();
        const pigments = await this.getAll('pigments');
        if (pigments.length > 0) return; // Already seeded

        const tx = await this.getTransaction(['pigments', 'customers'], 'readwrite');
        const pigmentStore = tx.objectStore('pigments');
        const customerStore = tx.objectStore('customers');

        const initialPigments = [
            { name: 'Titanium White', category: 'Base', stock_mg: 1000000, retail_price_per_gram_cents: 50, wholesale_price_per_gram_cents: 30 },
            { name: 'Ultramarine Blue', category: 'Color', stock_mg: 500000, retail_price_per_gram_cents: 120, wholesale_price_per_gram_cents: 80 },
            { name: 'Cadmium Red', category: 'Color', stock_mg: 200000, retail_price_per_gram_cents: 250, wholesale_price_per_gram_cents: 180 },
        ];

        const initialCustomers = [
            { name: 'Walk-in Customer', type: 'retail', tab_balance_cents: 0 },
            { name: 'Art Studio Inc', type: 'wholesale', tab_balance_cents: 0 },
        ];

        initialPigments.forEach(p => pigmentStore.add(p));
        initialCustomers.forEach(c => customerStore.add(c));

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve("Seeded successfully");
            tx.onerror = () => reject(tx.error);
        });
    }
}

export const dbInstance = new MicroSalerDB();
