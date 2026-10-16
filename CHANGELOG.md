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
