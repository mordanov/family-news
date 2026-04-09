package ru.familynews.app.data

import retrofit2.HttpException
import ru.familynews.app.data.remote.CreateUserBody
import ru.familynews.app.data.remote.NewsApi
import ru.familynews.app.data.remote.RoleBody
import ru.familynews.app.data.remote.UserDto

class UserRepository(private val api: NewsApi) {

    suspend fun list(): List<UserDto> = wrap { api.listUsers() }

    suspend fun create(login: String, password: String, role: String): UserDto = wrap {
        api.createUser(CreateUserBody(login = login, password = password, role = role))
    }

    suspend fun delete(id: Long) = wrap {
        val r = api.deleteUser(id)
        if (!r.isSuccessful) throw HttpException(r)
    }

    suspend fun updateRole(id: Long, role: String): UserDto = wrap {
        api.updateUserRole(id, RoleBody(role))
    }

    private suspend fun <T> wrap(block: suspend () -> T): T = try {
        block()
    } catch (e: HttpException) {
        val body = e.response()?.errorBody()?.string().orEmpty()
        val detail = """"detail"\s*:\s*"([^"]*)"""".toRegex().find(body)?.groupValues?.get(1)
        throw Exception(detail?.ifBlank { null } ?: (e.message ?: "Ошибка запроса"))
    }
}
