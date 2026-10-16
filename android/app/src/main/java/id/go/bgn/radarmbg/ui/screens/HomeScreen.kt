package id.go.bgn.radarmbg.ui.screens

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
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
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
import id.go.bgn.radarmbg.ui.components.AppTopBar
import id.go.bgn.radarmbg.ui.components.KpiCard
import id.go.bgn.radarmbg.ui.components.SkeletonBox
import id.go.bgn.radarmbg.ui.theme.BgnOnSurface
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.StatusError
import id.go.bgn.radarmbg.ui.theme.StatusSuccess
import id.go.bgn.radarmbg.ui.theme.StatusWarning
import id.go.bgn.radarmbg.viewmodel.AuthUiState
import id.go.bgn.radarmbg.viewmodel.AuthViewModel
import id.go.bgn.radarmbg.viewmodel.HomeUiState
import id.go.bgn.radarmbg.viewmodel.HomeViewModel
import id.go.bgn.radarmbg.viewmodel.NotifikasiUiState
import id.go.bgn.radarmbg.viewmodel.NotifikasiViewModel
import java.text.NumberFormat
import java.util.Locale

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
    val notifUiState by notifikasiViewModel.uiState.collectAsState()
    val authUiState by authViewModel.uiState.collectAsState()
    var isRefreshing by remember { mutableStateOf(false) }
    val pullRefreshState = rememberPullToRefreshState()

    LaunchedEffect(Unit) {
        homeViewModel.loadData()
        notifikasiViewModel.loadNotifikasi()
    }

    LaunchedEffect(homeUiState) {
        if (homeUiState !is HomeUiState.Loading) {
            isRefreshing = false
        }
    }

    val badgeCount = when (val n = notifUiState) {
        is NotifikasiUiState.Success -> n.data.badge_count
        else -> 0
    }

    val userInitial = when (val a = authUiState) {
        is AuthUiState.Success -> a.user.full_name.firstOrNull()?.toString() ?: "U"
        else -> "U"
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(R.string.app_name),
                badgeCount = badgeCount,
                onNotificationClick = onNotificationClick,
                onProfileClick = onProfileClick,
                userInitial = userInitial
            )
        }
    ) { innerPadding ->
        PullToRefreshBox(
            state = pullRefreshState,
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                homeViewModel.loadData()
                notifikasiViewModel.loadNotifikasi()
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (val state = homeUiState) {
                is HomeUiState.Loading -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // 2 rows of 2 skeleton KPI cards
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                SkeletonBox(modifier = Modifier.weight(1f).height(100.dp))
                                SkeletonBox(modifier = Modifier.weight(1f).height(100.dp))
                            }
                        }
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                SkeletonBox(modifier = Modifier.weight(1f).height(100.dp))
                                SkeletonBox(modifier = Modifier.weight(1f).height(100.dp))
                            }
                        }
                        // Section header skeleton
                        item {
                            SkeletonBox(modifier = Modifier.fillMaxWidth().height(20.dp))
                        }
                        // 5 table row skeletons
                        items(5) {
                            SkeletonBox(modifier = Modifier.fillMaxWidth().height(60.dp))
                        }
                    }
                }

                is HomeUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = state.message,
                                color = StatusError,
                                fontSize = 14.sp
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Button(
                                onClick = { homeViewModel.loadData() },
                                colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary)
                            ) {
                                Text(stringResource(R.string.action_retry))
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
                        // KPI Grid — 2 columns, 2 rows = 4 cards
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                KpiCard(
                                    value = numFormat.format(telemetri.sekolah_terlayani),
                                    label = stringResource(R.string.kpi_sekolah_terlayani),
                                    modifier = Modifier.weight(1f)
                                )
                                KpiCard(
                                    value = numFormat.format(telemetri.porsi_tersalurkan),
                                    label = stringResource(R.string.kpi_porsi),
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                        item {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                KpiCard(
                                    value = "${telemetri.kepatuhan_akg}%",
                                    label = stringResource(R.string.kpi_kepatuhan),
                                    modifier = Modifier.weight(1f)
                                )
                                KpiCard(
                                    value = telemetri.sppg_aktif.toString(),
                                    label = stringResource(R.string.kpi_sppg_aktif),
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

                        // Distribusi per provinsi rows
                        items(distribusi) { item ->
                            ProvinsiRow(provinsi = item)
                        }
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
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = provinsi.provinsi,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                    color = BgnOnSurface
                )
                Text(
                    text = "Target: ${NumberFormat.getNumberInstance(Locale("id","ID")).format(provinsi.target_porsi)} porsi",
                    fontSize = 12.sp,
                    color = BgnOnSurfaceVariant
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${provinsi.ketepatan}%",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = statusColor
                )
                Text(
                    text = provinsi.status,
                    fontSize = 11.sp,
                    color = statusColor
                )
            }
        }
    }
}
