package ru.familynews.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import ru.familynews.app.FamilyNewsApp
import ru.familynews.app.data.remote.NewsItemDto
import ru.familynews.app.data.remote.NewsMediaDto
import ru.familynews.app.util.UrlHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FeedScreen(
    app: FamilyNewsApp,
    auth: AuthViewModel,
    feed: FeedViewModel,
    onOpenEditor: (NewsItemDto?) -> Unit,
    onOpenUsers: () -> Unit,
) {
    val context = LocalContext.current
    LaunchedEffect(Unit) { feed.load(1) }

    var deleteNews by remember { mutableStateOf<NewsItemDto?>(null) }
    val full = auth.me?.role == "full_access"

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Новости") },
                actions = {
                    if (full) {
                        TextButton(onClick = onOpenUsers) { Text("Пользователи") }
                    }
                    IconButton(onClick = { auth.logout() }) {
                        Icon(Icons.Default.Logout, contentDescription = "Выйти")
                    }
                },
            )
        },
        floatingActionButton = {
            if (full) {
                FloatingActionButton(onClick = { onOpenEditor(null) }) {
                    Icon(Icons.Default.Add, contentDescription = "Добавить")
                }
            }
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (feed.loading && feed.items.isEmpty()) {
                CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(24.dp))
            }
            feed.error?.let { err ->
                Text(
                    err,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp),
                )
                TextButton(onClick = { feed.load(feed.page) }, Modifier.padding(horizontal = 16.dp)) {
                    Text("Повторить")
                }
            }
            LazyColumn(
                Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(feed.items, key = { it.id }) { item ->
                    NewsCard(
                        baseUrl = app.baseUrl,
                        item = item,
                        borderColor = parseHex(feed.colorValues[item.color] ?: "#64748B"),
                        fullAccess = full,
                        onEdit = { onOpenEditor(item) },
                        onDelete = { deleteNews = item },
                        onRotateLink = { feed.rotateLink(item.id) },
                        onShare = { token ->
                            val url = "${app.baseUrl.trimEnd('/')}/public/news/${Uri.encode(token)}"
                            val send = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, url)
                            }
                            context.startActivity(Intent.createChooser(send, "Поделиться"))
                        },
                    )
                }
            }
            if (feed.totalPages > 1) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(
                        onClick = { feed.load(feed.page - 1) },
                        enabled = feed.page > 1 && !feed.loading,
                    ) { Text("Назад") }
                    Text("${feed.page} / ${feed.totalPages}")
                    TextButton(
                        onClick = { feed.load(feed.page + 1) },
                        enabled = feed.page < feed.totalPages && !feed.loading,
                    ) { Text("Вперёд") }
                }
            }
        }
    }

    deleteNews?.let { n ->
        AlertDialog(
            onDismissRequest = { deleteNews = null },
            title = { Text("Удалить новость?") },
            text = { Text(n.description.take(120)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        feed.deleteNews(n.id)
                        deleteNews = null
                    },
                ) { Text("Удалить") }
            },
            dismissButton = {
                TextButton(onClick = { deleteNews = null }) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun NewsCard(
    baseUrl: String,
    item: NewsItemDto,
    borderColor: Color,
    fullAccess: Boolean,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onRotateLink: () -> Unit,
    onShare: (String) -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp)
            .border(3.dp, borderColor, RoundedCornerShape(12.dp)),
        colors = CardDefaults.cardColors(),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                if (fullAccess) {
                    IconButton(onClick = onEdit) {
                        Icon(Icons.Default.Edit, contentDescription = "Редактировать")
                    }
                    IconButton(onClick = onDelete) {
                        Icon(Icons.Default.Delete, contentDescription = "Удалить")
                    }
                }
            }
            Text(item.description, style = MaterialTheme.typography.bodyLarge)
            item.createdAt?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (item.media.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    item.media.forEach { m ->
                        MediaPreview(baseUrl, m)
                    }
                }
            }
            if (item.isPublished && item.publicToken != null) {
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { onShare(item.publicToken!!) }) {
                        Icon(Icons.Default.Share, null, Modifier.size(18.dp))
                        Spacer(Modifier.size(4.dp))
                        Text("Ссылка")
                    }
                    if (fullAccess) {
                        TextButton(onClick = onRotateLink) {
                            Icon(Icons.Default.Refresh, null, Modifier.size(18.dp))
                            Spacer(Modifier.size(4.dp))
                            Text("Новая ссылка")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MediaPreview(baseUrl: String, media: NewsMediaDto) {
    when (media.mediaKind) {
        "image" -> {
            val thumb = media.thumbnailUrl ?: media.url
            AsyncImage(
                model = UrlHelper.absolute(baseUrl, thumb),
                contentDescription = null,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp),
                contentScale = ContentScale.Crop,
            )
        }
        "video" -> {
            val thumb = media.thumbnailUrl
            if (thumb != null) {
                AsyncImage(
                    model = UrlHelper.absolute(baseUrl, thumb),
                    contentDescription = "Видео",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(180.dp),
                    contentScale = ContentScale.Crop,
                )
            } else {
                Text("Видео", style = MaterialTheme.typography.labelLarge)
            }
        }
        "audio" -> Text("Аудио: ${media.mimeType ?: ""}", style = MaterialTheme.typography.bodySmall)
        else -> Text("Файл", style = MaterialTheme.typography.bodySmall)
    }
}

private fun parseHex(hex: String): Color {
    return runCatching { Color(android.graphics.Color.parseColor(hex)) }
        .getOrElse { Color(0xFF64748B) }
}
