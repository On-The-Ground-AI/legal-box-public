#!/bin/bash
# start.sh — Launch OTG Legal Box (Mac and Linux)
#
# Prerequisites: Run scripts/setup.sh first (one time only).
#
# Usage:
#   chmod +x start.sh     (only needed once)
#   ./start.sh

set -e

# Ensure Homebrew binaries and /usr/local/bin are on PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Text colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}OTG Legal Box${NC}"
echo -e "${BLUE}   Local AI Assistant for Singapore Law Firms${NC}"
echo "──────────────────────────────────────────────"
echo ""

# ── Detect OS ─────────────────────────────────────────────────────────────────

OS_TYPE="$(uname -s)"

# ── Locate directories ────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

# ── Check prerequisites ────────────────────────────────────────────────────────

echo -e "${YELLOW}Checking requirements...${NC}"

if ! command -v python3 &>/dev/null; then
    echo -e "${RED}✗ Python 3 not found. Run scripts/setup.sh first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python 3: $(python3 --version)${NC}"

if ! command -v node &>/dev/null; then
    echo -e "${RED}✗ Node.js not found. Run scripts/setup.sh first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

if ! command -v ollama &>/dev/null; then
    echo -e "${YELLOW}⚠ Ollama not installed. AI features will be unavailable.${NC}"
    echo "  Install Ollama: https://ollama.com/"
else
    echo -e "${GREEN}✓ Ollama found${NC}"
fi

# Check venv
if [ ! -d "$BACKEND_DIR/venv" ]; then
    echo -e "${RED}✗ Python environment not set up. Run: ./scripts/setup.sh${NC}"
    exit 1
fi

# Check node_modules
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${RED}✗ Frontend packages not installed. Run: ./scripts/setup.sh${NC}"
    exit 1
fi

echo ""

# ── Start Ollama (if installed and not already running) ────────────────────────

OLLAMA_PID=""
if command -v ollama &>/dev/null; then
    if ! curl -s http://localhost:11434 >/dev/null 2>&1; then
        echo -e "${YELLOW}Starting Ollama...${NC}"
        ollama serve >/dev/null 2>&1 &
        OLLAMA_PID=$!
        sleep 2
        echo -e "${GREEN}✓ Ollama started${NC}"
    else
        echo -e "${GREEN}✓ Ollama already running${NC}"
    fi
fi

echo ""

# ── Start the backend ──────────────────────────────────────────────────────────

echo -e "${YELLOW}Starting backend (port 8000)...${NC}"
cd "$BACKEND_DIR"
source venv/bin/activate

uvicorn main:app --host 127.0.0.1 --port 8000 --log-level warning \
    >"$SCRIPT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait up to 60 seconds for backend to be ready (cold-start chromadb + model load)
BACKEND_READY=false
for i in $(seq 1 60); do
    if curl -s http://localhost:8000/api/health >/dev/null 2>&1; then
        BACKEND_READY=true
        break
    fi
    sleep 1
done

if [ "$BACKEND_READY" = false ]; then
    echo -e "${RED}✗ Backend failed to start. Check $SCRIPT_DIR/backend.log for errors.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi
echo -e "${GREEN}✓ Backend running at http://localhost:8000${NC}"

# ── Start the frontend ─────────────────────────────────────────────────────────

echo -e "${YELLOW}Starting frontend (port 3000)...${NC}"
cd "$FRONTEND_DIR"
npm run dev -- --open >"$SCRIPT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
sleep 2
echo -e "${GREEN}✓ Frontend running at http://localhost:3000${NC}"

echo ""
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"
echo -e "${BOLD}${GREEN}✅ OTG Legal Box is running!${NC}"
echo ""
echo -e "  Open your browser: ${BLUE}http://localhost:3000${NC}"
echo ""
echo -e "  Logs: $SCRIPT_DIR/backend.log"
echo -e "        $SCRIPT_DIR/frontend.log"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop.${NC}"
echo -e "${BOLD}────────────────────────────────────────────────────────${NC}"

# ── Cleanup on exit ────────────────────────────────────────────────────────────

cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down OTG Legal Box...${NC}"
    [ -n "$BACKEND_PID"  ] && kill $BACKEND_PID  2>/dev/null || true
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null || true
    [ -n "$OLLAMA_PID"   ] && kill $OLLAMA_PID   2>/dev/null || true
    echo -e "${GREEN}Stopped. Goodbye!${NC}"
    exit 0
}

trap cleanup INT TERM
wait
