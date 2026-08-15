#!/bin/bash
# uninstall.sh — Complete removal of OTG Legal Box (macOS / Linux)
#
# Removes: user data, logs, preferences, downloaded AI models, and
# (optionally) the app itself. Everything Legal Box ever wrote lives in the
# paths below — deleting them leaves zero residue.
#
# Usage:  ./uninstall.sh          # interactive
#         ./uninstall.sh --yes    # no prompts (removes data + models, keeps Ollama)

set -euo pipefail

YES=0
[ "${1:-}" = "--yes" ] && YES=1

confirm() {
  [ "$YES" = "1" ] && return 0
  read -r -p "$1 [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

echo "OTG Legal Box — uninstaller"
echo "==========================="

# 1. Stop running processes
pkill -f legalbox-backend 2>/dev/null || true
pkill -f 'uvicorn main:app' 2>/dev/null || true
echo "✓ Stopped Legal Box processes"

# 2. User data (cases, index, logs, settings)
if [ "$(uname)" = "Darwin" ]; then
  DATA_PATHS=(
    "$HOME/Library/Application Support/OTG Legal Box"
    "$HOME/Library/Logs/OTG Legal Box"
    "$HOME/Library/Preferences/ai.ontheground.legalbox.plist"
    "$HOME/Library/Saved Application State/ai.ontheground.legalbox.savedState"
  )
else
  DATA_PATHS=(
    "$HOME/.config/OTG Legal Box"
    "$HOME/.local/share/OTG Legal Box"
  )
fi

if confirm "Delete all Legal Box user data (cases, search index, audit logs, settings)?"; then
  for p in "${DATA_PATHS[@]}"; do
    rm -rf "$p" 2>/dev/null || true
  done
  echo "✓ User data removed"
fi

# 3. AI models downloaded through Legal Box (Ollama store)
if confirm "Delete downloaded AI models (frees 5–20 GB; other Ollama apps lose them too)?"; then
  if command -v ollama >/dev/null 2>&1; then
    for m in $(ollama list 2>/dev/null | awk 'NR>1 && $1 ~ /^gemma4/ {print $1}'); do
      ollama rm "$m" 2>/dev/null || true
    done
    echo "✓ Legal Box models removed from Ollama"
  else
    rm -rf "$HOME/.ollama/models" 2>/dev/null || true
    echo "✓ Ollama model store removed"
  fi
fi

# 4. The app bundle itself
if [ "$(uname)" = "Darwin" ] && [ -d "/Applications/OTG Legal Box.app" ]; then
  if confirm "Move 'OTG Legal Box.app' to the Trash?"; then
    rm -rf "/Applications/OTG Legal Box.app"
    echo "✓ App removed"
  fi
fi

echo ""
echo "Done. Nothing Legal Box created remains on this computer"
echo "(except Ollama itself, if you use it for other apps — remove it from"
echo " Applications / with your package manager if you no longer need it)."
