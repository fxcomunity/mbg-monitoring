package id.go.bgn.radarmbg.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.api.models.ProvinsiData
import id.go.bgn.radarmbg.data.api.models.TelemetriData
import id.go.bgn.radarmbg.data.repository.DataRepository
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(
        val telemetri: TelemetriData,
        val distribusi: List<ProvinsiData>
    ) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

class HomeViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState = _uiState.asStateFlow()

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = HomeUiState.Loading

            val telemetriDeferred = async { DataRepository.getTelemetri() }
            val distribusiDeferred = async { DataRepository.getDistribusi() }

            val telemetriResult = telemetriDeferred.await()
            val distribusiResult = distribusiDeferred.await()

            if (telemetriResult.isSuccess && distribusiResult.isSuccess) {
                _uiState.value = HomeUiState.Success(
                    telemetri = telemetriResult.getOrThrow(),
                    distribusi = distribusiResult.getOrThrow()
                )
            } else {
                val error = telemetriResult.exceptionOrNull()
                    ?: distribusiResult.exceptionOrNull()
                _uiState.value = HomeUiState.Error(
                    error?.message ?: "Terjadi kesalahan. Coba lagi."
                )
            }
        }
    }
}
