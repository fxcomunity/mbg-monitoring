package id.go.bgn.radarmbg.viewmodel

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.api.models.TiketData
import id.go.bgn.radarmbg.data.repository.DataRepository
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
    val role = MutableStateFlow("")
    val kategori = MutableStateFlow("")
    val sekolah = MutableStateFlow("")
    val tanggal = MutableStateFlow("")
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

    fun submitLaporan() {
        viewModelScope.launch {
            _submitState.value = TiketUiState.Loading

            val payload = buildString {
                append("{")
                append("\"nama\":\"${nama.value}\",")
                append("\"telepon\":\"${telepon.value}\",")
                append("\"role\":\"${role.value}\",")
                append("\"kategori\":\"${kategori.value}\",")
                append("\"sekolah\":\"${sekolah.value}\",")
                append("\"tanggal\":\"${tanggal.value}\",")
                append("\"deskripsi\":\"${deskripsi.value}\"")
                append("}")
            }

            DataRepository.sendChat(message = payload)
                .onSuccess { response ->
                    // Generate local ticket reference from session_id or timestamp
                    val localTicket = if (response.session_id.isNotBlank()) {
                        "TKT-${response.session_id.takeLast(5).uppercase()}"
                    } else {
                        "TKT-${System.currentTimeMillis().toString().takeLast(5)}"
                    }
                    _submitState.value = TiketUiState.Found(
                        TiketData(
                            nomor_tiket = localTicket,
                            kategori = kategori.value,
                            target_sekolah = sekolah.value,
                            status = "Diterima",
                            priority = "Normal",
                            tanggal_lapor = tanggal.value,
                            nama_pelapor = nama.value,
                            deskripsi = deskripsi.value,
                            catatan_satgas = response.reply
                        )
                    )
                }
                .onFailure { throwable ->
                    _submitState.value = TiketUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }
}
