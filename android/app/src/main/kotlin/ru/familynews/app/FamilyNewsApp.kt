package ru.familynews.app

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import ru.familynews.app.data.prefs.TokenStore

class FamilyNewsApp : Application() {

    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    lateinit var tokenStore: TokenStore
        private set

    @Volatile
    var accessToken: String? = null

    @Volatile
    var baseUrl: String = ""

    override fun onCreate() {
        super.onCreate()
        tokenStore = TokenStore(this)
        runBlocking {
            accessToken = tokenStore.token()
            baseUrl = tokenStore.baseUrl().orEmpty()
        }
        appScope.launch {
            tokenStore.tokenFlow.collectLatest { accessToken = it }
        }
        appScope.launch {
            tokenStore.baseUrlFlow.collectLatest { baseUrl = it.orEmpty() }
        }
    }
}
