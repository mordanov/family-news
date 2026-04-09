package ru.familynews.app.util

import org.junit.Assert.assertEquals
import org.junit.Test

class UrlHelperTest {

    @Test
    fun absolutePrependsBase() {
        assertEquals(
            "https://x.com/api/photos/a.jpg",
            UrlHelper.absolute("https://x.com", "/api/photos/a.jpg"),
        )
    }

    @Test
    fun absoluteKeepsFullUrl() {
        assertEquals(
            "https://cdn.example/img.png",
            UrlHelper.absolute("https://x.com", "https://cdn.example/img.png"),
        )
    }

    @Test
    fun absoluteAddsSlashIfMissing() {
        assertEquals(
            "https://x.com/api/photos/a.jpg",
            UrlHelper.absolute("https://x.com", "api/photos/a.jpg"),
        )
    }
}
