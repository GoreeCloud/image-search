package com.goreecloud.imagesearch

import com.sun.net.httpserver.HttpServer
import java.io.ByteArrayOutputStream
import java.io.InterruptedIOException
import java.net.InetSocketAddress
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Local JVM-only HTTP fixture; not an exception to Android's public-DNS rule. */
class TimedImageCallTest {
    private lateinit var server: HttpServer
    private lateinit var threads: ExecutorService
    private val client = OkHttpClient.Builder()
        .readTimeout(5, TimeUnit.SECONDS)
        .retryOnConnectionFailure(false)
        .build()

    @Before fun startServer() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        threads = Executors.newCachedThreadPool { work ->
            Thread(work, "image-timeout-test").apply { isDaemon = true }
        }
        server.executor = threads
        server.start()
    }

    @After fun stopServer() {
        server.stop(0)
        threads.shutdownNow()
    }

    private fun request(path: String) = Request.Builder()
        .url("http://127.0.0.1:${server.address.port}$path")
        .build()

    private fun nowMillis() = System.nanoTime() / 1_000_000L

    @Test fun ordinaryImageBodyCompletesBeforeDeadline() {
        val expected = ByteArray(2048) { (it % 251).toByte() }
        server.createContext("/fast") { exchange ->
            exchange.responseHeaders.add("Content-Type", "image/png")
            exchange.sendResponseHeaders(200, expected.size.toLong())
            exchange.responseBody.use { it.write(expected) }
        }
        val started = nowMillis()
        executeTimedImageCall(client, request("/fast"), ImageDownloadDeadline(started, 3_000), started)
            .use { response ->
                assertEquals(200, response.code)
                assertArrayEquals(expected, response.body!!.bytes())
            }
    }

    @Test fun aTricklingBodyTimesOutAndRollsBackItsPartialOutput() {
        val chunk = ByteArray(128) { 0x35 }
        server.createContext("/trickle") { exchange ->
            exchange.responseHeaders.add("Content-Type", "image/png")
            exchange.sendResponseHeaders(200, 4096)
            try {
                exchange.responseBody.use { stream ->
                    stream.write(chunk)
                    stream.flush()
                    Thread.sleep(1_500)
                    stream.write(ByteArray(4096 - chunk.size))
                }
            } catch (_: Exception) {
                // Expected when OkHttp cancels the call or JUnit tears down server.
            }
        }
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
    }
}
