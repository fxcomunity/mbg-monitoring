package id.go.bgn.radarmbg.data.api

import id.go.bgn.radarmbg.data.api.models.MenuWrapper
import retrofit2.http.GET
import retrofit2.http.Query

interface MenuApiService {

    @GET("/")
    suspend fun getMenu(@Query("date") date: String? = null): MenuWrapper
}
