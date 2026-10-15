package id.go.bgn.radarmbg.data.repository

import id.go.bgn.radarmbg.data.api.ApiClient
import id.go.bgn.radarmbg.data.api.models.AuthResponse

object AuthRepository {

    suspend fun checkSession(): Result<AuthResponse> = runCatching {
        ApiClient.instance.checkSession()
    }

    suspend fun login(username: String, password: String): Result<AuthResponse> = runCatching {
        ApiClient.instance.login(username = username, password = password)
    }

    suspend fun register(
        fullName: String,
        email: String,
        username: String,
        password: String,
        role: String,
        sppgName: String
    ): Result<AuthResponse> = runCatching {
        ApiClient.instance.register(
            fullName = fullName,
            email = email,
            username = username,
            password = password,
            role = role,
            sppgName = sppgName
        )
    }

    suspend fun logout(): Result<Unit> = runCatching {
        ApiClient.clearCookies()
    }
}
