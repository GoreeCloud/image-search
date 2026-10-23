# Native release acceptance checklist

This checklist applies to GoreeCloud Image Search development builds. The current Tauri WebView-based Linux/Android packages are transitional QA artifacts, **not native-complete applications** under the GoreeCloud operating-system mandate. The checks below do not replace implementation and acceptance of genuine native interfaces, lifecycle behavior, platform integrations, and upgrades. Passing CI packaging is not proof of an **Anchor** release.

## Candidate and Linux checks

1. Record the exact GitHub commit, build workflow URL, artifact names, checksums, versions, and architectures.
2. Confirm the DEB installs on supported Linux with required WebKitGTK dependencies, then launch the app in a real graphical session.
3. Exercise federated Openverse, Wikimedia, NASA, and Library of Congress search; verify actual images display, source rights links, saving, keyboard navigation, and responsive layouts.
4. Exercise offline/retry behavior and failed-preview recovery. Verify AppImage launch, reinstall/upgrade, and rollback.
5. Record any blocked UI acceptance, WebKit regressions, or incomplete source availability separately.
6. Evaluate the native Linux implementation boundary separately; DEB/AppImage packaging of the WebView UI alone cannot satisfy native acceptance.

## Disposable Android QA package safety

Each GitHub Actions Android USB QA run uses a distinct package suffix derived
from its workflow run ID. This deliberately avoids attempting to update an
older temporary debug-signed QA APK with a different ephemeral certificate.
Install the verified per-run QA APK only alongside user apps. Do not uninstall
or clear a previously installed package without independently confirming that
its data is disposable. The per-run QA scheme is **not** a substitute for the
persistent protected Development signing identity required for owner APKs.

## Android checks

1. Inspect package identity `com.goreecloud.imagesearch`, versionCode, target SDK, supported architecture, APK integrity, and signing-certificate fingerprint. Run `scripts/verify-android-apk.sh /path/to/app.apk`; for a Development release supply the approved `EXPECTED_SIGNER_SHA256` and `PREVIOUS_VERSION_CODE` environment variables so a changed certificate or non-increasing versionCode fails closed. A debug build without these reference values is **not** verified update-compatible.
2. Install on a representative Android 15/16 device or emulator; confirm startup, remote provider search, thumbnail rendering, and no fatal exceptions.
3. Inspect status-bar, navigation-bar, cutout, three-button navigation, gesture navigation, device rotation, and keyboard behavior. Content and bottom controls must stay outside interactive system UI.
4. Exercise source filters, saved collection, lightbox navigation, focus accessibility, thumbnail retry, and source-link privacy behavior.
5. Verify *update in place* with the same protected GoreeCloud Development signing identity and monotonically increasing versionCode, preserving app data and preferences.
6. Before delivering a Development APK to the owner, copy the **exact verified APK** into the authorized GoreeCloud Google Drive account, then read back its identity and metadata. Temporary CI debug signing must never be represented as update-compatible.
7. Verify every packaged arm64 native ELF `PT_LOAD` segment and APK library ZIP alignment support 16 KiB pages, then check on a real/representative device for the absence of the compatibility warning. Track this under [issue #17](https://github.com/GoreeCloud/image-search/issues/17); a proposed CI gate or green build alone does not close device acceptance.
8. Evaluate the actual native Android UI and application lifecycle separately from a WebView-based package, and close the keyboard/viewport issue [#11](https://github.com/GoreeCloud/image-search/issues/11) only with representative-device evidence.

## Release decision

Document known defects, privacy/security implications, target devices, limitations, manual QA evidence, dependency review, signing/upgrade evidence, owner delivery identity, recovery plan, and applicable nine-system integration. Do not mark the release **Anchor** until the genuine native implementation and all other required runtime and release gates pass.
