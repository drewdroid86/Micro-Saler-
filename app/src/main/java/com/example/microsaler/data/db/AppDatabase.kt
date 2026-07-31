package com.example.microsaler.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.microsaler.data.dao.*
import com.example.microsaler.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@Database(
    entities = [
        Pigment::class,
        StockReceipt::class,
        Customer::class,
        Sale::class,
        SalePayment::class,
        SaleItem::class,
        ReturnRecord::class,
        TabPayment::class,
        ShrinkageLog::class,
        AuditLog::class
    ],
    version = 4,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun pigmentDao(): PigmentDao
    abstract fun stockReceiptDao(): StockReceiptDao
    abstract fun customerDao(): CustomerDao
    abstract fun saleDao(): SaleDao
    abstract fun salePaymentDao(): SalePaymentDao
    abstract fun saleItemDao(): SaleItemDao
    abstract fun returnDao(): ReturnDao
    abstract fun tabPaymentDao(): TabPaymentDao
    abstract fun shrinkageLogDao(): ShrinkageLogDao
    abstract fun auditLogDao(): AuditLogDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        // BUG-8 fix: seeding must survive whichever ViewModel happened to trigger DB creation
        // being cleared. A SupervisorJob-backed application scope is not tied to any
        // ViewModel's lifecycle, so seeding always completes even if the caller's
        // viewModelScope is cancelled first.
        private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // --- 1. sale_payments ---
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `sale_payments_new` (
                        `payment_id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `sale_id` INTEGER NOT NULL,
                        `payment_type` TEXT NOT NULL,
                        `digital_provider` TEXT,
                        `amount_cents` INTEGER NOT NULL,
                        `merchant_fee_cents` INTEGER NOT NULL,
                        FOREIGN KEY(`sale_id`) REFERENCES `sales`(`sale_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT INTO `sale_payments_new` (`payment_id`, `sale_id`, `payment_type`, `digital_provider`, `amount_cents`, `merchant_fee_cents`)
                    SELECT `payment_id`, `sale_id`, `payment_type`, `digital_provider`, `amount_cents`, `merchant_fee_cents` FROM `sale_payments`
                """.trimIndent())
                db.execSQL("DROP TABLE `sale_payments`")
                db.execSQL("ALTER TABLE `sale_payments_new` RENAME TO `sale_payments`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_sale_payments_sale_id` ON `sale_payments` (`sale_id`)")

                // --- 2. sale_items ---
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `sale_items_new` (
                        `sale_item_id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `sale_id` INTEGER NOT NULL,
                        `pigment_id` INTEGER NOT NULL,
                        `weight_mg` INTEGER NOT NULL,
                        `price_charged_cents` INTEGER NOT NULL,
                        `unit_cogs_cents` INTEGER NOT NULL,
                        FOREIGN KEY(`sale_id`) REFERENCES `sales`(`sale_id`) ON UPDATE NO ACTION ON DELETE NO ACTION,
                        FOREIGN KEY(`pigment_id`) REFERENCES `pigments`(`pigment_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT INTO `sale_items_new` (`sale_item_id`, `sale_id`, `pigment_id`, `weight_mg`, `price_charged_cents`, `unit_cogs_cents`)
                    SELECT `sale_item_id`, `sale_id`, `pigment_id`, `weight_mg`, `price_charged_cents`, `unit_cogs_cents` FROM `sale_items`
                """.trimIndent())
                db.execSQL("DROP TABLE `sale_items`")
                db.execSQL("ALTER TABLE `sale_items_new` RENAME TO `sale_items`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_sale_items_sale_id` ON `sale_items` (`sale_id`)")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_sale_items_pigment_id` ON `sale_items` (`pigment_id`)")

                // --- 3. returns ---
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS `returns_new` (
                        `return_id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        `sale_item_id` INTEGER NOT NULL,
                        `mg_returned` INTEGER NOT NULL,
                        `refund_amount_cents` INTEGER NOT NULL,
                        `restock_to_inventory` INTEGER NOT NULL,
                        `reason` TEXT NOT NULL,
                        `created_at` INTEGER NOT NULL,
                        FOREIGN KEY(`sale_item_id`) REFERENCES `sale_items`(`sale_item_id`) ON UPDATE NO ACTION ON DELETE NO ACTION
                    )
                """.trimIndent())
                db.execSQL("""
                    INSERT INTO `returns_new` (`return_id`, `sale_item_id`, `mg_returned`, `refund_amount_cents`, `restock_to_inventory`, `reason`, `created_at`)
                    SELECT `return_id`, `sale_item_id`, `mg_returned`, `refund_amount_cents`, `restock_to_inventory`, `reason`, `created_at` FROM `returns`
                """.trimIndent())
                db.execSQL("DROP TABLE `returns`")
                db.execSQL("ALTER TABLE `returns_new` RENAME TO `returns`")
                db.execSQL("CREATE INDEX IF NOT EXISTS `index_returns_sale_item_id` ON `returns` (`sale_item_id`)")
            }
        }

        fun getDatabase(context: Context, scope: CoroutineScope): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "micro_saler_database"
                )
                .addCallback(DatabaseCallback(appScope))
                .addMigrations(MIGRATION_3_4)
                .build()
                INSTANCE = instance
                instance
            }
        }

        private class DatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        populateInitialData(database)
                    }
                }
            }

            suspend fun populateInitialData(db: AppDatabase) {
                val pigmentDao = db.pigmentDao()
                val customerDao = db.customerDao()

                // Initial Pigment Powders (stock in mg, total cost in cents)
                // 1g = 1000mg. E.g. 100g = 100,000mg.
                val samplePigments = listOf(
                    Pigment(
                        name = "Super Gold",
                        color_code = "#FFD700",
                        finish_type = "Metallic",
                        stock_mg = 84500, // 84.5g
                        total_cost_cents = 3481, // ~$0.0412/g ($4.12 per 100g)
                        default_pkg_cents = 35
                    ),
                    Pigment(
                        name = "Deep Sea Blue",
                        color_code = "#4169E1",
                        finish_type = "Mica Pearl",
                        stock_mg = 112000, // 112g
                        total_cost_cents = 4256, // ~$0.038/g
                        default_pkg_cents = 35
                    ),
                    Pigment(
                        name = "Ruby Spark",
                        color_code = "#E0115F",
                        finish_type = "Chameleon",
                        stock_mg = 45200, // 45.2g
                        total_cost_cents = 2260, // ~$0.05/g
                        default_pkg_cents = 35
                    ),
                    Pigment(
                        name = "Lavender Satin",
                        color_code = "#E6E6FA",
                        finish_type = "Satin",
                        stock_mg = 200000, // 200g
                        total_cost_cents = 6000, // ~$0.03/g
                        default_pkg_cents = 35
                    ),
                    Pigment(
                        name = "Emerald Sheen",
                        color_code = "#50C878",
                        finish_type = "Mica Pearl",
                        stock_mg = 95000, // 95g
                        total_cost_cents = 3990, // ~$0.042/g
                        default_pkg_cents = 35
                    ),
                    Pigment(
                        name = "Copper Dust",
                        color_code = "#B87333",
                        finish_type = "Matte Powder",
                        stock_mg = 150000, // 150g
                        total_cost_cents = 5250, // ~$0.035/g
                        default_pkg_cents = 35
                    )
                )

                samplePigments.forEach { pigmentDao.insertPigment(it) }

                // Initial Customers
                val sampleCustomers = listOf(
                    Customer(
                        name = "Sarah Jenkins (Resin Crafts)",
                        phone = "555-0192",
                        credit_limit_cents = 5000, // $50.00
                        current_balance_cents = 1250, // $12.50 tab
                        trust_status = "GOOD_STANDING"
                    ),
                    Customer(
                        name = "Marcus Vance",
                        phone = "555-0148",
                        credit_limit_cents = 2500, // $25.00
                        current_balance_cents = 0,
                        trust_status = "VIP"
                    ),
                    Customer(
                        name = "Elena Rostova",
                        phone = "555-0173",
                        credit_limit_cents = 2500, // $25.00
                        current_balance_cents = 2100, // $21.00 tab
                        trust_status = "PAUSED"
                    )
                )

                sampleCustomers.forEach { customerDao.insertCustomer(it) }
            }
        }
    }
}
