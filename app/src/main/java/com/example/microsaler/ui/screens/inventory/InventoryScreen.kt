package com.example.microsaler.ui.screens.inventory

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import java.util.Locale
import com.example.microsaler.data.model.Pigment
import com.example.microsaler.data.model.Sale
import com.example.microsaler.data.model.SaleItem
import com.example.microsaler.ui.components.ColorSwatchBox
import com.example.microsaler.ui.components.CurrencyAndWeightFormatter
import com.example.microsaler.ui.viewmodel.PosViewModel
import com.example.ui.theme.*

@Composable
fun InventoryScreen(
    viewModel: PosViewModel,
    pigments: List<Pigment>
) {
    var pigmentToRestock by remember { mutableStateOf<Pigment?>(null) }
    var pigmentForShrinkage by remember { mutableStateOf<Pigment?>(null) }
    var showAddPigmentDialog by remember { mutableStateOf(false) }

    val sales by viewModel.sales.collectAsState()
    val allSaleItems by viewModel.allSaleItems.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MarketBackground)
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "INVENTORY MANAGEMENT",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Button(
                onClick = { showAddPigmentDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.testTag("add_pigment_btn")
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Pigment")
                Spacer(modifier = Modifier.width(4.dp))
                Text("New Pigment")
            }
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            item {
                PigmentCostVsRevenueChart(
                    pigments = pigments,
                    sales = sales,
                    allSaleItems = allSaleItems
                )
            }

            items(pigments) { pigment ->
                PigmentInventoryCard(
                    pigment = pigment,
                    onRestockClick = { pigmentToRestock = pigment },
                    onShrinkageClick = { pigmentForShrinkage = pigment }
                )
            }
        }
    }

    // Restock Dialog with Live Blended Cost Preview
    pigmentToRestock?.let { pigment ->
        RestockDialog(
            pigment = pigment,
            onConfirm = { grams, costDollars, supplier ->
                viewModel.restockPigment(pigment.pigment_id, grams, costDollars, supplier) {
                    pigmentToRestock = null
                }
            },
            onDismiss = { pigmentToRestock = null }
        )
    }

    // Shrinkage Quick-Log Dialog
    pigmentForShrinkage?.let { pigment ->
        ShrinkageLogDialog(
            pigment = pigment,
            onConfirm = { gramsLost, reason ->
                viewModel.logShrinkage(pigment.pigment_id, gramsLost, reason) {
                    pigmentForShrinkage = null
                }
            },
            onDismiss = { pigmentForShrinkage = null }
        )
    }

    // Add Pigment Dialog
    if (showAddPigmentDialog) {
        AddPigmentDialog(
            onConfirm = { name, colorHex, finish, grams, costDollars ->
                viewModel.createPigment(name, colorHex, finish, grams, costDollars)
                showAddPigmentDialog = false
            },
            onDismiss = { showAddPigmentDialog = false }
        )
    }
}

@Composable
fun PigmentInventoryCard(
    pigment: Pigment,
    onRestockClick: () -> Unit,
    onShrinkageClick: () -> Unit
) {
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
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    ColorSwatchBox(colorHex = pigment.color_code, modifier = Modifier.size(28.dp))
                    Column {
                        Text(pigment.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text(pigment.finish_type, style = MaterialTheme.typography.labelSmall, color = MarketTextSecondary)
                    }
                }

                Surface(
                    color = MarketSurfaceVariant,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "WAC Cost: $${String.format("%.3f", pigment.costPerGramCents / 100.0)}/g",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MarketGreenDark,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("Current Stock:", style = MaterialTheme.typography.bodyMedium)
                    Text(
                        text = CurrencyAndWeightFormatter.formatMgToGrams(pigment.stock_mg),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Black,
                        color = if (pigment.stock_mg < 10000) MarketError else MarketTextPrimary
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = onShrinkageClick,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MarketError),
                        border = BorderStroke(1.dp, MarketError),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Shrinkage", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Spillage")
                    }

                    Button(
                        onClick = onRestockClick,
                        colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.AddShoppingCart, contentDescription = "Restock", modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Restock")
                    }
                }
            }
        }
    }
}

@Composable
fun RestockDialog(
    pigment: Pigment,
    onConfirm: (Double, Double, String) -> Unit,
    onDismiss: () -> Unit
) {
    var gramsText by remember { mutableStateOf("100") }
    var costText by remember { mutableStateOf("4.50") }
    var supplierText by remember { mutableStateOf("Colorant Supply Co.") }

    val receivedGrams = gramsText.toDoubleOrNull() ?: 0.0
    val totalCostDollars = costText.toDoubleOrNull() ?: 0.0

    val currentWacDollars = pigment.costPerGramCents / 100.0
    val batchUnitCostDollars = if (receivedGrams > 0) totalCostDollars / receivedGrams else 0.0

    // Live Blended WAC Cost Preview
    val newTotalStockGrams = pigment.stockGrams + receivedGrams
    val newTotalCostCents = pigment.total_cost_cents + (totalCostDollars * 100).toLong()
    val newBlendedCostPerGramDollars = if (newTotalStockGrams > 0) {
        (newTotalCostCents / 100.0) / newTotalStockGrams
    } else 0.0

    // Standard retail reference price ($35 per 15g = $2.333/g)
    val standardRetailPerGram = 35.0 / 15.0
    val projectedMarginPct = if (standardRetailPerGram > 0 && newBlendedCostPerGramDollars > 0) {
        ((standardRetailPerGram - newBlendedCostPerGramDollars) / standardRetailPerGram) * 100.0
    } else 0.0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Restock Pigment: ${pigment.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = gramsText,
                    onValueChange = { gramsText = it },
                    label = { Text("Received Weight (Grams)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().testTag("restock_grams_input")
                )

                OutlinedTextField(
                    value = costText,
                    onValueChange = { costText = it },
                    label = { Text("Total Batch Cost ($)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().testTag("restock_cost_input")
                )

                OutlinedTextField(
                    value = supplierText,
                    onValueChange = { supplierText = it },
                    label = { Text("Supplier Name") },
                    modifier = Modifier.fillMaxWidth()
                )

                // High-Contrast Live Preview Card
                Surface(
                    color = Color(0xFFE8F5E9),
                    border = BorderStroke(1.5.dp, MarketGreenPrimary),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "LIVE COST BASIS (WAC) PREVIEW",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MarketGreenDark
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Batch Unit Cost:", fontSize = 12.sp)
                            Text("$${String.format(Locale.US, "%.3f", batchUnitCostDollars)}/g", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Current Stock WAC:", fontSize = 12.sp)
                            Text("$${String.format(Locale.US, "%.3f", currentWacDollars)}/g", fontWeight = FontWeight.Medium, fontSize = 12.sp)
                        }
                        Divider(modifier = Modifier.padding(vertical = 4.dp), color = MarketGreenPrimary.copy(alpha = 0.3f))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("NEW BLENDED WAC:", fontWeight = FontWeight.Black, fontSize = 13.sp)
                            Text(
                                text = "$${String.format(Locale.US, "%.3f", newBlendedCostPerGramDollars)}/g",
                                fontWeight = FontWeight.Black,
                                color = MarketGreenDark,
                                fontSize = 15.sp
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("New Total Stock:", fontSize = 12.sp)
                            Text("${String.format(Locale.US, "%.1f", newTotalStockGrams)}g", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Est. Gross Margin (@ $35/15g):", fontSize = 12.sp)
                            Text("${String.format(Locale.US, "%.1f", projectedMarginPct)}%", fontWeight = FontWeight.Bold, color = MarketGreenDark, fontSize = 12.sp)
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                enabled = receivedGrams > 0 && totalCostDollars >= 0,
                onClick = {
                    if (receivedGrams > 0 && totalCostDollars >= 0) {
                        onConfirm(receivedGrams, totalCostDollars, supplierText)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary)
            ) {
                Text("Confirm Restock")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun ShrinkageLogDialog(
    pigment: Pigment,
    onConfirm: (Double, String) -> Unit,
    onDismiss: () -> Unit
) {
    var gramsText by remember { mutableStateOf("2.5") }
    var reason by remember { mutableStateOf("Spillage") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log Shrinkage: ${pigment.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = gramsText,
                    onValueChange = { gramsText = it },
                    label = { Text("Weight Lost (Grams)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth()
                )

                Text("Reason for Shrinkage:", style = MaterialTheme.typography.labelSmall)
                listOf("Spillage", "Sample/Gift", "Container Residue", "Quality Defect").forEach { r ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp)
                    ) {
                        RadioButton(selected = reason == r, onClick = { reason = r })
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(r)
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val g = gramsText.toDoubleOrNull() ?: 0.0
                    if (g > 0) {
                        onConfirm(g, reason)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MarketError)
            ) {
                Text("Log Shrinkage")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun AddPigmentDialog(
    onConfirm: (String, String, String, Double, Double) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var colorHex by remember { mutableStateOf("#FF9800") }
    var finishType by remember { mutableStateOf("Mica Pearl") }
    var initialGramsText by remember { mutableStateOf("100") }
    var initialCostText by remember { mutableStateOf("4.00") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add New Pigment Powder") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Pigment Name") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = colorHex, onValueChange = { colorHex = it }, label = { Text("Color Hex (e.g. #FF9800)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = finishType, onValueChange = { finishType = it }, label = { Text("Finish Type (Mica, Metallic, etc.)") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = initialGramsText, onValueChange = { initialGramsText = it }, label = { Text("Initial Stock (Grams)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = initialCostText, onValueChange = { initialCostText = it }, label = { Text("Initial Cost ($)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val g = initialGramsText.toDoubleOrNull() ?: 0.0
                    val c = initialCostText.toDoubleOrNull() ?: 0.0
                    if (name.isNotBlank()) {
                        onConfirm(name, colorHex, finishType, g, c)
                    }
                }
            ) {
                Text("Save Pigment")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun PigmentCostVsRevenueChart(
    pigments: List<Pigment>,
    sales: List<Sale>,
    allSaleItems: List<SaleItem>
) {
    if (pigments.isEmpty()) return

    val completedSaleIds = sales.filter { it.status == "COMPLETED" }.map { it.sale_id }.toSet()
    val completedSaleItems = allSaleItems.filter { it.sale_id in completedSaleIds }

    Card(
        colors = CardDefaults.cardColors(containerColor = MarketSurface),
        border = BorderStroke(1.dp, MarketBorder),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .testTag("inventory_bar_chart")
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.BarChart,
                        contentDescription = "Chart",
                        tint = MarketGreenPrimary
                    )
                    Text(
                        text = "TOTAL COST VS. CUMULATIVE REVENUE",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Chart Legend
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(modifier = Modifier.size(12.dp).background(Color(0xFFFF9800), RoundedCornerShape(2.dp)))
                    Text("Batch Cost ($)", style = MaterialTheme.typography.labelSmall)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Box(modifier = Modifier.size(12.dp).background(MarketGreenPrimary, RoundedCornerShape(2.dp)))
                    Text("Cum. Revenue ($)", style = MaterialTheme.typography.labelSmall)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Bars for each pigment batch
            pigments.forEach { pigment ->
                val totalCostCents = pigment.total_cost_cents
                val totalCostDollars = totalCostCents / 100.0

                val revenueCents = completedSaleItems
                    .filter { it.pigment_id == pigment.pigment_id }
                    .sumOf { it.price_charged_cents }
                val revenueDollars = revenueCents / 100.0

                val maxVal = maxOf(totalCostDollars, revenueDollars, 1.0)

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            ColorSwatchBox(colorHex = pigment.color_code, modifier = Modifier.size(16.dp))
                            Text(
                                text = pigment.name,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }

                        val profitDiffCents = revenueCents - totalCostCents
                        val profitStatusText = if (profitDiffCents >= 0) {
                            "+${CurrencyAndWeightFormatter.formatCents(profitDiffCents)} Profit"
                        } else {
                            "-${CurrencyAndWeightFormatter.formatCents(-profitDiffCents)} To ROI"
                        }
                        Text(
                            text = profitStatusText,
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = if (profitDiffCents >= 0) MarketGreenDark else MarketWarning
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))

                    // Bar 1: Batch Cost
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Cost",
                            fontSize = 11.sp,
                            color = MarketTextSecondary,
                            modifier = Modifier.width(52.dp)
                        )
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(16.dp)
                                .background(MarketSurfaceVariant, RoundedCornerShape(4.dp))
                        ) {
                            val costFraction = (totalCostDollars / maxVal).toFloat().coerceIn(0f, 1f)
                            if (costFraction > 0f) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxHeight()
                                        .fillMaxWidth(costFraction)
                                        .background(Color(0xFFFF9800), RoundedCornerShape(4.dp))
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = CurrencyAndWeightFormatter.formatCents(totalCostCents),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.width(60.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(2.dp))

                    // Bar 2: Cumulative Revenue
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Revenue",
                            fontSize = 11.sp,
                            color = MarketTextSecondary,
                            modifier = Modifier.width(52.dp)
                        )
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .height(16.dp)
                                .background(MarketSurfaceVariant, RoundedCornerShape(4.dp))
                        ) {
                            val revFraction = (revenueDollars / maxVal).toFloat().coerceIn(0f, 1f)
                            if (revFraction > 0f) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxHeight()
                                        .fillMaxWidth(revFraction)
                                        .background(MarketGreenPrimary, RoundedCornerShape(4.dp))
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = CurrencyAndWeightFormatter.formatCents(revenueCents),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = MarketGreenDark,
                            modifier = Modifier.width(60.dp)
                        )
                    }
                }
                if (pigment != pigments.last()) {
                    Divider(color = MarketBorderLight, modifier = Modifier.padding(vertical = 4.dp))
                }
            }
        }
    }
}
