#!/bin/bash
# build-app.sh — Build the OTG Legal Box installer (Mac and Linux)
#
# This script:
#   1. Builds the React frontend (static HTML/JS/CSS)
#   2. Compiles the Python backend into a standalone binary (PyInstaller)
#   3. Packages everything into a .dmg (Mac) or .AppImage/.deb (Linux)
#
# Prerequisites (run setup.sh first, then install these extra tools):
#   pip install pyinstaller
#   cd electron && npm install
#
# For Mac distribution: you need an Apple Developer account for code signing.
# For unsigned builds (internal use): set CSC_IDENTITY_AUTO_DISCOVERY=false

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ELECTRON_DIR="$PROJECT_DIR/electron"
BACKEND_DIST="$PROJECT_DIR/backend-dist"

echo ""
echo -e "${BOLD}OTG Legal Box — Build Installer${NC}"
echo "──────────────────────────────────────"
echo ""

# ── Step 1: Build the React frontend ─────────────────────────────────────────

echo -e "${YELLOW}Step 1/3: Building frontend...${NC}"
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "  Installing npm packages..."
    npm install -q
fi

npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}Frontend build failed — dist/ not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend built ($(du -sh dist | cut -f1))${NC}"

# ── Step 2: Compile Python backend with PyInstaller ───────────────────────────

echo ""
echo -e "${YELLOW}Step 2/3: Compiling Python backend...${NC}"
echo "  This may take 5-10 minutes on first build."
echo ""

cd "$BACKEND_DIR"
source venv/bin/activate

# Install PyInstaller if not present
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    echo "  Installing PyInstaller..."
    pip install pyinstaller -q
fi

# Bundle the embedding model into the build tree — the packaged app runs a
# loopback-only egress guard, so the model must ship inside the binary.
if [ ! -d "embedding_model" ]; then
    echo "  Saving embedding model into build tree (one-time download)..."
    # device='cpu': on Apple Silicon, sentence-transformers auto-selects the
    # MPS (Metal GPU) backend, which can fail with an out-of-memory error in
    # constrained/virtualized environments (seen in CI). This step only
    # downloads and serializes weights to disk, so forcing CPU avoids the
    # GPU backend entirely with no downside.
    LEGALBOX_ALLOW_EGRESS=1 python3 -c "
from sentence_transformers import SentenceTransformer
SentenceTransformer('all-MiniLM-L6-v2', device='cpu').save('embedding_model')
"
fi

# Download the Ollama runtime for bundling into the installer (Electron
# spawns it if the user has no system Ollama). MIT-licensed binary from
# the official release channel.
OLLAMA_VENDOR_DIR="$ELECTRON_DIR/vendor/ollama"
if [ ! -x "$OLLAMA_VENDOR_DIR/ollama" ]; then
    echo "  Downloading Ollama runtime for bundling..."
    mkdir -p "$OLLAMA_VENDOR_DIR"
    if [ "$(uname -s)" = "Darwin" ]; then
        curl -fsSL -o /tmp/ollama-darwin.tgz \
          "https://ollama.com/download/ollama-darwin.tgz"
        tar -xzf /tmp/ollama-darwin.tgz -C "$OLLAMA_VENDOR_DIR"
    else
        curl -fsSL -o "$OLLAMA_VENDOR_DIR/ollama" \
          "https://ollama.com/download/ollama-linux-amd64"
    fi
    chmod +x "$OLLAMA_VENDOR_DIR/ollama" 2>/dev/null || true
    echo "  ✓ Ollama runtime staged in electron/vendor/ollama"
fi

# Run PyInstaller
pyinstaller legalbox.spec \
    --distpath "$BACKEND_DIST" \
    --workpath "$PROJECT_DIR/.pyinstaller-work" \
    --clean \
    --noconfirm

if [ ! -d "$BACKEND_DIST/legalbox-backend" ]; then
    echo -e "${RED}PyInstaller build failed — binary not found${NC}"
    exit 1
fi

# Make the binary executable
chmod +x "$BACKEND_DIST/legalbox-backend/legalbox-backend"
echo -e "${GREEN}✓ Backend compiled ($(du -sh "$BACKEND_DIST" | cut -f1))${NC}"

# ── Step 3: Package with Electron ────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Step 3/3: Packaging with Electron...${NC}"

cd "$ELECTRON_DIR"

if [ ! -d "node_modules" ]; then
    echo "  Installing Electron packages..."
    npm install -q
fi

# Detect platform and build accordingly
OS_TYPE="$(uname -s)"
if [ "$OS_TYPE" = "Darwin" ]; then
    echo "  Building macOS .dmg..."
    # Unsigned build for internal distribution
    CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:mac
elif [ "$OS_TYPE" = "Linux" ]; then
    echo "  Building Linux .AppImage and .deb..."
    npm run build:linux
fi

echo -e "${GREEN}✓ Installer built${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────

DIST_DIR="$PROJECT_DIR/dist-electron"
echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}${GREEN}✅ Build complete!${NC}"
echo ""
echo -e "  Installer is in: ${BLUE}$DIST_DIR/${NC}"
echo ""
ls "$DIST_DIR/"*.{dmg,AppImage,deb} 2>/dev/null || ls "$DIST_DIR/"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
