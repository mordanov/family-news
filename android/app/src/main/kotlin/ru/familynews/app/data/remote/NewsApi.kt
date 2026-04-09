package ru.familynews.app.data.remote

import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.Field
import retrofit2.http.FormUrlEncoded
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface NewsApi {
    @FormUrlEncoded
    @POST("auth/login")
    suspend fun login(
        @Field("username") username: String,
        @Field("password") password: String,
    ): TokenResponse

    @GET("auth/me")
    suspend fun me(): MeResponse

    @GET("news/meta/colors")
    suspend fun getColors(): List<NewsColorDto>

    @GET("news")
    suspend fun listNews(
        @Query("page") page: Int,
        @Query("per_page") perPage: Int = 10,
    ): NewsListResponse

    @GET("news/public/{token}")
    suspend fun getPublicNews(@Path("token") token: String): NewsItemDto

    @Multipart
    @POST("news")
    suspend fun createNews(
        @Part("description") description: RequestBody,
        @Part("color") color: RequestBody,
        @Part("created_at") createdAt: RequestBody?,
        @Part("is_published") isPublished: RequestBody,
        @Part media: List<MultipartBody.Part>?,
        @Part photos: List<MultipartBody.Part>?,
    ): NewsItemDto

    @Multipart
    @POST("news/{id}/media")
    suspend fun uploadMedia(
        @Path("id") id: Long,
        @Part mediaFile: MultipartBody.Part,
    ): NewsMediaDto

    @Multipart
    @PUT("news/{id}")
    suspend fun updateNews(
        @Path("id") id: Long,
        @Part("description") description: RequestBody,
        @Part("color") color: RequestBody,
        @Part("created_at") createdAt: RequestBody?,
        @Part("is_published") isPublished: RequestBody,
        @Part("delete_photo_ids") deletePhotoIds: RequestBody,
        @Part newMedia: List<MultipartBody.Part>?,
        @Part newPhotos: List<MultipartBody.Part>?,
    ): NewsItemDto

    @POST("news/{id}/public-link/rotate")
    suspend fun rotatePublicLink(@Path("id") id: Long): NewsItemDto

    @DELETE("news/{id}")
    suspend fun deleteNews(@Path("id") id: Long): Response<Unit>

    @DELETE("news/{newsId}/photos/{photoId}")
    suspend fun deletePhoto(
        @Path("newsId") newsId: Long,
        @Path("photoId") photoId: Long,
    ): Response<Unit>

    @GET("users")
    suspend fun listUsers(): List<UserDto>

    @POST("users")
    suspend fun createUser(@Body body: CreateUserBody): UserDto

    @DELETE("users/{id}")
    suspend fun deleteUser(@Path("id") id: Long): Response<Unit>

    @PATCH("users/{id}/role")
    suspend fun updateUserRole(
        @Path("id") id: Long,
        @Body body: RoleBody,
    ): UserDto
}

data class CreateUserBody(
    val login: String,
    val password: String,
    val role: String = "read_only",
)

data class RoleBody(
    val role: String,
)
