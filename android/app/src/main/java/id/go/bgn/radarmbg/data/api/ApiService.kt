package id.go.bgn.radarmbg.data.api

import id.go.bgn.radarmbg.data.api.models.AuthResponse
import id.go.bgn.radarmbg.data.api.models.ChatResponse
import id.go.bgn.radarmbg.data.api.models.DistribusiWrapper
import id.go.bgn.radarmbg.data.api.models.MenuWrapper
import id.go.bgn.radarmbg.data.api.models.NotifikasiData
import id.go.bgn.radarmbg.data.api.models.ReportSubmitResponse
import id.go.bgn.radarmbg.data.api.models.TelemetriWrapper
import id.go.bgn.radarmbg.data.api.models.TiketWrapper
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.Multipart
import retrofit2.http.Part

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

    @Multipart
    @POST("api/tiket")
    suspend fun submitTiket(
        @Part("reporter_name") reporterName: RequestBody,
        @Part("reporter_phone") reporterPhone: RequestBody,
        @Part("reporter_role") reporterRole: RequestBody,
        @Part("issue_category") issueCategory: RequestBody,
        @Part("school_target") schoolTarget: RequestBody,
        @Part("incident_date") incidentDate: RequestBody,
        @Part("description") description: RequestBody,
        @Part photo: MultipartBody.Part?
    ): ReportSubmitResponse

    @FormUrlEncoded
    @POST("api/live_chat")
    suspend fun sendChat(
        @Field("message") message: String,
        @Field("session_id") sessionId: String = "",
        @Field("action") action: String = "send",
        @Field("target_type") targetType: String = "admin",
        @Field("sender_name") senderName: String = "",
        @Field("target_sppg_name") targetSppgName: String = "",
        @Field("history") history: String = ""
    ): ChatResponse
}
