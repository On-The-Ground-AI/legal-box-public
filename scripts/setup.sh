#!/bin/bash
# setup.sh — One-time setup for OTG Legal Box (Mac and Linux)
#
# Run this script ONCE to install all dependencies.
# After setup, use start.sh to launch the app.
#
# Usage:
#   chmod +x scripts/setup.sh    (only needed once)
#   ./scripts/setup.sh

set -e  # Stop if any command fails

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}OTG Legal Box — Setup${NC}"
echo -e "${BLUE}   One-time installation for Mac and Linux${NC}"
echo "──────────────────────────────────────────────"
echo ""

# ── Detect OS ─────────────────────────────────────────────────────────────────

OS_TYPE="$(uname -s)"
if [ "$OS_TYPE" = "Darwin" ]; then
    echo -e "${BLUE}Detected: macOS${NC}"
elif [ "$OS_TYPE" = "Linux" ]; then
    echo -e "${BLUE}Detected: Linux${NC}"
else
    echo -e "${YELLOW}Warning: Unrecognised OS ($OS_TYPE). Proceeding anyway.${NC}"
fi
echo ""

# ── Check Python ──────────────────────────────────────────────────────────────
# SpaCy, NumPy, and ChromaDB require Python 3.11 or 3.12.
# Python 3.13+ and 3.14 lack pre-built wheels and fail to compile from source.

echo -e "${YELLOW}Checking Python 3.11 or 3.12...${NC}"

# Prefer explicit version binaries first (works whether from Homebrew, pyenv, or system)
PYTHON_BIN=""
for candidate in python3.11 python3.12; do
    if command -v "$candidate" &>/dev/null; then
        PYTHON_BIN="$candidate"
        break
    fi
done

# Fall back to /opt/homebrew paths (Apple Silicon Homebrew)
if [ -z "$PYTHON_BIN" ]; then
    for candidate in /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3.12; do
        if [ -x "$candidate" ]; then
            PYTHON_BIN="$candidate"
            break
        fi
    done
fi

# Fall back to Intel Homebrew paths
if [ -z "$PYTHON_BIN" ]; then
    for candidate in /usr/local/bin/python3.11 /usr/local/bin/python3.12; do
        if [ -x "$candidate" ]; then
            PYTHON_BIN="$candidate"
            break
        fi
    done
fi

if [ -z "$PYTHON_BIN" ]; then
    echo -e "${RED}Python 3.11 or 3.12 not found.${NC}"
    echo ""
    echo "  Python 3.13 and 3.14 are NOT supported (SpaCy/NumPy lack wheels for them)."
    echo "  You need Python 3.11 or 3.12."
    echo ""
    if [ "$OS_TYPE" = "Darwin" ]; then
        echo "  Install with Homebrew:"
        echo "    brew install python@3.11"
        echo "  Then re-run this script."
    else
        echo "  Install with:"
        echo "    sudo apt install python3.11 python3.11-venv python3.11-dev"
    fi
    exit 1
fi

PYTHON_VERSION=$("$PYTHON_BIN" --version)
echo -e "${GREEN}✓ $PYTHON_VERSION (using $PYTHON_BIN)${NC}"

# ── Check Node.js ─────────────────────────────────────────────────────────────

echo -e "${YELLOW}Checking Node.js...${NC}"
if ! command -v node &>/dev/null; then
    echo -e "${RED}Node.js not found.${NC}"
    echo "  Download from: https://nodejs.org/  (LTS version recommended)"
    if [ "$OS_TYPE" = "Darwin" ]; then
        echo "  Or via Homebrew: brew install node"
    else
        echo "  Or via package manager: sudo apt install nodejs npm"
    fi
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js $NODE_VERSION${NC}"

# ── Check Ollama ──────────────────────────────────────────────────────────────

echo -e "${YELLOW}Checking Ollama...${NC}"
if ! command -v ollama &>/dev/null; then
    echo -e "${YELLOW}⚠ Ollama not found.${NC}"
    if [ "$OS_TYPE" = "Darwin" ]; then
        echo "  Download Ollama for Mac: https://ollama.com/download/mac"
    else
        echo "  Install Ollama for Linux:"
        echo "    curl -fsSL https://ollama.com/install.sh | sh"
    fi
    echo ""
    echo "  After installing Ollama, run this script again OR manually run:"
    echo "    ollama pull gemma4:e4b"
    echo ""
    echo "  You can continue setup now, but the app won't work until Ollama is installed."
    echo ""
    read -r -p "Continue without Ollama? [y/N] " response
    if [[ ! "$response" =~ ^[yY]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ Ollama found${NC}"
fi

echo ""

# ── Get script location ────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo -e "${BLUE}Project directory: $PROJECT_DIR${NC}"
echo ""

# ── Python virtual environment ────────────────────────────────────────────────

echo -e "${YELLOW}Setting up Python virtual environment...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
    echo "  Creating venv with $PYTHON_BIN..."
    "$PYTHON_BIN" -m venv venv
fi

# Activate
source venv/bin/activate

# Upgrade pip silently
pip install --upgrade pip -q

# Install dependencies
echo "  Installing Python packages (this takes a few minutes the first time)..."
pip install -r requirements.txt -q

echo ""

# ── Download SpaCy NER model (used by the Presidio PII shield) ────────────────
# en_core_web_lg gives materially better recall on names (important for the
# PII shield); en_core_web_sm is the smaller fallback if the download fails.

echo -e "${YELLOW}Checking SpaCy English NER model...${NC}"
if python3 -c "import spacy; spacy.load('en_core_web_lg')" 2>/dev/null; then
    echo -e "${GREEN}✓ SpaCy model (en_core_web_lg) already installed${NC}"
elif python3 -m spacy download en_core_web_lg -q 2>/dev/null; then
    echo -e "${GREEN}✓ SpaCy model (en_core_web_lg) downloaded${NC}"
else
    echo "  en_core_web_lg download failed — falling back to en_core_web_sm..."
    if ! python3 -c "import spacy; spacy.load('en_core_web_sm')" 2>/dev/null; then
        python3 -m spacy download en_core_web_sm -q
    fi
    echo -e "${GREEN}✓ SpaCy model (en_core_web_sm) installed${NC}"
fi
echo ""

# ── Pre-download the embedding model ─────────────────────────────────────────
# The backend blocks all non-loopback connections at runtime (egress guard),
# so the sentence-transformers model must be fetched now, not on first use.

echo -e "${YELLOW}Checking local embedding model (all-MiniLM-L6-v2)...${NC}"
if LEGALBOX_ALLOW_EGRESS=1 python3 -c "
from sentence_transformers import SentenceTransformer
SentenceTransformer('all-MiniLM-L6-v2')
" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Embedding model ready${NC}"
else
    echo -e "${YELLOW}⚠ Could not pre-download the embedding model — case search"
    echo -e "  will need one-time internet access (set LEGALBOX_ALLOW_EGRESS=1).${NC}"
fi
echo ""

# ── Frontend dependencies ─────────────────────────────────────────────────────

echo -e "${YELLOW}Installing frontend packages (npm)...${NC}"
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "  Running npm install (may take a minute)..."
    npm install -q
fi
echo -e "${GREEN}✓ Frontend packages ready${NC}"
echo ""

# ── Pull Gemma model if Ollama is available ────────────────────────────────────

if command -v ollama &>/dev/null; then
    echo -e "${YELLOW}Checking for Gemma 4 model...${NC}"
    if ! ollama list 2>/dev/null | grep -q "gemma4"; then
        echo "  Pulling gemma4:e4b (~5 GB)... this may take several minutes."
        echo "  You can cancel with Ctrl+C and run manually: ollama pull gemma4:e4b"
        echo ""
        ollama pull gemma4:e4b
        echo -e "${GREEN}✓ Model downloaded${NC}"
    else
        echo -e "${GREEN}✓ Gemma 4 model already installed${NC}"
    fi
    echo ""
fi

# ── Create data directories ───────────────────────────────────────────────────

mkdir -p "$PROJECT_DIR/data/cases"
mkdir -p "$PROJECT_DIR/data/uploads"
echo -e "${GREEN}✓ Data directories created${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "  To start the app, run:"
echo -e "  ${BLUE}./start.sh${NC}"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo ""
