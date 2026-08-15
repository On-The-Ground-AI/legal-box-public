# config.py — Central configuration for OTG Legal Box
# Edit these settings to change how the app behaves.

import os
import json

# Single source of truth for the app version (electron/package.json mirrors
# this at build time; the frontend reads it from /api/health).
APP_VERSION = "1.0.0"

# ──────────────────────────────────────────────
# SERVER MODE
# ──────────────────────────────────────────────
# "desktop"  → only your own computer can connect (localhost)
# "server"   → other computers on the same WiFi can connect
DEPLOYMENT_MODE = os.getenv("LEGALBOX_MODE", "desktop")

# Port the backend runs on
BACKEND_PORT = int(os.getenv("LEGALBOX_PORT", 8000))

# ──────────────────────────────────────────────
# CLOUD PROVIDER SETTINGS (online mode)
# ──────────────────────────────────────────────
# Which AI backend to use: "ollama" (local, default) or a cloud provider name.
CLOUD_PROVIDER = os.getenv("LEGALBOX_CLOUD_PROVIDER", "ollama")
# Cloud provider API key (stored in settings.json, never logged).
CLOUD_API_KEY = os.getenv("LEGALBOX_CLOUD_API_KEY", "")
# Cloud model name (overrides provider default).
CLOUD_MODEL = os.getenv("LEGALBOX_CLOUD_MODEL", "")
# Custom base URL (for OpenAI-compatible APIs like Together, DeepSeek, etc.).
CLOUD_BASE_URL = os.getenv("LEGALBOX_CLOUD_BASE_URL", "")

# Whether the PII shield is active. Forced ON when CLOUD_PROVIDER != "ollama".
PII_SHIELD_ENABLED = os.getenv("LEGALBOX_PII_SHIELD", "1") == "1"

# ──────────────────────────────────────────────
# OLLAMA SETTINGS
# ──────────────────────────────────────────────
# Where Ollama is running (default: local machine)
OLLAMA_BASE_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

# Default model to use. Change this if you have a different model pulled.
# Recommended: "gemma4:e4b" (fast, 8 GB RAM) | "gemma4:26b" (16 GB) | "gemma4:31b" (32 GB)
DEFAULT_MODEL = os.getenv("LEGALBOX_MODEL", "gemma4:e4b")

# Model profiles — users install multiple models and swap based on task weight.
# "heavy" is used for contract review, drafting, redline, bundles, chronology.
# "light" is used for chat, search, summarisation.
# If a slot is empty, the app falls back to DEFAULT_MODEL.
MODEL_PROFILES = {
    "heavy": "",
    "light": "",
}

# Which task tier each router defaults to. Routers call resolve_model(tier)
# to pick the right model based on the user's profile selection.
MODEL_TIER_BY_ROUTE = {
    "chat":       "light",
    "search":     "light",
    "summarize":  "light",
    "contracts":  "heavy",
    "drafting":   "heavy",
    "redline":    "heavy",
    "bundles":    "heavy",
    "chronology": "heavy",
}

def resolve_model(tier: str = "light", requested: str | None = None) -> str:
    """
    Pick the model to use for a request, in priority order:
      1. Explicit model passed by the caller
      2. The profile slot for this tier ("heavy" or "light")
      3. DEFAULT_MODEL (the globally active fallback)
    """
    if requested:
        return requested
    slot = MODEL_PROFILES.get(tier, "") or ""
    if slot.strip():
        return slot.strip()
    return DEFAULT_MODEL

# How many tokens the LLM generates at most per response
MAX_TOKENS = 2048

# ──────────────────────────────────────────────
# DATABASE PATHS
# ──────────────────────────────────────────────
# All data stays local.
# LEGALBOX_DATA_DIR is set by electron/main.js in packaged builds so that
# data goes to the OS user-data folder rather than inside the app bundle.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.getenv("LEGALBOX_DATA_DIR") or os.path.join(BASE_DIR, "data")
CASES_DIR = os.path.join(DATA_DIR, "cases")       # Uploaded PDF files
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")   # Temporary uploads
SQLITE_DB_PATH = os.path.join(DATA_DIR, "legalbox.db")
CHROMA_DB_PATH = os.path.join(DATA_DIR, "chroma")
LOGS_DIR = os.path.join(DATA_DIR, "logs")
SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")

# ──────────────────────────────────────────────
# USER PROFILE
# ──────────────────────────────────────────────
DISPLAY_NAME = os.getenv("LEGALBOX_USER", "Lawyer")
FIRM_NAME    = os.getenv("LEGALBOX_FIRM", "My Firm")
USER_ROLE    = os.getenv("LEGALBOX_ROLE", "Associate")

# ──────────────────────────────────────────────
# DOCUMENT PROCESSING
# ──────────────────────────────────────────────
# Which extraction engine to use: "fast" (pdfplumber + MarkItDown, light,
# default) or "accurate" (Docling, layout-aware, heavier). OCR (Tesseract)
# is an opt-in toggle for scanned/image-only PDFs.
DOC_ENGINE = os.getenv("LEGALBOX_DOC_ENGINE", "fast")
DOC_OCR    = os.getenv("LEGALBOX_DOC_OCR", "0") == "1"


def load_settings():
    """Load persisted settings from data/settings.json and update module globals."""
    global DEFAULT_MODEL, DEPLOYMENT_MODE, DISPLAY_NAME, FIRM_NAME, USER_ROLE, MODEL_PROFILES
    global DOC_ENGINE, DOC_OCR, CLOUD_PROVIDER, CLOUD_API_KEY, CLOUD_MODEL, CLOUD_BASE_URL
    global PII_SHIELD_ENABLED
    if os.path.exists(SETTINGS_PATH):
        try:
            data = json.load(open(SETTINGS_PATH))
            DEFAULT_MODEL    = data.get("model",        DEFAULT_MODEL)
            DEPLOYMENT_MODE  = data.get("mode",         DEPLOYMENT_MODE)
            DISPLAY_NAME     = data.get("display_name", DISPLAY_NAME)
            FIRM_NAME        = data.get("firm",         FIRM_NAME)
            USER_ROLE        = data.get("role",         USER_ROLE)
            DOC_ENGINE       = data.get("doc_engine",   DOC_ENGINE)
            DOC_OCR          = data.get("doc_ocr",      DOC_OCR)
            CLOUD_PROVIDER   = data.get("cloud_provider",   CLOUD_PROVIDER)
            CLOUD_API_KEY    = data.get("cloud_api_key",    CLOUD_API_KEY)
            CLOUD_MODEL      = data.get("cloud_model",      CLOUD_MODEL)
            CLOUD_BASE_URL   = data.get("cloud_base_url",   CLOUD_BASE_URL)
            PII_SHIELD_ENABLED = data.get("pii_shield_enabled", PII_SHIELD_ENABLED)
            profiles         = data.get("model_profiles") or {}
            if isinstance(profiles, dict):
                MODEL_PROFILES["heavy"] = profiles.get("heavy", "") or ""
                MODEL_PROFILES["light"] = profiles.get("light", "") or ""
        except Exception:
            pass  # Corrupt settings file — keep defaults


def save_settings():
    """Write current globals to data/settings.json."""
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    json.dump(
        {
            "model":          DEFAULT_MODEL,
            "mode":           DEPLOYMENT_MODE,
            "display_name":   DISPLAY_NAME,
            "firm":           FIRM_NAME,
            "role":           USER_ROLE,
            "doc_engine":     DOC_ENGINE,
            "doc_ocr":        DOC_OCR,
            "model_profiles": MODEL_PROFILES,
            "cloud_provider":   CLOUD_PROVIDER,
            "cloud_api_key":    CLOUD_API_KEY,
            "cloud_model":      CLOUD_MODEL,
            "cloud_base_url":   CLOUD_BASE_URL,
            "pii_shield_enabled": PII_SHIELD_ENABLED,
        },
        open(SETTINGS_PATH, "w"),
        indent=2,
    )

# ──────────────────────────────────────────────
# RAG (Retrieval-Augmented Generation) SETTINGS
# ──────────────────────────────────────────────
# How many case excerpts to pull when answering a question
RAG_TOP_K = 5

# How large each chunk of a document is (in characters)
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200  # How much chunks overlap to avoid cutting context

# ──────────────────────────────────────────────
# LEGAL DISCLAIMER (shown in the UI)
# ──────────────────────────────────────────────
LEGAL_DISCLAIMER = (
    "⚠️ AI output must be reviewed by a qualified lawyer. "
    "OTG Legal Box does not provide legal advice."
)
