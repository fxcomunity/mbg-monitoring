package id.go.bgn.radarmbg.data.api

import id.go.bgn.radarmbg.BuildConfig
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

object ApiClient {

    // Endpoint utama (Pages Functions)
    private const val BASE_URL = "https://mbg.jack-ai.my.id/"

    // Worker auth standalone — dipakai khusus untuk login/register/session
    // karena Pages Function auth_user masih dalam perbaikan
    const val AUTH_WORKER_URL = "https://mbg-auth.aqsholhalqi4.workers.dev"

    // Worker data (KV) — menggantikan Pages Functions yang gagal build
    private const val DATA_WORKER_URL = "https://mbg-data.aqsholhalqi4.workers.dev"

    // Worker menu (Neon DB via raw fetch) — menggantikan Pages Functions yang gagal build
    private const val MENU_WORKER_URL = "https://mbg-menu.aqsholhalqi4.workers.dev"

    private val cookieStore = ConcurrentHashMap<String, List<Cookie>>()

    private val cookieJar = object : CookieJar {
        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            cookieStore[url.host] = cookies
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> {
            return cookieStore[url.host] ?: emptyList()
        }
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
    }

    private val okHttpClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
                .addHeader("X-Requested-By", "mbg-radar")
                .build()
            chain.proceed(request)
        }
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    val instance: ApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }

    // Auth instance — pakai Worker standalone yang sudah terbukti bekerja
    val authInstance: AuthApiService by lazy {
        Retrofit.Builder()
            .baseUrl("$AUTH_WORKER_URL/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AuthApiService::class.java)
    }

    // Data instance — Worker KV standalone (telemetri & distribusi)
    val dataInstance: DataApiService by lazy {
        Retrofit.Builder()
            .baseUrl("$DATA_WORKER_URL/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(DataApiService::class.java)
    }

    // Menu instance — Worker Neon DB standalone (menu harian)
    val menuInstance: MenuApiService by lazy {
        Retrofit.Builder()
            .baseUrl("$MENU_WORKER_URL/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(MenuApiService::class.java)
    }

    fun clearCookies() {
        cookieStore.clear()
    }
}
