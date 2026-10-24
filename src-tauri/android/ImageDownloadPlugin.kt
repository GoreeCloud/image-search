package com.goreecloud.imagesearch

import android.app.Activity
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.text.Normalizer
import java.util.Locale

@InvokeArg
class ImageSaveArgs {
    lateinit var url: String
    lateinit var title: String
}

/**
 * Native Android Downloads writer. WebView blob-anchor downloads do not save
 * into the public Downloads collection on many Android devices.
 * No storage permission is required for app-created Downloads on Android 10+.
 */
@TauriPlugin
class ImageDownloadPlugin(private val activity: Activity) : Plugin(activity) {
    companion object {
        private const val MAX_BYTES = 40L * 1024 * 1024
        private val formats = mapOf(
            "image/jpeg" to "jpg",
            "image/png" to "png",
            "image/webp" to "webp",
            "image/gif" to "gif",
            "image/avif" to "avif",
            "image/bmp" to "bmp",
            "image/tiff" to "tif",
            "image/heic" to "heic",
            "image/heif" to "heif"
        )
    }

    @Command
    fun saveImage(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(ImageSaveArgs::class.java)
        } catch (_: Exception) {
            invoke.reject("The image download request was invalid.")
            return
        }
        Thread({
            try {
                val name = saveToDownloads(args.url, args.title)
                val result = JSObject()
                result.put("filename", name)
                invoke.resolve(result)
            } catch (error: Exception) {
                invoke.reject(error.message ?: "Could not save this image to Downloads.")
            }
        }, "goreecloud-image-download").start()
    }

    private fun validateUrl(address: String): URL {
        val uri = try { URI(address) } catch (_: Exception) {
            throw IllegalArgumentException("The image URL is invalid.")
        }
        val host = uri.host?.lowercase(Locale.ROOT) ?: ""
        // Validate again on every redirect; the WebView-side URL check is
        // not a trust boundary for a native network request.
        val localName = listOf(".localhost", ".local", ".localdomain", ".internal", ".lan")
            .any { host.endsWith(it) } || host == "home.arpa" || host.endsWith(".home.arpa")
        val unsafe = host.isEmpty() || host.endsWith(".") || !host.contains(".") ||
            host == "localhost" || localName ||
            host.startsWith("127.") || host.startsWith("10.") ||
            host.startsWith("192.168.") || host.startsWith("169.254.") ||
            (host.startsWith("172.") && host.split(".").getOrNull(1)?.toIntOrNull()?.let { it in 16..31 } == true) ||
            host.all { it.isDigit() || it == '.' } || host.contains(":")
        if (uri.scheme?.lowercase(Locale.ROOT) != "https" || uri.userInfo != null ||
            (uri.port != -1 && uri.port != 443) || unsafe) {
            throw IllegalArgumentException("Only public HTTPS image addresses can be downloaded.")
        }
        return uri.toURL()
    }

    private fun openImage(original: String): Pair<HttpURLConnection, String> {
        var current = validateUrl(original)
        repeat(5) {
            val connection = (current.openConnection() as HttpURLConnection).apply {
                connectTimeout = 15000
                readTimeout = 25000
                instanceFollowRedirects = false
                setRequestProperty("Accept", "image/avif,image/webp,image/*")
            }
            try {
                val status = connection.responseCode
                if (status in 300..399) {
                    val redirect = connection.getHeaderField("Location")
                        ?: throw IllegalStateException("The image provider sent an invalid redirect.")
                    val next = URL(current, redirect).toString()
                    current = validateUrl(next)
                    connection.disconnect()
                    return@repeat
                }
                if (status !in 200..299) {
                    throw IllegalStateException("Image provider returned HTTP $status. Open the original source instead.")
                }
                val mime = connection.contentType?.substringBefore(";")?.trim()?.lowercase(Locale.ROOT)
                    ?: ""
                if (!formats.containsKey(mime)) {
                    throw IllegalStateException("The image provider did not return a supported image file.")
                }
                if (connection.contentLengthLong > MAX_BYTES) {
                    throw IllegalStateException("The image is larger than the 40 MB limit.")
                }
                return Pair(connection, mime)
            } catch (error: Exception) {
                connection.disconnect()
                throw error
            }
        }
        throw IllegalStateException("The image provider redirected too many times.")
    }

    private fun safeFilename(title: String, mime: String): String {
        val normalized = Normalizer.normalize(title, Normalizer.Form.NFKC)
            .replace(Regex("[\\x00-\\x1F\\x7F/\\\\:*?\"<>|]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim(' ', '.')
            .take(76)
            .trim(' ', '.')
            .ifBlank { "image" }
        return "$normalized.${formats.getValue(mime)}"
    }

    private fun saveToDownloads(original: String, title: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            throw IllegalStateException("Saving to Downloads requires Android 10 or newer.")
        }
        val (connection, mime) = openImage(original)
        val filename = safeFilename(title, mime)
        val resolver = activity.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, filename)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        var savedUri: android.net.Uri? = null
        var completed = false
        try {
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Android could not create a Downloads file.")
            savedUri = uri
            var written = 0L
            resolver.openOutputStream(uri, "w")?.use { output ->
                connection.inputStream.use { input ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buffer)
                        if (n == -1) break
                        written += n
                        if (written > MAX_BYTES) {
                            throw IllegalStateException("The image exceeds the 40 MB download limit.")
                        }
                        output.write(buffer, 0, n)
                    }
                    output.flush()
                }
            } ?: throw IllegalStateException("Android could not write the Downloads file.")
            if (written == 0L) throw IllegalStateException("The image provider returned an empty file.")
            val ready = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
            if (resolver.update(uri, ready, null, null) < 1) {
                throw IllegalStateException("Android did not finalize the downloaded file.")
            }
            completed = true
            return resolver.query(uri, arrayOf(MediaStore.MediaColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) cursor.getString(0) else filename
            } ?: filename
        } finally {
            connection.disconnect()
            if (!completed && savedUri != null) resolver.delete(savedUri, null, null)
        }
    }
}
