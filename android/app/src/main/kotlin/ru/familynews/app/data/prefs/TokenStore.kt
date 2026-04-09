package ru.familynews.app.data.prefs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

class TokenStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("access_token")
    private val baseUrlKey = stringPreferencesKey("base_url")

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[tokenKey] }
    val baseUrlFlow: Flow<String?> = context.dataStore.data.map { it[baseUrlKey] }

    suspend fun setToken(token: String?) {
        context.dataStore.edit { prefs ->
            if (token == null) prefs.remove(tokenKey) else prefs[tokenKey] = token
        }
    }

    suspend fun setBaseUrl(url: String) {
        context.dataStore.edit { it[baseUrlKey] = url.trimEnd('/') }
    }

    suspend fun token(): String? = tokenFlow.first()

    suspend fun baseUrl(): String? = baseUrlFlow.first()
}
