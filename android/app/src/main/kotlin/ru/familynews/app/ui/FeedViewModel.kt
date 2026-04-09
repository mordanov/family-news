package ru.familynews.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import ru.familynews.app.FamilyNewsApp
import ru.familynews.app.data.NewsRepository
import ru.familynews.app.data.remote.NetworkFactory
import ru.familynews.app.data.remote.NewsItemDto
import ru.familynews.app.media.MediaPreprocessor

class FeedViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as FamilyNewsApp
    private fun repo() = NewsRepository(
        NetworkFactory.createNewsApi(app.baseUrl) { app.accessToken },
        MediaPreprocessor(app),
    )

    var items by mutableStateOf<List<NewsItemDto>>(emptyList())
    var page by mutableIntStateOf(1)
    var totalPages by mutableIntStateOf(1)
    var loading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)
    var colorValues by mutableStateOf<Map<String, String>>(emptyMap())

    fun load(pageNum: Int = page) {
        viewModelScope.launch {
            loading = true
            error = null
            try {
                if (colorValues.isEmpty()) {
                    colorValues = try {
                        repo().colors().associate { it.id to it.value }
                    } catch (_: Exception) {
                        mapOf("amber" to "#F59E0B", "teal" to "#006D5B", "blue" to "#3B82F6")
                    }
                }
                val data = repo().listNews(pageNum)
                items = data.items
                page = data.page
                totalPages = data.pages
            } catch (e: Exception) {
                error = e.message ?: "Не удалось загрузить новости"
            } finally {
                loading = false
            }
        }
    }

    fun deleteNews(id: Long) {
        viewModelScope.launch {
            try {
                repo().deleteNews(id)
                load(page)
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    fun rotateLink(id: Long) {
        viewModelScope.launch {
            try {
                repo().rotatePublicLink(id)
                load(page)
            } catch (e: Exception) {
                error = e.message
            }
        }
    }
}
