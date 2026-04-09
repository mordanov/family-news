package ru.familynews.app.media

import android.content.Context
import android.net.Uri
import android.webkit.MimeTypeMap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.MultipartBody
import java.io.File

/**
 * Prepares local content for upload: compresses images (max 1080px longest side)
 * and transcodes video to fit in a 1280×720 frame (letterboxed, H.264 MP4).
 * GIF and audio are copied as-is.
 */
class MediaPreprocessor(private val context: Context) {

    suspend fun toUploadPart(uri: Uri, partName: String = "media"): MultipartBody.Part =
        withContext(Dispatchers.IO) {
            val mime = context.contentResolver.getType(uri) ?: guessMime(uri)
            val (file, outMime) = when {
                mime.startsWith("image/") && mime != "image/gif" ->
                    ImageCompressor.compressToCache(context, uri) to "image/jpeg"

                mime.startsWith("video/") ->
                    VideoCompressor.transcode720pBox(context, uri) to "video/mp4"

                else ->
                    copyRawToCache(uri) to mime
            }
            val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(outMime) ?: "bin"
            val safeName = "upload.$ext"
            val body = file.asRequestBody(outMime.toMediaTypeOrNull())
            MultipartBody.Part.createFormData(partName, safeName, body)
        }

    private fun guessMime(uri: Uri): String {
        val ext = uri.lastPathSegment?.substringAfterLast('.', "")?.lowercase().orEmpty()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
    }

    private fun copyRawToCache(uri: Uri): File {
        val mime = context.contentResolver.getType(uri) ?: guessMime(uri)
        val ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime) ?: "bin"
        val out = File(context.cacheDir, "raw_${System.currentTimeMillis()}.$ext")
        context.contentResolver.openInputStream(uri)?.use { input ->
            out.outputStream().use { input.copyTo(it) }
        }
        return out
    }
}
