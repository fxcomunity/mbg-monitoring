package id.go.bgn.radarmbg.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import id.go.bgn.radarmbg.data.api.models.UserData
import id.go.bgn.radarmbg.data.local.SessionDataStore
import id.go.bgn.radarmbg.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    data class Success(val user: UserData) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
    object LoggedOut : AuthUiState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState = _uiState.asStateFlow()

    fun checkSession() {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            AuthRepository.checkSession()
                .onSuccess { response ->
                    if (response.logged_in && response.user != null) {
                        _uiState.value = AuthUiState.Success(response.user)
                    } else {
                        _uiState.value = AuthUiState.LoggedOut
                    }
                }
                .onFailure { throwable ->
                    _uiState.value = AuthUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }

    fun login(username: String, password: String) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            AuthRepository.login(username, password)
                .onSuccess { response ->
                    if (response.status == "success" && response.user != null) {
                        SessionDataStore.saveSession(getApplication(), response.user)
                        _uiState.value = AuthUiState.Success(response.user)
                    } else {
                        _uiState.value = AuthUiState.Error(
                            response.message ?: "Login gagal"
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.value = AuthUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }

    fun register(
        fullName: String,
        email: String,
        username: String,
        password: String,
        role: String,
        sppgName: String
    ) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            AuthRepository.register(fullName, email, username, password, role, sppgName)
                .onSuccess { response ->
                    if (response.status == "success" && response.user != null) {
                        SessionDataStore.saveSession(getApplication(), response.user)
                        _uiState.value = AuthUiState.Success(response.user)
                    } else {
                        _uiState.value = AuthUiState.Error(
                            response.message ?: "Terjadi kesalahan. Coba lagi."
                        )
                    }
                }
                .onFailure { throwable ->
                    _uiState.value = AuthUiState.Error(
                        throwable.message ?: "Terjadi kesalahan. Coba lagi."
                    )
                }
        }
    }

    fun logout() {
        viewModelScope.launch {
            AuthRepository.logout()
            SessionDataStore.clearSession(getApplication())
            _uiState.value = AuthUiState.LoggedOut
        }
    }
}
