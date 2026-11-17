package id.go.bgn.radarmbg.ui.screens

import android.content.Context
import android.graphics.drawable.Drawable
import androidx.appcompat.content.res.AppCompatResources
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.data.api.ApiClient
import id.go.bgn.radarmbg.data.api.models.SppgData
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.viewmodel.HomeUiState
import id.go.bgn.radarmbg.viewmodel.HomeViewModel
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker

private data class WilayahItem(
    val label: String,
    val lat: Double,
    val lng: Double,
    val zoom: Double
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PetaScreen(homeViewModel: HomeViewModel = viewModel()) {
    val uiState by homeViewModel.uiState.collectAsState()
    var expanded by remember { mutableStateOf(false) }
    var selectedWilayah by remember { mutableStateOf(WilayahItem("Seluruh Indonesia", -2.5, 118.0, 5.0)) }
    var showSppgList by remember { mutableStateOf(false) }
    var selectedMapPoint by remember { mutableStateOf<GeoPoint?>(null) }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        Configuration.getInstance().userAgentValue = context.packageName
        if (uiState !is HomeUiState.Success) {
            homeViewModel.loadData()
        }
    }

    var sppgList by remember { mutableStateOf<List<SppgData>>(emptyList()) }
    var sppgLoadFailed by remember { mutableStateOf(false) }
    var sppgBannerVisible by remember { mutableStateOf(true) }
    var sppgReloadKey by remember { mutableStateOf(0) }

    LaunchedEffect(sppgReloadKey) {
        sppgLoadFailed = false
        try {
            val response = ApiClient.dataInstance.getSppg()
            if (response.status == "success") {
                sppgList = response.data.filter { it.latitude != null && it.longitude != null }
            } else {
                sppgLoadFailed = true
            }
        } catch (_: Exception) {
            sppgLoadFailed = true
        }
    }

    val wilayahList = remember(sppgList) {
        listOf(WilayahItem("Seluruh Indonesia", -2.5, 118.0, 5.0)) +
            sppgList.groupBy { it.provinsi.trim() }
                .filterKeys { it.isNotBlank() }
                .map { (province, items) ->
                    WilayahItem(
                        label = province,
                        lat = items.mapNotNull { it.latitude }.average(),
                        lng = items.mapNotNull { it.longitude }.average(),
                        zoom = 8.5
                    )
                }
                .sortedBy { it.label }
    }

    val selectedSppg = remember(sppgList, selectedWilayah) {
        if (selectedWilayah.label == "Seluruh Indonesia") sppgList
        else sppgList.filter { it.provinsi.trim().equals(selectedWilayah.label, ignoreCase = true) }
    }

    if (showSppgList) {
        ModalBottomSheet(onDismissRequest = { showSppgList = false }) {
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                Text(
                    text = "SPPG di ${selectedWilayah.label}",
                    color = BgnPrimary,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${selectedSppg.size} lokasi dengan koordinat tersedia",
                    color = BgnOnSurfaceVariant,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 4.dp, bottom = 12.dp)
                )
                LazyColumn(
                    modifier = Modifier.fillMaxWidth().height(420.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 20.dp)
                ) {
                    items(selectedSppg) { sppg ->
                        Card(
                            onClick = {
                                val lat = sppg.latitude
                                val lng = sppg.longitude
                                if (lat != null && lng != null) {
                                    selectedMapPoint = GeoPoint(lat, lng)
                                }
                                showSppgList = false
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(sppg.nama, color = BgnPrimary, fontWeight = FontWeight.SemiBold)
                                val location = listOfNotNull(sppg.kabupaten_kota, sppg.kecamatan)
                                    .filter { it.isNotBlank() }
                                    .joinToString(" • ")
                                if (location.isNotBlank()) {
                                    Text(
                                        location,
                                        color = BgnOnSurfaceVariant,
                                        fontSize = 12.sp,
                                        modifier = Modifier.padding(top = 3.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.peta_judul),
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BgnPrimary)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // SPPG Data Notice Banner
            if (sppgBannerVisible) {
                androidx.compose.foundation.layout.Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(color = Color(0xFFFEF3C7))
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = if (sppgLoadFailed) {
                            "Lokasi SPPG belum dapat dimuat. Periksa koneksi lalu coba lagi."
                        } else {
                            "${sppgList.size} lokasi SPPG ditampilkan. Sebagian koordinat mungkin masih dalam proses verifikasi."
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF92400E),
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(
                        onClick = {
                            if (sppgLoadFailed) {
                                sppgReloadKey += 1
                            } else {
                                sppgBannerVisible = false
                            }
                        },
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Text(
                            text = if (sppgLoadFailed) "Coba lagi" else "Tutup",
                            color = Color(0xFF92400E),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }

            // Wilayah dropdown
            ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                OutlinedTextField(
                    value = selectedWilayah.label,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.peta_pilih_wilayah)) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                )
                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    wilayahList.forEach { item ->
                        DropdownMenuItem(
                            text = { Text(item.label) },
                            onClick = {
                                selectedWilayah = item
                                selectedMapPoint = null
                                expanded = false
                            }
                        )
                    }
                }
            }

            Button(
                onClick = { showSppgList = true },
                enabled = selectedSppg.isNotEmpty(),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary)
            ) {
                Text("Lihat ${selectedSppg.size} lokasi SPPG")
            }

            // OSMDroid map
            Box(modifier = Modifier.weight(1f)) {
                val currentWilayah = selectedWilayah
                val currentMapPoint = selectedMapPoint
                val currentSppgList = selectedSppg

                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        createMapView(ctx)
                    },
                    update = { mapView ->
                        val mapController = mapView.controller
                        val center = currentMapPoint ?: GeoPoint(currentWilayah.lat, currentWilayah.lng)
                        mapController.animateTo(center, currentWilayah.zoom, 1000L)

                        // Clear existing overlays and re-add
                        mapView.overlays.clear()

                        // SPPG markers
                        val sppgIconDrawable: Drawable? = AppCompatResources.getDrawable(mapView.context, R.drawable.ic_location)
                        currentSppgList.forEach { sppg ->
                            val lat = sppg.latitude ?: return@forEach
                            val lng = sppg.longitude ?: return@forEach
                            val sppgMarker = Marker(mapView)
                            sppgMarker.position = GeoPoint(lat, lng)
                            sppgMarker.title = sppg.nama
                            sppgMarker.snippet = buildString {
                                append(sppg.provinsi)
                                if (!sppg.kabupaten_kota.isNullOrEmpty()) append(" — ${sppg.kabupaten_kota}")
                                if (!sppg.alamat.isNullOrEmpty()) append("\n${sppg.alamat}")
                                if (!sppg.nama_yayasan.isNullOrEmpty()) append("\n${sppg.nama_yayasan}")
                            }
                            if (sppgIconDrawable != null) sppgMarker.icon = sppgIconDrawable
                            mapView.overlays.add(sppgMarker)
                        }

                        mapView.invalidate()
                    }
                )
            }
        }
    }
}

private fun createMapView(context: Context): MapView {
    val mapView = MapView(context)
    mapView.setTileSource(TileSourceFactory.MAPNIK)
    mapView.setMultiTouchControls(true)
    mapView.zoomController.setVisibility(org.osmdroid.views.CustomZoomButtonsController.Visibility.NEVER)
    val mapController = mapView.controller
    mapController.setZoom(5.0)
    mapController.setCenter(GeoPoint(-2.5, 118.0))
    return mapView
}
