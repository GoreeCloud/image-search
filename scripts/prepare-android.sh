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
