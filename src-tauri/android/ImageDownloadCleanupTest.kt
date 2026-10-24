package com.goreecloud.imagesearch

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test

class ImageDownloadCleanupTest {
    @Test fun incompleteDownloadClosesResponseAndRollsBack() {
        val events = mutableListOf<String>()
        finalizeImageDownload(false, { events += "close" }, { events += "rollback" })
        assertEquals(listOf("close", "rollback"), events)
    }

    @Test fun rollbackRunsEvenIfResponseCloseThrows() {
        val events = mutableListOf<String>()
        val cause = IllegalStateException("close failed")
        val failure = assertThrows(IllegalStateException::class.java) {
            finalizeImageDownload(false, {
                events += "close"
                throw cause
            }, { events += "rollback" })
        }
        assertSame(cause, failure)
        assertEquals(listOf("close", "rollback"), events)
    }

    @Test fun completedDownloadClosesWithoutDeletingFile() {
        val events = mutableListOf<String>()
        finalizeImageDownload(true, { events += "close" }, { events += "rollback" })
        assertEquals(listOf("close"), events)
    }

    @Test fun rollbackFailureDoesNotSkipResponseClose() {
        val events = mutableListOf<String>()
        val cause = IllegalStateException("delete failed")
        val failure = assertThrows(IllegalStateException::class.java) {
            finalizeImageDownload(false, { events += "close" }, {
                events += "rollback"
                throw cause
            })
        }
        assertSame(cause, failure)
        assertEquals(listOf("close", "rollback"), events)
    }
}
