# Native release acceptance checklist

This checklist applies to GoreeCloud Image Search development builds. Passing CI packaging is not proof of a Stable release.

## Candidate and Linux checks

1. Record the exact GitHub commit, build workflow URL, artifact names, checksums, versions, and architectures.
2. Confirm the DEB installs on supported Linux with required WebKitGTK dependencies, then launch the app in a real graphical session.
3. Exercise federated Openverse, Wikimedia, NASA, and Library of Congress search; verify actual images display, source rights links, saving, keyboard navigation, and responsive layouts.
4. Exercise offline/retry behavior and failed-preview recovery. Verify AppImage launch, reinstall/upgrade, and rollback.
5. Record any blocked UI acceptance, WebKit regressions, or incomplete source availability separately.

## Android checks

1. Inspect package identity `com.goreecloud.imagesearch`, versionCode, target SDK, supported architecture, APK integrity, and signing-certificate fingerprint. Run `scripts/verify-android-apk.sh /path/to/app.apk`; for a Development release supply the approved `EXPECTED_SIGNER_SHA256` and `PREVIOUS_VERSION_CODE` environment variables so a changed certificate or non-increasing versionCode fails closed. A debug build without these reference values is **not** verified update-compatible.
2. Install on a representative Android 15/16 device or emulator; confirm startup, remote provider search, thumbnail rendering, and no fatal exceptions.
3. Inspect status-bar, navigation-bar, cutout, three-button navigation, gesture navigation, device rotation, and keyboard behavior. Content and bottom controls must stay outside interactive system UI.
4. Exercise source filters, saved collection, lightbox navigation, focus accessibility, thumbnail retry, and source-link privacy behavior.
5. Verify *update in place* with the same protected GoreeCloud Development signing identity and monotonically increasing versionCode, preserving app data and preferences.
6. Before delivering a Development APK to the owner, copy the **exact verified APK** into the authorized GoreeCloud Google Drive account, then read back its identity and metadata. Temporary CI debug signing must never be represented as update-compatible.

## Release decision

Document known defects, privacy/security implications, target devices, limitations, manual QA evidence, dependency review, signing/upgrade evidence, owner delivery identity, and recovery plan. Do not mark Stable until required runtime and release gates pass.
