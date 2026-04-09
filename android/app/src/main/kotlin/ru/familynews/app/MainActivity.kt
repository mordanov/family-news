package ru.familynews.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.activity.ComponentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import ru.familynews.app.ui.AuthViewModel
import ru.familynews.app.ui.FeedScreen
import ru.familynews.app.ui.FeedViewModel
import ru.familynews.app.ui.LoginScreen
import ru.familynews.app.ui.NewsEditorDialog
import ru.familynews.app.ui.NewsEditorViewModel
import ru.familynews.app.ui.UsersScreen
import ru.familynews.app.ui.UsersViewModel
import ru.familynews.app.ui.theme.FamilyNewsTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            FamilyNewsTheme {
                val app = application as FamilyNewsApp
                val auth: AuthViewModel = viewModel()
                val feed: FeedViewModel = viewModel()
                val users: UsersViewModel = viewModel()
                val editor: NewsEditorViewModel = viewModel()

                LaunchedEffect(Unit) { auth.refreshSession() }
                LaunchedEffect(app.baseUrl) {
                    if (auth.baseUrlInput.isBlank()) {
                        auth.baseUrlInput = app.baseUrl
                    }
                }

                var showUsers by remember { mutableStateOf(false) }
                var showEditor by remember { mutableStateOf(false) }

                when {
                    !auth.sessionChecked || (auth.loading && auth.me == null) -> {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    }
                    auth.me == null -> LoginScreen(auth)
                    showUsers && auth.me?.role == "full_access" -> {
                        UsersScreen(
                            usersVm = users,
                            auth = auth,
                            onBack = { showUsers = false },
                        )
                    }
                    else -> {
                        FeedScreen(
                            app = app,
                            auth = auth,
                            feed = feed,
                            onOpenEditor = { item ->
                                if (item == null) {
                                    editor.resetForCreate()
                                } else {
                                    editor.loadForEdit(item)
                                }
                                editor.loadColors()
                                showEditor = true
                            },
                            onOpenUsers = { showUsers = true },
                        )
                    }
                }

                if (showEditor) {
                    NewsEditorDialog(
                        editor = editor,
                        onDismiss = { showEditor = false },
                        onSaved = { feed.load(feed.page) },
                    )
                }
            }
        }
    }
}
