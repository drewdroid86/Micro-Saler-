package com.example.microsaler.data.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.example.microsaler.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface PigmentDao {
    @Query("SELECT * FROM pigments WHERE is_archived = 0 ORDER BY name ASC")
    fun getAllPigments(): Flow<List<Pigment>>

    @Query("SELECT * FROM pigments ORDER BY name ASC")
    fun getAllPigmentsIncludingArchived(): Flow<List<Pigment>>

    @Query("SELECT * FROM pigments WHERE pigment_id = :id LIMIT 1")
    suspend fun getPigmentById(id: Long): Pigment?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPigment(pigment: Pigment): Long

    @Update
    suspend fun updatePigment(pigment: Pigment)

    @Query("UPDATE pigments SET stock_mg = :newStockMg, total_cost_cents = :newTotalCostCents WHERE pigment_id = :id")
    suspend fun updateStockAndCost(id: Long, newStockMg: Long, newTotalCostCents: Long)
}

@Dao
interface StockReceiptDao {
    @Query("SELECT * FROM stock_receipts WHERE pigment_id = :pigmentId ORDER BY received_at DESC")
    fun getReceiptsForPigment(pigmentId: Long): Flow<List<StockReceipt>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReceipt(receipt: StockReceipt): Long
}

@Dao
interface CustomerDao {
    @Query("SELECT * FROM customers ORDER BY name ASC")
    fun getAllCustomers(): Flow<List<Customer>>

    @Query("SELECT * FROM customers WHERE customer_id = :id LIMIT 1")
    suspend fun getCustomerById(id: Long): Customer?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCustomer(customer: Customer): Long

    @Update
    suspend fun updateCustomer(customer: Customer)

    @Query("UPDATE customers SET current_balance_cents = current_balance_cents + :amountCents WHERE customer_id = :customerId")
    suspend fun updateCustomerBalance(customerId: Long, amountCents: Long)
}

@Dao
interface SaleDao {
    @Query("SELECT * FROM sales ORDER BY created_at DESC")
    fun getAllSales(): Flow<List<Sale>>

    @Query("SELECT * FROM sales WHERE customer_id = :customerId ORDER BY created_at DESC")
    fun getSalesByCustomer(customerId: Long): Flow<List<Sale>>

    @Query("SELECT * FROM sales WHERE sale_id = :id LIMIT 1")
    suspend fun getSaleById(id: Long): Sale?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSale(sale: Sale): Long

    @Query("UPDATE sales SET status = :status WHERE sale_id = :saleId")
    suspend fun updateSaleStatus(saleId: Long, status: String)
}

@Dao
interface SalePaymentDao {
    @Query("SELECT * FROM sale_payments WHERE sale_id = :saleId")
    fun getPaymentsForSale(saleId: Long): Flow<List<SalePayment>>

    @Query("SELECT * FROM sale_payments WHERE sale_id = :saleId")
    suspend fun getPaymentsForSaleSync(saleId: Long): List<SalePayment>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayment(payment: SalePayment): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayments(payments: List<SalePayment>)
}

@Dao
interface SaleItemDao {
    @Query("SELECT * FROM sale_items")
    fun getAllSaleItems(): Flow<List<SaleItem>>

    @Query("SELECT * FROM sale_items WHERE sale_id = :saleId")
    fun getItemsForSale(saleId: Long): Flow<List<SaleItem>>

    @Query("SELECT * FROM sale_items WHERE sale_id = :saleId")
    suspend fun getItemsForSaleSync(saleId: Long): List<SaleItem>

    @Query("SELECT * FROM sale_items WHERE sale_item_id = :saleItemId LIMIT 1")
    suspend fun getSaleItemById(saleItemId: Long): SaleItem?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSaleItem(saleItem: SaleItem): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSaleItems(items: List<SaleItem>)
}

@Dao
interface ReturnDao {
    @Query("SELECT * FROM returns WHERE sale_item_id = :saleItemId")
    fun getReturnsForSaleItem(saleItemId: Long): Flow<List<ReturnRecord>>

    @Query("SELECT SUM(mg_returned) FROM returns WHERE sale_item_id = :saleItemId")
    suspend fun getTotalReturnedMgForSaleItem(saleItemId: Long): Long?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertReturn(returnRecord: ReturnRecord): Long
}

@Dao
interface TabPaymentDao {
    @Query("SELECT * FROM tab_payments WHERE customer_id = :customerId ORDER BY created_at DESC")
    fun getTabPaymentsForCustomer(customerId: Long): Flow<List<TabPayment>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTabPayment(tabPayment: TabPayment): Long
}

@Dao
interface ShrinkageLogDao {
    @Query("SELECT * FROM shrinkage_logs ORDER BY created_at DESC")
    fun getAllShrinkageLogs(): Flow<List<ShrinkageLog>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertShrinkageLog(log: ShrinkageLog): Long
}

@Dao
interface AuditLogDao {
    @Query("SELECT * FROM audit_log ORDER BY timestamp DESC")
    fun getAllAuditLogs(): Flow<List<AuditLog>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAuditLog(log: AuditLog): Long
}
