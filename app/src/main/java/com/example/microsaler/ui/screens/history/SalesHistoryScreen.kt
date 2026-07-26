package com.example.microsaler.ui.screens.history

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.AssignmentReturn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.microsaler.data.model.*
import com.example.microsaler.ui.components.CurrencyAndWeightFormatter
import com.example.microsaler.ui.viewmodel.PosViewModel
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun SalesHistoryScreen(
    viewModel: PosViewModel,
    sales: List<Sale>,
    customers: List<Customer>,
    pigments: List<Pigment>
) {
    var saleToVoid by remember { mutableStateOf<Sale?>(null) }
    var selectedSaleItemForReturn by remember { mutableStateOf<Pair<Sale, SaleItem>?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MarketBackground)
            .padding(12.dp)
    ) {
        Text(
            text = "SALES TRANSACTION HISTORY",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        if (sales.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text("No sales transactions yet.", color = MarketTextSecondary)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(sales) { sale ->
                    val customer = customers.find { it.customer_id == sale.customer_id }
                    SaleCard(
                        sale = sale,
                        customer = customer,
                        pigments = pigments,
                        viewModel = viewModel,
                        onVoidClick = { saleToVoid = sale },
                        onReturnClick = { saleItem ->
                            selectedSaleItemForReturn = Pair(sale, saleItem)
                        }
                    )
                }
            }
        }
    }

    // Void Sale Dialog
    saleToVoid?.let { sale ->
        VoidSaleDialog(
            sale = sale,
            onConfirm = { reason ->
                viewModel.voidSale(sale.sale_id, reason) {
                    saleToVoid = null
                }
            },
            onDismiss = { saleToVoid = null }
        )
    }

    // Return Item Dialog
    selectedSaleItemForReturn?.let { (sale, saleItem) ->
        val pigment = pigments.find { it.pigment_id == saleItem.pigment_id }
        ProcessReturnDialog(
            saleItem = saleItem,
            pigmentName = pigment?.name ?: "Pigment",
            viewModel = viewModel,
            onConfirm = { grams, refundDollars, restock, reason ->
                viewModel.processReturn(saleItem.sale_item_id, grams, refundDollars, restock, reason) {
                    selectedSaleItemForReturn = null
                }
            },
            onDismiss = { selectedSaleItemForReturn = null }
        )
    }
}

@Composable
fun SaleCard(
    sale: Sale,
    customer: Customer?,
    pigments: List<Pigment>,
    viewModel: PosViewModel,
    onVoidClick: () -> Unit,
    onReturnClick: (SaleItem) -> Unit
) {
    val items by viewModel.getItemsForSale(sale.sale_id).collectAsState(initial = emptyList())
    val payments by viewModel.getPaymentsForSale(sale.sale_id).collectAsState(initial = emptyList())

    val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.US)

    Card(
        colors = CardDefaults.cardColors(containerColor = MarketSurface),
        border = BorderStroke(1.dp, if (sale.status == "VOIDED") MarketError else MarketBorder),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Sale #${sale.sale_id} (${customer?.name ?: "Walk-in"})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = dateFormat.format(Date(sale.created_at)),
                        style = MaterialTheme.typography.labelSmall,
                        color = MarketTextSecondary
                    )
                }

                Surface(
                    color = when (sale.status) {
                        "VOIDED" -> MarketError
                        "REFUNDED" -> MarketWarning
                        else -> MarketGreenPrimary
                    },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = sale.status,
                        color = MarketSurface,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Line items
            items.forEach { item ->
                val pigment = pigments.find { it.pigment_id == item.pigment_id }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${pigment?.name ?: "Pigment"} - ${CurrencyAndWeightFormatter.formatMgToGrams(item.weight_mg)}",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = CurrencyAndWeightFormatter.formatCents(item.price_charged_cents),
                            fontWeight = FontWeight.Bold
                        )
                        if (sale.status == "COMPLETED") {
                            IconButton(onClick = { onReturnClick(item) }, modifier = Modifier.size(28.dp)) {
                                Icon(Icons.Default.AssignmentReturn, contentDescription = "Return Item", tint = MarketGreenPrimary, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }

            Divider(modifier = Modifier.padding(vertical = 6.dp), color = MarketBorderLight)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Total: ${CurrencyAndWeightFormatter.formatCents(sale.total_amount_cents)}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "Payments: " + payments.joinToString(", ") { "${it.payment_type} (${CurrencyAndWeightFormatter.formatCents(it.amount_cents)})" },
                        style = MaterialTheme.typography.labelSmall,
                        color = MarketTextSecondary
                    )
                }

                if (sale.status == "COMPLETED") {
                    OutlinedButton(
                        onClick = onVoidClick,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MarketError),
                        border = BorderStroke(1.dp, MarketError),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.Block, contentDescription = "Void Sale", modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Void Sale", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun VoidSaleDialog(
    sale: Sale,
    onConfirm: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var reason by remember { mutableStateOf("Customer cancelled / Wrong item") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Void Sale #${sale.sale_id}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Voiding this sale will restock all items and log to audit_log.")
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason for Voiding") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm(reason) },
                colors = ButtonDefaults.buttonColors(containerColor = MarketError)
            ) {
                Text("Confirm Void")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun ProcessReturnDialog(
    saleItem: SaleItem,
    pigmentName: String,
    viewModel: PosViewModel,
    onConfirm: (Double, Double, Boolean, String) -> Unit,
    onDismiss: () -> Unit
) {
    var alreadyReturnedMg by remember { mutableStateOf(0L) }
    var isLoaded by remember { mutableStateOf(false) }

    LaunchedEffect(saleItem.sale_item_id) {
        alreadyReturnedMg = viewModel.getAlreadyReturnedMg(saleItem.sale_item_id)
        isLoaded = true
    }

    val originalGrams = saleItem.weight_mg / 1000.0
    val alreadyReturnedGrams = alreadyReturnedMg / 1000.0
    val maxEligibleMg = (saleItem.weight_mg - alreadyReturnedMg).coerceAtLeast(0L)
    val maxEligibleGrams = maxEligibleMg / 1000.0

    var gramsText by remember { mutableStateOf("") }
    LaunchedEffect(isLoaded, maxEligibleGrams) {
        if (isLoaded) {
            gramsText = String.format(Locale.US, "%.1f", maxEligibleGrams)
        }
    }

    val defaultRefundDollars = String.format(Locale.US, "%.2f", saleItem.price_charged_cents / 100.0)
    var refundText by remember { mutableStateOf(defaultRefundDollars) }
    var restockToInventory by remember { mutableStateOf(true) }
    var reason by remember { mutableStateOf("Customer returned powder") }

    val enteredGrams = gramsText.toDoubleOrNull() ?: 0.0
    val isExceeding = enteredGrams > maxEligibleGrams + 0.001 // floating point tolerance
    val canProcess = isLoaded && maxEligibleMg > 0 && enteredGrams > 0 && !isExceeding

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Process Return: $pigmentName") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                // Return Eligibility Summary Box
                Surface(
                    color = MarketSurfaceVariant,
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text("RETURN ELIGIBILITY AUDIT", style = MaterialTheme.typography.labelSmall, color = MarketTextSecondary)
                        Text("Original Sold: ${originalGrams}g", style = MaterialTheme.typography.bodyMedium)
                        Text("Prior Returns: ${alreadyReturnedGrams}g", style = MaterialTheme.typography.bodyMedium, color = MarketWarning)
                        Divider(modifier = Modifier.padding(vertical = 4.dp))
                        Text(
                            text = "MAX ELIGIBLE FOR RETURN: ${maxEligibleGrams}g",
                            fontWeight = FontWeight.Bold,
                            color = if (maxEligibleGrams > 0) MarketGreenDark else MarketError
                        )
                    }
                }

                if (maxEligibleMg <= 0) {
                    Surface(
                        color = MarketError,
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "⚠️ Fully Returned: No remaining weight available to return.",
                            color = MarketSurface,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(8.dp)
                        )
                    }
                } else {
                    OutlinedTextField(
                        value = gramsText,
                        onValueChange = { gramsText = it },
                        label = { Text("Weight Returned (Grams)") },
                        isError = isExceeding,
                        supportingText = {
                            if (isExceeding) {
                                Text("Exceeds max eligible return of ${maxEligibleGrams}g", color = MarketError)
                            } else {
                                Text("Cap: ${maxEligibleGrams}g max")
                            }
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth().testTag("return_grams_input")
                    )

                    OutlinedTextField(
                        value = refundText,
                        onValueChange = { refundText = it },
                        label = { Text("Refund Amount ($)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Restock returned powder to inventory?", fontWeight = FontWeight.Bold)
                        Switch(checked = restockToInventory, onCheckedChange = { restockToInventory = it })
                    }

                    OutlinedTextField(
                        value = reason,
                        onValueChange = { reason = it },
                        label = { Text("Reason for Return") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        },
        confirmButton = {
            Button(
                enabled = canProcess,
                onClick = {
                    val g = gramsText.toDoubleOrNull() ?: 0.0
                    val r = refundText.toDoubleOrNull() ?: 0.0
                    if (g > 0 && g <= maxEligibleGrams) {
                        onConfirm(g, r, restockToInventory, reason)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary)
            ) {
                Text("Process Return")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
