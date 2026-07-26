package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.microsaler.ui.components.MarketTopHeader
import com.example.microsaler.ui.screens.audit.AuditLogScreen
import com.example.microsaler.ui.screens.checkout.CheckoutScreen
import com.example.microsaler.ui.screens.customers.CustomerScreen
import com.example.microsaler.ui.screens.history.SalesHistoryScreen
import com.example.microsaler.ui.screens.inventory.InventoryScreen
import com.example.microsaler.ui.viewmodel.PosViewModel
import com.example.ui.theme.MicroSalerTheme

class MainActivity : ComponentActivity() {

    private val viewModel: PosViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MicroSalerTheme {
                val pigments by viewModel.pigments.collectAsStateWithLifecycle()
                val customers by viewModel.customers.collectAsStateWithLifecycle()
                val sales by viewModel.sales.collectAsStateWithLifecycle()
                val auditLogs by viewModel.auditLogs.collectAsStateWithLifecycle()
                val checkoutState by viewModel.checkoutState.collectAsStateWithLifecycle()

                var currentTab by remember { mutableStateOf("checkout") }

                Scaffold(
                    topBar = {
                        MarketTopHeader(
                            title = "MICRO SALER",
                            currentTab = currentTab,
                            onTabSelected = { currentTab = it }
                        )
                    }
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        when (currentTab) {
                            "checkout" -> CheckoutScreen(
                                viewModel = viewModel,
                                pigments = pigments,
                                customers = customers,
                                uiState = checkoutState
                            )
                            "inventory" -> InventoryScreen(
                                viewModel = viewModel,
                                pigments = pigments
                            )
                            "customers" -> CustomerScreen(
                                viewModel = viewModel,
                                customers = customers
                            )
                            "history" -> SalesHistoryScreen(
                                viewModel = viewModel,
                                sales = sales,
                                customers = customers,
                                pigments = pigments
                            )
                            "audit" -> AuditLogScreen(
                                auditLogs = auditLogs
                            )
                        }
                    }
                }
            }
        }
    }
}
