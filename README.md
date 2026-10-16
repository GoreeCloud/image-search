# Image Search

A GoreeCloud visual discovery app for **web, Linux, and Android**. It uses a polished, Pinterest-inspired masonry interface with a single shared React/TypeScript experience and a minimal Tauri 2 native shell.

## Available capabilities

- Search openly licensed imagery across multiple websites through Openverse, or switch to Wikimedia Commons. No API key required at the supported anonymous request limits.
- Adaptive masonry grid with original aspect ratios, skeletons, infinite pagination and retry states.
- Search suggestions, source links, orientation filters and full-screen image details.
- Save / unsave images locally on-device. Copy original links, inspect creator, resolution and license.
- Dark Glaze-inspired styling, accessibility labels, keyboard shortcuts, focus-trapped image previews, reduced-motion support and touch-friendly layouts.
- Privacy-first: no login, no tracking, no analytics, no third-party JavaScript embeds.
- Installable progressive web app (PWA) on supported browsers. Its app shell remains available offline; searching and remote images still require connectivity.
- Request timeouts and non-destructive load-more retry handling protect the existing gallery if a provider is temporarily unavailable.

**Scope:** Openverse indexes openly licensed media from multiple websites. Wikimedia Commons is also available. Neither source is a general-purpose unrestricted web crawler. Both APIs have rate/usage limitations. Search queries go to the selected provider; previews are fetched from the Openverse thumbnail endpoint or Wikimedia CDN. Saved images contain URL/metadata, not offline image binaries.

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
npm run tauri -- android dev
npm run tauri -- android build --debug --target aarch64
```

Android requires SDK + NDK + a connected emulator/device for actual runtime tests. The manual GitHub Actions job makes a temporary debug package solely for bounded testing. **It is not a GoreeCloud Development distribution APK**; persistent protected signing identity, monotonically increasing Android versionCode, install/upgrade tests, and Drive delivery must be completed before a development APK is offered to the owner.

## Search provider and image rights

The browser calls `https://api.openverse.org/v1/images/` (anonymous limits apply) or `https://commons.wikimedia.org/w/api.php` with `origin=*`. Openverse previews are proxied by Openverse; Commons thumbnails are served from trusted Wikimedia hosts. Each image links to its original source page for authoritative authorship, license, and attribution terms. Images are not claimed to be free of restrictions; verify requirements before reuse.

No API keys are embedded in client code. Future commercial search providers should use a separate secured proxy with appropriate quotas, caching, licensing and terms compliance.

## Architecture

- `src/services/openverse.ts` and `src/services/commons.ts`: open-license image provider APIs, response normalization, URL trust boundaries and pagination.
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
