package id.go.bgn.radarmbg.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.api.models.MenuData
import id.go.bgn.radarmbg.data.repository.DataRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class MenuUiState {
    object Loading : MenuUiState()
    data class Success(
        val allItems: List<MenuData>,
        val filtered: List<MenuData>,
        val kotaList: List<String>,
        val selectedKota: String
    ) : MenuUiState()
    data class Error(val message: String) : MenuUiState()
}

class MenuViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<MenuUiState>(MenuUiState.Loading)
    val uiState = _uiState.asStateFlow()

    fun loadMenu() {
        viewModelScope.launch {
            _uiState.value = MenuUiState.Loading
            DataRepository.getMenu()
                .onSuccess { items ->
                    val kotaList = items.map { it.city }.distinct().sorted()
                    _uiState.value = MenuUiState.Success(
                        allItems = items,
                        filtered = items,
                        kotaList = kotaList,
                        selectedKota = ""
                    )
                }
                .onFailure { throwable ->
                    _uiState.value = MenuUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }

    fun filterByKota(kota: String) {
        val current = _uiState.value as? MenuUiState.Success ?: return
        val filtered = if (kota.isBlank()) {
            current.allItems
        } else {
            current.allItems.filter { it.city.equals(kota, ignoreCase = true) }
        }
        _uiState.value = current.copy(filtered = filtered, selectedKota = kota)
    }
}
