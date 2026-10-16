## Unreleased — expanded sources and Settings

- Add The Metropolitan Museum of Art CC0 collection imagery to keyless federated search through its current v1.1 paginated API.
- Add optional Europeana cultural-heritage search with a user-supplied API key, held only in session memory, never persisted to disk or sent in URLs.
- Add Settings navigation beside Saved on mobile and in the desktop header, including API provider setup and removal.
- Add Light and Dark Mode with locally retained theme choice, responsive contrast-safe surfaces, and mobile settings layout.
- Pin additional provider API/CDN hosts in Tauri content security policy; reject unsafe image URLs and non-public-domain Met items.

## Unreleased — Android keyboard navigation behavior

- Hide the mobile Explore/Saved bottom navigation while the software keyboard occupies a significant part of the visual viewport, restoring it when the keyboard closes.
- Use the VisualViewport resize/scroll signals rather than a fixed Android keyboard height; preserve desktop navigation and small toolbar movements.
- Verify on an isolated USB QA application before release; do not replace an existing signed Android installation or promote Stable solely from CI.

## Unreleased — broaden keyless art discovery

- Add Cleveland Museum of Art Open Access (CC0 works with image assets) as a fifth no-key provider; filterable independently and included in federated search.
- Pin thumbnail hosts to the museum’s public media CDN, preserve authoritative artwork links, and enforce CC0 status in response normalization.

## Unreleased — image discovery and Android layout improvements

- Search NASA Image and Video Library and Library of Congress historical photography collections alongside Openverse and Wikimedia Commons, with All sources selected by default.
- Aggregate results with stable ID deduplication and tolerate temporary failure of individual sources.
- Retry broken previews using trusted provider image URLs when available; otherwise offer explicit retry and original-source link.
- Adjust mobile header, navigation and preview safe-area layout; apply native Android system-bar and cutout insets prior to WebView rendering to avoid edge-to-edge overlap.
- Redesign the Image Search icon using source SVG artwork, with consistent native, favicon and PWA assets.
- Add provider, image-fallback, security and browser regression checks.
- Development status only. Signed Development APK and native device runtime acceptance remain release gates.

# Changelog

## 0.1.0 — Development

- Introduced the responsive masonry image discovery application.
- Added Openverse multi-source and Wikimedia Commons search integration, pagination, details and source attribution.
- Added saved images, orientation filters, keyboard navigation, accessible modal focus management and loading/error/empty states.
- Added web compilation and tests, plus Linux/Android Tauri configuration and CI pipeline.
- Added installable offline-shell PWA, request timeouts, safer metadata handling and recoverable next-page failures.
- Production deployment, native runtime tests, and signed Android distribution remain unverified.
