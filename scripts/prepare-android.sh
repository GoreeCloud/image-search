#!/usr/bin/env bash
set -euo pipefail
source="src-tauri/android/MainActivity.kt"
root="src-tauri/gen/android/app/src/main/java"
test -f "$source"
test -d "$root"
mapfile -t activities < <(find "$root" -type f -name MainActivity.kt)
if [[ ${#activities[@]} -ne 1 ]]; then
  printf 'Expected one Android MainActivity; found %s\n' "${#activities[@]}" >&2
  exit 1
fi
cp "$source" "${activities[0]}"
printf 'Applied native Android system-bar insets to %s\n' "${activities[0]}"

# Keep this native plugin in both the regular and per-run QA APK packages.
# The Kotlin class retains its stable namespace so Rust can register it under
# com.goreecloud.imagesearch even if the QA app identifier changes.
test -f src-tauri/android/ImageDownloadPlugin.kt
cp src-tauri/android/ImageDownloadPlugin.kt "$(dirname "${activities[0]}")/ImageDownloadPlugin.kt"
cp src-tauri/android/PublicImageDns.kt "$(dirname "${activities[0]}")/PublicImageDns.kt"
cp src-tauri/android/ImageDownloadDeadline.kt "$(dirname "${activities[0]}")/ImageDownloadDeadline.kt"
printf 'Applied native Android Downloads plugin, public-only DNS resolver, and total deadline\n'

# Generated Android sources are intentionally not checked into Git. Add the
# networking dependency and native JVM regression suite on every CI/QA init.
gradle_file="src-tauri/gen/android/app/build.gradle.kts"
test -f "$gradle_file"
if ! grep -Fq 'com.squareup.okhttp3:okhttp:5.3.0' "$gradle_file"; then
  printf '\n// GoreeCloud native image downloads: validated, pinned DNS destinations.\ndependencies {\n    implementation("com.squareup.okhttp3:okhttp:5.3.0")\n    testImplementation("junit:junit:4.13.2")\n}\n' >> "$gradle_file"
fi
test_root="src-tauri/gen/android/app/src/test/java/com/goreecloud/imagesearch"
mkdir -p "$test_root"
cp src-tauri/android/PublicImageDnsTest.kt "$test_root/PublicImageDnsTest.kt"
cp src-tauri/android/ImageDownloadDeadlineTest.kt "$test_root/ImageDownloadDeadlineTest.kt"
printf 'Installed native DNS policy and download deadline regression tests\n'

# System-bar appearance is a separate native plugin with the same stable namespace.
test -f src-tauri/android/ThemeBarsPlugin.kt
cp src-tauri/android/ThemeBarsPlugin.kt "$(dirname "${activities[0]}")/ThemeBarsPlugin.kt"
printf 'Applied native Android theme-aware system bars plugin\n'
