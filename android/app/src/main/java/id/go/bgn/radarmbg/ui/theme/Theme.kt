package id.go.bgn.radarmbg.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = BgnPrimary,
    primaryContainer = BgnPrimaryContainer,
    secondary = BgnSecondary,
    tertiary = StatusSuccess,
    background = BgnBackground,
    surface = BgnSurface,
    surfaceVariant = BgnSurfaceVariant,
    onSurface = BgnOnSurface,
    onSurfaceVariant = BgnOnSurfaceVariant,
    outline = BgnOutline,
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
