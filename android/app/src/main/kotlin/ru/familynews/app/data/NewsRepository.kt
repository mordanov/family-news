package ru.familynews.app.data

import android.net.Uri
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import ru.familynews.app.data.remote.NewsApi
import ru.familynews.app.data.remote.NewsColorDto
import ru.familynews.app.data.remote.NewsItemDto
import ru.familynews.app.data.remote.NewsListResponse
import ru.familynews.app.data.remote.NewsMediaDto
import ru.familynews.app.media.MediaPreprocessor
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

class NewsRepository(
    private val api: NewsApi,
    private val mediaPreprocessor: MediaPreprocessor,
) {
    private val textPlain = "text/plain; charset=UTF-8".toMediaType()
    private val jsonType = "application/json; charset=UTF-8".toMediaType()

    suspend fun colors(): List<NewsColorDto> = wrap { api.getColors() }

    suspend fun listNews(page: Int): NewsListResponse = wrap { api.listNews(page) }

    suspend fun createNewsDraft(
        description: String,
        color: String,
        createdAt: String?,
        isPublished: Boolean,
    ): NewsItemDto = wrap {
        api.createNews(
            description = description.toRequestBody(textPlain),
            color = color.toRequestBody(textPlain),
            createdAt = createdAt?.toRequestBody(textPlain),
            isPublished = isPublished.toString().toRequestBody(textPlain),
            media = null,
            photos = null,
        )
    }

    suspend fun uploadNewsMedia(newsId: Long, uri: Uri): NewsMediaDto = wrap {
        val part = mediaPreprocessor.toUploadPart(uri, "media_file")
        api.uploadMedia(newsId, part)
    }

    suspend fun createNewsWithMedia(
        description: String,
        color: String,
        createdAt: String?,
        isPublished: Boolean,
        mediaUris: List<Uri>,
    ): NewsItemDto {
        val parts = mediaUris.map { mediaPreprocessor.toUploadPart(it, "media") }
        return wrap {
            api.createNews(
                description = description.toRequestBody(textPlain),
                color = color.toRequestBody(textPlain),
                createdAt = createdAt?.toRequestBody(textPlain),
                isPublished = isPublished.toString().toRequestBody(textPlain),
                media = parts.ifEmpty { null },
                photos = null,
            )
        }
    }

    suspend fun updateNews(
        id: Long,
        description: String,
        color: String,
        createdAt: String?,
        isPublished: Boolean,
        deletePhotoIds: List<Long>,
        newMediaUris: List<Uri>,
    ): NewsItemDto {
        val parts = newMediaUris.map { mediaPreprocessor.toUploadPart(it, "new_media") }
        val deleteJson = "[${deletePhotoIds.joinToString(",")}]"
        return wrap {
            api.updateNews(
                id = id,
                description = description.toRequestBody(textPlain),
                color = color.toRequestBody(textPlain),
                createdAt = createdAt?.toRequestBody(textPlain),
                isPublished = isPublished.toString().toRequestBody(textPlain),
                deletePhotoIds = deleteJson.toRequestBody(jsonType),
                newMedia = parts.ifEmpty { null },
                newPhotos = null,
            )
        }
    }

    suspend fun rotatePublicLink(id: Long): NewsItemDto = wrap { api.rotatePublicLink(id) }

    suspend fun deleteNews(id: Long) = wrap {
        val r = api.deleteNews(id)
        if (!r.isSuccessful) throw HttpException(r)
    }

    suspend fun deletePhoto(newsId: Long, photoId: Long) = wrap {
        val r = api.deletePhoto(newsId, photoId)
        if (!r.isSuccessful) throw HttpException(r)
    }

    private suspend fun <T> wrap(block: suspend () -> T): T = try {
        block()
    } catch (e: HttpException) {
        val body = e.response()?.errorBody()?.string().orEmpty()
        val detail = """"detail"\s*:\s*"([^"]*)"""".toRegex().find(body)?.groupValues?.get(1)
        throw Exception(detail?.ifBlank { null } ?: (e.message ?: "Ошибка запроса"))
    }

    companion object {
        fun formatCreatedAt(instant: Instant): String {
            val z = instant.atZone(ZoneId.of("Europe/Madrid"))
            return String.format(
                Locale.US,
                "%04d-%02d-%02dT%02d:%02d",
                z.year,
                z.monthValue,
                z.dayOfMonth,
                z.hour,
                z.minute,
            )
        }

        fun parseCreatedAtFromApi(iso: String?): String? {
            if (iso.isNullOrBlank()) return null
            return runCatching {
                val instant = Instant.parse(iso)
                formatCreatedAt(instant)
            }.getOrNull()
        }
    }
}
