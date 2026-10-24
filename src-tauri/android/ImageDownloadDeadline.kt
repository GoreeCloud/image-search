package com.goreecloud.imagesearch

/**
 * One monotonic wall-clock budget shared by every manual redirect and the
 * final streamed response. This prevents a trickling server from keeping an
 * Android image download alive indefinitely.
 */
internal class ImageDownloadDeadline(
    private val startedAtMillis: Long,
    private val limitMillis: Long = 120_000L
) {
    init {
        require(limitMillis > 0L) { "Download deadline must be positive." }
    }

    fun remainingMillis(nowMillis: Long): Long {
        val elapsed = (nowMillis - startedAtMillis).coerceAtLeast(0L)
        return (limitMillis - elapsed).coerceAtLeast(0L)
    }
}
