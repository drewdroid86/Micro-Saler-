package com.example.microsaler.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

object CurrencyAndWeightFormatter {
    fun formatCents(cents: Long): String {
        return "$${String.format("%.2f", cents / 100.0)}"
    }

    fun formatMgToGrams(mg: Long): String {
        return "${String.format("%.1f", mg / 1000.0)}g"
    }

    fun formatMgToOz(mg: Long): String {
        return "${String.format("%.2f", mg / 28349.5)} oz"
    }
}

@Composable
fun MarketTopHeader(
    title: String = "MICRO SALER",
    currentTab: String,
    onTabSelected: (String) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MarketSurface)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PointOfSale,
                    contentDescription = "POS Logo",
                    tint = MarketGreenPrimary,
                    modifier = Modifier.size(28.dp)
                )
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 0.5.sp
                )
            }

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(MarketSuccess)
                )
                Text(
                    text = "100% OFFLINE LOCAL",
                    style = MaterialTheme.typography.labelSmall,
                    color = MarketTextSecondary
                )
            }
        }

        // Navigation Bar Tabs for Market Stall POS
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MarketSurfaceVariant)
                .padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            val tabs = listOf(
                "checkout" to ("Terminal" to Icons.Default.ShoppingCart),
                "inventory" to ("Inventory" to Icons.Default.Inventory2),
                "customers" to ("Customers" to Icons.Default.People),
                "history" to ("Sales" to Icons.Default.ReceiptLong),
                "audit" to ("Audit Log" to Icons.Default.Security)
            )

            tabs.forEach { (tabId, pair) ->
                val (label, icon) = pair
                val isSelected = currentTab == tabId
                Row(
                    modifier = Modifier
                        .testTag("nav_tab_$tabId")
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (isSelected) MarketGreenPrimary else Color.Transparent)
                        .clickable { onTabSelected(tabId) }
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (isSelected) MarketSurface else MarketTextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (isSelected) MarketSurface else MarketTextSecondary,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
fun TrustStatusBadge(status: String) {
    val (bgColor, textColor, label) = when (status.uppercase()) {
        "VIP" -> Triple(Color(0xFFF3E5F5), Color(0xFF7B1FA2), "VIP")
        "PAUSED" -> Triple(Color(0xFFFFEBEE), Color(0xFFC62828), "PAUSED")
        else -> Triple(Color(0xFFE8F5E1), MarketGreenDark, "GOOD STANDING")
    }

    Surface(
        color = bgColor,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.padding(2.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@Composable
fun ColorSwatchBox(colorHex: String, modifier: Modifier = Modifier) {
    val color = try {
        Color(android.graphics.Color.parseColor(colorHex))
    } catch (e: Exception) {
        MarketGreenPrimary
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color)
            .border(1.dp, MarketBorder, RoundedCornerShape(8.dp))
    )
}
