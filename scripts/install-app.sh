#!/usr/bin/env bash

set -euo pipefail

REPO="Samin12/claude-command-center-beta"
ASSET_NAME="Samins-Command-Center-mac-arm64.dmg"
DOWNLOAD_URL="https://github.com/${REPO}/releases/latest/download/${ASSET_NAME}"
APP_NAME="Samins Command Center.app"
DEFAULT_INSTALL_DIR="/Applications"
INSTALL_DIR="${DEFAULT_INSTALL_DIR}"
SHOULD_OPEN=1
TMP_DIR="$(mktemp -d /tmp/samins-command-center-install.XXXXXX)"
MOUNT_POINT=""

cleanup() {
  if [[ -n "${MOUNT_POINT}" && -d "${MOUNT_POINT}" ]]; then
    hdiutil detach "${MOUNT_POINT}" -quiet >/dev/null 2>&1 || true
  fi
  rm -rf "${TMP_DIR}"
}

usage() {
  cat <<EOF
Install the latest Samins Command Center release on macOS.

Usage:
  $0 [--install-dir /Applications] [--skip-open]
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --skip-open)
      SHOULD_OPEN=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

trap cleanup EXIT

if [[ "${OSTYPE:-}" != darwin* ]]; then
  echo "This installer currently supports macOS only." >&2
  exit 1
fi

mkdir -p "${INSTALL_DIR}"

DMG_PATH="${TMP_DIR}/${ASSET_NAME}"

echo "Downloading ${ASSET_NAME}..."
curl --fail --location --progress-bar --output "${DMG_PATH}" "${DOWNLOAD_URL}"

echo "Mounting disk image..."
MOUNT_POINT="$(hdiutil attach "${DMG_PATH}" -nobrowse -quiet | awk 'END {print $NF}')"

if [[ -z "${MOUNT_POINT}" || ! -d "${MOUNT_POINT}" ]]; then
  echo "Failed to mount ${ASSET_NAME}." >&2
  exit 1
fi

APP_SOURCE="$(find "${MOUNT_POINT}" -maxdepth 2 -type d -name "${APP_NAME}" -print -quit)"

if [[ -z "${APP_SOURCE}" ]]; then
  echo "Could not find ${APP_NAME} inside the mounted disk image." >&2
  exit 1
fi

APP_DEST="${INSTALL_DIR}/${APP_NAME}"

echo "Installing ${APP_NAME} to ${APP_DEST}..."
osascript -e 'tell application "Samins Command Center" to quit' >/dev/null 2>&1 || true

if [[ -w "${INSTALL_DIR}" ]]; then
  rm -rf "${APP_DEST}"
  ditto "${APP_SOURCE}" "${APP_DEST}"
  xattr -dr com.apple.quarantine "${APP_DEST}" >/dev/null 2>&1 || true
  xattr -cr "${APP_DEST}" >/dev/null 2>&1 || true
else
  sudo rm -rf "${APP_DEST}"
  sudo ditto "${APP_SOURCE}" "${APP_DEST}"
  sudo xattr -dr com.apple.quarantine "${APP_DEST}" >/dev/null 2>&1 || true
  sudo xattr -cr "${APP_DEST}" >/dev/null 2>&1 || true
fi

echo "Unmounting disk image..."
hdiutil detach "${MOUNT_POINT}" -quiet >/dev/null 2>&1 || true
MOUNT_POINT=""

if [[ "${SHOULD_OPEN}" -eq 1 ]]; then
  echo "Opening ${APP_NAME}..."
  open "${APP_DEST}"
fi

cat <<EOF

Installed successfully.
Location: ${APP_DEST}

If Claude Code is already installed, you can start using Samins Command Center now.
If Claude Code is not installed yet, install it from:
https://docs.anthropic.com/en/docs/claude-code/getting-started
EOF
