package id.go.bgn.radarmbg.data.api

import id.go.bgn.radarmbg.data.api.models.AuthResponse
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Interface untuk Worker auth standalone
 * URL: https://mbg-auth.aqsholhalqi4.workers.dev
 * Endpoint: GET / dan POST /
 */
interface AuthApiService {

    @GET("/")
    suspend fun checkSession(): AuthResponse

    @FormUrlEncoded
    @POST("/")
    suspend fun login(
        @Field("action") action: String = "login",
        @Field("username") username: String,
        @Field("password") password: String
    ): AuthResponse

    @FormUrlEncoded
    @POST("/")
    suspend fun register(
        @Field("action") action: String = "register",
        @Field("full_name") fullName: String,
        @Field("email") email: String,
        @Field("username") username: String,
        @Field("password") password: String,
        @Field("role") role: String,
        @Field("sppg_name") sppgName: String = ""
    ): AuthResponse
}
