package ru.familynews.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import ru.familynews.app.data.remote.NewsColorDto
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun NewsEditorDialog(
    editor: NewsEditorViewModel,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    val pick = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetMultipleContents(),
    ) { uris ->
        if (uris.isNotEmpty()) editor.addNewUris(uris)
    }

    Dialog(
        onDismissRequest = { if (!editor.saving) onDismiss() },
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Surface(shape = MaterialTheme.shapes.large) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
            ) {
                Text(
                    if (editor.editing == null) "Новая новость" else "Редактировать",
                    style = MaterialTheme.typography.headlineSmall,
                )
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = editor.description,
                    onValueChange = { editor.description = it },
                    label = { Text("Описание") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 4,
                )
                Spacer(Modifier.height(8.dp))
                Text("Цвет рамки", style = MaterialTheme.typography.labelLarge)
                FlowRow(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    val colors = if (editor.colors.isNotEmpty()) editor.colors else defaultChipColors()
                    colors.forEach { c ->
                        FilterChip(
                            selected = editor.selectedColor == c.id,
                            onClick = { editor.selectedColor = c.id },
                            label = { Text(c.label, maxLines = 1) },
                        )
                    }
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = editor.createdAtLocal,
                    onValueChange = { editor.createdAtLocal = it },
                    label = { Text("Дата и время (Europe/Madrid)") },
                    placeholder = { Text("2025-01-01T12:00") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = editor.isPublished, onCheckedChange = { editor.isPublished = it })
                    Text("Опубликовать")
                }
                editor.editing?.let { e ->
                    val visible = e.media.filter { m -> m.id !in editor.deletedMediaIds }
                    if (visible.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        Text("Текущие файлы", style = MaterialTheme.typography.titleSmall)
                        visible.forEach { m ->
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text("${m.mediaKind} #${m.id}", style = MaterialTheme.typography.bodySmall)
                                TextButton(onClick = { editor.removeExistingMedia(m.id) }) {
                                    Text("Удалить")
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    "Новые файлы (фото сжимаются до 1080px, видео — в рамку 1280×720)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { pick.launch("*/*") }) {
                        Text("Выбрать файлы")
                    }
                }
                editor.newUris.forEach { u ->
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(u.toString().takeLast(32), style = MaterialTheme.typography.bodySmall)
                        TextButton(onClick = { editor.removeNewUri(u) }) { Text("Убрать") }
                    }
                }
                if (editor.saving && editor.uploadTotal > 0) {
                    Spacer(Modifier.height(8.dp))
                    val frac = editor.uploadDone.toFloat() / editor.uploadTotal.coerceAtLeast(1)
                    LinearProgressIndicator(
                        progress = { frac },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text("${editor.uploadDone} / ${editor.uploadTotal}", style = MaterialTheme.typography.bodySmall)
                }
                editor.error?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
                Spacer(Modifier.height(16.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss, enabled = !editor.saving) { Text("Отмена") }
                    Spacer(Modifier.padding(4.dp))
                    Button(
                        onClick = {
                            editor.save {
                                onSaved()
                                onDismiss()
                            }
                        },
                        enabled = !editor.saving,
                    ) { Text("Сохранить") }
                }
            }
        }
    }
}

private fun defaultChipColors(): List<NewsColorDto> = listOf(
    NewsColorDto("amber", "Жёлтый", "#F59E0B"),
    NewsColorDto("teal", "Бирюза", "#006D5B"),
    NewsColorDto("blue", "Синий", "#3B82F6"),
)
