package com.goreecloud.imagesearch

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ImageDownloadDeadlineTest {
    @Test fun beginsWithFullBudgetAndCountsDown() {
        val deadline = ImageDownloadDeadline(1_000L, 120_000L)
        assertEquals(120_000L, deadline.remainingMillis(1_000L))
        assertEquals(75_000L, deadline.remainingMillis(46_000L))
    }

    @Test fun redirectsConsumeTheSameBudget() {
        val deadline = ImageDownloadDeadline(10_000L, 120_000L)
        assertEquals(110_000L, deadline.remainingMillis(20_000L))
        assertEquals(50_000L, deadline.remainingMillis(80_000L))
        assertEquals(1L, deadline.remainingMillis(129_999L))
    }

    @Test fun expirationNeverWrapsIntoUnlimitedTime() {
        val deadline = ImageDownloadDeadline(500L, 120_000L)
        assertEquals(0L, deadline.remainingMillis(120_500L))
        assertEquals(0L, deadline.remainingMillis(999_999L))
    }

    @Test fun clockReadBeforeStartCannotIncreaseBudget() {
        assertEquals(120_000L, ImageDownloadDeadline(5_000L).remainingMillis(4_000L))
    }

    @Test fun rejectsNonpositiveLimit() {
        assertThrows(IllegalArgumentException::class.java) {
            ImageDownloadDeadline(0L, 0L)
        }
    }
}
