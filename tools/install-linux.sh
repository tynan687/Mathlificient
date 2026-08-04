#!/usr/bin/env bash
#
# Build and install Mathlificient on a Debian/Ubuntu machine.
#
# The app was Windows-only until now — not because anything in it is
# Windows-specific (nothing is: no process.platform, no win32 paths, and both
# dependencies are pure JS) but because package.json had no Linux target. It
# does now, so this is an ordinary electron-builder run.
#
#   ./tools/install-linux.sh              build the .deb and offer to install it
#   ./tools/install-linux.sh --no-install just build it, leave it in dist/
#   ./tools/install-linux.sh --run        skip packaging, run straight from source
#
# Wants ~1.5GB free disk while building. Peak memory is a few hundred MB, so a
# 4GB machine is fine.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"
PC="$REPO/VoiceMathTutorPC"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
die()  { printf '\033[31merror: %s\033[0m\n' "$*" >&2; exit 1; }

[ -d "$PC" ] || die "no VoiceMathTutorPC/ next to this script — run it from inside the repo"

# ---- node ----------------------------------------------------------------------------
command -v node >/dev/null 2>&1 || die \
  "node is not installed. On Debian 12:
    sudo apt install nodejs npm
  Debian 12 ships node 18, which is enough. For something newer see https://nodejs.org."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "node $NODE_MAJOR is too old; electron-builder needs 18+."
say "node $(node -v)"

# ---- the keyring, because the API key depends on it ------------------------------------
#
# safeStorage encrypts the key only when a keyring is actually available. Without
# one it writes the key in plain text. The .deb depends on libsecret-1-0, but a
# package being installed is not the same as a keyring running and unlocked, so
# this is a heads-up rather than a gate.
if ! ldconfig -p 2>/dev/null | grep -q libsecret-1; then
  warn "libsecret is not installed — your OpenAI API key would be stored UNENCRYPTED."
  warn "  sudo apt install libsecret-1-0 gnome-keyring"
  warn "The app will tell you the same thing on its home screen."
fi

# ---- run from source, no packaging ------------------------------------------------------
if [ "${1:-}" = "--run" ]; then
  say "Installing dependencies"
  npm install --prefix "$PC"
  say "Starting Mathlificient"
  exec npm start --prefix "$PC"
fi

# ---- build ------------------------------------------------------------------------------
say "Installing dependencies (this is the slow part)"
if [ -f "$PC/package-lock.json" ]; then npm ci --prefix "$PC"; else npm install --prefix "$PC"; fi

say "Building the .deb"
( cd "$PC" && npx electron-builder --linux deb )

DEB="$(ls -t "$PC"/dist/*.deb 2>/dev/null | head -1 || true)"
[ -n "$DEB" ] || die "electron-builder finished but produced no .deb in $PC/dist"
say "Built $(basename "$DEB") ($(du -h "$DEB" | cut -f1))"

if [ "${1:-}" = "--no-install" ]; then
  echo "Install it yourself with:  sudo apt install \"$DEB\""
  exit 0
fi

# ---- install ------------------------------------------------------------------------------
# apt, not dpkg -i: apt resolves the dependencies, dpkg would just fail on them.
say "Installing (needs sudo)"
sudo apt install -y "$DEB"

say "Done — Mathlificient is in your applications menu, or run: mathlificient"
