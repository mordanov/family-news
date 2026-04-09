package ru.familynews.app.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapFactory.Options
import android.net.Uri
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object ImageCompressor {

    fun compressToCache(context: Context, uri: Uri): File {
        val cr = context.contentResolver
        val opts = Options().apply { inJustDecodeBounds = true }
        cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
        val ow = opts.outWidth
        val oh = opts.outHeight
        if (ow <= 0 || oh <= 0) {
            return copyUriToCache(context, uri, "bin")
        }

        val (tw, th) = MediaSizeCalculator.targetImageDimensions(ow, oh)
        opts.inJustDecodeBounds = false
        opts.inSampleSize = calculateInSampleSize(ow, oh, tw, th)
        val decoded = cr.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, opts) }
            ?: return copyUriToCache(context, uri, "jpg")

        val scaled = if (decoded.width != tw || decoded.height != th) {
            Bitmap.createScaledBitmap(decoded, tw, th, true).also {
                if (it != decoded) decoded.recycle()
            }
        } else {
            decoded
        }

        val out = File(context.cacheDir, "img_${System.currentTimeMillis()}.jpg")
        FileOutputStream(out).use { fos ->
            scaled.compress(Bitmap.CompressFormat.JPEG, 88, fos)
        }
        scaled.recycle()
        return out
    }

    private fun calculateInSampleSize(srcW: Int, srcH: Int, targetW: Int, targetH: Int): Int {
        var inSampleSize = 1
        if (srcH > targetH || srcW > targetW) {
            val halfH = srcH / 2
            val halfW = srcW / 2
            while (halfH / inSampleSize >= targetH && halfW / inSampleSize >= targetW) {
                inSampleSize *= 2
            }
        }
        return max(1, inSampleSize)
    }

    private fun copyUriToCache(context: Context, uri: Uri, ext: String): File {
        val out = File(context.cacheDir, "raw_${System.currentTimeMillis()}.$ext")
        context.contentResolver.openInputStream(uri)?.use { input ->
            out.outputStream().use { output -> input.copyTo(output) }
        }
        return out
    }
}
