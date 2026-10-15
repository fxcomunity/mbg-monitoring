package id.go.bgn.radarmbg.ui.screens

import android.content.Context
import android.graphics.drawable.Drawable
import androidx.appcompat.content.res.AppCompatResources
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.viewmodel.HomeUiState
import id.go.bgn.radarmbg.viewmodel.HomeViewModel
import kotlinx.coroutines.delay
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import kotlin.random.Random

private data class WilayahItem(
    val label: String,
    val lat: Double,
    val lng: Double,
    val zoom: Double
)

private val wilayahList = listOf(
    WilayahItem("Seluruh Indonesia", -2.5, 118.0, 5.0),
    WilayahItem("DKI Jakarta", -6.2, 106.816667, 11.0),
    WilayahItem("Jawa Barat", -6.9, 107.6, 9.0),
    WilayahItem("Jawa Tengah", -7.15, 110.1, 9.0),
    WilayahItem("Jawa Timur", -7.75, 112.5, 9.0)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PetaScreen(homeViewModel: HomeViewModel = viewModel()) {
    val uiState by homeViewModel.uiState.collectAsState()
    var expanded by remember { mutableStateOf(false) }
    var selectedWilayah by remember { mutableStateOf(wilayahList[0]) }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        Configuration.getInstance().userAgentValue = context.packageName
        if (uiState !is HomeUiState.Success) {
            homeViewModel.loadData()
        }
    }

    // Simulated moving van positions
    val vanOffsets = remember { mutableStateOf(List(3) { Pair(Random.nextDouble(-0.5, 0.5), Random.nextDouble(-0.5, 0.5)) }) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(3000L)
            vanOffsets.value = List(3) { Pair(Random.nextDouble(-0.5, 0.5), Random.nextDouble(-0.5, 0.5)) }
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
                        .menuAnchor()
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
                                expanded = false
                            }
                        )
                    }
                }
            }

            // OSMDroid map
            Box(modifier = Modifier.weight(1f)) {
                val distribusiList = when (val s = uiState) {
                    is HomeUiState.Success -> s.distribusi
                    else -> emptyList()
                }
                val currentWilayah = selectedWilayah
                val currentVanOffsets = vanOffsets.value

                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        createMapView(ctx)
                    },
                    update = { mapView ->
                        val mapController = mapView.controller
                        val center = GeoPoint(currentWilayah.lat, currentWilayah.lng)
                        mapController.animateTo(center, currentWilayah.zoom, 1000L)

                        // Clear existing overlays and re-add
                        mapView.overlays.clear()

                        // Province markers (green)
                        val greenDrawable: Drawable? = AppCompatResources.getDrawable(mapView.context, R.drawable.ic_location)
                        distribusiList.forEachIndexed { idx, provinsi ->
                            val approxLat = -2.5 + (idx * 1.5)
                            val approxLng = 108.0 + (idx * 3.0)
                            val marker = Marker(mapView)
                            marker.position = GeoPoint(approxLat, approxLng)
                            marker.title = provinsi.provinsi
                            marker.snippet = "Ketepatan: ${provinsi.ketepatan}%"
                            if (greenDrawable != null) {
                                marker.icon = greenDrawable
                            }
                            mapView.overlays.add(marker)
                        }

                        // Moving van markers (blue — use ic_verified as van icon)
                        val vanDrawable: Drawable? = AppCompatResources.getDrawable(mapView.context, R.drawable.ic_verified)
                        currentVanOffsets.forEachIndexed { idx, offset ->
                            val vanMarker = Marker(mapView)
                            vanMarker.position = GeoPoint(
                                currentWilayah.lat + offset.first,
                                currentWilayah.lng + offset.second
                            )
                            vanMarker.title = "Van ${idx + 1}"
                            if (vanDrawable != null) {
                                vanMarker.icon = vanDrawable
                            }
                            mapView.overlays.add(vanMarker)
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
