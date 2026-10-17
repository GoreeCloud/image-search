#!/usr/bin/env bash
# Verify every packaged arm64 native ELF can load on 16 KiB-page Android devices.
# Usage: bash scripts/verify-android-16k.sh /absolute/path/to/app.apk
set -euo pipefail
apk="${1:?provide the built APK path}"
test -s "$apk"
command -v readelf >/dev/null || { echo 'readelf is required' >&2; exit 2; }
command -v unzip >/dev/null || { echo 'unzip is required' >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mapfile -t entries < <(unzip -Z1 "$apk" | grep -E '^lib/arm64-v8a/[^/]+\.so$' || true)
if ((${#entries[@]} == 0)); then
  echo 'No arm64-v8a .so files found in APK' >&2
  exit 1
fi
for entry in "${entries[@]}"; do
  so="$tmp/${entry##*/}"
  unzip -p "$apk" "$entry" > "$so"
  mapfile -t aligns < <(readelf -lW "$so" | awk '$1 == "LOAD" { print $NF }')
  if ((${#aligns[@]} == 0)); then
    echo "$entry has no LOAD segments" >&2
    exit 1
  fi
  for align in "${aligns[@]}"; do
    if ((16#${align#0x} < 16384)); then
      echo "16 KiB ELF alignment FAIL: $entry PT_LOAD p_align=$align" >&2
      exit 1
    fi
  done
  echo "16 KiB ELF alignment OK: $entry (${#aligns[@]} LOAD segments)"
done
if command -v zipalign >/dev/null; then
  zipalign -c -P 16 -v 4 "$apk" >/dev/null || {
    echo '16 KiB APK native library ZIP alignment failed' >&2
    exit 1
  }
  echo '16 KiB APK ZIP entry alignment OK'
else
  echo 'zipalign absent: ELF tested, APK ZIP alignment not checked' >&2
  exit 2
fi
