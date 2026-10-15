package id.go.bgn.radarmbg.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
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
import androidx.core.content.FileProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import id.go.bgn.radarmbg.R
import id.go.bgn.radarmbg.ui.theme.BgnOnSurfaceVariant
import id.go.bgn.radarmbg.ui.theme.BgnPrimary
import id.go.bgn.radarmbg.ui.theme.BgnPrimaryContainer
import id.go.bgn.radarmbg.ui.theme.BgnSecondary
import id.go.bgn.radarmbg.ui.theme.BgnTertiaryFixed
import id.go.bgn.radarmbg.ui.theme.StatusError
import id.go.bgn.radarmbg.ui.theme.StatusSuccess
import id.go.bgn.radarmbg.ui.theme.StatusWarning
import id.go.bgn.radarmbg.viewmodel.LaporanViewModel
import id.go.bgn.radarmbg.viewmodel.TiketUiState
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val kategoriList = listOf(
    "Kualitas Makanan",
    "Keterlambatan",
    "Porsi",
    "Kebersihan",
    "Lainnya"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LaporanScreen(laporanViewModel: LaporanViewModel = viewModel()) {
    val nama by laporanViewModel.nama.collectAsState()
    val telepon by laporanViewModel.telepon.collectAsState()
    val role by laporanViewModel.role.collectAsState()
    val kategori by laporanViewModel.kategori.collectAsState()
    val sekolah by laporanViewModel.sekolah.collectAsState()
    val tanggal by laporanViewModel.tanggal.collectAsState()
    val deskripsi by laporanViewModel.deskripsi.collectAsState()
    val submitState by laporanViewModel.submitState.collectAsState()
    val tiketState by laporanViewModel.tiketState.collectAsState()

    var tiketInput by remember { mutableStateOf("") }
    var showDatePicker by remember { mutableStateOf(false) }
    var kategoriExpanded by remember { mutableStateOf(false) }

    val context = LocalContext.current

    // Camera photo capture
    var photoUri by remember { mutableStateOf<Uri?>(null) }
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            laporanViewModel.photoUri.value = photoUri
        }
    }

    val datePickerState = rememberDatePickerState()
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    val millis = datePickerState.selectedDateMillis
                    if (millis != null) {
                        val sdf = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
                        laporanViewModel.tanggal.value = sdf.format(Date(millis))
                    }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Batal") }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = stringResource(R.string.laporan_judul),
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // === Section 1: Form aduan ===
            Text(
                text = "Ajukan Laporan",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = BgnPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))

            OutlinedTextField(
                value = nama,
                onValueChange = { laporanViewModel.nama.value = it },
                label = { Text(stringResource(R.string.hint_nama)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = telepon,
                onValueChange = { laporanViewModel.telepon.value = it },
                label = { Text(stringResource(R.string.hint_telepon)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Role selection
            Text(text = "Pelapor sebagai:", fontSize = 13.sp, color = BgnOnSurfaceVariant)
            Row(verticalAlignment = Alignment.CenterVertically) {
                listOf("user" to "Wali Murid", "sppg" to "SPPG", "ortu" to "Orang Tua").forEach { (value, label) ->
                    RadioButton(
                        selected = role == value,
                        onClick = { laporanViewModel.role.value = value }
                    )
                    Text(text = label, modifier = Modifier.padding(end = 8.dp), fontSize = 13.sp)
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            // Kategori dropdown
            ExposedDropdownMenuBox(
                expanded = kategoriExpanded,
                onExpandedChange = { kategoriExpanded = !kategoriExpanded }
            ) {
                OutlinedTextField(
                    value = kategori,
                    onValueChange = {},
                    readOnly = true,
                    label = { Text(stringResource(R.string.label_kategori)) },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = kategoriExpanded) },
                    modifier = Modifier.fillMaxWidth().menuAnchor()
                )
                ExposedDropdownMenu(
                    expanded = kategoriExpanded,
                    onDismissRequest = { kategoriExpanded = false }
                ) {
                    kategoriList.forEach { item ->
                        DropdownMenuItem(
                            text = { Text(item) },
                            onClick = {
                                laporanViewModel.kategori.value = item
                                kategoriExpanded = false
                            }
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = sekolah,
                onValueChange = { laporanViewModel.sekolah.value = it },
                label = { Text(stringResource(R.string.hint_sekolah)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Date field
            OutlinedTextField(
                value = tanggal,
                onValueChange = {},
                readOnly = true,
                label = { Text(stringResource(R.string.hint_tanggal)) },
                modifier = Modifier.fillMaxWidth(),
                trailingIcon = {
                    TextButton(onClick = { showDatePicker = true }) {
                        Text("📅", fontSize = 18.sp)
                    }
                }
            )
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = deskripsi,
                onValueChange = { laporanViewModel.deskripsi.value = it },
                label = { Text(stringResource(R.string.hint_deskripsi)) },
                modifier = Modifier.fillMaxWidth(),
                minLines = 3,
                maxLines = 6
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Photo button
            OutlinedButton(
                onClick = {
                    try {
                        val photoFile = File.createTempFile("aduan_", ".jpg", context.cacheDir)
                        val uri = FileProvider.getUriForFile(
                            context,
                            "${context.packageName}.fileprovider",
                            photoFile
                        )
                        photoUri = uri
                        cameraLauncher.launch(uri)
                    } catch (e: Exception) {
                        // Camera not available in emulator
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(stringResource(R.string.btn_foto))
            }

            if (laporanViewModel.photoUri.collectAsState().value != null) {
                Text(
                    text = "✓ Foto terlampir",
                    color = StatusSuccess,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Button(
                onClick = { laporanViewModel.submitLaporan() },
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary),
                enabled = submitState !is TiketUiState.Loading
            ) {
                if (submitState is TiketUiState.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(stringResource(R.string.btn_kirim))
                }
            }

            // Submit result
            when (val s = submitState) {
                is TiketUiState.Found -> {
                    Spacer(modifier = Modifier.height(8.dp))
                    Surface(
                        color = StatusSuccess.copy(alpha = 0.1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Laporan Diterima ✓", fontWeight = FontWeight.Bold, color = StatusSuccess)
                            Text("Nomor Tiket: ${s.data.nomor_tiket}", fontSize = 13.sp)
                            if (s.data.catatan_satgas.isNotBlank()) {
                                Text("Balasan: ${s.data.catatan_satgas}", fontSize = 12.sp, color = BgnOnSurfaceVariant)
                            }
                        }
                    }
                }
                is TiketUiState.Error -> {
                    Text(text = s.message, color = StatusError, fontSize = 13.sp)
                }
                else -> Unit
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(modifier = Modifier.height(16.dp))

            // === Section 2: Ticket tracking ===
            Text(
                text = stringResource(R.string.label_tiket_tracking),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = BgnPrimary
            )
            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = tiketInput,
                    onValueChange = { tiketInput = it },
                    label = { Text(stringResource(R.string.hint_nomor_tiket)) },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    onClick = { laporanViewModel.trackTiket(tiketInput) },
                    colors = ButtonDefaults.buttonColors(containerColor = BgnPrimary),
                    enabled = tiketState !is TiketUiState.Loading
                ) {
                    Text(stringResource(R.string.btn_cek_tiket))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Tiket result
            when (val t = tiketState) {
                is TiketUiState.Loading -> {
                    CircularProgressIndicator(color = BgnPrimary, modifier = Modifier.size(24.dp))
                }
                is TiketUiState.Found -> {
                    val statusColor = when (t.data.status.lowercase()) {
                        "selesai", "resolved" -> StatusSuccess
                        "proses", "processing" -> StatusWarning
                        else -> BgnSecondary
                    }
                    Surface(
                        color = statusColor.copy(alpha = 0.08f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(t.data.nomor_tiket, fontWeight = FontWeight.Bold, color = BgnPrimary)
                            Text("Kategori: ${t.data.kategori}", fontSize = 13.sp)
                            Text("Sekolah: ${t.data.target_sekolah}", fontSize = 13.sp)
                            Text(
                                text = t.data.status,
                                color = statusColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            if (t.data.catatan_satgas.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "Catatan Satgas: ${t.data.catatan_satgas}",
                                    fontSize = 12.sp,
                                    color = BgnOnSurfaceVariant
                                )
                            }
                        }
                    }
                }
                is TiketUiState.NotFound -> {
                    Text("Tiket tidak ditemukan.", color = StatusWarning, fontSize = 13.sp)
                }
                is TiketUiState.Error -> {
                    Text(text = t.message, color = StatusError, fontSize = 13.sp)
                }
                else -> Unit
            }

            // Bottom padding
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}
