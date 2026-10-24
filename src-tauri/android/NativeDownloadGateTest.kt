package com.goreecloud.imagesearch

import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeDownloadGateTest {
    @Test fun allowsTwoAndReleasesSlotsForLaterDownloads() {
        val gate = NativeDownloadGate()
        assertTrue(gate.tryAcquire())
        assertTrue(gate.tryAcquire())
        assertFalse(gate.tryAcquire())
        gate.release()
        assertTrue(gate.tryAcquire())
        assertFalse(gate.tryAcquire())
        gate.release()
        gate.release()
        assertTrue(gate.tryAcquire())
        assertTrue(gate.tryAcquire())
        gate.release()
        gate.release()
    }

    @Test fun concurrentRequestsCannotExceedCapacity() {
        val gate = NativeDownloadGate(2)
        val start = CountDownLatch(1)
        val done = CountDownLatch(24)
        val accepted = AtomicInteger()
        val workers = (1..24).map {
            thread(start = true) {
                start.await()
                if (gate.tryAcquire()) accepted.incrementAndGet()
                done.countDown()
            }
        }
        start.countDown()
        assertTrue("All contenders must finish", done.await(10, TimeUnit.SECONDS))
        workers.forEach { it.join() }
        assertEquals(2, accepted.get())
        assertFalse(gate.tryAcquire())
        gate.release()
        gate.release()
    }

    @Test fun rejectsInvalidCapacity() {
        assertThrows(IllegalArgumentException::class.java) { NativeDownloadGate(0) }
    }
}
