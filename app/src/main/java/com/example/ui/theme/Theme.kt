package com.example.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val CleanMinimalColorScheme = lightColorScheme(
    primary = MarketGreenPrimary,
    onPrimary = MarketSurface,
    primaryContainer = MarketGreenLight,
    onPrimaryContainer = MarketGreenDark,
    secondary = MarketTextSecondary,
    onSecondary = MarketSurface,
    background = MarketBackground,
    onBackground = MarketTextPrimary,
    surface = MarketSurface,
    onSurface = MarketTextPrimary,
    surfaceVariant = MarketSurfaceVariant,
    onSurfaceVariant = MarketTextSecondary,
    outline = MarketBorder,
    error = MarketError,
    onError = MarketSurface
)

@Composable
fun MicroSalerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = CleanMinimalColorScheme,
        typography = Typography,
        content = content
    )
}
