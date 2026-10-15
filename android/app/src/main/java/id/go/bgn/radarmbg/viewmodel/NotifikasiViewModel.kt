package id.go.bgn.radarmbg.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.api.models.NotifikasiData
import id.go.bgn.radarmbg.data.repository.DataRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class NotifikasiUiState {
    object Loading : NotifikasiUiState()
    data class Success(val data: NotifikasiData) : NotifikasiUiState()
    data class Error(val message: String) : NotifikasiUiState()
}

class NotifikasiViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<NotifikasiUiState>(NotifikasiUiState.Loading)
    val uiState = _uiState.asStateFlow()

    fun loadNotifikasi() {
        viewModelScope.launch {
            _uiState.value = NotifikasiUiState.Loading
            DataRepository.getNotifikasi()
                .onSuccess { data ->
                    _uiState.value = NotifikasiUiState.Success(data)
                }
                .onFailure { throwable ->
                    _uiState.value = NotifikasiUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }
}
