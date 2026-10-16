package id.go.bgn.radarmbg.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.data.api.models.ProvinsiData
import id.go.bgn.radarmbg.ui.components.KpiCard
import id.go.bgn.radarmbg.ui.components.SkeletonBox
import id.go.bgn.radarmbg.ui.theme.BgnOnSurface
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.StatusError
import id.go.bgn.radarmbg.ui.theme.StatusSuccess
import id.go.bgn.radarmbg.ui.theme.StatusWarning
import id.go.bgn.radarmbg.viewmodel.AuthViewModel
import id.go.bgn.radarmbg.viewmodel.HomeUiState
import id.go.bgn.radarmbg.viewmodel.HomeViewModel
import id.go.bgn.radarmbg.viewmodel.NotifikasiViewModel
import java.text.NumberFormat
import java.util.Locale

// Warna KPI cards sesuai web dashboard
private val KpiColors = listOf(
    Color(0xFF2563EB), // biru — sekolah
    Color(0xFF059669), // hijau — porsi
    Color(0xFF7C3AED), // ungu — AKG
    Color(0xFFD97706)  // amber — SPPG
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onNotificationClick: () -> Unit,
    onProfileClick: () -> Unit,
    homeViewModel: HomeViewModel = viewModel(),
    notifikasiViewModel: NotifikasiViewModel = viewModel(),
    authViewModel: AuthViewModel = viewModel()
) {
    val homeUiState by homeViewModel.uiState.collectAsState()
    var isRefreshing by remember { mutableStateOf(false) }
    val pullRefreshState = rememberPullToRefreshState()

    LaunchedEffect(Unit) {
        homeViewModel.loadData()
        notifikasiViewModel.loadNotifikasi()
    }

    LaunchedEffect(homeUiState) {
        if (homeUiState !is HomeUiState.Loading) isRefreshing = false
    }

    // Screen background sesuai web (#F8F9FF)
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF8F9FF))
    ) {
        PullToRefreshBox(
            state = pullRefreshState,
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                homeViewModel.loadData()
                notifikasiViewModel.loadNotifikasi()
            },
            modifier = Modifier.fillMaxSize()
        ) {
            when (val state = homeUiState) {
                is HomeUiState.Loading -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                SkeletonBox(Modifier.weight(1f).height(100.dp))
                                SkeletonBox(Modifier.weight(1f).height(100.dp))
                            }
                        }
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                SkeletonBox(Modifier.weight(1f).height(100.dp))
                                SkeletonBox(Modifier.weight(1f).height(100.dp))
                            }
                        }
                        item { SkeletonBox(Modifier.fillMaxWidth().height(20.dp)) }
                        items(5) { SkeletonBox(Modifier.fillMaxWidth().height(60.dp)) }
                    }
                }

                is HomeUiState.Error -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Card(
                            modifier = Modifier.padding(24.dp),
                            shape = RoundedCornerShape(20.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(4.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Warning,
                                    contentDescription = null,
                                    tint = StatusWarning,
                                    modifier = Modifier.size(48.dp)
                                )
                                Spacer(Modifier.height(12.dp))
                                Text(
                                    text = "Gagal memuat data",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 16.sp,
                                    color = BgnOnSurface
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    text = "Periksa koneksi internet dan coba lagi.",
                                    fontSize = 13.sp,
                                    color = BgnOnSurfaceVariant
                                )
                                Spacer(Modifier.height(16.dp))
                                Button(
                                    onClick = { homeViewModel.loadData() },
                                    colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(stringResource(R.string.action_retry))
                                }
                            }
                        }
                    }
                }

                is HomeUiState.Success -> {
                    val telemetri = state.telemetri
                    val distribusi = state.distribusi
                    val numFormat = NumberFormat.getNumberInstance(Locale("id", "ID"))

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // KPI row 1
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                KpiCard(
                                    value = numFormat.format(telemetri.sekolah_terlayani),
                                    label = stringResource(R.string.kpi_sekolah_terlayani),
                                    accentColor = KpiColors[0],
                                    modifier = Modifier.weight(1f)
                                )
                                KpiCard(
                                    value = numFormat.format(telemetri.porsi_tersalurkan),
                                    label = stringResource(R.string.kpi_porsi),
                                    accentColor = KpiColors[1],
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        // KPI row 2
                        item {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                KpiCard(
                                    value = "${telemetri.kepatuhan_akg}%",
                                    label = stringResource(R.string.kpi_kepatuhan),
                                    accentColor = KpiColors[2],
                                    modifier = Modifier.weight(1f)
                                )
                                KpiCard(
                                    value = telemetri.sppg_aktif.toString(),
                                    label = stringResource(R.string.kpi_sppg_aktif),
                                    accentColor = KpiColors[3],
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        // Section header
                        item {
                            Text(
                                text = stringResource(R.string.label_distribusi_provinsi),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = BgnOnSurface,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        }
                        items(distribusi) { ProvinsiRow(it) }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProvinsiRow(provinsi: ProvinsiData) {
    val statusColor = when {
        provinsi.ketepatan >= 98 -> StatusSuccess
        provinsi.ketepatan >= 95 -> StatusWarning
        else -> StatusError
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(provinsi.provinsi, fontWeight = FontWeight.Medium, fontSize = 14.sp, color = BgnOnSurface)
                Text(
                    "Target: ${NumberFormat.getNumberInstance(Locale("id","ID")).format(provinsi.target_porsi)} porsi",
                    fontSize = 12.sp, color = BgnOnSurfaceVariant
                )
            }
            Spacer(Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text("${provinsi.ketepatan}%", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = statusColor)
                Text(provinsi.status, fontSize = 11.sp, color = statusColor)
            }
        }
    }
}
