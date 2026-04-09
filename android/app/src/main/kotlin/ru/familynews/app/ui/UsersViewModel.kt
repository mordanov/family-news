package ru.familynews.app.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch
import ru.familynews.app.FamilyNewsApp
import ru.familynews.app.data.UserRepository
import ru.familynews.app.data.remote.NetworkFactory
import ru.familynews.app.data.remote.UserDto

class UsersViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as FamilyNewsApp
    private fun repo() = UserRepository(NetworkFactory.createNewsApi(app.baseUrl) { app.accessToken })

    var users by mutableStateOf<List<UserDto>>(emptyList())
    var loading by mutableStateOf(false)
    var error by mutableStateOf<String?>(null)

    var newLogin by mutableStateOf("")
    var newPassword by mutableStateOf("")
    var newRole by mutableStateOf("read_only")

    fun load() {
        viewModelScope.launch {
            loading = true
            error = null
            try {
                users = repo().list()
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }
    }

    fun createUser() {
        viewModelScope.launch {
            loading = true
            error = null
            try {
                repo().create(newLogin.trim(), newPassword, newRole)
                newLogin = ""
                newPassword = ""
                load()
            } catch (e: Exception) {
                error = e.message
            } finally {
                loading = false
            }
        }
    }

    fun deleteUser(id: Long) {
        viewModelScope.launch {
            try {
                repo().delete(id)
                load()
            } catch (e: Exception) {
                error = e.message
            }
        }
    }

    fun setRole(id: Long, role: String) {
        viewModelScope.launch {
            try {
                repo().updateRole(id, role)
                load()
            } catch (e: Exception) {
                error = e.message
            }
        }
    }
}
