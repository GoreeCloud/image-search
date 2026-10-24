# Image Search

A GoreeCloud visual discovery app in development, with a **web/PWA interface** and experimental **Linux and Android Tauri packages**. Its shared React/TypeScript interface runs in a WebView on those packaged targets; these packages are not yet native-complete under GoreeCloud's operating-system implementation requirements.

## Available capabilities

- Search **eight keyless image collections** by default: Openverse, Wikimedia Commons, NASA Image and Video Library, historical Library of Congress photographs, Cleveland Museum of Art, Metropolitan Museum of Art, Wellcome Collection, and the Victoria and Albert Museum. Filter to any individual source from the Source menu. No provider API key is embedded or required.
- The default Explore screen follows the owner-approved Android mockup v3: light indigo/lavender appearance, prominent search, category chips, image-source controls, masonry tiles with always-available mobile actions, and a floating Explore/Saved/Settings dock. Existing saved dark-mode preferences are retained.
- The initial Explore feed mixes six real provider queries across landscapes, architecture, flowers, space, coasts and interiors; it is not a static set of mock images. Results carry their original source links and usage rights. Providers may return different images or temporarily fail.
- Adaptive masonry grid, skeletons, bounded pagination, and retry states. **Show more images** is available beside the results count on larger layouts, even when an unavailable provider pauses automatic pagination; another control appears below the gallery.
- Search suggestions, source links, orientation filters and full-screen image details.
- Download the original image file from individual results or image details when the provider permits cross-origin access. Download size is capped at 40 MB; filenames are sanitized. Provider restrictions, browser capabilities, and native WebView download handling can prevent direct downloads, so the original image/source links remain available as a fallback.
- Save / unsave image bookmarks locally on-device (metadata and URLs only; this is separate from downloads). Copy original links, inspect creator, resolution and license.
- Dark/light appearance, accessibility labels, keyboard shortcuts, focus-trapped image previews, reduced-motion support and touch-friendly layouts. Full GoreeCloud UI (GC UI) integration remains unverified.
- On narrow mobile layouts, the filter trigger and the three image-action buttons retain the approved 38px visual size while exposing nonoverlapping 44px CSS touch targets. A source-level layout contract checks the 320px two-column constraint; physical-device hit testing and approved-mockup review remain pending.
- Privacy-first: no login, no tracking, no analytics, no third-party JavaScript embeds.
- Installable progressive web app (PWA) on supported browsers. Its app shell remains available offline; searching and remote images still require connectivity.
- Request timeouts and non-destructive load-more retry handling protect the existing gallery if a provider is temporarily unavailable.
- Provider response validation rejects invalid JSON envelopes, skips isolated malformed image records without discarding valid neighboring results, and bounds per-page normalization work. This is defensive parsing, not a guarantee that external image hosts remain available.
- Gallery previews retry using a trusted same-provider alternative where available. Failed previews offer a retry and link to the authoritative source instead of trapping the user on a dead image.
- Branded source-based icon on the web, PWA, Linux and Android; Android 15+ native system-bar inset handling keeps the app from overlapping status and navigation bars.

**Scope:** Openverse indexes openly licensed imagery from many websites; Wikimedia Commons indexes shared media; NASA offers mission and science photography; the Library of Congress offers historical photographs with item-specific reuse rights; Cleveland Museum of Art and the Met contribute CC0 images; Wellcome Collection adds history, science and medicine; and the Victoria and Albert Museum adds art and design. **Wellcome and V&A imagery is not necessarily free to reuse**: image-specific rights and source pages are displayed, and V&A records require checking their rights terms. The newer collections may lack exact dimensions, so such records are excluded from orientation-specific filters instead of being incorrectly labelled square. These collections are not an unrestricted web crawler, and API limits or missing thumbnails can reduce coverage. “All sources” sends the search query to each provider, tolerates individual provider failure and deduplicates results. A provider-filtered query goes only to the selected provider. Saved images contain URLs and metadata, not offline image binaries. NASA content follows its own media usage policies, rather than being universally CC0.

## Requirements

Node.js 22+ and npm. Native builds require the Rust, Linux WebKitGTK, and Android SDK/NDK tools described in the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Develop and verify

```bash
npm ci
npm run dev           # http://localhost:1420
npm run typecheck
npm test
npm run test:provider-cors
npm run test:mobile-touch
npm run build
```

### Diagnose browser provider access

For a **manual, read-only check** of the eight keyless providers' CORS response
headers, from an approved network and with no user search terms or API keys:

```bash
npm run probe:provider-cors
# Check another approved HTTPS app origin when its name is known:
npm run probe:provider-cors -- --origin=https://YOUR-APP-ORIGIN.example
```

This sends one small, synthetic HTTPS GET per official provider, at most three
concurrently, with a 12-second per-request timeout. It reads only response
headers and reports `allowed`, `blocked`, `http-error`, `timeout`, or
`network-error`. A nonzero exit indicates a provider needs review. The check
does **not** bypass CORS, contact unapproved hosts, cache images, prove image
loadability, or replace real-browser/Android/WebView acceptance. A successful
HTTP 200 with no `Access-Control-Allow-Origin` is **blocked**, not usable by
browser JavaScript. Europeana is excluded because it requires an optional
user-provided API key; the probe never handles such credentials.

### Install the web app

Serve the production `dist/` directory over HTTPS (or use localhost during development). On supported browsers, use **Install app** / **Add to Home screen** to install the PWA. The service worker precaches only same-origin application assets: it does not cache third-party image results, user searches, or raw images. Experimental Linux/Android Tauri packaging remains separate and is not a substitute for genuine native applications.

## Linux

```bash
npm run tauri -- dev
npm run tauri -- build
```

The Linux job in GitHub Actions builds DEB and AppImage artifacts after the necessary native toolchain is available.

## Android

```bash
npm run tauri -- android init
bash scripts/prepare-android.sh   # apply version-controlled Android window-inset handler
npm run tauri -- android dev
npm run tauri -- android build --debug --target aarch64
```

Android requires SDK + NDK + a connected emulator/device for actual runtime tests. The GitHub Actions job produces a temporary debug package solely for bounded testing. **It is not a GoreeCloud Development distribution APK**; persistent protected signing identity, monotonically increasing Android versionCode, install/upgrade tests, and Drive delivery must be completed before a development APK is offered to the owner.

## Search provider and image rights

The browser calls the official HTTPS APIs for [Openverse](https://api.openverse.org/v1/images/), [Wikimedia Commons](https://commons.wikimedia.org/w/api.php), [NASA](https://images-api.nasa.gov/search), [Library of Congress](https://www.loc.gov/photos/?fo=json), [Cleveland Museum of Art](https://openaccess-api.clevelandart.org/api/artworks/), [Metropolitan Museum of Art](https://collectionapi.metmuseum.org/public/collection/v1.1/search), [Wellcome Collection](https://developers.wellcomecollection.org/api/catalogue), and [Victoria and Albert Museum](https://developers.vam.ac.uk/guide/v2/quick-start.html). Wellcome and V&A images use only their corresponding official IIIF image hosts. Previews come from provider-controlled hosts, not through our infrastructure. Openverse third-party originals are not fetched automatically as thumbnail fallbacks. Each image links to its source record for authoritative authorship, license, and attribution terms. Images are not claimed to be free of restrictions; verify requirements before reuse.

No API keys are embedded in client code. Future commercial search providers should use a separate secured proxy with appropriate quotas, caching, licensing and terms compliance.

## Architecture

- `src/services/openverse.ts`, `commons.ts`, `nasa.ts`, `loc.ts`, `cleveland.ts`, `met.ts`, `wellcome.ts`, `vam.ts`: source-specific API adapters, response normalization, URL trust boundaries and pagination.
- `src/services/providers.ts`: parallel federated search with partial-failure tolerance and stable result deduplication.
- `src/services/providerResponse.ts`: shared untrusted-JSON boundary for source adapters, including per-record isolation and finite image dimensions.
- `src/services/imageFallback.ts`: same-provider trusted preview recovery.
- `src-tauri/android/MainActivity.kt`: Android native safe-area application; `scripts/prepare-android.sh` installs it into generated Gradle sources.
- `src/hooks`: image search request lifecycle and local saved state, with separate first-page and load-more error handling.
- `src/services/network.ts`: cancellable HTTP timeout helper shared by image providers.
- `scripts/provider-cors.mjs` and `scripts/check-provider-cors.mjs`: bounded, manual
  cross-origin API header qualification; its pure policy checks run in CI.
- `src/components`: masonry tiles and lightbox.
- `src/styles.css`: shared responsive, reduced-motion-aware styling.
- `src-tauri`: minimal Rust shell with a restrictive content security policy.
- `.github/workflows/verify.yml`: web tests/build, Linux bundle, manually invoked Android packaging.

## Acceptance status

This is an initial development implementation. **Neither a green CI run nor a Tauri DEB/AppImage/APK proves native operating-system conformance or an Anchor release.** The current packaged WebView UI is not native-complete; platform-targeted implementations and runtime acceptance remain required. Before Anchor qualification, verify live source availability and partial failures, security/privacy, accessibility, native platform behavior, signing and update continuity, installation, recovery, and the applicable nine-system integration requirements. See [native release acceptance](docs/native-release-acceptance.md).

## License

Copyright (C) 2026 GoreeCloud. Original GoreeCloud Image Search source code is licensed under **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**; see [LICENSE](LICENSE) for the complete terms. This covers the original application source, not third-party libraries or remotely served images. Dependencies and source images remain subject to their respective licenses and attribution requirements.

### Appearance and optional provider API keys

On mobile, **Settings** sits beside Explore and Saved in the floating bottom dock; on
desktop it is in the main navigation. Settings > **Appearance** lets you choose
Dark or Light Mode. Light is the first-run default matching mockup v3; an existing
user's explicit theme preference is respected. Only the theme preference is stored locally.

**Settings > API** supports optional Europeana cultural heritage imagery with a user-provided
Europeana API key. Europeana needs its own API authorization and is not queried
without a key. See https://europeana.atlassian.net/wiki/spaces/EF/pages/2462351393/Accessing+the+APIs. Connected Europeana
results join All sources, or select Europeana from the source filter.

**Key security:** the Europeana key is held only in this session's JavaScript
memory and sent as an HTTPS X-Api-Key header directly to api.europeana.eu,
never put into image URLs, committed to GitHub, or persisted in localStorage.
Reloading or closing the app clears it. Do not enter server-side confidential
credentials in a browser/client application. No provider account is created
for the user. Europeana personal keys are for individual exploration; service
usage requires a Europeana project key and compliance with its access terms. Provider-specific usage rights, quotas and attribution still apply.

The Met API uses https://collectionapi.metmuseum.org/public/collection/v1.1/search
(paginated; the older v1 search endpoint was deprecated in October 2026).
The Met is filtered to public-domain items, and individual image URLs are
limited to its official CDN. These sources are not unrestricted web crawlers.

Android QA: On Android 10+, downloads now use native MediaStore to save to the public Downloads folder; only a finalized file triggers success. Physical-device verification is required before release.
