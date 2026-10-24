package com.goreecloud.imagesearch

import java.io.InterruptedIOException
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response

/**
 * Apply the same remaining monotonic deadline to an OkHttp call including
 * streamed response-body reads. Redirects call this again with the shared
 * ImageDownloadDeadline rather than allocating a new 120-second budget.
 */
internal fun executeTimedImageCall(
    client: OkHttpClient,
    request: Request,
    deadline: ImageDownloadDeadline,
    nowMillis: Long
): Response {
    val remaining = deadline.remainingMillis(nowMillis)
    if (remaining == 0L) throw InterruptedIOException("Image download timed out.")
    val call = client.newCall(request)
    call.timeout().timeout(remaining, TimeUnit.MILLISECONDS)
    return call.execute()
}
