package id.go.bgn.radarmbg.data.repository

import id.go.bgn.radarmbg.data.api.ApiClient
import id.go.bgn.radarmbg.data.api.models.ChatResponse
import id.go.bgn.radarmbg.data.api.models.MenuData
import id.go.bgn.radarmbg.data.api.models.NotifikasiData
import id.go.bgn.radarmbg.data.api.models.ProvinsiData
import id.go.bgn.radarmbg.data.api.models.TelemetriData
import id.go.bgn.radarmbg.data.api.models.TiketWrapper

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

    suspend fun sendChat(message: String): Result<ChatResponse> = runCatching {
        ApiClient.instance.sendChat(message = message)
    }
}
