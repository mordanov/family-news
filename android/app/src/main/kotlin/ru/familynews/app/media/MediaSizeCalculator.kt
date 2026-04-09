package ru.familynews.app.media

/**
 * Pure helpers for client-side compression targets:
 * - Photos: longest side at most [PHOTO_MAX_LONGEST_SIDE] px.
 * - Video: fit inside 1280×720 (standard 720p frame) preserving aspect ratio.
 */
object MediaSizeCalculator {
    const val PHOTO_MAX_LONGEST_SIDE = 1080
    const val VIDEO_BOX_WIDTH = 1280
    const val VIDEO_BOX_HEIGHT = 720

    fun targetImageDimensions(width: Int, height: Int): Pair<Int, Int> {
        if (width <= 0 || height <= 0) return width to height
        val longest = maxOf(width, height)
        if (longest <= PHOTO_MAX_LONGEST_SIDE) return width to height
        val scale = PHOTO_MAX_LONGEST_SIDE.toDouble() / longest
        return scaleToEven(width, height, scale)
    }

    /**
     * Scale so the frame fits fully inside [VIDEO_BOX_WIDTH]×[VIDEO_BOX_HEIGHT] (no upscaling).
     */
    fun targetVideoDimensions(width: Int, height: Int): Pair<Int, Int> {
        if (width <= 0 || height <= 0) return width to height
        val scale = minOf(
            VIDEO_BOX_WIDTH.toDouble() / width,
            VIDEO_BOX_HEIGHT.toDouble() / height,
            1.0,
        )
        return scaleToEven(width, height, scale)
    }

    internal fun scaleToEven(width: Int, height: Int, scale: Double): Pair<Int, Int> {
        var w = maxOf(2, (width * scale).toInt())
        var h = maxOf(2, (height * scale).toInt())
        w -= w % 2
        h -= h % 2
        return w to h
    }
}
