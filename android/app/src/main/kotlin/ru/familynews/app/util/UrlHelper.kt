package ru.familynews.app.util

object UrlHelper {
    fun absolute(base: String, path: String): String {
        if (path.startsWith("http://") || path.startsWith("https://")) return path
        val b = base.trimEnd('/')
        val p = if (path.startsWith("/")) path else "/$path"
        return b + p
    }
}
