# Image Search

A GoreeCloud visual discovery app for **web, Linux, and Android**. It uses a polished, Pinterest-inspired masonry interface with a single shared React/TypeScript experience and a minimal Tauri 2 native shell.

## Available capabilities

- Search **six keyless image collections** by default: Openverse, Wikimedia Commons, NASA Image and Video Library, and historical Library of Congress photographs, CC0 Cleveland Museum of Art collections, and CC0 Metropolitan Museum of Art collections. Filter to any individual source from the Source menu. No provider API key is embedded or required.
- Adaptive masonry grid with original aspect ratios, skeletons, infinite pagination and retry states.
- Search suggestions, source links, orientation filters and full-screen image details.
- Save / unsave images locally on-device. Copy original links, inspect creator, resolution and license.
- Dark Glaze-inspired styling, accessibility labels, keyboard shortcuts, focus-trapped image previews, reduced-motion support and touch-friendly layouts.
- Privacy-first: no login, no tracking, no analytics, no third-party JavaScript embeds.
- Installable progressive web app (PWA) on supported browsers. Its app shell remains available offline; searching and remote images still require connectivity.
- Request timeouts and non-destructive load-more retry handling protect the existing gallery if a provider is temporarily unavailable.
- Gallery previews retry using a trusted same-provider alternative where available. Failed previews offer a retry and link to the authoritative source instead of trapping the user on a dead image.
- Branded source-based icon on the web, PWA, Linux and Android; Android 15+ native system-bar inset handling keeps the app from overlapping status and navigation bars.

**Scope:** Openverse indexes openly licensed imagery from many websites; Wikimedia Commons indexes shared media; NASA offers mission and science photography; the Library of Congress offers historical photographs with item-specific reuse rights; and the Cleveland Museum of Art and Metropolitan Museum of Art contribute CC0 collection images. These collections are not an unrestricted web crawler, and API limits or missing thumbnails can reduce coverage. “All sources” sends the search query to each provider, tolerates individual provider failure and deduplicates results. A provider-filtered query goes only to the selected provider. Saved images contain URLs and metadata, not offline image binaries. NASA content follows its own media usage policies, rather than being universally CC0.

## Requirements

Node.js 22+ and npm. Native builds require the Rust, Linux WebKitGTK, and Android SDK/NDK tools described in the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

## Develop and verify

```bash
npm ci
npm run dev           # http://localhost:1420
npm run typecheck
npm test
npm run build
```

### Install the web app

Serve the production `dist/` directory over HTTPS (or use localhost during development). On supported browsers, use **Install app** / **Add to Home screen** to install the PWA. The service worker precaches only same-origin application assets: it does not cache third-party image results, user searches, or raw images. Native Linux/Android Tauri packaging remains separate.

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

The browser calls `https://api.openverse.org/v1/images/` (anonymous limits apply), `https://commons.wikimedia.org/w/api.php` with `origin=*`, `https://images-api.nasa.gov/search`, and `https://www.loc.gov/photos/?fo=json, https://openaccess-api.clevelandart.org/api/artworks/, and the current Metropolitan Museum of Art v1.1 paginated search endpoint.`. Previews come from provider-controlled hosts, not through our infrastructure. Openverse third-party originals are not fetched automatically as thumbnail fallbacks. Each image links to its original source page for authoritative authorship, license, and attribution terms. Images are not claimed to be free of restrictions; verify requirements before reuse.

No API keys are embedded in client code. Future commercial search providers should use a separate secured proxy with appropriate quotas, caching, licensing and terms compliance.

## Architecture

- `src/services/openverse.ts`, `commons.ts`, `nasa.ts`, `loc.ts`, `cleveland.ts`: source-specific API adapters, response normalization, URL trust boundaries and pagination.
- `src/services/providers.ts`: parallel federated search with partial-failure tolerance and stable result deduplication.
- `src/services/imageFallback.ts`: same-provider trusted preview recovery.
- `src-tauri/android/MainActivity.kt`: Android native safe-area application; `scripts/prepare-android.sh` installs it into generated Gradle sources.
- `src/hooks`: image search request lifecycle and local saved state, with separate first-page and load-more error handling.
- `src/services/network.ts`: cancellable HTTP timeout helper shared by image providers.
- `src/components`: masonry tiles and lightbox.
- `src/styles.css`: shared responsive, reduced-motion-aware styling.
- `src-tauri`: minimal Rust shell with a restrictive content security policy.
- `.github/workflows/verify.yml`: web tests/build, Linux bundle, manually invoked Android packaging.

## Acceptance status

This is an initial development implementation. It must not be called production Stable without platform-runtime testing, security review, source availability checks, release signing, install/upgrade testing, and acceptance verification.

## License

Copyright (C) 2026 GoreeCloud. Original GoreeCloud Image Search source code is licensed under **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**; see [LICENSE](LICENSE) for the complete terms. This covers the original application source, not third-party libraries or remotely served images. Dependencies and source images remain subject to their respective licenses and attribution requirements.

### Appearance and optional provider API keys

On mobile, **Settings** sits beside Explore and Saved in the bottom dock; on
desktop it is in the main navigation. Settings > **Appearance** lets you choose
Dark or Light Mode. Only the theme preference is stored locally.

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
