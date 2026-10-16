package id.go.bgn.radarmbg.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.theme.BgnBackground
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnPrimaryContainer

private data class DashboardTile(
    val labelRes: Int,
    val icon: ImageVector,
    val onClick: () -> Unit,
    val isEnabled: Boolean
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    userRole: String,
    onNavigateToAdminPanel: () -> Unit,
    onNavigateToLaporan: () -> Unit
) {
    val tiles: List<DashboardTile> = when (userRole) {
        "admin" -> listOf(
            DashboardTile(R.string.tile_kpi_nasional, Icons.Default.ShowChart, {}, true),
            DashboardTile(R.string.tile_manajemen_akun, Icons.Default.People, {}, true),
            DashboardTile(R.string.tile_status_sppg, Icons.Default.CheckCircle, {}, true),
            DashboardTile(R.string.tile_backup_menu, Icons.Default.Archive, {}, true),
            DashboardTile(R.string.tile_log_keamanan, Icons.Default.Security, onNavigateToAdminPanel, true)
        )
        "sppg" -> listOf(
            DashboardTile(R.string.tile_input_menu, Icons.Default.Edit, {}, true),
            DashboardTile(R.string.tile_profil_dapur, Icons.Default.Restaurant, {}, true),
            DashboardTile(R.string.tile_laporan_distribusi, Icons.Default.BarChart, {}, true)
        )
        else -> listOf(
            DashboardTile(R.string.tile_status_laporan, Icons.Default.Assignment, onNavigateToLaporan, true),
            DashboardTile(R.string.tile_menu_sekolah, Icons.Default.MenuBook, {}, false),
            DashboardTile(R.string.tile_kontak_satgas, Icons.Default.Phone, {}, false)
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.dashboard_judul),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary)
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            val rows = tiles.chunked(2)
            items(rows) { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    row.forEach { tile ->
                        DashboardTileCard(
                            tile = tile,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    // Fill remaining space if odd number of tiles in last row
                    if (row.size == 1) {
                        Spacer(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun DashboardTileCard(
    tile: DashboardTile,
    modifier: Modifier = Modifier
) {
    val containerColor = if (tile.isEnabled) BgnPrimaryContainer else BgnBackground
    val contentColor = if (tile.isEnabled) Color.White else BgnOnSurfaceVariant

    ElevatedCard(
        onClick = tile.onClick,
        modifier = modifier.height(120.dp),
        colors = CardDefaults.elevatedCardColors(containerColor = containerColor),
        enabled = tile.isEnabled
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = tile.icon,
                    contentDescription = null,
                    tint = contentColor,
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(tile.labelRes),
                    color = contentColor,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center
                )
                if (!tile.isEnabled) {
                    Text(
                        text = stringResource(R.string.label_fitur_segera),
                        color = BgnOnSurfaceVariant,
                        fontSize = 11.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
