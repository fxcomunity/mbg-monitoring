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
    object Registered : AuthUiState()
    data class Error(val message: String) : AuthUiState()
    object LoggedOut : AuthUiState()
}

sealed class PasswordChangeState {
    object Idle : PasswordChangeState()
    object Loading : PasswordChangeState()
    data class Success(val message: String) : PasswordChangeState()
    data class Error(val message: String) : PasswordChangeState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState = _uiState.asStateFlow()
    private val _passwordChangeState = MutableStateFlow<PasswordChangeState>(PasswordChangeState.Idle)
    val passwordChangeState = _passwordChangeState.asStateFlow()

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
                    val user = response.user
                    if (response.status == "success" && user != null) {
                        SessionDataStore.saveSession(getApplication(), user)
                        _uiState.value = AuthUiState.Success(user)
                    } else {
                        _uiState.value = AuthUiState.Error(response.message ?: "Login gagal.")
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
                    if (response.status == "success") {
                        _uiState.value = AuthUiState.Registered
                    } else {
                        _uiState.value = AuthUiState.Error(
                            response.message ?: "Registrasi gagal."
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

    fun changePassword(currentPassword: String, newPassword: String, confirmPassword: String) {
        if (currentPassword.isBlank() || newPassword.isBlank() || confirmPassword.isBlank()) {
            _passwordChangeState.value = PasswordChangeState.Error("Semua kolom kata sandi wajib diisi.")
            return
        }
        if (newPassword.length < 6) {
            _passwordChangeState.value = PasswordChangeState.Error("Kata sandi baru minimal 6 karakter.")
            return
        }
        if (newPassword != confirmPassword) {
            _passwordChangeState.value = PasswordChangeState.Error("Konfirmasi kata sandi baru tidak cocok.")
            return
        }

        viewModelScope.launch {
            _passwordChangeState.value = PasswordChangeState.Loading
            AuthRepository.changePassword(currentPassword, newPassword, confirmPassword)
                .onSuccess { response ->
                    _passwordChangeState.value = if (response.status == "success") {
                        PasswordChangeState.Success(response.message)
                    } else {
                        PasswordChangeState.Error(response.message.ifBlank { "Kata sandi gagal diperbarui." })
                    }
                }
                .onFailure { error ->
                    _passwordChangeState.value = PasswordChangeState.Error(
                        error.message ?: "Kata sandi gagal diperbarui. Coba lagi."
                    )
                }
        }
    }

    fun resetPasswordChangeState() {
        _passwordChangeState.value = PasswordChangeState.Idle
    }
}
