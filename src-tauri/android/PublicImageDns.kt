package com.goreecloud.imagesearch

import java.net.InetAddress
import java.net.UnknownHostException
import okhttp3.Dns

/**
 * OkHttp connects to the InetAddress values returned here, without a second
 * system DNS lookup. The original HTTPS host is retained for SNI and TLS
 * certificate hostname verification.
 *
 * Fail closed if ANY DNS answer is non-public, including mixed A/AAAA replies.
 * Redirects use this resolver afresh; a later DNS rebinding answer is rejected.
 */
internal class PublicImageDns(
    private val resolve: (String) -> List<InetAddress> = { Dns.SYSTEM.lookup(it) }
) : Dns {
    override fun lookup(hostname: String): List<InetAddress> {
        val addresses = resolve(hostname)
        if (addresses.isEmpty() || addresses.any { !isPublicNetworkAddress(it) }) {
            throw UnknownHostException("Image hostname did not resolve exclusively to public IP addresses.")
        }
        return addresses
    }
}

/** Conservative globally-routable-only policy for image download destinations. */
internal fun isPublicNetworkAddress(address: InetAddress): Boolean {
    if (address.isAnyLocalAddress || address.isLoopbackAddress ||
        address.isLinkLocalAddress || address.isSiteLocalAddress || address.isMulticastAddress) {
        return false
    }

    val bytes = address.address.map { it.toInt() and 0xff }
    return when (bytes.size) {
        4 -> {
            val (a, b, c) = bytes
            when {
                // Unspecified, RFC1918, loopback, link-local and non-unicast.
                a == 0 || a == 10 || a == 127 || a >= 224 -> false
                a == 100 && b in 64..127 -> false // carrier-grade NAT
                a == 169 && b == 254 -> false
                a == 172 && b in 16..31 -> false
                a == 192 && b == 168 -> false
                // IANA special-purpose, documentation and relay networks.
                a == 192 && b == 0 && (c == 0 || c == 2) -> false
                a == 192 && b == 88 && c == 99 -> false
                a == 198 && b in 18..19 -> false
                a == 198 && b == 51 && c == 100 -> false
                a == 203 && b == 0 && c == 113 -> false
                else -> true
            }
        }
        16 -> {
            // Only globally addressed IPv6 2000::/3 is eligible. Exclude
            // special-use IETF, documentation, 6to4 and documentation v6 ranges.
            val a = bytes[0]
            val b = bytes[1]
            val c = bytes[2]
            val e = bytes[3]
            (a and 0xe0) == 0x20 &&
                !(a == 0x20 && b == 0x01 && c <= 0x01) && // IETF special-use 2001::/23
                !(a == 0x20 && b == 0x01 && c == 0x0d && e == 0xb8) && // documentation
                !(a == 0x20 && b == 0x02) && // 6to4 embeds arbitrary IPv4
                !(a == 0x3f && b == 0xff) // 3fff::/20 documentation
        }
        else -> false
    }
}
