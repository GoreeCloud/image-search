package com.goreecloud.imagesearch

import java.io.ByteArrayOutputStream
import java.io.InterruptedIOException
import java.util.concurrent.TimeUnit
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import okhttp3.OkHttpClient
import okhttp3.Request
import okio.Buffer
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Loopback-only JVM test server, never an exception to Android's public-DNS rule. */
class TimedImageCallTest {
    private lateinit var server: MockWebServer
    private val client = OkHttpClient.Builder()
        .readTimeout(5, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .build()

    @Before fun startServer() {
        server = MockWebServer()
        server.start()
    }

    @After fun stopServer() {
        server.close()
    }

    private fun request(path: String) = Request.Builder().url(server.url(path)).build()
    private fun nowMillis() = System.nanoTime() / 1_000_000L

    @Test fun ordinaryImageBodyCompletesBeforeDeadline() {
        val expected = ByteArray(2048) { (it % 251).toByte() }
        server.enqueue(MockResponse.Builder()
            .code(200)
            .setHeader("Content-Type", "image/png")
            .body(Buffer().write(expected))
            .build()
        )
        val started = nowMillis()
        executeTimedImageCall(client, request("/fast"), ImageDownloadDeadline(started, 3_000), started)
            .use { response ->
                assertEquals(200, response.code)
                assertArrayEquals(expected, response.body!!.bytes())
            }
    }

    @Test fun aTricklingBodyTimesOutAndRollsBackItsPartialOutput() {
        // Deliver the first 128 bytes immediately, then stall the next block.
        // The real OkHttp Call.timeout must interrupt the body, not just headers.
        server.enqueue(MockResponse.Builder()
            .code(200)
            .setHeader("Content-Type", "image/png")
            .body(Buffer().write(ByteArray(4096) { 0x35 }))
            .throttleBody(128, 1_500, TimeUnit.MILLISECONDS)
            .build()
        )
        val started = nowMillis()
        val response = executeTimedImageCall(
            client, request("/trickle"), ImageDownloadDeadline(started, 350), started
        )
        val partial = ByteArrayOutputStream()
        var rolledBack = false
        var bytesBeforeRollback = 0
        var timeout: InterruptedIOException? = null
        try {
            val bytes = ByteArray(64)
            response.body!!.byteStream().use { input ->
                while (true) {
                    val amount = input.read(bytes)
                    if (amount == -1) break
                    partial.write(bytes, 0, amount)
                }
            }
        } catch (error: InterruptedIOException) {
            timeout = error
        } finally {
            finalizeImageDownload(false,
                closeResponse = { response.close() },
                rollbackPending = {
                    rolledBack = true
                    bytesBeforeRollback = partial.size()
                    partial.reset()
                }
            )
        }
        assertTrue("Streamed-body call timeout should fire", timeout != null)
        assertTrue("Rollback should run after a partial stream", rolledBack)
        assertTrue("Fixture should deliver partial bytes before the timeout", bytesBeforeRollback > 0)
        assertEquals(0, partial.size())
        assertTrue("Deadline should interrupt without waiting for server completion",
            nowMillis() - started < 1_300)
    }

    @Test fun expiredBudgetFailsBeforeOpeningANetworkCall() {
        val started = nowMillis()
        assertThrows(InterruptedIOException::class.java) {
            executeTimedImageCall(client, request("/unused"),
                ImageDownloadDeadline(started, 50), started + 51)
        }
        assertEquals(0, server.requestCount)
    }
}
