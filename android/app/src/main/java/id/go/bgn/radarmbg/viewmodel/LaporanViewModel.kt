package id.go.bgn.radarmbg.viewmodel

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.api.models.TiketData
import id.go.bgn.radarmbg.data.repository.DataRepository
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class TiketUiState {
    object Idle : TiketUiState()
    object Loading : TiketUiState()
    data class Found(val data: TiketData) : TiketUiState()
    object NotFound : TiketUiState()
    data class Error(val message: String) : TiketUiState()
}

class LaporanViewModel : ViewModel() {

    // Form state
    val nama = MutableStateFlow("")
    val telepon = MutableStateFlow("")
    val role = MutableStateFlow("wali")
    val kategori = MutableStateFlow("waktu")
    val sekolah = MutableStateFlow("")
    val tanggal = MutableStateFlow(SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()))
    val deskripsi = MutableStateFlow("")
    val photoUri = MutableStateFlow<Uri?>(null)

    private val _tiketState = MutableStateFlow<TiketUiState>(TiketUiState.Idle)
    val tiketState = _tiketState.asStateFlow()

    private val _submitState = MutableStateFlow<TiketUiState>(TiketUiState.Idle)
    val submitState = _submitState.asStateFlow()

    fun trackTiket(tiketId: String) {
        viewModelScope.launch {
            _tiketState.value = TiketUiState.Loading
            DataRepository.getTiket(tiketId)
                .onSuccess { wrapper ->
                    if (wrapper.data != null) {
                        _tiketState.value = TiketUiState.Found(wrapper.data)
                    } else {
                        _tiketState.value = TiketUiState.NotFound
                    }
                }
                .onFailure { throwable ->
                    _tiketState.value = TiketUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }

    fun submitLaporan(context: Context) {
        viewModelScope.launch {
            if (nama.value.isBlank() || sekolah.value.isBlank() || deskripsi.value.isBlank()
                || !Regex("^[0-9+()\\-\\s]{8,20}$").matches(telepon.value.trim())) {
                _submitState.value = TiketUiState.Error(
                    "Nama, nomor telepon, sekolah, dan deskripsi wajib diisi dengan benar."
                )
                return@launch
            }
            _submitState.value = TiketUiState.Loading
            DataRepository.submitTiket(
                context = context.applicationContext,
                photoUri = photoUri.value,
                reporterName = nama.value.trim(),
                reporterPhone = telepon.value.trim(),
                reporterRole = role.value,
                issueCategory = kategori.value,
                schoolTarget = sekolah.value.trim(),
                incidentDate = tanggal.value,
                description = deskripsi.value.trim()
            ).onSuccess { response ->
                if (response.status == "success" && response.ticket_code.isNotBlank()) {
                    _submitState.value = TiketUiState.Found(
                        TiketData(
                            nomor_tiket = response.ticket_code,
                            kategori = kategori.value,
                            target_sekolah = sekolah.value,
                            status = "masuk",
                            priority = "sedang",
                            tanggal_lapor = tanggal.value,
                            nama_pelapor = nama.value,
                            deskripsi = deskripsi.value,
                            catatan_satgas = response.message
                        )
                    )
                    photoUri.value = null
                } else {
                    _submitState.value = TiketUiState.Error(
                        response.message.ifBlank { "Laporan gagal disimpan. Coba lagi." }
                    )
                }
            }.onFailure { throwable ->
                _submitState.value = TiketUiState.Error(
                    throwable.message ?: "Terjadi kesalahan. Coba lagi."
                )
            }
        }
    }
}
