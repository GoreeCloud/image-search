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
printf 'Applied native Android Downloads plugin\n'
