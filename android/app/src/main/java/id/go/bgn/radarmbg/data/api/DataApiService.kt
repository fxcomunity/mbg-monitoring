package id.go.bgn.radarmbg.data.api

import id.go.bgn.radarmbg.data.api.models.DistribusiWrapper
import id.go.bgn.radarmbg.data.api.models.TelemetriWrapper
import retrofit2.http.GET
import retrofit2.http.Query

interface DataApiService {

    @GET("/")
    suspend fun getTelemetri(@Query("type") type: String = "telemetri"): TelemetriWrapper

    @GET("/")
    suspend fun getDistribusi(@Query("type") type: String = "distribusi"): DistribusiWrapper
}
