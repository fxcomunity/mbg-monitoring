package id.go.bgn.radarmbg.data.repository

import android.content.Context
import android.net.Uri
import id.go.bgn.radarmbg.data.api.ApiClient
import id.go.bgn.radarmbg.data.api.models.ChatResponse
import id.go.bgn.radarmbg.data.api.models.MenuData
import id.go.bgn.radarmbg.data.api.models.NotifikasiData
import id.go.bgn.radarmbg.data.api.models.ProvinsiData
import id.go.bgn.radarmbg.data.api.models.ReportSubmitResponse
import id.go.bgn.radarmbg.data.api.models.TelemetriData
import id.go.bgn.radarmbg.data.api.models.TiketWrapper
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

object DataRepository {

    suspend fun getTelemetri(): Result<TelemetriData> = runCatching {
        ApiClient.dataInstance.getTelemetri().data
    }

    suspend fun getDistribusi(): Result<List<ProvinsiData>> = runCatching {
        ApiClient.dataInstance.getDistribusi().data
    }

    suspend fun getMenu(): Result<List<MenuData>> = runCatching {
        ApiClient.menuInstance.getMenu().data
    }

    suspend fun getNotifikasi(): Result<NotifikasiData> = runCatching {
        ApiClient.instance.getNotifikasi()
    }

    suspend fun getTiket(tiketId: String): Result<TiketWrapper> = runCatching {
        ApiClient.instance.getTiket(tiket = tiketId)
    }

    suspend fun submitTiket(
        context: Context,
        photoUri: Uri?,
        reporterName: String,
        reporterPhone: String,
        reporterRole: String,
        issueCategory: String,
        schoolTarget: String,
        incidentDate: String,
        description: String
    ): Result<ReportSubmitResponse> = runCatching {
        fun textPart(value: String) = value.toRequestBody("text/plain".toMediaType())
        val photoPart = photoUri?.let { uri ->
            val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                ?: error("Foto laporan tidak dapat dibaca. Pilih foto kembali.")
            require(bytes.size <= 10 * 1024 * 1024) { "Ukuran foto maksimal 10 MB." }
            MultipartBody.Part.createFormData(
                "photo",
                "aduan.jpg",
                bytes.toRequestBody("image/jpeg".toMediaType())
            )
        }

        ApiClient.instance.submitTiket(
            reporterName = textPart(reporterName),
            reporterPhone = textPart(reporterPhone),
            reporterRole = textPart(reporterRole),
            issueCategory = textPart(issueCategory),
            schoolTarget = textPart(schoolTarget),
            incidentDate = textPart(incidentDate),
            description = textPart(description),
            photo = photoPart
        )
    }

    suspend fun sendChat(
        message: String,
        sessionId: String,
        targetType: String,
        targetSppgName: String,
        history: String
    ): Result<ChatResponse> = runCatching {
        ApiClient.instance.sendChat(
            message = message,
            sessionId = sessionId,
            targetType = targetType,
            targetSppgName = targetSppgName,
            history = history
        )
    }
}
