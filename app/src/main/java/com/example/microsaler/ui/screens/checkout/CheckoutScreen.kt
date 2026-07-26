package com.example.microsaler.ui.screens.checkout

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.microsaler.data.model.Customer
import com.example.microsaler.data.model.Pigment
import com.example.microsaler.data.model.SalePayment
import com.example.microsaler.ui.components.ColorSwatchBox
import com.example.microsaler.ui.components.CurrencyAndWeightFormatter
import com.example.microsaler.ui.components.TrustStatusBadge
import com.example.microsaler.ui.viewmodel.CheckoutUiState
import com.example.microsaler.ui.viewmodel.PosViewModel
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    viewModel: PosViewModel,
    pigments: List<Pigment>,
    customers: List<Customer>,
    uiState: CheckoutUiState
) {
    var showCustomerPicker by remember { mutableStateOf(false) }
    var showCustomWeightDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MarketBackground)
    ) {
        // Customer Selection Banner
        CustomerSelectionHeader(
            selectedCustomer = uiState.selectedCustomer,
            onOpenPicker = { showCustomerPicker = true },
            onClearCustomer = { viewModel.selectCustomer(null) }
        )

        // Error Banner if any
        uiState.userErrorMessage?.let { error ->
            Surface(
                color = MarketError,
                contentColor = MarketSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = error, style = MaterialTheme.typography.bodyMedium, color = MarketSurface)
                    IconButton(onClick = { viewModel.clearErrorMessage() }) {
                        Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = MarketSurface)
                    }
                }
            }
        }

        // Success Alert if completed
        uiState.lastSuccessSaleId?.let { saleId ->
            Surface(
                color = MarketSuccess,
                contentColor = MarketSurface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Sale #$saleId completed successfully!",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = MarketSurface
                    )
                    IconButton(onClick = { viewModel.clearSuccessMessage() }) {
                        Icon(Icons.Default.Close, contentDescription = "Dismiss", tint = MarketSurface)
                    }
                }
            }
        }

        // Main Grid & Cart Area
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(8.dp)
        ) {
            // Pigment Swatch Grid
            Text(
                text = "PIGMENT POWDERS (TAP TO SELECT)",
                style = MaterialTheme.typography.labelSmall,
                color = MarketTextSecondary,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 4.dp)
            )

            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(pigments) { pigment ->
                    val isSelected = uiState.selectedPigment?.pigment_id == pigment.pigment_id
                    PigmentGridCard(
                        pigment = pigment,
                        isSelected = isSelected,
                        onClick = { viewModel.selectPigment(pigment) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Quick Weight Presets Bar
            Text(
                text = "QUICK WEIGHT PRESETS",
                style = MaterialTheme.typography.labelSmall,
                color = MarketTextSecondary,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                val presets = listOf(
                    "1g" to 1000L,
                    "5g" to 5000L,
                    "10g" to 10000L,
                    "1oz" to 28350L,
                    "4oz" to 113398L
                )

                presets.forEach { (label, weightMg) ->
                    Button(
                        onClick = { viewModel.addWeightToSelectedPigment(weightMg) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MarketSurface,
                            contentColor = MarketTextPrimary
                        ),
                        border = BorderStroke(1.dp, MarketBorder),
                        shape = RoundedCornerShape(12.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .testTag("preset_weight_$label")
                    ) {
                        Text(text = label, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }

                Button(
                    onClick = { showCustomWeightDialog = true },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MarketSurfaceVariant,
                        contentColor = MarketGreenPrimary
                    ),
                    border = BorderStroke(1.dp, MarketGreenPrimary),
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 12.dp),
                    modifier = Modifier.testTag("custom_weight_btn")
                ) {
                    Icon(Icons.Default.Scale, contentDescription = "Custom Weight", modifier = Modifier.size(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Cart Summary Box
            Card(
                colors = CardDefaults.cardColors(containerColor = MarketSurface),
                border = BorderStroke(1.dp, MarketBorder),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "CURRENT CART (${uiState.cartItems.size} items)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MarketTextSecondary
                        )
                        if (uiState.cartItems.isNotEmpty()) {
                            Text(
                                text = "Clear",
                                style = MaterialTheme.typography.labelSmall,
                                color = MarketError,
                                modifier = Modifier
                                    .clickable { viewModel.clearCart() }
                                    .padding(4.dp)
                            )
                        }
                    }

                    if (uiState.cartItems.isEmpty()) {
                        Text(
                            text = "Select a pigment above and tap a weight preset to weigh out.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MarketTextSecondary,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 120.dp)
                        ) {
                            itemsIndexed(uiState.cartItems) { index, item ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        ColorSwatchBox(
                                            colorHex = item.pigment.color_code,
                                            modifier = Modifier.size(16.dp)
                                        )
                                        Text(
                                            text = "${item.pigment.name} (${CurrencyAndWeightFormatter.formatMgToGrams(item.weight_mg)})",
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }

                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Text(
                                            text = CurrencyAndWeightFormatter.formatCents(item.price_charged_cents),
                                            style = MaterialTheme.typography.bodyLarge,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Icon(
                                            imageVector = Icons.Default.DeleteOutline,
                                            contentDescription = "Remove item",
                                            tint = MarketError,
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clickable { viewModel.removeCartItem(index) }
                                        )
                                    }
                                }
                            }
                        }

                        Divider(modifier = Modifier.padding(vertical = 6.dp), color = MarketBorderLight)

                        // Live Running Margin Display
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Revenue: ${CurrencyAndWeightFormatter.formatCents(uiState.totalAmountCents)} | COGS: ${CurrencyAndWeightFormatter.formatCents(uiState.totalCogsCents)}",
                                style = MaterialTheme.typography.bodyMedium,
                                fontSize = 12.sp
                            )
                            Text(
                                text = "Est. Margin: +${CurrencyAndWeightFormatter.formatCents(uiState.estimatedMarginCents)}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MarketSuccess,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }

        // Bottom Action Panel (1-Tap CASH vs Drawer options)
        Surface(
            color = MarketSurfaceVariant,
            tonalElevation = 8.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "TOTAL SALE",
                            style = MaterialTheme.typography.labelSmall,
                            color = MarketTextSecondary
                        )
                        Text(
                            text = CurrencyAndWeightFormatter.formatCents(uiState.totalAmountCents),
                            style = MaterialTheme.typography.displayLarge,
                            fontSize = 32.sp
                        )
                    }

                    // FASTEST PATH: 1-Tap COLLECT CASH Button
                    Button(
                        onClick = { viewModel.quickCollectCash() },
                        enabled = uiState.cartItems.isNotEmpty(),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MarketGreenPrimary,
                            contentColor = MarketSurface
                        ),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .height(56.dp)
                            .testTag("collect_cash_button")
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(Icons.Default.Payments, contentDescription = "Collect Cash")
                            Text(
                                text = "COLLECT CASH",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Black,
                                color = MarketSurface
                            )
                        }
                    }
                }

                // Secondary Payment Methods Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    TextButton(
                        onClick = { viewModel.setPaymentDrawerOpen(true) },
                        enabled = uiState.cartItems.isNotEmpty(),
                        modifier = Modifier.testTag("payment_drawer_button")
                    ) {
                        Icon(Icons.Default.CreditCard, contentDescription = "Digital", modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Digital / House Tab / Split Payment", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // Customer Picker Dialog
    if (showCustomerPicker) {
        CustomerPickerDialog(
            customers = customers,
            onSelect = {
                viewModel.selectCustomer(it)
                showCustomerPicker = false
            },
            onDismiss = { showCustomerPicker = false }
        )
    }

    // Custom Weight Input Dialog
    if (showCustomWeightDialog) {
        CustomWeightDialog(
            selectedPigment = uiState.selectedPigment ?: pigments.firstOrNull(),
            onConfirm = { mg, priceCents ->
                viewModel.addWeightToSelectedPigment(mg, priceCents)
                showCustomWeightDialog = false
            },
            onDismiss = { showCustomWeightDialog = false }
        )
    }

    // Payment Drawer Sheet/Dialog
    if (uiState.activePaymentDrawer) {
        PaymentDrawerDialog(
            uiState = uiState,
            viewModel = viewModel,
            onDismiss = { viewModel.setPaymentDrawerOpen(false) }
        )
    }
}

@Composable
fun CustomerSelectionHeader(
    selectedCustomer: Customer?,
    onOpenPicker: () -> Unit,
    onClearCustomer: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(MarketSurfaceVariant)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            color = MarketSurface,
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, MarketBorder),
            modifier = Modifier
                .clickable { onOpenPicker() }
                .testTag("customer_selector_pill")
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Person, contentDescription = "Customer", tint = MarketGreenPrimary, modifier = Modifier.size(18.dp))
                Text(
                    text = selectedCustomer?.name ?: "Walk-in Customer",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold
                )
                if (selectedCustomer != null) {
                    TrustStatusBadge(status = selectedCustomer.trust_status)
                    if (selectedCustomer.current_balance_cents > 0) {
                        Surface(
                            color = MarketTabBadge,
                            shape = CircleShape
                        ) {
                            Text(
                                text = "Tab: ${CurrencyAndWeightFormatter.formatCents(selectedCustomer.current_balance_cents)}",
                                color = MarketSurface,
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }
                Icon(Icons.Default.ExpandMore, contentDescription = "Change Customer", tint = MarketTextSecondary, modifier = Modifier.size(18.dp))
            }
        }

        if (selectedCustomer != null) {
            IconButton(onClick = onClearCustomer) {
                Icon(Icons.Default.Close, contentDescription = "Switch to Walk-in", tint = MarketTextSecondary)
            }
        }
    }
}

@Composable
fun PigmentGridCard(
    pigment: Pigment,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MarketSurface),
        border = BorderStroke(
            width = if (isSelected) 3.dp else 1.dp,
            color = if (isSelected) MarketGreenPrimary else MarketBorder
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .testTag("pigment_card_${pigment.pigment_id}")
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            ColorSwatchBox(
                colorHex = pigment.color_code,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(36.dp)
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = pigment.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )

                if (isSelected) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Selected",
                        tint = MarketGreenPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = pigment.finish_type,
                    style = MaterialTheme.typography.labelSmall,
                    color = MarketTextSecondary
                )
                Text(
                    text = "${CurrencyAndWeightFormatter.formatMgToGrams(pigment.stock_mg)} in stock",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (pigment.stock_mg < 10000) MarketError else MarketGreenDark,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun CustomerPickerDialog(
    customers: List<Customer>,
    onSelect: (Customer?) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Select Customer", style = MaterialTheme.typography.titleLarge) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                // Walk-in option
                Surface(
                    color = MarketSurfaceVariant,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(null) }
                        .padding(vertical = 4.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.PersonOutline, contentDescription = "Walk-in")
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Walk-in Customer (No Tab)", fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                LazyColumn(modifier = Modifier.heightIn(max = 240.dp)) {
                    items(customers) { customer ->
                        Card(
                            colors = CardDefaults.cardColors(containerColor = MarketSurface),
                            border = BorderStroke(1.dp, MarketBorder),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(customer) }
                                .padding(vertical = 4.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(customer.name, fontWeight = FontWeight.Bold)
                                    Text("Phone: ${customer.phone}", style = MaterialTheme.typography.bodyMedium)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    TrustStatusBadge(status = customer.trust_status)
                                    Text(
                                        text = "Avail. Credit: ${CurrencyAndWeightFormatter.formatCents(customer.availableCreditCents)}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MarketGreenDark
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun CustomWeightDialog(
    selectedPigment: Pigment?,
    onConfirm: (Long, Long?) -> Unit,
    onDismiss: () -> Unit
) {
    var gramsText by remember { mutableStateOf("15") }
    var priceText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Weigh Pigment: ${selectedPigment?.name ?: ""}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = gramsText,
                    onValueChange = { gramsText = it },
                    label = { Text("Weight in Grams") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().testTag("custom_grams_input")
                )

                OutlinedTextField(
                    value = priceText,
                    onValueChange = { priceText = it },
                    label = { Text("Price Charged ($) [Optional override]") },
                    placeholder = { Text("Auto-calculated if blank") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val grams = gramsText.toDoubleOrNull() ?: 0.0
                    val weightMg = (grams * 1000).toLong()
                    val priceCents = priceText.toDoubleOrNull()?.let { (it * 100).toLong() }
                    if (weightMg > 0) {
                        onConfirm(weightMg, priceCents)
                    }
                }
            ) {
                Text("Add to Cart")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun PaymentDrawerDialog(
    uiState: CheckoutUiState,
    viewModel: PosViewModel,
    onDismiss: () -> Unit
) {
    var selectedPaymentMode by remember { mutableStateOf("DIGITAL") } // DIGITAL, HOUSE_TAB, SPLIT
    var digitalProvider by remember { mutableStateOf("Square") }

    // Split state
    var cashSplitText by remember { mutableStateOf("0.00") }
    var digitalSplitText by remember { mutableStateOf("0.00") }
    var tabSplitText by remember { mutableStateOf("0.00") }

    val totalSaleCents = uiState.totalAmountCents
    val customer = uiState.selectedCustomer

    // Calculations for Split Mode
    val cashCents = ((cashSplitText.toDoubleOrNull() ?: 0.0) * 100).toLong()
    val digitalCents = ((digitalSplitText.toDoubleOrNull() ?: 0.0) * 100).toLong()
    val tabCents = ((tabSplitText.toDoubleOrNull() ?: 0.0) * 100).toLong()
    val splitSumCents = cashCents + digitalCents + tabCents
    val remainingCents = totalSaleCents - splitSumCents

    val isReconciled = kotlin.math.abs(remainingCents) <= 1

    // Handshake mode check
    val isTabOverCredit = when (selectedPaymentMode) {
        "HOUSE_TAB" -> customer != null && totalSaleCents > customer.availableCreditCents
        "SPLIT" -> customer != null && tabCents > customer.availableCreditCents
        else -> false
    }

    val canComplete = when (selectedPaymentMode) {
        "DIGITAL" -> true
        "HOUSE_TAB" -> customer != null && (!isTabOverCredit || uiState.isHandshakeOverrideEnabled)
        "SPLIT" -> isReconciled && (tabCents == 0L || (customer != null && (!isTabOverCredit || uiState.isHandshakeOverrideEnabled)))
        else -> false
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column {
                Text("Payment Checkout", fontWeight = FontWeight.Bold)
                Text(
                    text = "Total Due: ${CurrencyAndWeightFormatter.formatCents(totalSaleCents)}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MarketGreenDark,
                    fontWeight = FontWeight.Black
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Mode Select Tabs
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    listOf("DIGITAL", "HOUSE_TAB", "SPLIT").forEach { mode ->
                        FilterChip(
                            selected = selectedPaymentMode == mode,
                            onClick = { selectedPaymentMode = mode },
                            label = { Text(mode.replace("_", " ")) },
                            modifier = Modifier.testTag("pay_mode_$mode")
                        )
                    }
                }

                when (selectedPaymentMode) {
                    "DIGITAL" -> {
                        Text("Select Digital Provider:", style = MaterialTheme.typography.labelSmall)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            listOf("Square", "Venmo", "Zelle", "PayPal").forEach { provider ->
                                FilterChip(
                                    selected = digitalProvider == provider,
                                    onClick = { digitalProvider = provider },
                                    label = { Text(provider) }
                                )
                            }
                        }

                        // Merchant Fee Calculation Preview (e.g., 2.9% + $0.30)
                        val merchantFeeCents = (totalSaleCents * 0.029 + 30).toLong()
                        Surface(
                            color = MarketSurfaceVariant,
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "Digital Merchant Fee: ${CurrencyAndWeightFormatter.formatCents(merchantFeeCents)} (2.9% + $0.30)",
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    "HOUSE_TAB" -> {
                        if (customer == null) {
                            Surface(
                                color = MarketError,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = "⚠️ House Tab requires selecting a named customer first!",
                                    color = MarketSurface,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(10.dp)
                                )
                            }
                        } else {
                            val availCredit = customer.availableCreditCents
                            val exceedsCredit = totalSaleCents > availCredit

                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("Customer: ${customer.name}", fontWeight = FontWeight.Bold)
                                Text("Current Balance: ${CurrencyAndWeightFormatter.formatCents(customer.current_balance_cents)}")
                                Text("Credit Limit: ${CurrencyAndWeightFormatter.formatCents(customer.credit_limit_cents)}")
                                Text(
                                    text = "Available Credit: ${CurrencyAndWeightFormatter.formatCents(availCredit)}",
                                    fontWeight = FontWeight.Bold,
                                    color = if (exceedsCredit) MarketError else MarketSuccess
                                )

                                // RULE 6: Visually Distinct Handshake Mode Credit Override
                                if (exceedsCredit) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Surface(
                                        color = Color(0xFF3E1D00),
                                        border = BorderStroke(2.dp, MarketWarning),
                                        shape = RoundedCornerShape(12.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Column(modifier = Modifier.padding(12.dp)) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                                            ) {
                                                Icon(
                                                    Icons.Default.Security,
                                                    contentDescription = "Warning",
                                                    tint = MarketWarning
                                                )
                                                Text(
                                                    text = "CREDIT LIMIT EXCEEDED",
                                                    color = MarketWarning,
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 14.sp
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = "Tab (${CurrencyAndWeightFormatter.formatCents(totalSaleCents)}) exceeds available limit (${CurrencyAndWeightFormatter.formatCents(availCredit)}). Explicit Handshake Mode authorization required.",
                                                color = Color.White,
                                                style = MaterialTheme.typography.bodyMedium,
                                                fontSize = 12.sp
                                            )
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                modifier = Modifier.fillMaxWidth()
                                            ) {
                                                Text(
                                                    text = "Authorize Handshake Mode",
                                                    color = Color.White,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Switch(
                                                    checked = uiState.isHandshakeOverrideEnabled,
                                                    onCheckedChange = { viewModel.setHandshakeOverride(it) },
                                                    modifier = Modifier.testTag("handshake_override_switch")
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    "SPLIT" -> {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            // Live Running Balance Display Card
                            Surface(
                                color = if (isReconciled) Color(0xFFE8F5E9) else Color(0xFFFFF3E0),
                                border = BorderStroke(1.5.dp, if (isReconciled) MarketSuccess else MarketWarning),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("Sale Total:", fontWeight = FontWeight.Medium)
                                        Text(CurrencyAndWeightFormatter.formatCents(totalSaleCents), fontWeight = FontWeight.Bold)
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text("Split Allocated:", fontWeight = FontWeight.Medium)
                                        Text(CurrencyAndWeightFormatter.formatCents(splitSumCents), fontWeight = FontWeight.Bold)
                                    }
                                    Divider(modifier = Modifier.padding(vertical = 4.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("REMAINING TO COLLECT:", fontWeight = FontWeight.Black)
                                        Text(
                                            text = if (remainingCents >= 0) CurrencyAndWeightFormatter.formatCents(remainingCents) else "Overpaid ${CurrencyAndWeightFormatter.formatCents(-remainingCents)}",
                                            fontWeight = FontWeight.Black,
                                            color = if (isReconciled) MarketSuccess else MarketError,
                                            fontSize = 16.sp
                                        )
                                    }
                                }
                            }

                            // Inputs with quick auto-fill buttons
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                OutlinedTextField(
                                    value = cashSplitText,
                                    onValueChange = { cashSplitText = it },
                                    label = { Text("Cash Portion ($)") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(
                                    onClick = {
                                        val fillCents = (remainingCents + cashCents).coerceAtLeast(0)
                                        cashSplitText = String.format("%.2f", fillCents / 100.0)
                                    }
                                ) {
                                    Text("Fill")
                                }
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                OutlinedTextField(
                                    value = digitalSplitText,
                                    onValueChange = { digitalSplitText = it },
                                    label = { Text("Digital Portion ($)") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(
                                    onClick = {
                                        val fillCents = (remainingCents + digitalCents).coerceAtLeast(0)
                                        digitalSplitText = String.format("%.2f", fillCents / 100.0)
                                    }
                                ) {
                                    Text("Fill")
                                }
                            }

                            if (digitalCents > 0) {
                                val splitFeeCents = (digitalCents * 0.029 + 30).toLong()
                                Text(
                                    text = "Digital Fee on split portion: ${CurrencyAndWeightFormatter.formatCents(splitFeeCents)}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MarketTextSecondary
                                )
                            }

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                OutlinedTextField(
                                    value = tabSplitText,
                                    onValueChange = { tabSplitText = it },
                                    label = { Text("House Tab Portion ($)") },
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(
                                    onClick = {
                                        val fillCents = (remainingCents + tabCents).coerceAtLeast(0)
                                        tabSplitText = String.format("%.2f", fillCents / 100.0)
                                    }
                                ) {
                                    Text("Fill")
                                }
                            }

                            if (tabCents > 0 && customer == null) {
                                Text(
                                    text = "⚠️ Select a named customer to charge House Tab split",
                                    color = MarketError,
                                    style = MaterialTheme.typography.labelSmall,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            if (tabCents > 0 && customer != null && tabCents > customer.availableCreditCents) {
                                Surface(
                                    color = Color(0xFF3E1D00),
                                    border = BorderStroke(1.5.dp, MarketWarning),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(modifier = Modifier.padding(10.dp)) {
                                        Text(
                                            text = "⚠️ TAB SPLIT EXCEEDS CREDIT LIMIT",
                                            color = MarketWarning,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp
                                        )
                                        Text(
                                            text = "Tab portion (${CurrencyAndWeightFormatter.formatCents(tabCents)}) > Available Credit (${CurrencyAndWeightFormatter.formatCents(customer.availableCreditCents)}). Handshake Mode required.",
                                            color = Color.White,
                                            fontSize = 11.sp
                                        )
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text("Authorize Handshake Mode", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                            Switch(
                                                checked = uiState.isHandshakeOverrideEnabled,
                                                onCheckedChange = { viewModel.setHandshakeOverride(it) },
                                                modifier = Modifier.testTag("handshake_override_switch")
                                            )
                                        }
                                    }
                                }
                            }

                            // Explicit blocked mismatch banner if not reconciled
                            if (!isReconciled) {
                                Surface(
                                    color = MarketError,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "⚠️ BLOCKED: Split payments must equal sale total exactly. Adjust entries by ${CurrencyAndWeightFormatter.formatCents(kotlin.math.abs(remainingCents))}.",
                                        color = MarketSurface,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(8.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = canComplete,
                onClick = {
                    when (selectedPaymentMode) {
                        "DIGITAL" -> {
                            val feeCents = (totalSaleCents * 0.029 + 30).toLong()
                            viewModel.processPayment(
                                listOf(
                                    SalePayment(
                                        sale_id = 0,
                                        payment_type = "DIGITAL",
                                        digital_provider = digitalProvider,
                                        amount_cents = totalSaleCents,
                                        merchant_fee_cents = feeCents
                                    )
                                )
                            )
                        }
                        "HOUSE_TAB" -> {
                            viewModel.processPayment(
                                listOf(
                                    SalePayment(
                                        sale_id = 0,
                                        payment_type = "HOUSE_TAB",
                                        amount_cents = totalSaleCents,
                                        merchant_fee_cents = 0
                                    )
                                )
                            )
                        }
                        "SPLIT" -> {
                            val payments = mutableListOf<SalePayment>()
                            if (cashCents > 0) {
                                payments.add(SalePayment(sale_id = 0, payment_type = "CASH", amount_cents = cashCents, merchant_fee_cents = 0))
                            }
                            if (digitalCents > 0) {
                                val fee = (digitalCents * 0.029 + 30).toLong()
                                payments.add(SalePayment(sale_id = 0, payment_type = "DIGITAL", digital_provider = "Square", amount_cents = digitalCents, merchant_fee_cents = fee))
                            }
                            if (tabCents > 0) {
                                payments.add(SalePayment(sale_id = 0, payment_type = "HOUSE_TAB", amount_cents = tabCents, merchant_fee_cents = 0))
                            }

                            viewModel.processPayment(payments)
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary)
            ) {
                Text("Complete Sale")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
