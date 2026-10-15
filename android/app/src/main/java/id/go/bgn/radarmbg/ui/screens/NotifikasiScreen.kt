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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import id.go.bgn.radarmbg.data.api.models.LaporanReport
import id.go.bgn.radarmbg.ui.theme.BgnOnSurface
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnSecondary
import id.go.bgn.radarmbg.ui.theme.StatusError
import id.go.bgn.radarmbg.ui.theme.StatusSuccess
import id.go.bgn.radarmbg.ui.theme.StatusWarning
import id.go.bgn.radarmbg.viewmodel.NotifikasiUiState
import id.go.bgn.radarmbg.viewmodel.NotifikasiViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotifikasiScreen(notifikasiViewModel: NotifikasiViewModel = viewModel()) {
    val uiState by notifikasiViewModel.uiState.collectAsState()
    var isRefreshing by remember { mutableStateOf(false) }
    val pullRefreshState = rememberPullToRefreshState()

    LaunchedEffect(Unit) {
        notifikasiViewModel.loadNotifikasi()
    }

    LaunchedEffect(uiState) {
        if (uiState !is NotifikasiUiState.Loading) {
            isRefreshing = false
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.notifikasi_judul),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary)
            )
        }
    ) { innerPadding ->
        PullToRefreshBox(
            state = pullRefreshState,
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                notifikasiViewModel.loadNotifikasi()
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (val state = uiState) {
                is NotifikasiUiState.Loading -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = BgnPrimary)
                    }
                }

                is NotifikasiUiState.Error -> {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text(text = state.message, color = StatusError, fontSize = 14.sp)
                    }
                }

                is NotifikasiUiState.Success -> {
                    val data = state.data
                    if (data.latest_reports.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("🔔", fontSize = 40.sp)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = stringResource(R.string.notif_empty),
                                    color = BgnOnSurfaceVariant,
                                    fontSize = 14.sp
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Badge summary card
                            item {
                                Surface(
                                    color = BgnPrimary.copy(alpha = 0.08f),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(16.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text("📊 ", fontSize = 20.sp)
                                        Column {
                                            Text(
                                                text = "${data.laporan_masuk_count} laporan masuk",
                                                fontWeight = FontWeight.Bold,
                                                color = BgnPrimary
                                            )
                                            Text(
                                                text = "Badge: ${data.badge_count}",
                                                fontSize = 12.sp,
                                                color = BgnOnSurfaceVariant
                                            )
                                        }
                                    }
                                }
                            }

                            items(data.latest_reports) { report ->
                                LaporanReportCard(report = report)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LaporanReportCard(report: LaporanReport) {
    val statusColor = when (report.status.lowercase()) {
        "selesai", "resolved" -> StatusSuccess
        "proses", "processing" -> StatusWarning
        "pending", "masuk" -> BgnSecondary
        else -> BgnOnSurfaceVariant
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = report.ticket_code,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    color = BgnPrimary
                )
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = report.status,
                        fontSize = 11.sp,
                        color = statusColor,
                        fontWeight = FontWeight.Medium,
                        modifier = androidx.compose.ui.Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = report.reporter_name,
                fontSize = 14.sp,
                color = BgnOnSurface
            )
            Text(
                text = report.school_target,
                fontSize = 12.sp,
                color = BgnOnSurfaceVariant
            )
            Text(
                text = report.issue_category,
                fontSize = 12.sp,
                color = BgnOnSurfaceVariant
            )
            Text(
                text = report.created_at,
                fontSize = 11.sp,
                color = BgnOnSurfaceVariant,
                modifier = androidx.compose.ui.Modifier.padding(top = 4.dp)
            )
        }
    }
}
