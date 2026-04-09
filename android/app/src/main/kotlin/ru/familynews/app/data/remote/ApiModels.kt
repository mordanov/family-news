package ru.familynews.app.data.remote

import com.squareup.moshi.Json

data class TokenResponse(
    @Json(name = "access_token") val accessToken: String,
    @Json(name = "token_type") val tokenType: String,
)

data class MeResponse(
    @Json(name = "user_id") val userId: Long,
    val login: String,
    val role: String,
)

data class NewsColorDto(
    val id: String,
    val label: String,
    val value: String,
)

data class NewsMediaDto(
    val id: Long,
    @Json(name = "media_kind") val mediaKind: String,
    @Json(name = "mime_type") val mimeType: String?,
    @Json(name = "size_bytes") val sizeBytes: Long,
    val url: String,
    @Json(name = "thumbnail_url") val thumbnailUrl: String?,
)

data class NewsItemDto(
    val id: Long,
    val description: String,
    val color: String,
    @Json(name = "created_at") val createdAt: String?,
    @Json(name = "updated_at") val updatedAt: String?,
    val author: String?,
    @Json(name = "is_published") val isPublished: Boolean,
    @Json(name = "public_token") val publicToken: String?,
    val media: List<NewsMediaDto> = emptyList(),
    val photos: List<NewsMediaDto> = emptyList(),
)

data class NewsListResponse(
    val total: Int,
    val page: Int,
    @Json(name = "per_page") val perPage: Int,
    val pages: Int,
    val items: List<NewsItemDto>,
)

data class UserDto(
    val id: Long,
    val login: String,
    val role: String,
    @Json(name = "created_at") val createdAt: String?,
)
