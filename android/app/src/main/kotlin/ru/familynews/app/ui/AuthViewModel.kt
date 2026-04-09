package ru.familynews.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import retrofit2.HttpException
import ru.familynews.app.FamilyNewsApp
import ru.familynews.app.data.remote.MeResponse
import ru.familynews.app.data.remote.NetworkFactory

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as FamilyNewsApp

    var baseUrlInput by mutableStateOf("")
    var loginInput by mutableStateOf("")
    var passwordInput by mutableStateOf("")
    var error by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)
    var me by mutableStateOf<MeResponse?>(null)
    var sessionChecked by mutableStateOf(false)

    init {
        baseUrlInput = app.baseUrl
    }

    private fun api() = NetworkFactory.createNewsApi(app.baseUrl.ifBlank { baseUrlInput.trim() }) { app.accessToken }

    fun refreshSession() {
        viewModelScope.launch {
            loading = true
            error = null
            try {
                if (app.baseUrl.isBlank() || app.accessToken.isNullOrBlank()) {
                    me = null
                } else {
                    me = api().me()
                }
            } catch (e: HttpException) {
                me = null
                if (e.code() == 401) {
                    app.tokenStore.setToken(null)
                }
                error = e.message ?: "Сессия недействительна"
            } catch (e: Exception) {
                me = null
                error = e.message ?: "Сессия недействительна"
            } finally {
                loading = false
                sessionChecked = true
            }
        }
    }

    fun saveBaseUrl() {
        val url = baseUrlInput.trim().trimEnd('/')
        if (url.isBlank()) {
            error = "Укажите адрес сервера"
            return
        }
        viewModelScope.launch {
            app.tokenStore.setBaseUrl(url)
            error = null
        }
    }

    fun login() {
        val url = app.baseUrl.ifBlank { baseUrlInput.trim().trimEnd('/') }
        if (url.isBlank()) {
            error = "Сначала укажите и сохраните адрес сервера"
            return
        }
        viewModelScope.launch {
            loading = true
            error = null
            try {
                if (app.baseUrl.isBlank()) {
                    app.tokenStore.setBaseUrl(url)
                }
                val client = NetworkFactory.createNewsApi(url) { null }
                val tokenResponse = client.login(loginInput.trim(), passwordInput.trim())
                val access = tokenResponse.accessToken
                app.tokenStore.setToken(access)
                passwordInput = ""
                me = NetworkFactory.createNewsApi(url) { access }.me()
            } catch (e: Exception) {
                error = e.message ?: "Ошибка входа"
            } finally {
                loading = false
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            app.tokenStore.setToken(null)
            me = null
        }
    }
}
