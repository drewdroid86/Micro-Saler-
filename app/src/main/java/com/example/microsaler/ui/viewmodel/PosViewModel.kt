package com.example.microsaler.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.microsaler.data.db.AppDatabase
import com.example.microsaler.data.model.*
import com.example.microsaler.data.repository.PosRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

data class CartItem(
    val pigment: Pigment,
    val weight_mg: Long,
    val price_charged_cents: Long,
    val unit_cogs_cents: Long
) {
    val weightGrams: Double get() = weight_mg / 1000.0
}

data class CheckoutUiState(
    val selectedCustomer: Customer? = null,
    val cartItems: List<CartItem> = emptyList(),
    val selectedPigment: Pigment? = null,
    val pricingMode: String = "RETAIL", // RETAIL or WHOLESALE
    val isHandshakeOverrideEnabled: Boolean = false,
    val activePaymentDrawer: Boolean = false,
    val userErrorMessage: String? = null,
    val lastSuccessSaleId: Long? = null
) {
    val totalAmountCents: Long get() = cartItems.sumOf { it.price_charged_cents }
    val totalCogsCents: Long get() = cartItems.sumOf { it.unit_cogs_cents }
    val estimatedMarginCents: Long get() = totalAmountCents - totalCogsCents
}

class PosViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AppDatabase.getDatabase(application, viewModelScope)
    private val repository = PosRepository(
        db = db,
        pigmentDao = db.pigmentDao(),
        stockReceiptDao = db.stockReceiptDao(),
        customerDao = db.customerDao(),
        saleDao = db.saleDao(),
        salePaymentDao = db.salePaymentDao(),
        saleItemDao = db.saleItemDao(),
        returnDao = db.returnDao(),
        tabPaymentDao = db.tabPaymentDao(),
        shrinkageLogDao = db.shrinkageLogDao(),
        auditLogDao = db.auditLogDao()
    )

    val pigments: StateFlow<List<Pigment>> = repository.pigments
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val customers: StateFlow<List<Customer>> = repository.allCustomers
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val sales: StateFlow<List<Sale>> = repository.allSales
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val allSaleItems: StateFlow<List<SaleItem>> = repository.allSaleItems
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val auditLogs: StateFlow<List<AuditLog>> = repository.allAuditLogs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val shrinkageLogs: StateFlow<List<ShrinkageLog>> = repository.allShrinkageLogs
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private val _checkoutState = MutableStateFlow(CheckoutUiState())
    val checkoutState: StateFlow<CheckoutUiState> = _checkoutState.asStateFlow()

    fun selectCustomer(customer: Customer?) {
        _checkoutState.update { it.copy(selectedCustomer = customer, isHandshakeOverrideEnabled = false) }
    }

    fun selectPigment(pigment: Pigment) {
        _checkoutState.update { it.copy(selectedPigment = pigment) }
    }

    fun setPricingMode(mode: String) {
        _checkoutState.update { it.copy(pricingMode = mode) }
    }

    fun setHandshakeOverride(enabled: Boolean) {
        _checkoutState.update { it.copy(isHandshakeOverrideEnabled = enabled) }
    }

    fun setPaymentDrawerOpen(open: Boolean) {
        _checkoutState.update { it.copy(activePaymentDrawer = open) }
    }

    fun clearErrorMessage() {
        _checkoutState.update { it.copy(userErrorMessage = null) }
    }

    fun clearSuccessMessage() {
        _checkoutState.update { it.copy(lastSuccessSaleId = null) }
    }

    // ADD ITEM OR QUICK WEIGHT
    fun addWeightToSelectedPigment(weightMg: Long, customPriceCents: Long? = null) {
        val pigment = _checkoutState.value.selectedPigment
            ?: pigments.value.firstOrNull()
            ?: return

        // Default price uses this pigment's retail or wholesale price per gram, based on current pricing mode, plus packaging
        val activePricePerGramCents = if (_checkoutState.value.pricingMode == "WHOLESALE") {
            pigment.wholesale_price_per_gram_cents
        } else {
            pigment.retail_price_per_gram_cents
        }
        val calculatedPriceCents = customPriceCents ?: (
            (weightMg / 1000.0 * activePricePerGramCents).toLong() + pigment.default_pkg_cents
        )

        val unitCogsCents = if (pigment.stock_mg > 0) {
            ((pigment.total_cost_cents.toDouble() / pigment.stock_mg) * weightMg).toLong()
        } else {
            0L
        }

        val newItem = CartItem(
            pigment = pigment,
            weight_mg = weightMg,
            price_charged_cents = calculatedPriceCents,
            unit_cogs_cents = unitCogsCents
        )

        _checkoutState.update { state ->
            state.copy(cartItems = state.cartItems + newItem)
        }
    }

    fun removeCartItem(index: Int) {
        _checkoutState.update { state ->
            val updated = state.cartItems.toMutableList()
            if (index in updated.indices) {
                updated.removeAt(index)
            }
            state.copy(cartItems = updated)
        }
    }

    fun clearCart() {
        _checkoutState.update { it.copy(cartItems = emptyList(), activePaymentDrawer = false) }
    }

    // 1-TAP QUICK CASH SALE (Fastest Path for Market Stall Sales)
    fun quickCollectCash() {
        val state = _checkoutState.value
        if (state.cartItems.isEmpty()) {
            _checkoutState.update { it.copy(userErrorMessage = "Cart is empty") }
            return
        }

        val totalAmount = state.totalAmountCents
        val items = state.cartItems.map {
            SaleItem(
                sale_id = 0,
                pigment_id = it.pigment.pigment_id,
                weight_mg = it.weight_mg,
                price_charged_cents = it.price_charged_cents,
                unit_cogs_cents = it.unit_cogs_cents
            )
        }

        val cashPayment = listOf(
            SalePayment(
                sale_id = 0,
                payment_type = "CASH",
                amount_cents = totalAmount,
                merchant_fee_cents = 0
            )
        )

        viewModelScope.launch {
            val result = repository.completeSale(
                customerId = state.selectedCustomer?.customer_id,
                items = items,
                payments = cashPayment,
                isCreditOverride = false
            )

            result.onSuccess { saleId ->
                _checkoutState.update {
                    it.copy(
                        cartItems = emptyList(),
                        activePaymentDrawer = false,
                        lastSuccessSaleId = saleId
                    )
                }
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message ?: "Failed to complete sale") }
            }
        }
    }

    // COMPLETE PAYMENT DRAWER SUBMIT (CASH / DIGITAL / HOUSE_TAB / SPLIT)
    fun processPayment(payments: List<SalePayment>) {
        val state = _checkoutState.value
        if (state.cartItems.isEmpty()) {
            _checkoutState.update { it.copy(userErrorMessage = "Cart is empty") }
            return
        }

        val items = state.cartItems.map {
            SaleItem(
                sale_id = 0,
                pigment_id = it.pigment.pigment_id,
                weight_mg = it.weight_mg,
                price_charged_cents = it.price_charged_cents,
                unit_cogs_cents = it.unit_cogs_cents
            )
        }

        viewModelScope.launch {
            val result = repository.completeSale(
                customerId = state.selectedCustomer?.customer_id,
                items = items,
                payments = payments,
                isCreditOverride = state.isHandshakeOverrideEnabled
            )

            result.onSuccess { saleId ->
                _checkoutState.update {
                    it.copy(
                        cartItems = emptyList(),
                        activePaymentDrawer = false,
                        isHandshakeOverrideEnabled = false,
                        lastSuccessSaleId = saleId
                    )
                }
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message ?: "Sale payment failed") }
            }
        }
    }

    // RESTOCK PIGMENT
    fun restockPigment(pigmentId: Long, grams: Double, totalCostDollars: Double, supplierName: String, onComplete: () -> Unit) {
        val receivedMg = (grams * 1000).toLong()
        val totalCostCents = (totalCostDollars * 100).toLong()

        viewModelScope.launch {
            val result = repository.restockPigment(pigmentId, receivedMg, totalCostCents, supplierName)
            result.onSuccess {
                onComplete()
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message) }
            }
        }
    }

    // LOG SHRINKAGE
    fun logShrinkage(pigmentId: Long, gramsLost: Double, reason: String, onComplete: () -> Unit) {
        val mgLost = (gramsLost * 1000).toLong()
        viewModelScope.launch {
            val result = repository.logShrinkage(pigmentId, mgLost, reason)
            result.onSuccess {
                onComplete()
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message) }
            }
        }
    }

    // SETTLE CUSTOMER TAB
    fun settleCustomerTab(customerId: Long, amountPaidDollars: Double, paymentType: String, digitalProvider: String?, onComplete: () -> Unit) {
        val amountCents = (amountPaidDollars * 100).toLong()
        viewModelScope.launch {
            val result = repository.settleTabPayment(customerId, amountCents, paymentType, digitalProvider)
            result.onSuccess {
                onComplete()
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message) }
            }
        }
    }

    // PROCESS RETURN
    fun processReturn(saleItemId: Long, gramsReturned: Double, refundDollars: Double, restock: Boolean, reason: String, onComplete: () -> Unit) {
        val mgReturned = (gramsReturned * 1000).toLong()
        val refundCents = (refundDollars * 100).toLong()

        viewModelScope.launch {
            val result = repository.processReturn(saleItemId, mgReturned, refundCents, restock, reason)
            result.onSuccess {
                onComplete()
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message) }
            }
        }
    }

    // VOID SALE
    fun voidSale(saleId: Long, reason: String, onComplete: () -> Unit) {
        viewModelScope.launch {
            val result = repository.voidSale(saleId, reason)
            result.onSuccess {
                onComplete()
            }.onFailure { ex ->
                _checkoutState.update { it.copy(userErrorMessage = ex.message) }
            }
        }
    }

    // CREATE NEW PIGMENT
    fun createPigment(
        name: String,
        colorHex: String,
        finishType: String,
        initialGrams: Double,
        initialCostDollars: Double,
        retailPricePerGramDollars: Double = 2.50,
        wholesalePricePerGramDollars: Double = 1.50
    ) {
        val stockMg = (initialGrams * 1000).toLong()
        val totalCostCents = (initialCostDollars * 100).toLong()
        val retailCentsPerGram = (retailPricePerGramDollars * 100).toLong()
        val wholesaleCentsPerGram = (wholesalePricePerGramDollars * 100).toLong()

        viewModelScope.launch {
            repository.addPigment(
                Pigment(
                    name = name,
                    color_code = colorHex,
                    finish_type = finishType,
                    stock_mg = stockMg,
                    total_cost_cents = totalCostCents,
                    retail_price_per_gram_cents = retailCentsPerGram,
                    wholesale_price_per_gram_cents = wholesaleCentsPerGram
                )
            )
        }
    }

    // UPDATE PIGMENT PRICING (retail + wholesale per-gram sale prices, audit-logged)
    fun updatePigmentPrices(pigmentId: Long, retailPricePerGramDollars: Double, wholesalePricePerGramDollars: Double) {
        viewModelScope.launch {
            repository.updatePigmentPricing(
                pigmentId = pigmentId,
                retailPricePerGramCents = (retailPricePerGramDollars * 100).toLong(),
                wholesalePricePerGramCents = (wholesalePricePerGramDollars * 100).toLong()
            )
        }
    }

    // CREATE NEW CUSTOMER
    fun createCustomer(name: String, phone: String, creditLimitDollars: Double, trustStatus: String) {
        val limitCents = (creditLimitDollars * 100).toLong()
        viewModelScope.launch {
            repository.addCustomer(
                Customer(
                    name = name,
                    phone = phone,
                    credit_limit_cents = limitCents,
                    trust_status = trustStatus
                )
            )
        }
    }

    suspend fun getAlreadyReturnedMg(saleItemId: Long): Long = repository.getAlreadyReturnedMg(saleItemId)

    fun getPaymentsForSale(saleId: Long): Flow<List<SalePayment>> = repository.getPaymentsForSale(saleId)
    fun getItemsForSale(saleId: Long): Flow<List<SaleItem>> = repository.getItemsForSale(saleId)
}
