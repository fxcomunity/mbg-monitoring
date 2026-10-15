package id.go.bgn.radarmbg.data.api

import id.go.bgn.radarmbg.data.api.models.AuthResponse
import id.go.bgn.radarmbg.data.api.models.ChatResponse
import id.go.bgn.radarmbg.data.api.models.DistribusiWrapper
import id.go.bgn.radarmbg.data.api.models.MenuWrapper
import id.go.bgn.radarmbg.data.api.models.NotifikasiData
import id.go.bgn.radarmbg.data.api.models.TelemetriWrapper
import id.go.bgn.radarmbg.data.api.models.TiketWrapper
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

interface ApiService {

    @GET("api/auth_user")
    suspend fun checkSession(): AuthResponse

    @FormUrlEncoded
    @POST("api/auth_user")
    suspend fun login(
        @Field("action") action: String = "login",
        @Field("username") username: String,
        @Field("password") password: String
    ): AuthResponse

    @FormUrlEncoded
    @POST("api/auth_user")
    suspend fun register(
        @Field("action") action: String = "register",
        @Field("full_name") fullName: String,
        @Field("email") email: String,
        @Field("username") username: String,
        @Field("password") password: String,
        @Field("role") role: String,
        @Field("sppg_name") sppgName: String = ""
    ): AuthResponse

    @GET("api/telemetri")
    suspend fun getTelemetri(): TelemetriWrapper

    @GET("api/distribusi")
    suspend fun getDistribusi(): DistribusiWrapper

    @GET("api/menu")
    suspend fun getMenu(): MenuWrapper

    @GET("api/notifications")
    suspend fun getNotifikasi(): NotifikasiData

    @GET("api/tiket")
    suspend fun getTiket(@Query("tiket") tiket: String): TiketWrapper

    @FormUrlEncoded
    @POST("api/live_chat")
    suspend fun sendChat(
        @Field("message") message: String,
        @Field("session_id") sessionId: String = ""
    ): ChatResponse
}
