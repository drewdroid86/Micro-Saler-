package com.example.microsaler.data.repository

import androidx.room.withTransaction
import com.example.microsaler.data.db.AppDatabase
import com.example.microsaler.data.dao.*
import com.example.microsaler.data.model.*
import kotlinx.coroutines.flow.Flow
import org.json.JSONObject
import kotlin.math.abs

class PosRepository(
    private val db: AppDatabase,
    private val pigmentDao: PigmentDao,
    private val stockReceiptDao: StockReceiptDao,
    private val customerDao: CustomerDao,
    private val saleDao: SaleDao,
    private val salePaymentDao: SalePaymentDao,
    private val saleItemDao: SaleItemDao,
    private val returnDao: ReturnDao,
    private val tabPaymentDao: TabPaymentDao,
    private val shrinkageLogDao: ShrinkageLogDao,
    private val auditLogDao: AuditLogDao
) {
    val pigments: Flow<List<Pigment>> = pigmentDao.getAllPigments()
    val allCustomers: Flow<List<Customer>> = customerDao.getAllCustomers()
    val allSales: Flow<List<Sale>> = saleDao.getAllSales()
    val allSaleItems: Flow<List<SaleItem>> = saleItemDao.getAllSaleItems()
    val allShrinkageLogs: Flow<List<ShrinkageLog>> = shrinkageLogDao.getAllShrinkageLogs()
    val allAuditLogs: Flow<List<AuditLog>> = auditLogDao.getAllAuditLogs()

    suspend fun getPigmentById(id: Long): Pigment? = pigmentDao.getPigmentById(id)
    suspend fun getCustomerById(id: Long): Customer? = customerDao.getCustomerById(id)

    // RESTOCK PIGMENT
    suspend fun restockPigment(
        pigmentId: Long,
        receivedMg: Long,
        totalCostCents: Long,
        supplierName: String
    ): Result<Unit> {
        val pigment = pigmentDao.getPigmentById(pigmentId)
            ?: return Result.failure(Exception("Pigment not found"))

        val newStockMg = pigment.stock_mg + receivedMg
        val newTotalCostCents = pigment.total_cost_cents + totalCostCents

        pigmentDao.updateStockAndCost(pigmentId, newStockMg, newTotalCostCents)

        stockReceiptDao.insertReceipt(
            StockReceipt(
                pigment_id = pigmentId,
                received_mg = receivedMg,
                total_cost_cents = totalCostCents,
                supplier_name = supplierName
            )
        )
        return Result.success(Unit)
    }

    // SHRINKAGE LOG (Spillage / Sample / Loss)
    suspend fun logShrinkage(
        pigmentId: Long,
        mgLost: Long,
        reason: String
    ): Result<Unit> {
        val pigment = pigmentDao.getPigmentById(pigmentId)
            ?: return Result.failure(Exception("Pigment not found"))

        if (mgLost <= 0) return Result.failure(Exception("Loss weight must be greater than 0"))

        val cogsLossCents = if (pigment.stock_mg > 0) {
            ((pigment.total_cost_cents.toDouble() / pigment.stock_mg) * mgLost).toLong()
        } else {
            0L
        }

        val newStockMg = (pigment.stock_mg - mgLost).coerceAtLeast(0)
        val newTotalCostCents = (pigment.total_cost_cents - cogsLossCents).coerceAtLeast(0)

        pigmentDao.updateStockAndCost(pigmentId, newStockMg, newTotalCostCents)

        shrinkageLogDao.insertShrinkageLog(
            ShrinkageLog(
                pigment_id = pigmentId,
                mg_lost = mgLost,
                cogs_loss_cents = cogsLossCents,
                reason = reason
            )
        )

        return Result.success(Unit)
    }

    // COMPLETE SALE (With Split Payment Reconciliation & Handshake Mode Check)
    suspend fun completeSale(
        customerId: Long?,
        items: List<SaleItem>,
        payments: List<SalePayment>,
        isCreditOverride: Boolean
    ): Result<Long> {
        return try {
            val saleId = db.withTransaction {
                if (items.isEmpty()) throw Exception("Cart is empty")
                if (payments.isEmpty()) throw Exception("No payments provided")

                val totalSaleAmountCents = items.sumOf { it.price_charged_cents }
                val totalCogsCents = items.sumOf { it.unit_cogs_cents }
                val totalPaymentsCents = payments.sumOf { it.amount_cents }

                // RULE 4: Split payments must sum to exactly the sale total (±1 cent rounding tolerance)
                if (abs(totalSaleAmountCents - totalPaymentsCents) > 1) {
                    throw Exception(
                        "Payment total ($${String.format("%.2f", totalPaymentsCents / 100.0)}) " +
                        "does not match sale total ($${String.format("%.2f", totalSaleAmountCents / 100.0)})."
                    )
                }

                // RULE 6: House Tab Available Credit Check & Handshake Mode
                val houseTabPayment = payments.find { it.payment_type == "HOUSE_TAB" }
                var customer: Customer? = null

                if (houseTabPayment != null && houseTabPayment.amount_cents > 0) {
                    if (customerId == null) {
                        throw Exception("House Tab requires a named customer")
                    }
                    customer = customerDao.getCustomerById(customerId)
                        ?: throw Exception("Customer not found")

                    val availableCredit = customer.availableCreditCents
                    if (houseTabPayment.amount_cents > availableCredit) {
                        if (!isCreditOverride) {
                            throw Exception(
                                "House Tab exceeds available credit ($${String.format("%.2f", availableCredit / 100.0)}). " +
                                "Enable Handshake Mode to override."
                            )
                        }
                    }
                }

                // Save Sale
                val saleId = saleDao.insertSale(
                    Sale(
                        customer_id = customerId,
                        total_amount_cents = totalSaleAmountCents,
                        total_cogs_cents = totalCogsCents,
                        status = "COMPLETED",
                        is_credit_override = isCreditOverride
                    )
                )

                // Save Sale Items & Deduct Inventory Stock
                items.forEach { item ->
                    saleItemDao.insertSaleItem(item.copy(sale_id = saleId))

                    val pigment = pigmentDao.getPigmentById(item.pigment_id)
                    if (pigment != null) {
                        val newStock = (pigment.stock_mg - item.weight_mg).coerceAtLeast(0)
                        val newCost = (pigment.total_cost_cents - item.unit_cogs_cents).coerceAtLeast(0)
                        pigmentDao.updateStockAndCost(item.pigment_id, newStock, newCost)
                    }
                }

                // Save Payments & Update Customer Balance if House Tab
                payments.forEach { payment ->
                    salePaymentDao.insertPayment(payment.copy(sale_id = saleId))
                    if (payment.payment_type == "HOUSE_TAB" && customerId != null) {
                        customerDao.updateCustomerBalance(customerId, payment.amount_cents)
                    }
                }

                // Log Handshake Override if triggered
                if (isCreditOverride && houseTabPayment != null) {
                    val detailsJson = JSONObject().apply {
                        put("sale_id", saleId)
                        put("customer_id", customerId)
                        put("customer_name", customer?.name ?: "Unknown")
                        put("tab_amount_cents", houseTabPayment.amount_cents)
                        put("available_credit_cents", customer?.availableCreditCents ?: 0)
                        put("credit_limit_cents", customer?.credit_limit_cents ?: 0)
                    }.toString()

                    auditLogDao.insertAuditLog(
                        AuditLog(
                            entity_type = "SALE",
                            entity_id = saleId,
                            action = "HANDSHAKE_CREDIT_OVERRIDE",
                            details = detailsJson
                        )
                    )
                }

                saleId
            }
            Result.success(saleId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // RULE 3: PROCESS RETURN WITH CUMULATIVE RETURN TRACKING
    suspend fun processReturn(
        saleItemId: Long,
        mgReturned: Long,
        refundAmountCents: Long,
        restockToInventory: Boolean,
        reason: String
    ): Result<Unit> {
        return try {
            db.withTransaction {
                val saleItem = saleItemDao.getSaleItemById(saleItemId)
                    ?: throw Exception("Sale item not found")

                if (mgReturned <= 0) throw Exception("Return weight must be greater than 0")

                val alreadyReturnedMg = returnDao.getTotalReturnedMgForSaleItem(saleItemId) ?: 0L
                val maxReturnableMg = saleItem.weight_mg - alreadyReturnedMg

                if (mgReturned > maxReturnableMg) {
                    throw Exception(
                        "Cannot return ${mgReturned / 1000.0}g. " +
                        "Max returnable weight is ${maxReturnableMg / 1000.0}g " +
                        "(Already returned: ${alreadyReturnedMg / 1000.0}g out of ${saleItem.weight_mg / 1000.0}g sold)."
                    )
                }

                returnDao.insertReturn(
                    ReturnRecord(
                        sale_item_id = saleItemId,
                        mg_returned = mgReturned,
                        refund_amount_cents = refundAmountCents,
                        restock_to_inventory = restockToInventory,
                        reason = reason
                    )
                )

                // If restocking, add back to pigment inventory
                if (restockToInventory) {
                    val pigment = pigmentDao.getPigmentById(saleItem.pigment_id)
                    if (pigment != null) {
                        val restockCogsCents = if (saleItem.weight_mg > 0) {
                            ((saleItem.unit_cogs_cents.toDouble() / saleItem.weight_mg) * mgReturned).toLong()
                        } else 0L

                        pigmentDao.updateStockAndCost(
                            id = saleItem.pigment_id,
                            newStockMg = pigment.stock_mg + mgReturned,
                            newTotalCostCents = pigment.total_cost_cents + restockCogsCents
                        )
                    }
                }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // VOID SALE
    suspend fun voidSale(saleId: Long, reason: String): Result<Unit> {
        return try {
            db.withTransaction {
                val sale = saleDao.getSaleById(saleId)
                    ?: throw Exception("Sale not found")

                if (sale.status == "VOIDED") {
                    throw Exception("Sale is already voided")
                }

                // Restock items
                val saleItems = saleItemDao.getItemsForSaleSync(saleId)
                saleItems.forEach { item ->
                    val pigment = pigmentDao.getPigmentById(item.pigment_id)
                    if (pigment != null) {
                        pigmentDao.updateStockAndCost(
                            id = item.pigment_id,
                            newStockMg = pigment.stock_mg + item.weight_mg,
                            newTotalCostCents = pigment.total_cost_cents + item.unit_cogs_cents
                        )
                    }
                }

                // Reverse House Tab balance if applicable
                val payments = salePaymentDao.getPaymentsForSaleSync(saleId)
                val houseTabPayment = payments.find { it.payment_type == "HOUSE_TAB" }
                if (houseTabPayment != null && sale.customer_id != null) {
                    customerDao.updateCustomerBalance(sale.customer_id, -houseTabPayment.amount_cents)
                }

                saleDao.updateSaleStatus(saleId, "VOIDED")

                val detailsJson = JSONObject().apply {
                    put("sale_id", saleId)
                    put("reason", reason)
                    put("total_amount_cents", sale.total_amount_cents)
                }.toString()

                auditLogDao.insertAuditLog(
                    AuditLog(
                        entity_type = "SALE",
                        entity_id = saleId,
                        action = "VOID_SALE",
                        details = detailsJson
                    )
                )
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // SETTLE TAB PAYMENT
    suspend fun settleTabPayment(
        customerId: Long,
        amountPaidCents: Long,
        paymentType: String,
        digitalProvider: String?
    ): Result<Unit> {
        val customer = customerDao.getCustomerById(customerId)
            ?: return Result.failure(Exception("Customer not found"))

        if (amountPaidCents <= 0) return Result.failure(Exception("Payment amount must be greater than $0.00"))

        tabPaymentDao.insertTabPayment(
            TabPayment(
                customer_id = customerId,
                amount_paid_cents = amountPaidCents,
                payment_type = paymentType,
                digital_provider = digitalProvider
            )
        )

        // Reduce balance
        customerDao.updateCustomerBalance(customerId, -amountPaidCents)

        return Result.success(Unit)
    }

    // PIGMENT & CUSTOMER MANAGEMENTS
    suspend fun addPigment(pigment: Pigment): Long = pigmentDao.insertPigment(pigment)
    suspend fun updatePigment(pigment: Pigment) = pigmentDao.updatePigment(pigment)
    suspend fun addCustomer(customer: Customer): Long = customerDao.insertCustomer(customer)
    suspend fun updateCustomer(customer: Customer) = customerDao.updateCustomer(customer)

    // UPDATE PIGMENT PRICING (retail + wholesale per-gram prices)
    suspend fun updatePigmentPricing(
        pigmentId: Long,
        retailPricePerGramCents: Long,
        wholesalePricePerGramCents: Long
    ): Result<Unit> {
        val pigment = pigmentDao.getPigmentById(pigmentId)
            ?: return Result.failure(Exception("Pigment not found"))

        pigmentDao.updatePricing(pigmentId, retailPricePerGramCents, wholesalePricePerGramCents)

        val detailsJson = JSONObject().apply {
            put("pigment_id", pigmentId)
            put("pigment_name", pigment.name)
            put("old_retail_price_per_gram_cents", pigment.retail_price_per_gram_cents)
            put("new_retail_price_per_gram_cents", retailPricePerGramCents)
            put("old_wholesale_price_per_gram_cents", pigment.wholesale_price_per_gram_cents)
            put("new_wholesale_price_per_gram_cents", wholesalePricePerGramCents)
        }.toString()

        auditLogDao.insertAuditLog(
            AuditLog(
                entity_type = "PIGMENT",
                entity_id = pigmentId,
                action = "PRICING_UPDATE",
                details = detailsJson
            )
        )

        return Result.success(Unit)
    }

    suspend fun getAlreadyReturnedMg(saleItemId: Long): Long = returnDao.getTotalReturnedMgForSaleItem(saleItemId) ?: 0L

    fun getPaymentsForSale(saleId: Long): Flow<List<SalePayment>> = salePaymentDao.getPaymentsForSale(saleId)
    fun getItemsForSale(saleId: Long): Flow<List<SaleItem>> = saleItemDao.getItemsForSale(saleId)
}
