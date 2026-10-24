package com.goreecloud.imagesearch

import java.util.concurrent.Semaphore

/**
 * Bounds native image downloads independently of WebView button state.
 * A save command is rejected while both slots are occupied, rather than
 * spawning an unbounded number of network threads.
 */
internal class NativeDownloadGate(maxConcurrent: Int = 2) {
    private val permits: Semaphore

    init {
        require(maxConcurrent > 0) { "Download concurrency must be positive." }
        permits = Semaphore(maxConcurrent)
    }

    fun tryAcquire(): Boolean = permits.tryAcquire()

    fun release() {
        permits.release()
    }
}
