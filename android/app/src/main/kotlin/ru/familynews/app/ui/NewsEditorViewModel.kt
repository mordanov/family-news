package ru.familynews.app.ui

import android.app.Application
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import ru.familynews.app.FamilyNewsApp
import ru.familynews.app.data.NewsRepository
import ru.familynews.app.data.remote.NetworkFactory
import ru.familynews.app.data.remote.NewsColorDto
import ru.familynews.app.data.remote.NewsItemDto
import ru.familynews.app.media.MediaPreprocessor
import java.time.Instant
import kotlin.math.max

class NewsEditorViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as FamilyNewsApp
    private fun repo() = NewsRepository(
        NetworkFactory.createNewsApi(app.baseUrl) { app.accessToken },
        MediaPreprocessor(application),
    )

    var description by mutableStateOf("")
    var selectedColor by mutableStateOf("amber")
    var createdAtLocal by mutableStateOf(NewsRepository.formatCreatedAt(Instant.now()))
    var isPublished by mutableStateOf(false)
    val newUris = mutableStateListOf<Uri>()
    val deletedMediaIds = mutableStateListOf<Long>()
    var colors by mutableStateOf<List<NewsColorDto>>(emptyList())

    var editing: NewsItemDto? = null

    var saving by mutableStateOf(false)
    var uploadDone by mutableStateOf(0)
    var uploadTotal by mutableStateOf(0)
    var error by mutableStateOf<String?>(null)

    fun resetForCreate() {
        editing = null
        description = ""
        selectedColor = "amber"
        createdAtLocal = NewsRepository.formatCreatedAt(Instant.now())
        isPublished = false
        newUris.clear()
        deletedMediaIds.clear()
    }

    fun loadForEdit(item: NewsItemDto) {
        editing = item
        description = item.description
        selectedColor = item.color
        createdAtLocal = NewsRepository.parseCreatedAtFromApi(item.createdAt)
            ?: NewsRepository.formatCreatedAt(Instant.now())
        isPublished = item.isPublished
        newUris.clear()
        deletedMediaIds.clear()
    }

    fun loadColors() {
        viewModelScope.launch {
            try {
                colors = repo().colors()
            } catch (_: Exception) {
                colors = defaultColors()
            }
        }
    }

    fun removeExistingMedia(id: Long) {
        if (editing != null && !deletedMediaIds.contains(id)) {
            deletedMediaIds.add(id)
        }
    }

    fun addNewUris(uris: List<Uri>) {
        for (u in uris) newUris.add(u)
    }

    fun removeNewUri(uri: Uri) {
        newUris.remove(uri)
    }

    fun save(onDone: () -> Unit) {
        val desc = description.trim()
        if (desc.isEmpty()) {
            error = "Введите описание"
            return
        }
        viewModelScope.launch {
            saving = true
            error = null
            uploadDone = 0
            try {
                val edit = editing
                if (edit == null) {
                    val draft = repo().createNewsDraft(
                        description = desc,
                        color = selectedColor,
                        createdAt = createdAtLocal.ifBlank { null },
                        isPublished = isPublished,
                    )
                    uploadTotal = newUris.size
                    for (uri in newUris) {
                        repo().uploadNewsMedia(draft.id, uri)
                        uploadDone += 1
                    }
                } else {
                    uploadTotal = maxOf(newUris.size, 1)
                    uploadDone = 0
                    repo().updateNews(
                        id = edit.id,
                        description = desc,
                        color = selectedColor,
                        createdAt = createdAtLocal.ifBlank { null },
                        isPublished = isPublished,
                        deletePhotoIds = deletedMediaIds.toList(),
                        newMediaUris = newUris.toList(),
                    )
                    uploadDone = uploadTotal
                }
                onDone()
            } catch (e: Exception) {
                error = e.message ?: "Ошибка сохранения"
            } finally {
                saving = false
            }
        }
    }

    private fun defaultColors(): List<NewsColorDto> = listOf(
        NewsColorDto("amber", "Оранжево-жёлтый", "#F59E0B"),
        NewsColorDto("teal", "Бирюзовый", "#006D5B"),
        NewsColorDto("blue", "Синий", "#3B82F6"),
    )
}
