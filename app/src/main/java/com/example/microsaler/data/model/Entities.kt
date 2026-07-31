package com.example.microsaler.data.model

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

object TrustStatus {
    const val GOOD_STANDING = "GOOD_STANDING"
    const val PAUSED = "PAUSED"
    const val VIP = "VIP"
}

object SaleStatus {
    const val COMPLETED = "COMPLETED"
    const val VOIDED = "VOIDED"
    const val REFUNDED = "REFUNDED"
}

object PaymentType {
    const val CASH = "CASH"
    const val DIGITAL = "DIGITAL"
    const val HOUSE_TAB = "HOUSE_TAB"
}

@Entity(tableName = "pigments")
data class Pigment(
    @PrimaryKey(autoGenerate = true) val pigment_id: Long = 0,
    val name: String,
    val color_code: String, // Hex e.g. "#FFD700"
    val finish_type: String, // e.g., "Mica Pearl", "Chameleon", "Metallic", "Matte Powder", "Satin"
    val stock_mg: Long, // INTEGER, milligrams
    val total_cost_cents: Long, // INTEGER, cumulative cost cents of current stock
    val default_pkg_cents: Long = 35, // INTEGER, default packaging cost 35 cents
    val retail_price_per_gram_cents: Long = 250, // INTEGER, retail sale price per gram in cents (default $2.50/g)
    val wholesale_price_per_gram_cents: Long = 150, // INTEGER, wholesale/bulk sale price per gram in cents (default $1.50/g)
    val is_archived: Boolean = false
) {
    // Derived WAC (Weighted Average Cost) per mg in cents
    val costPerMgCents: Double
        get() = if (stock_mg > 0) total_cost_cents.toDouble() / stock_mg else 0.0

    // Derived cost per gram in cents
    val costPerGramCents: Long
        get() = (costPerMgCents * 1000).toLong()

    val stockGrams: Double
        get() = stock_mg / 1000.0
}

@Entity(tableName = "stock_receipts")
data class StockReceipt(
    @PrimaryKey(autoGenerate = true) val receipt_id: Long = 0,
    val pigment_id: Long,
    val received_mg: Long,
    val total_cost_cents: Long,
    val supplier_name: String,
    val received_at: Long = System.currentTimeMillis()
)

@Entity(tableName = "customers")
data class Customer(
    @PrimaryKey(autoGenerate = true) val customer_id: Long = 0,
    val name: String,
    val phone: String,
    val credit_limit_cents: Long = 2500, // default $25.00
    val current_balance_cents: Long = 0,
    val trust_status: String = TrustStatus.GOOD_STANDING // GOOD_STANDING / PAUSED / VIP
) {
    val availableCreditCents: Long
        get() = (credit_limit_cents - current_balance_cents).coerceAtLeast(0)
}

@Entity(tableName = "sales")
data class Sale(
    @PrimaryKey(autoGenerate = true) val sale_id: Long = 0,
    val customer_id: Long? = null, // null means walk-in
    val total_amount_cents: Long,
    val total_cogs_cents: Long,
    val status: String = SaleStatus.COMPLETED, // COMPLETED / VOIDED / REFUNDED
    val is_credit_override: Boolean = false,
    val created_at: Long = System.currentTimeMillis()
)

@Entity(
    tableName = "sale_payments",
    foreignKeys = [
        ForeignKey(
            entity = Sale::class,
            parentColumns = ["sale_id"],
            childColumns = ["sale_id"],
            onDelete = ForeignKey.NO_ACTION
        )
    ],
    indices = [
        Index("sale_id")
    ]
)
data class SalePayment(
    @PrimaryKey(autoGenerate = true) val payment_id: Long = 0,
    val sale_id: Long,
    val payment_type: String, // CASH / DIGITAL / HOUSE_TAB
    val digital_provider: String? = null, // e.g. "Square", "Venmo", "Zelle", "PayPal"
    val amount_cents: Long,
    val merchant_fee_cents: Long = 0
)

@Entity(
    tableName = "sale_items",
    foreignKeys = [
        ForeignKey(
            entity = Sale::class,
            parentColumns = ["sale_id"],
            childColumns = ["sale_id"],
            onDelete = ForeignKey.NO_ACTION
        ),
        ForeignKey(
            entity = Pigment::class,
            parentColumns = ["pigment_id"],
            childColumns = ["pigment_id"],
            onDelete = ForeignKey.NO_ACTION
        )
    ],
    indices = [
        Index("sale_id"),
        Index("pigment_id")
    ]
)
data class SaleItem(
    @PrimaryKey(autoGenerate = true) val sale_item_id: Long = 0,
    val sale_id: Long,
    val pigment_id: Long,
    val weight_mg: Long,
    val price_charged_cents: Long,
    val unit_cogs_cents: Long
)

@Entity(
    tableName = "returns",
    foreignKeys = [
        ForeignKey(
            entity = SaleItem::class,
            parentColumns = ["sale_item_id"],
            childColumns = ["sale_item_id"],
            onDelete = ForeignKey.NO_ACTION
        )
    ],
    indices = [
        Index("sale_item_id")
    ]
)
data class ReturnRecord(
    @PrimaryKey(autoGenerate = true) val return_id: Long = 0,
    val sale_item_id: Long,
    val mg_returned: Long,
    val refund_amount_cents: Long,
    val restock_to_inventory: Boolean,
    val reason: String,
    val created_at: Long = System.currentTimeMillis()
)

@Entity(tableName = "tab_payments")
data class TabPayment(
    @PrimaryKey(autoGenerate = true) val payment_id: Long = 0,
    val customer_id: Long,
    val amount_paid_cents: Long,
    val payment_type: String, // CASH / DIGITAL
    val digital_provider: String? = null,
    val created_at: Long = System.currentTimeMillis()
)

@Entity(tableName = "shrinkage_logs")
data class ShrinkageLog(
    @PrimaryKey(autoGenerate = true) val log_id: Long = 0,
    val pigment_id: Long,
    val mg_lost: Long,
    val cogs_loss_cents: Long,
    val reason: String,
    val created_at: Long = System.currentTimeMillis()
)

@Entity(tableName = "audit_log")
data class AuditLog(
    @PrimaryKey(autoGenerate = true) val audit_id: Long = 0,
    val entity_type: String,
    val entity_id: Long,
    val action: String,
    val details: String, // JSON string
    val timestamp: Long = System.currentTimeMillis()
)
