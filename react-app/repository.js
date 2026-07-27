import { dbInstance } from './db.js';

export class PosRepository {
    constructor() {
        this.db = dbInstance;
    }

    async logAudit(action, entity, entity_id, details) {
        await this.db.add('audit_log', {
            action,
            entity,
            entity_id,
            details,
            timestamp: new Date().toISOString()
        });
    }

    async restockPigment(pigmentId, receivedMg, totalCostCents, supplierName) {
        const tx = await this.db.getTransaction(['pigments', 'stock_receipts', 'audit_log'], 'readwrite');
        
        return new Promise((resolve, reject) => {
            const pigmentStore = tx.objectStore('pigments');
            const getReq = pigmentStore.get(pigmentId);
            
            getReq.onsuccess = () => {
                const pigment = getReq.result;
                if (!pigment) return reject("Pigment not found");
                
                pigment.stock_mg += receivedMg;
                pigmentStore.put(pigment);
                
                const receiptStore = tx.objectStore('stock_receipts');
                const receiptIdReq = receiptStore.add({
                    pigment_id: pigmentId,
                    received_mg: receivedMg,
                    total_cost_cents: totalCostCents,
                    supplier_name: supplierName,
                    date: new Date().toISOString()
                });
                
                receiptIdReq.onsuccess = () => {
                    const auditStore = tx.objectStore('audit_log');
                    auditStore.add({
                        action: 'restock',
                        entity: 'pigment',
                        entity_id: pigmentId,
                        details: { receivedMg, totalCostCents, supplierName },
                        timestamp: new Date().toISOString()
                    });
                };
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async logShrinkage(pigmentId, mgLost, reason) {
        const tx = await this.db.getTransaction(['pigments', 'shrinkage_logs', 'audit_log'], 'readwrite');
        
        return new Promise((resolve, reject) => {
            const pigmentStore = tx.objectStore('pigments');
            const getReq = pigmentStore.get(pigmentId);
            
            getReq.onsuccess = () => {
                const pigment = getReq.result;
                if (!pigment) return reject("Pigment not found");
                
                pigment.stock_mg -= mgLost;
                if (pigment.stock_mg < 0) pigment.stock_mg = 0;
                pigmentStore.put(pigment);
                
                tx.objectStore('shrinkage_logs').add({
                    pigment_id: pigmentId,
                    mg_lost: mgLost,
                    reason,
                    date: new Date().toISOString()
                });
                
                tx.objectStore('audit_log').add({
                    action: 'shrinkage',
                    entity: 'pigment',
                    entity_id: pigmentId,
                    details: { mgLost, reason },
                    timestamp: new Date().toISOString()
                });
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async completeSale(customerId, items, payments, isCreditOverride) {
        const tx = await this.db.getTransaction(['sales', 'sale_items', 'sale_payments', 'pigments', 'customers', 'audit_log'], 'readwrite');
        
        return new Promise((resolve, reject) => {
            let subtotalCents = 0;
            items.forEach(i => { subtotalCents += i.total_cents; });
            
            let totalPaidCents = 0;
            let tabAmount = 0;
            payments.forEach(p => {
                totalPaidCents += p.amount_cents;
                if (p.payment_type === 'tab') {
                    tabAmount += p.amount_cents;
                }
            });
            
            if (totalPaidCents < subtotalCents && !isCreditOverride) {
                return reject("Insufficient payments");
            }
            
            const saleStore = tx.objectStore('sales');
            const saleReq = saleStore.add({
                customer_id: customerId,
                subtotal_cents: subtotalCents,
                discount_cents: 0,
                total_cents: subtotalCents,
                total_paid_cents: totalPaidCents,
                date: new Date().toISOString(),
                status: 'completed'
            });
            
            saleReq.onsuccess = () => {
                const saleId = saleReq.result;
                const saleItemStore = tx.objectStore('sale_items');
                const pigmentStore = tx.objectStore('pigments');
                
                items.forEach(item => {
                    saleItemStore.add({
                        sale_id: saleId,
                        pigment_id: item.pigment_id,
                        quantity_mg: item.quantity_mg,
                        price_per_gram_cents: item.price_per_gram_cents,
                        total_cents: item.total_cents,
                        returned_mg: 0
                    });
                    
                    const getPigReq = pigmentStore.get(item.pigment_id);
                    getPigReq.onsuccess = () => {
                        const pig = getPigReq.result;
                        if (pig) {
                            pig.stock_mg -= item.quantity_mg;
                            pigmentStore.put(pig);
                        }
                    };
                });
                
                const paymentStore = tx.objectStore('sale_payments');
                payments.forEach(p => {
                    paymentStore.add({
                        sale_id: saleId,
                        payment_type: p.payment_type,
                        amount_cents: p.amount_cents,
                        digital_provider: p.digital_provider || null
                    });
                });
                
                if (tabAmount > 0 && customerId) {
                    const custStore = tx.objectStore('customers');
                    const getCust = custStore.get(customerId);
                    getCust.onsuccess = () => {
                        const cust = getCust.result;
                        if (cust) {
                            cust.tab_balance_cents += tabAmount;
                            custStore.put(cust);
                        }
                    };
                }
                
                tx.objectStore('audit_log').add({
                    action: 'sale_completed',
                    entity: 'sale',
                    entity_id: saleId,
                    details: { total_cents: subtotalCents },
                    timestamp: new Date().toISOString()
                });
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async processReturn(saleItemId, mgReturned, refundAmountCents, restockToInventory, reason) {
        const tx = await this.db.getTransaction(['sale_items', 'returns', 'pigments', 'audit_log'], 'readwrite');
        return new Promise((resolve, reject) => {
            const itemStore = tx.objectStore('sale_items');
            const getReq = itemStore.get(saleItemId);
            
            getReq.onsuccess = () => {
                const item = getReq.result;
                if (!item) return reject("Sale item not found");
                
                item.returned_mg += mgReturned;
                itemStore.put(item);
                
                tx.objectStore('returns').add({
                    sale_item_id: saleItemId,
                    returned_mg: mgReturned,
                    refund_amount_cents: refundAmountCents,
                    restocked: restockToInventory,
                    reason,
                    date: new Date().toISOString()
                });
                
                if (restockToInventory) {
                    const pigStore = tx.objectStore('pigments');
                    const pigReq = pigStore.get(item.pigment_id);
                    pigReq.onsuccess = () => {
                        const pig = pigReq.result;
                        if (pig) {
                            pig.stock_mg += mgReturned;
                            pigStore.put(pig);
                        }
                    };
                }
                
                tx.objectStore('audit_log').add({
                    action: 'return_processed',
                    entity: 'sale_item',
                    entity_id: saleItemId,
                    details: { mgReturned, refundAmountCents },
                    timestamp: new Date().toISOString()
                });
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async voidSale(saleId, reason) {
        const tx = await this.db.getTransaction(['sales', 'sale_items', 'pigments', 'customers', 'sale_payments', 'audit_log'], 'readwrite');
        return new Promise((resolve, reject) => {
            const saleStore = tx.objectStore('sales');
            const saleReq = saleStore.get(saleId);
            
            saleReq.onsuccess = () => {
                const sale = saleReq.result;
                if (!sale) return reject("Sale not found");
                if (sale.status === 'voided') return reject("Sale already voided");
                
                sale.status = 'voided';
                saleStore.put(sale);
                
                // Restock items
                const itemStore = tx.objectStore('sale_items');
                const itemIdx = itemStore.index('sale_id');
                const getItemsReq = itemIdx.getAll(saleId);
                
                getItemsReq.onsuccess = () => {
                    const items = getItemsReq.result;
                    const pigStore = tx.objectStore('pigments');
                    items.forEach(item => {
                        const netMg = item.quantity_mg - item.returned_mg;
                        if (netMg > 0) {
                            const pigReq = pigStore.get(item.pigment_id);
                            pigReq.onsuccess = () => {
                                const pig = pigReq.result;
                                if (pig) {
                                    pig.stock_mg += netMg;
                                    pigStore.put(pig);
                                }
                            };
                        }
                    });
                };
                
                // Reverse tab payments if any
                const payStore = tx.objectStore('sale_payments');
                const payIdx = payStore.index('sale_id');
                const getPayReq = payIdx.getAll(saleId);
                
                getPayReq.onsuccess = () => {
                    const payments = getPayReq.result;
                    let tabPaid = 0;
                    payments.forEach(p => {
                        if (p.payment_type === 'tab') tabPaid += p.amount_cents;
                    });
                    
                    if (tabPaid > 0 && sale.customer_id) {
                        const custStore = tx.objectStore('customers');
                        const custReq = custStore.get(sale.customer_id);
                        custReq.onsuccess = () => {
                            const cust = custReq.result;
                            if (cust) {
                                cust.tab_balance_cents -= tabPaid;
                                custStore.put(cust);
                            }
                        };
                    }
                };
                
                tx.objectStore('audit_log').add({
                    action: 'void_sale',
                    entity: 'sale',
                    entity_id: saleId,
                    details: { reason },
                    timestamp: new Date().toISOString()
                });
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async settleTabPayment(customerId, amountPaidCents, paymentType, digitalProvider) {
        const tx = await this.db.getTransaction(['customers', 'tab_payments', 'audit_log'], 'readwrite');
        return new Promise((resolve, reject) => {
            const custStore = tx.objectStore('customers');
            const custReq = custStore.get(customerId);
            
            custReq.onsuccess = () => {
                const cust = custReq.result;
                if (!cust) return reject("Customer not found");
                
                cust.tab_balance_cents -= amountPaidCents;
                custStore.put(cust);
                
                tx.objectStore('tab_payments').add({
                    customer_id: customerId,
                    amount_paid_cents: amountPaidCents,
                    payment_type: paymentType,
                    digital_provider: digitalProvider,
                    date: new Date().toISOString()
                });
                
                tx.objectStore('audit_log').add({
                    action: 'settle_tab',
                    entity: 'customer',
                    entity_id: customerId,
                    details: { amountPaidCents, paymentType },
                    timestamp: new Date().toISOString()
                });
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async updatePigmentPricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents) {
        const tx = await this.db.getTransaction(['pigments', 'audit_log'], 'readwrite');
        return new Promise((resolve, reject) => {
            const pigStore = tx.objectStore('pigments');
            const pigReq = pigStore.get(pigmentId);
            
            pigReq.onsuccess = () => {
                const pig = pigReq.result;
                if (!pig) return reject("Pigment not found");
                
                const oldRetail = pig.retail_price_per_gram_cents;
                const oldWholesale = pig.wholesale_price_per_gram_cents;
                
                pig.retail_price_per_gram_cents = retailPricePerGramCents;
                pig.wholesale_price_per_gram_cents = wholesalePricePerGramCents;
                pigStore.put(pig);
                
                tx.objectStore('audit_log').add({
                    action: 'update_pricing',
                    entity: 'pigment',
                    entity_id: pigmentId,
                    details: { oldRetail, oldWholesale, newRetail: retailPricePerGramCents, newWholesale: wholesalePricePerGramCents },
                    timestamp: new Date().toISOString()
                });
            };
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async createPigment(pigmentData) {
        const id = await this.db.add('pigments', {
            name: pigmentData.name,
            category: pigmentData.category,
            stock_mg: pigmentData.stock_mg || 0,
            retail_price_per_gram_cents: pigmentData.retail_price_per_gram_cents,
            wholesale_price_per_gram_cents: pigmentData.wholesale_price_per_gram_cents
        });
        await this.logAudit('create_pigment', 'pigment', id, pigmentData);
        return id;
    }

    async createCustomer(customerData) {
        const id = await this.db.add('customers', {
            name: customerData.name,
            type: customerData.type,
            tab_balance_cents: 0
        });
        await this.logAudit('create_customer', 'customer', id, customerData);
        return id;
    }
}

// Helpers
export function formatCents(cents) {
    return '$' + (cents / 100).toFixed(2);
}

export function formatMgToGrams(mg) {
    return (mg / 1000).toFixed(2) + ' g';
}

export function formatMgToOz(mg) {
    return (mg / 28349.5).toFixed(3) + ' oz';
}
