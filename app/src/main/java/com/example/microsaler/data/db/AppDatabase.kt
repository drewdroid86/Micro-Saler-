package com.example.microsaler.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.example.microsaler.data.dao.*
import com.example.microsaler.data.model.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
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
    version = 3,
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

        fun getDatabase(context: Context, scope: CoroutineScope): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "micro_saler_database"
                )
                .addCallback(DatabaseCallback(scope))
                .fallbackToDestructiveMigration()
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
