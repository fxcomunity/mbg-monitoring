package id.go.bgn.radarmbg.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary

@Composable
fun KpiCard(
    value: String,
    label: String,
    modifier: Modifier = Modifier
) {
    ElevatedCard(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = value,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = BgnPrimary
            )
            Text(
                text = label,
                fontSize = 12.sp,
                color = BgnOnSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
