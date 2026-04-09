package ru.familynews.app.media

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaSizeCalculatorTest {

    @Test
    fun imageUnchangedWhenAlreadySmall() {
        val (w, h) = MediaSizeCalculator.targetImageDimensions(800, 600)
        assertEquals(800, w)
        assertEquals(600, h)
    }

    @Test
    fun imageScalesLongestSideTo1080() {
        val (w, h) = MediaSizeCalculator.targetImageDimensions(2160, 1080)
        assertEquals(1080, maxOf(w, h))
        assertEquals(540, minOf(w, h))
    }

    @Test
    fun imagePortrait2160x3840() {
        val (w, h) = MediaSizeCalculator.targetImageDimensions(2160, 3840)
        assertEquals(1080, maxOf(w, h))
    }

    @Test
    fun videoFitsInside1280x720Box() {
        val (w, h) = MediaSizeCalculator.targetVideoDimensions(3840, 2160)
        assertTrue(w <= 1280)
        assertTrue(h <= 720)
        assertEquals(0, w % 2)
        assertEquals(0, h % 2)
    }

    @Test
    fun videoPortraitFitsBox() {
        val (w, h) = MediaSizeCalculator.targetVideoDimensions(1080, 1920)
        assertTrue(w <= 1280)
        assertTrue(h <= 720)
    }

    @Test
    fun videoNoUpscale() {
        val (w, h) = MediaSizeCalculator.targetVideoDimensions(640, 360)
        assertEquals(640, w)
        assertEquals(360, h)
    }
}
