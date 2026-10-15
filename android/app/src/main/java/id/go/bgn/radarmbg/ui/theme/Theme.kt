package id.go.bgn.radarmbg.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = BgnPrimary,
    primaryContainer = BgnPrimaryContainer,
    secondary = BgnSecondary,
    background = BgnBackground,
    surface = BgnSurface,
    onSurface = BgnOnSurface,
    onSurfaceVariant = BgnOnSurfaceVariant,
    error = StatusError
)

@Composable
fun RadarMBGTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography,
        content = content
    )
}
