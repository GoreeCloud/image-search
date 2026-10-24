package com.goreecloud.imagesearch

/**
 * Always attempt MediaStore rollback for an unfinished native download,
 * including when closing the network response itself fails.
 */
internal fun finalizeImageDownload(
    completed: Boolean,
    closeResponse: () -> Unit,
    rollbackPending: () -> Unit
) {
    try {
        closeResponse()
    } finally {
        if (!completed) rollbackPending()
    }
}
