package id.go.bgn.radarmbg.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.components.MenuCard
import id.go.bgn.radarmbg.ui.components.SkeletonBox
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnBackground
import id.go.bgn.radarmbg.viewmodel.MenuUiState
import id.go.bgn.radarmbg.viewmodel.MenuViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuScreen(menuViewModel: MenuViewModel = viewModel()) {
    val uiState by menuViewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        menuViewModel.loadMenu()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.menu_judul),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary)
            )
        }
    ) { innerPadding ->
        when (val state = uiState) {
            is MenuUiState.Loading -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(BgnBackground)
                        .padding(innerPadding)
                        .padding(16.dp)
                ) {
                    SkeletonBox(modifier = Modifier.fillMaxWidth().height(120.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    SkeletonBox(modifier = Modifier.fillMaxWidth().height(120.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    SkeletonBox(modifier = Modifier.fillMaxWidth().height(120.dp))
                }
            }

            is MenuUiState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(BgnBackground)
                        .padding(innerPadding)
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = state.message,
                            color = BgnOnSurfaceVariant,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = { menuViewModel.loadMenu() },
                            colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary)
                        ) {
                            Text(stringResource(R.string.action_retry))
                        }
                    }
                }
            }

            is MenuUiState.Success -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(BgnBackground)
                        .padding(innerPadding)
                ) {
                    Text(
                        text = "Menu yang tersedia hari ini",
                        color = BgnPrimary,
                        fontWeight = FontWeight.Bold,
                        fontSize = 20.sp,
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp)
                    )
                    Text(
                        text = "Pilih kota untuk melihat menu dari SPPG setempat.",
                        color = BgnOnSurfaceVariant,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 4.dp)
                    )
                    // Filter chips
                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        item {
                            FilterChip(
                                selected = state.selectedKota.isBlank(),
                                onClick = { menuViewModel.filterByKota("") },
                                label = { Text(stringResource(R.string.filter_semua)) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = BgnPrimary,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                        items(state.kotaList) { kota ->
                            FilterChip(
                                selected = state.selectedKota == kota,
                                onClick = { menuViewModel.filterByKota(kota) },
                                label = { Text(kota) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = BgnPrimary,
                                    selectedLabelColor = Color.White
                                )
                            )
                        }
                    }

                    if (state.filtered.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = stringResource(R.string.menu_empty),
                                color = BgnPrimary,
                                fontSize = 14.sp
                            )
                        }
                    } else {
                        LazyColumn(
                            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(state.filtered) { menu ->
                                MenuCard(menu = menu)
                            }
                        }
                    }
                }
            }
        }
    }
}
