package ru.familynews.app.data.remote

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object NetworkFactory {
    private const val READ_TIMEOUT_SEC = 120L
    private const val WRITE_TIMEOUT_SEC = 120L

    fun createMoshi(): Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    /**
     * [baseUrl] without trailing slash, e.g. https://news.example.com
     * Retrofit paths are relative to /api/
     */
    fun createNewsApi(
        baseUrl: String,
        debugLogging: Boolean = false,
        accessTokenProvider: () -> String?,
    ): NewsApi {
        val normalized = baseUrl.trimEnd('/')
        val apiRoot = "$normalized/api/".toHttpUrl()

        val authInterceptor = Interceptor { chain ->
            val req = chain.request()
            val token = accessTokenProvider()
            val next = if (token != null && !req.url.encodedPath.endsWith("/auth/login")) {
                req.newBuilder().header("Authorization", "Bearer $token").build()
            } else {
                req
            }
            chain.proceed(next)
        }

        val log = HttpLoggingInterceptor().apply {
            level = if (debugLogging) HttpLoggingInterceptor.Level.BODY else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT_SEC, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT_SEC, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .apply { if (debugLogging) addInterceptor(log) }
            .build()

        return Retrofit.Builder()
            .baseUrl(apiRoot)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(createMoshi()))
            .build()
            .create(NewsApi::class.java)
    }
}
