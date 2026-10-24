package com.goreecloud.imagesearch

import java.net.InetAddress
import java.net.UnknownHostException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class PublicImageDnsTest {
    private fun ip(value: String) = InetAddress.getByName(value)

    private fun mustReject(block: () -> Unit) {
        try {
            block()
            fail("Expected the resolver to fail closed")
        } catch (_: UnknownHostException) {
            // The HTTP request must never be opened for this DNS response.
        }
    }

    @Test fun acceptsPublicIpv4AndIpv6WithoutChangingAddresses() {
        val expected = listOf(ip("1.1.1.1"), ip("2606:4700:4700::1111"))
        assertEquals(expected, PublicImageDns { expected }.lookup("images.example.org"))
    }

    @Test fun rejectsAnEmptyReply() {
        mustReject { PublicImageDns { emptyList() }.lookup("images.example.org") }
    }

    @Test fun rejectsMixedPublicAndPrivateAnswers() {
        for (blocked in listOf("127.0.0.1", "10.12.3.4", "169.254.169.254",
            "192.168.1.1", "172.31.1.1", "::1", "fd12::1", "fe80::1")) {
            mustReject {
                PublicImageDns { listOf(ip("8.8.8.8"), ip(blocked)) }.lookup("images.example.org")
            }
        }
    }

    @Test fun rejectsCarrierGradeNatAndSpecialUseIpv4Ranges() {
        for (blocked in listOf("0.1.2.3", "100.64.0.1", "100.127.255.254",
            "192.0.0.1", "192.0.2.1", "192.88.99.1", "198.18.0.1",
            "198.51.100.1", "203.0.113.1", "224.0.0.1", "240.0.0.1")) {
            assertFalse("Must reject $blocked", isPublicNetworkAddress(ip(blocked)))
        }
    }

    @Test fun rejectsSpecialUseIpv6AndMappedIpv4() {
        for (blocked in listOf("::", "::ffff:127.0.0.1", "2001:db8::1",
            "2001::1", "2002:c0a8:0101::1", "3fff::1", "ff02::1")) {
            assertFalse("Must reject $blocked", isPublicNetworkAddress(ip(blocked)))
        }
    }

    @Test fun acceptsOtherPublicUnicastAddresses() {
        for (publicIp in listOf("8.8.8.8", "9.9.9.9",
            "151.101.1.69", "2606:4700:4700::1001", "2a00:1450::1")) {
            assertTrue("Must accept $publicIp", isPublicNetworkAddress(ip(publicIp)))
        }
    }

    @Test fun rejectsReboundDnsAnswerOnNextRequest() {
        var calls = 0
        val resolver = PublicImageDns {
            calls += 1
            if (calls == 1) listOf(ip("8.8.8.8")) else listOf(ip("127.0.0.1"))
        }
        assertEquals(listOf(ip("8.8.8.8")), resolver.lookup("images.example.org"))
        mustReject { resolver.lookup("images.example.org") }
        assertEquals(2, calls)
    }
}
