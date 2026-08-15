#!/bin/bash
# usb-update.sh — Apply an OTG Legal Box update from a USB drive (Mac and Linux)
#
# HOW TO USE (for the person doing the update):
#
#   1. Prepare the USB drive:
#      - Create a folder called "legalbox-update" on the USB drive
#      - Copy the new app files into it (same structure as the project)
#      - If updating the AI model, copy the new .gguf file into a "models/" subfolder
#
#   2. Plug the USB drive into the target computer
#   3. Run this script: ./scripts/usb-update.sh
#   4. The script finds the USB automatically and applies the update
#   5. Restart the app
#
# NO INTERNET REQUIRED. This script never contacts any external server.
#
# What it updates:
#   - Application code (backend/, frontend/ dist, electron/)
#   - AI model files (if included on the USB)
#   - Python packages (if requirements.txt changed)
#
# What it NEVER changes automatically:
#   - Your case database (data/ folder) — your data is always preserved
#   - Your settings (config files) — preserved unless you explicitly included them

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
UPDATE_FOLDER_NAME="legalbox-update"

echo ""
echo -e "${BOLD}OTG Legal Box — USB Update${NC}"
echo "──────────────────────────────────────"
echo ""
echo -e "Your data (cases, settings) is NEVER deleted during updates."
echo ""

# ── Find the USB drive ─────────────────────────────────────────────────────────

OS_TYPE="$(uname -s)"
UPDATE_SOURCE=""

if [ "$OS_TYPE" = "Darwin" ]; then
    # Mac: USB drives appear in /Volumes/
    for vol in /Volumes/*/; do
        if [ -d "${vol}${UPDATE_FOLDER_NAME}" ]; then
            UPDATE_SOURCE="${vol}${UPDATE_FOLDER_NAME}"
            echo -e "${GREEN}Found update on: $vol${NC}"
            break
        fi
    done
else
    # Linux: check common mount points
    for mount in /media /mnt /run/media/"$USER"; do
        if [ -d "$mount" ]; then
            found=$(find "$mount" -maxdepth 3 -type d -name "$UPDATE_FOLDER_NAME" 2>/dev/null | head -1)
            if [ -n "$found" ]; then
                UPDATE_SOURCE="$found"
                echo -e "${GREEN}Found update on: $mount${NC}"
                break
            fi
        fi
    done
fi

if [ -z "$UPDATE_SOURCE" ]; then
    echo -e "${RED}No USB update found.${NC}"
    echo ""
    echo "Make sure your USB drive is plugged in and contains a folder named:"
    echo "  ${UPDATE_FOLDER_NAME}/"
    echo ""
    echo "Expected structure on the USB drive:"
    echo "  ${UPDATE_FOLDER_NAME}/"
    echo "  ├── version.txt          (e.g. '1.2.0')"
    echo "  ├── backend/             (updated Python files, optional)"
    echo "  ├── frontend/dist/       (updated built frontend, optional)"
    echo "  ├── models/              (updated AI model files, optional)"
    echo "  └── CHANGELOG.txt        (what changed in this update)"
    exit 1
fi

# ── Read version info ──────────────────────────────────────────────────────────

NEW_VERSION=""
if [ -f "$UPDATE_SOURCE/version.txt" ]; then
    NEW_VERSION=$(cat "$UPDATE_SOURCE/version.txt" | tr -d '[:space:]')
    echo -e "Update version: ${BLUE}${NEW_VERSION}${NC}"
fi

if [ -f "$UPDATE_SOURCE/CHANGELOG.txt" ]; then
    echo ""
    echo -e "${BOLD}What's new in this update:${NC}"
    cat "$UPDATE_SOURCE/CHANGELOG.txt"
    echo ""
fi

# ── Confirm before applying ────────────────────────────────────────────────────

echo -e "${YELLOW}Ready to apply update to: $PROJECT_DIR${NC}"
echo ""
read -r -p "Apply update now? [y/N] " confirm
if [[ ! "$confirm" =~ ^[yY]$ ]]; then
    echo "Update cancelled."
    exit 0
fi

echo ""

# ── Back up current version ───────────────────────────────────────────────────

BACKUP_DIR="$PROJECT_DIR/../legalbox-backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${YELLOW}Creating backup at: $BACKUP_DIR${NC}"
# Only back up code, not the large data/model files
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_DIR/backend" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$PROJECT_DIR/frontend" "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${GREEN}✓ Backup created${NC}"

# ── Apply updates ─────────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Applying update...${NC}"

# Backend code
if [ -d "$UPDATE_SOURCE/backend" ]; then
    echo "  Updating backend code..."
    # Preserve the venv and data directories
    rsync -av --exclude='venv/' --exclude='__pycache__/' \
        "$UPDATE_SOURCE/backend/" "$PROJECT_DIR/backend/"
    echo -e "  ${GREEN}✓ Backend updated${NC}"
fi

# Frontend (pre-built dist)
if [ -d "$UPDATE_SOURCE/frontend/dist" ]; then
    echo "  Updating frontend..."
    rm -rf "$PROJECT_DIR/frontend/dist"
    cp -r "$UPDATE_SOURCE/frontend/dist" "$PROJECT_DIR/frontend/dist"
    echo -e "  ${GREEN}✓ Frontend updated${NC}"
fi

# AI model files
if [ -d "$UPDATE_SOURCE/models" ]; then
    echo "  Updating AI models..."
    MODEL_DIR="$PROJECT_DIR/data/models"
    mkdir -p "$MODEL_DIR"
    cp -r "$UPDATE_SOURCE/models/"* "$MODEL_DIR/"
    echo -e "  ${GREEN}✓ Models updated${NC}"
fi

# Update Python packages if requirements changed
if [ -f "$UPDATE_SOURCE/backend/requirements.txt" ]; then
    echo "  Installing updated Python packages..."
    cd "$PROJECT_DIR/backend"
    source venv/bin/activate
    pip install -r requirements.txt -q
    echo -e "  ${GREEN}✓ Python packages updated${NC}"
fi

# ── Write version file ─────────────────────────────────────────────────────────

if [ -n "$NEW_VERSION" ]; then
    echo "$NEW_VERSION" > "$PROJECT_DIR/.version"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}${GREEN}✅ Update applied successfully!${NC}"
echo ""
echo -e "  Restart the app to use the new version."
echo ""
echo -e "  Your data (cases, settings) was not modified."
echo ""
echo -e "  Backup saved to: ${BLUE}$BACKUP_DIR${NC}"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
