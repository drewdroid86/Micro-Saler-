package com.example.microsaler.ui.screens.customers

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.example.microsaler.data.model.Customer
import com.example.microsaler.ui.components.CurrencyAndWeightFormatter
import com.example.microsaler.ui.components.TrustStatusBadge
import com.example.microsaler.ui.viewmodel.PosViewModel
import com.example.ui.theme.*

@Composable
fun CustomerScreen(
    viewModel: PosViewModel,
    customers: List<Customer>
) {
    var customerToSettle by remember { mutableStateOf<Customer?>(null) }
    var showAddCustomerDialog by remember { mutableStateOf(false) }

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
                text = "CUSTOMER HOUSE TABS",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )

            Button(
                onClick = { showAddCustomerDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.testTag("add_customer_btn")
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Customer")
                Spacer(modifier = Modifier.width(4.dp))
                Text("New Customer")
            }
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(customers) { customer ->
                CustomerTabCard(
                    customer = customer,
                    onSettleTabClick = { customerToSettle = customer }
                )
            }
        }
    }

    // Settle Tab Dialog
    customerToSettle?.let { customer ->
        SettleTabDialog(
            customer = customer,
            onConfirm = { amountDollars, payType, provider ->
                viewModel.settleCustomerTab(customer.customer_id, amountDollars, payType, provider) {
                    customerToSettle = null
                }
            },
            onDismiss = { customerToSettle = null }
        )
    }

    // Add Customer Dialog
    if (showAddCustomerDialog) {
        AddCustomerDialog(
            onConfirm = { name, phone, limitDollars, status ->
                viewModel.createCustomer(name, phone, limitDollars, status)
                showAddCustomerDialog = false
            },
            onDismiss = { showAddCustomerDialog = false }
        )
    }
}

@Composable
fun CustomerTabCard(
    customer: Customer,
    onSettleTabClick: () -> Unit
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
                Column {
                    Text(customer.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Phone: ${customer.phone}", style = MaterialTheme.typography.bodyMedium, color = MarketTextSecondary)
                }

                TrustStatusBadge(status = customer.trust_status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Current Tab: ${CurrencyAndWeightFormatter.formatCents(customer.current_balance_cents)}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.Bold,
                        color = if (customer.current_balance_cents > 0) MarketTabBadge else MarketTextPrimary
                    )
                    Text(
                        text = "Available Credit: ${CurrencyAndWeightFormatter.formatCents(customer.availableCreditCents)} / Limit: ${CurrencyAndWeightFormatter.formatCents(customer.credit_limit_cents)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MarketTextSecondary
                    )
                }

                Button(
                    onClick = onSettleTabClick,
                    enabled = customer.current_balance_cents > 0,
                    colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Icon(Icons.Default.Payments, contentDescription = "Settle Tab", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Settle Tab")
                }
            }
        }
    }
}

@Composable
fun SettleTabDialog(
    customer: Customer,
    onConfirm: (Double, String, String?) -> Unit,
    onDismiss: () -> Unit
) {
    val defaultAmount = String.format("%.2f", customer.current_balance_cents / 100.0)
    var amountText by remember { mutableStateOf(defaultAmount) }
    var payType by remember { mutableStateOf("CASH") }
    var digitalProvider by remember { mutableStateOf("Square") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Settle Tab: ${customer.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "Current Balance: ${CurrencyAndWeightFormatter.formatCents(customer.current_balance_cents)}",
                    fontWeight = FontWeight.Bold
                )

                OutlinedTextField(
                    value = amountText,
                    onValueChange = { amountText = it },
                    label = { Text("Amount Paid ($)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth().testTag("settle_amount_input")
                )

                Text("Payment Type:", style = MaterialTheme.typography.labelSmall)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    listOf("CASH", "DIGITAL").forEach { type ->
                        FilterChip(
                            selected = payType == type,
                            onClick = { payType = type },
                            label = { Text(type) }
                        )
                    }
                }

                if (payType == "DIGITAL") {
                    Text("Digital Provider:", style = MaterialTheme.typography.labelSmall)
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("Square", "Venmo", "Zelle").forEach { p ->
                            FilterChip(
                                selected = digitalProvider == p,
                                onClick = { digitalProvider = p },
                                label = { Text(p) }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val amountDollars = amountText.toDoubleOrNull() ?: 0.0
                    if (amountDollars > 0) {
                        onConfirm(amountDollars, payType, if (payType == "DIGITAL") digitalProvider else null)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MarketGreenPrimary)
            ) {
                Text("Record Payment")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}

@Composable
fun AddCustomerDialog(
    onConfirm: (String, String, Double, String) -> Unit,
    onDismiss: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var creditLimitText by remember { mutableStateOf("25.00") }
    var trustStatus by remember { mutableStateOf("GOOD_STANDING") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add Customer") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone Number") }, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(value = creditLimitText, onValueChange = { creditLimitText = it }, label = { Text("Credit Limit ($)") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())

                Text("Trust Status:", style = MaterialTheme.typography.labelSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("GOOD_STANDING", "VIP", "PAUSED").forEach { status ->
                        FilterChip(
                            selected = trustStatus == status,
                            onClick = { trustStatus = status },
                            label = { Text(status) }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val limit = creditLimitText.toDoubleOrNull() ?: 25.0
                    if (name.isNotBlank()) {
                        onConfirm(name, phone, limit, trustStatus)
                    }
                }
            ) {
                Text("Save Customer")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        }
    )
}
