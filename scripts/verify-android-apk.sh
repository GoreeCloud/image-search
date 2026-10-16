#!/usr/bin/env bash
set -euo pipefail

# Verify one Android APK's cryptographic integrity and reported identity.
# When expected signer/version are provided, fail closed on mismatches.
if [[ $# -ne 1 || ! -f "$1" ]]; then
  printf 'Usage: %s /path/to/app.apk\n' "$0" >&2
  exit 2
fi

apk="$1"
aapt_bin="${AAPT_BIN:-aapt}"
apksigner_bin="${APKSIGNER_BIN:-apksigner}"
expected_package="${EXPECTED_PACKAGE:-com.goreecloud.imagesearch}"
expected_signer="${EXPECTED_SIGNER_SHA256:-}"
previous_code="${PREVIOUS_VERSION_CODE:-}"

unzip -tq "$apk"
"$apksigner_bin" verify "$apk"
badging="$("$aapt_bin" dump badging "$apk")"
package_line="$(printf '%s\n' "$badging" | grep -m 1 '^package:')"
package="$(printf '%s' "$package_line" | awk -F "'" '{print $2}')"
version_code="$(printf '%s' "$package_line" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")"
signer="$("$apksigner_bin" verify --print-certs "$apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1)"

if [[ "$package" != "$expected_package" ]]; then
  printf 'Unexpected package: %s (expected %s)\n' "$package" "$expected_package" >&2
  exit 1
fi
if [[ ! "$version_code" =~ ^[0-9]+$ || -z "$signer" ]]; then
  echo 'APK version code or signing identity is missing.' >&2
  exit 1
fi
if [[ -n "$expected_signer" && "${signer,,}" != "${expected_signer,,}" ]]; then
  echo 'APK signing certificate differs from protected Development identity.' >&2
  exit 1
fi
if [[ -n "$previous_code" ]]; then
  if [[ ! "$previous_code" =~ ^[0-9]+$ || "$version_code" -le "$previous_code" ]]; then
    printf 'APK versionCode %s must exceed previous versionCode %s.\n' "$version_code" "$previous_code" >&2
    exit 1
  fi
fi

printf 'APK package=%s versionCode=%s signerSHA256=%s\n' "$package" "$version_code" "$signer"
if [[ -z "$expected_signer" ]]; then
  echo 'No expected signer provided: integrity verified; Development update compatibility NOT established.'
fi
