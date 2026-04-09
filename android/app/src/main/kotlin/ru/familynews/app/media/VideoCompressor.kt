package ru.familynews.app.media

import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object VideoCompressor {

    suspend fun transcode720pBox(context: Context, uri: Uri): File {
        val outFile = File(context.cacheDir, "vid_${System.currentTimeMillis()}.mp4")
        withContext(Dispatchers.Main) {
            suspendCancellableCoroutine { cont ->
                val listener = object : Transformer.Listener {
                    override fun onCompleted(composition: Composition, exportResult: ExportResult) {
                        if (cont.isActive) cont.resume(Unit)
                    }

                    override fun onError(
                        composition: Composition,
                        exportResult: ExportResult,
                        exportException: ExportException,
                    ) {
                        if (cont.isActive) cont.resumeWithException(exportException)
                    }
                }
                val transformer = Transformer.Builder(context)
                    .setListener(listener)
                    .build()

                cont.invokeOnCancellation {
                    runCatching { transformer.cancel() }
                }

                val presentation = Presentation.createForWidthAndHeight(
                    MediaSizeCalculator.VIDEO_BOX_WIDTH,
                    MediaSizeCalculator.VIDEO_BOX_HEIGHT,
                    Presentation.LAYOUT_SCALE_TO_FIT,
                )
                val effects = Effects(
                    /* audioEffects */ emptyList(),
                    /* videoEffects */ listOf(presentation),
                )
                val edited = EditedMediaItem.Builder(MediaItem.fromUri(uri))
                    .setEffects(effects)
                    .build()
                transformer.start(edited, outFile.absolutePath)
            }
        }
        return outFile
    }
}
