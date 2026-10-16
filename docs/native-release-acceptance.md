# Native release acceptance checklist

This checklist applies to GoreeCloud Image Search development builds. Passing GitHub Actions does not establish a production-ready release.

## Linux

1. Download the exact Debian package and AppImage associated with the candidate commit.
2. Verify the package checksum, architecture, and dependencies.
3. On a representative graphical Debian-family workstation, install the package, launch the application, and confirm live Openverse and Wikimedia search results.
4. Exercise search, saved images, lightbox keyboard navigation, network outage/retry, window resizing, and reinstall/upgrade.
5. Repeat essential smoke checks with the AppImage. Document any WebKit or sandbox failures.

## Android

1. Verify the Android package identifier, version code, signing certificate fingerprint, and architecture.
2. Install a candidate build on a representative supported device or emulator, launch it, and confirm that the correct activity remains running.
3. Validate search results, scrolling, source switching, saving, preview navigation, error states, orientation, accessibility, and offline behavior.
4. Confirm install/upgrade compatibility against the *same protected Development signing identity* and an incremented version code.
5. For owner distribution, copy the **exact verified APK** into the authorized GoreeCloud Google Drive account and read back its identity before presenting a link. Temporary CI debug signatures are not update-compatible.

## Release decision

Record candidate commit, checksums, installed build identifiers, test environment, observed defects, dependencies, recovery/rollback strategy, and outstanding approvals. Do not declare Stable or production readiness when native UI, upgrade continuity, security, or owner delivery remains unverified.
