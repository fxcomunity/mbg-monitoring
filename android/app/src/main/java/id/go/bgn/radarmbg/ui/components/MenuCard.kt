package id.go.bgn.radarmbg.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.go.bgn.radarmbg.data.api.models.MenuData
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnPrimaryContainer
import id.go.bgn.radarmbg.ui.theme.BgnSecondary
import id.go.bgn.radarmbg.ui.theme.BgnTertiaryFixed

@Composable
fun MenuCard(
    menu: MenuData,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // School target bold primary
            Text(
                text = menu.school_target,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = BgnPrimary
            )
            // Menu title secondary
            Text(
                text = menu.menu_title,
                fontSize = 14.sp,
                color = BgnSecondary,
                modifier = Modifier.padding(top = 2.dp)
            )

            Row(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // City chip
                ChipLabel(text = menu.city, bgColor = BgnPrimary.copy(alpha = 0.08f), textColor = BgnPrimary)

                // Kalori badge
                if (menu.kalori_kkal != null) {
                    ChipLabel(
                        text = "${menu.kalori_kkal} kkal",
                        bgColor = BgnTertiaryFixed,
                        textColor = BgnPrimaryContainer
                    )
                }
            }

            // Nutrisi row
            Row(
                modifier = Modifier.padding(top = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                if (menu.protein_g != null) {
                    ChipLabel(text = "P: ${menu.protein_g}g", bgColor = Color(0xFFE8F5E9), textColor = BgnOnSurfaceVariant)
                }
                if (menu.karbohidrat_g != null) {
                    ChipLabel(text = "K: ${menu.karbohidrat_g}g", bgColor = Color(0xFFFFF8E1), textColor = BgnOnSurfaceVariant)
                }
                if (menu.lemak_g != null) {
                    ChipLabel(text = "L: ${menu.lemak_g}g", bgColor = Color(0xFFFCE4EC), textColor = BgnOnSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun ChipLabel(text: String, bgColor: Color, textColor: Color) {
    Text(
        text = text,
        fontSize = 11.sp,
        color = textColor,
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 3.dp)
    )
}
