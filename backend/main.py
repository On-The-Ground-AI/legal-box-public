# main.py — FastAPI Backend for OTG Legal Box
#
# This is the main backend server.
# It exposes API endpoints that the React frontend calls.
# All LLM requests go through the PII Shield before reaching Ollama.
#
# Core endpoints:
#   GET  /api/health         → Check if server + Ollama are running
#   GET  /api/models         → List available Ollama models
#   POST /api/chat           → PII-protected chat
#   POST /api/summarize      → Document summarization
#   POST /api/upload-case    → Upload a case PDF to the local database
#   GET  /api/cases          → List all cases in the database
#   GET  /api/search-cases   → RAG search over uploaded cases
#   DELETE /api/cases/{id}   → Remove a case from the database
#   GET  /api/settings       → Get current settings
#   POST /api/settings       → Update settings
#
# Additional tool endpoints (via routers):
#   POST /api/contracts/review      → Contract review + risk report
#   POST /api/bundles/generate      → Court bundle automator
#   POST /api/chronology/extract    → Extract chronology from files
#   POST /api/chronology/from-text  → Extract chronology from text
#   POST /api/drafting/letter       → Draft legal letter/email
#   POST /api/drafting/billing      → Generate billing narratives
#   POST /api/drafting/pleading     → Draft pleading structure

import os
import sys

# Confidentiality first, before ANY other import can open a connection:
#  - offline mode for HuggingFace libs when running as a packaged app (the
#    embedding model is bundled; nothing should ever be fetched)
#  - the egress guard makes non-loopback connections impossible
if getattr(sys, "frozen", False):
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

# Add the backend directory to sys.path so imports work correctly
# regardless of which directory the script is launched from
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import egress_guard
egress_guard.install()

import json
import shutil
import time
import platform
from typing import List, Optional, Dict
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import config
import pii_shield
import document_parser
from pii_shield import anonymize, deanonymize, PIIResult
from ollama_client import OllamaClient, CHAT_SYSTEM_PROMPT, SUMMARIZE_SYSTEM_PROMPT, RAG_SYSTEM_PROMPT
from case_db import get_db

# Import the new tool routers
from routers.contracts import router as contracts_router
from routers.bundles import router as bundles_router
from routers.chronology import router as chronology_router
from routers.drafting import router as drafting_router
from routers.redline import router as redline_router
from routers.audit import router as audit_router
from routers.models import router as models_router
from routers.users import router as users_router
import prompt_library
import audit_logger

# Paths that self-log with richer data — middleware skips these to avoid double-logging
_SELF_LOGGING_PATHS = {
    "/api/chat", "/api/summarize", "/api/summarize-file",
    "/api/contracts/review", "/api/redline/markup", "/api/redline/compare",
    "/api/chronology/extract", "/api/chronology/from-text",
    "/api/drafting/letter", "/api/drafting/billing", "/api/drafting/pleading",
    "/api/bundles/generate",
}


# ──────────────────────────────────────────────
# APP SETUP
# ──────────────────────────────────────────────

app = FastAPI(
    title="OTG Legal Box API",
    description="Local AI assistant for Singapore law firms",
    version=config.APP_VERSION,
)


class AuditMiddleware(BaseHTTPMiddleware):
    """Log all /api/* requests that are not self-logged by the endpoint."""
    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        if request.url.path.startswith("/api/") and request.url.path not in _SELF_LOGGING_PATHS:
            audit_logger.log_request(
                path=request.url.path,
                method=request.method,
                status=response.status_code,
                duration_ms=int((time.monotonic() - start) * 1000),
            )
        return response

# CORS: Allow the React frontend (on a different port) to call this API.
# Desktop mode locks this to the local dev/Electron origins. Server mode
# (shared office machine) cannot enumerate client origins, so it stays
# open — but with credentials disabled either way.
_cors_origins = (
    ["*"] if config.DEPLOYMENT_MODE == "server"
    # "null" is the Origin the packaged Electron app sends (it loads the UI
    # from file://); the localhost origins cover the Vite dev server.
    else ["http://localhost:3000", "http://127.0.0.1:3000", "null"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(AuditMiddleware)

# Register all tool routers
app.include_router(contracts_router)
app.include_router(bundles_router)
app.include_router(chronology_router)
app.include_router(drafting_router)
app.include_router(redline_router)
app.include_router(audit_router)
app.include_router(models_router)
app.include_router(users_router)

# Ollama client — used for all LLM calls
ollama = OllamaClient()


# ──────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ──────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str       # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None
    stream: bool = False

class ChatResponse(BaseModel):
    response: str
    model: str
    pii_detected: Dict[str, int]    # summary of what PII was anonymized
    disclaimer: str

class SummarizeRequest(BaseModel):
    text: str
    model: Optional[str] = None

class SummarizeResponse(BaseModel):
    summary: str
    model: str
    pii_detected: Dict[str, int]
    disclaimer: str
    # Truncation honesty: when a long document is trimmed to fit the model's
    # context, say so instead of silently dropping the tail.
    truncated: bool = False
    chars_used: int = 0
    chars_total: int = 0

class SettingsUpdate(BaseModel):
    model: Optional[str] = None
    mode: Optional[str] = None          # "desktop" or "server"
    display_name: Optional[str] = None
    firm: Optional[str] = None
    role: Optional[str] = None
    doc_engine: Optional[str] = None    # "fast" or "accurate"
    doc_ocr: Optional[bool] = None      # OCR for scanned PDFs
    cloud_provider: Optional[str] = None   # "ollama", "openai", "anthropic", "groq", "gemini"
    cloud_api_key: Optional[str] = None
    cloud_model: Optional[str] = None
    cloud_base_url: Optional[str] = None
    pii_shield_enabled: Optional[bool] = None


# ──────────────────────────────────────────────
# HELPER FUNCTIONS
# ──────────────────────────────────────────────

async def call_llm(messages, model, system_prompt):
    """
    Call the LLM — either local Ollama or a cloud provider, based on config.
    Returns the response string.
    """
    if config.CLOUD_PROVIDER == "ollama":
        return await ollama.chat(messages=messages, model=model, system_prompt=system_prompt)
    else:
        # Cloud provider path
        from cloud_providers import call_provider, DEFAULT_MODELS
        cloud_model = config.CLOUD_MODEL or model or DEFAULT_MODELS.get(config.CLOUD_PROVIDER, "")
        return await call_provider(
            provider=config.CLOUD_PROVIDER,
            messages=messages,
            model=cloud_model,
            system_prompt=system_prompt,
            api_key=config.CLOUD_API_KEY,
            base_url=config.CLOUD_BASE_URL,
        )

async def call_llm_generate(prompt, model, system_prompt):
    """Generate a single response — either Ollama or cloud."""
    if config.CLOUD_PROVIDER == "ollama":
        return await ollama.generate(prompt=prompt, model=model, system_prompt=system_prompt)
    else:
        from cloud_providers import call_provider, DEFAULT_MODELS
        cloud_model = config.CLOUD_MODEL or model or DEFAULT_MODELS.get(config.CLOUD_PROVIDER, "")
        messages = [{"role": "user", "content": prompt}]
        return await call_provider(
            provider=config.CLOUD_PROVIDER,
            messages=messages,
            model=cloud_model,
            system_prompt=system_prompt,
            api_key=config.CLOUD_API_KEY,
            base_url=config.CLOUD_BASE_URL,
        )

def get_model(requested_model: Optional[str] = None, tier: str = "light") -> str:
    """
    Return the model to use for a light-tier request (chat, search, summarize).

    Priority: explicit request > profile slot for `tier` > DEFAULT_MODEL.
    Router files that handle heavier tasks call config.resolve_model("heavy", …)
    directly.
    """
    return config.resolve_model(tier, requested_model)

def _build_rag_prompt(query: str, search_results: List[Dict]) -> str:
    """Build a prompt that includes relevant case excerpts for the LLM."""
    if not search_results:
        return f"Question: {query}\n\nNo relevant cases were found in the database."

    context_parts = ["Here are relevant excerpts from the case database:\n"]
    for i, result in enumerate(search_results, 1):
        context_parts.append(
            f"--- Excerpt {i} from '{result['case_name']}' ---\n"
            f"{result['text']}\n"
        )

    context = "\n".join(context_parts)
    return f"{context}\n\nBased on the above case excerpts, answer this question:\n{query}"


# ──────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Check if the server and Ollama are running."""
    if config.CLOUD_PROVIDER == "ollama":
        ollama_ok = await ollama.is_available()
        models = await ollama.list_models() if ollama_ok else []
    else:
        ollama_ok = False
        models = []
    
    db = get_db()

    shield_info = pii_shield.engine_info()
    return {
        "status": "ok",
        "version": config.APP_VERSION,
        "ollama_running": ollama_ok,
        "models_available": [m["name"] for m in models],
        "case_count": db.get_case_count(),
        "deployment_mode": config.DEPLOYMENT_MODE,
        "pii_engine": shield_info["engine"],
        "pii_ner_model": shield_info["ner_model"],
        "pii_ner_active": shield_info["ner_active"],
        "pii_shield_enabled": config.PII_SHIELD_ENABLED,
        "egress_locked": egress_guard.egress_locked(),
        "cloud_provider": config.CLOUD_PROVIDER,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/models")
async def list_models():
    """List all Ollama models installed on this machine."""
    models = await ollama.list_models()
    return {
        "models": [
            {
                "name": m["name"],
                "size": m.get("size", 0),
                "size_gb": round(m.get("size", 0) / 1e9, 1),
                "modified": m.get("modified_at", ""),
            }
            for m in models
        ],
        "default_model": config.DEFAULT_MODEL,
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    PII-protected chat with the LLM.

    Flow:
    1. Anonymize ALL messages (strip PII before LLM sees anything) — if PII shield is enabled
    2. Send messages to the LLM (local Ollama or cloud provider)
    3. Deanonymize the response (restore real names) — if PII shield is enabled
    4. Return the response + PII summary
    """
    model = get_model(request.model)

    # Anonymize each message and combine token maps (only if PII shield is on)
    combined_token_map: Dict[str, str] = {}
    combined_pii_summary: Dict[str, int] = {}
    anonymized_messages = []

    if config.PII_SHIELD_ENABLED:
        for msg in request.messages:
            pii_result = anonymize(msg.content)
            combined_token_map.update(pii_result.token_map)
            for k, v in pii_result.pii_summary.items():
                combined_pii_summary[k] = combined_pii_summary.get(k, 0) + v
            anonymized_messages.append({
                "role": msg.role,
                "content": pii_result.anonymized_text
            })
    else:
        for msg in request.messages:
            anonymized_messages.append({"role": msg.role, "content": msg.content})

    # Send to the LLM (Ollama or cloud)
    _t0 = time.monotonic()
    try:
        raw_response = await call_llm(
            messages=anonymized_messages,
            model=model,
            system_prompt=CHAT_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        audit_logger.log_request(path="/api/chat", method="POST", status=503,
                                 duration_ms=int((time.monotonic()-_t0)*1000), model=model)
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        audit_logger.log_request(path="/api/chat", method="POST", status=400,
                                 duration_ms=int((time.monotonic()-_t0)*1000), model=model)
        raise HTTPException(status_code=400, detail=str(e))

    # Restore PII in the response (only if PII shield is on)
    if config.PII_SHIELD_ENABLED:
        final_response = deanonymize(raw_response, combined_token_map)
    else:
        final_response = raw_response

    audit_logger.log_request(
        path="/api/chat", method="POST", status=200,
        duration_ms=int((time.monotonic() - _t0) * 1000),
        model=model,
        pii_counts=combined_pii_summary or None,
    )

    return ChatResponse(
        response=final_response,
        model=model,
        pii_detected=combined_pii_summary,
        disclaimer=config.LEGAL_DISCLAIMER,
    )


@app.post("/api/summarize", response_model=SummarizeResponse)
async def summarize(request: SummarizeRequest):
    """
    Summarize a legal document.
    PII is stripped before the document reaches the LLM (if shield is enabled).
    """
    model = get_model(request.model)

    if config.PII_SHIELD_ENABLED:
        pii_result = anonymize(request.text)
        prompt = f"Please summarize the following legal document:\n\n{pii_result.anonymized_text}"
    else:
        prompt = f"Please summarize the following legal document:\n\n{request.text}"
        pii_result = None

    try:
        raw_summary = await call_llm_generate(
            prompt=prompt,
            model=model,
            system_prompt=SUMMARIZE_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if config.PII_SHIELD_ENABLED and pii_result:
        final_summary = deanonymize(raw_summary, pii_result.token_map)
    else:
        final_summary = raw_summary

    return SummarizeResponse(
        summary=final_summary,
        model=model,
        pii_detected=pii_result.pii_summary if pii_result else {},
        disclaimer=config.LEGAL_DISCLAIMER,
    )


@app.post("/api/summarize-file")
async def summarize_file(
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
):
    """
    Upload a PDF or DOCX and get a structured summary.
    Text is extracted from the file, PII is anonymized (if shield is on), then the LLM summarizes.
    """
    import shutil as _shutil
    import tempfile as _tempfile
    from pathlib import Path as _Path
    from document_parser import parse_document

    filename = file.filename or "document"
    ext = _Path(filename).suffix.lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    tmp = _tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        _shutil.copyfileobj(file.file, tmp)
        tmp.close()
        try:
            text = parse_document(tmp.name).text
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Could not read file: {str(e)}")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

    use_model = get_model(model)

    if config.PII_SHIELD_ENABLED:
        pii_result = anonymize(text)
        anonymized_text = pii_result.anonymized_text
    else:
        anonymized_text = text
        pii_result = None

    # Trim to fit context — and report it honestly in the response
    chars_total = len(anonymized_text)
    excerpt = anonymized_text[:12000]
    truncated = chars_total > 12000
    prompt = f"Please summarize the following legal document:\n\n{excerpt}"
    if truncated:
        prompt += "\n\n[Document truncated]"

    try:
        raw_summary = await call_llm_generate(
            prompt=prompt,
            model=use_model,
            system_prompt=SUMMARIZE_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if config.PII_SHIELD_ENABLED and pii_result:
        final_summary = deanonymize(raw_summary, pii_result.token_map)
    else:
        final_summary = raw_summary

    return SummarizeResponse(
        summary=final_summary,
        model=use_model,
        pii_detected=pii_result.pii_summary if pii_result else {},
        disclaimer=config.LEGAL_DISCLAIMER,
        truncated=truncated,
        chars_used=len(excerpt),
        chars_total=chars_total,
    )


@app.post("/api/upload-case")
async def upload_case(
    file: UploadFile = File(...),
    case_name: str = Form(""),
    court: str = Form(""),
    date: str = Form(""),
    parties: str = Form(""),
    practice_area: str = Form(""),
    tags: str = Form("[]"),  # JSON array as string
):
    """
    Upload a case PDF and add it to the local database.
    The PDF text is extracted, chunked, and indexed for semantic search.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    os.makedirs(config.UPLOADS_DIR, exist_ok=True)
    temp_path = os.path.join(config.UPLOADS_DIR, f"temp_{file.filename}")

    try:
        with open(temp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        final_path = os.path.join(config.CASES_DIR, file.filename)
        shutil.move(temp_path, final_path)

        try:
            parsed_tags = json.loads(tags)
        except json.JSONDecodeError:
            parsed_tags = []

        db = get_db()
        metadata = {
            "case_name": case_name or file.filename,
            "court": court,
            "date": date,
            "parties": parties,
            "practice_area": practice_area,
            "tags": parsed_tags,
        }

        case_id = db.add_case(
            pdf_path=final_path,
            filename=file.filename,
            metadata=metadata,
        )

        return {
            "success": True,
            "case_id": case_id,
            "message": f"Case '{metadata['case_name']}' added to the database.",
            "filename": file.filename,
        }

    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")


@app.get("/api/cases")
async def list_cases():
    """List all cases in the local database."""
    db = get_db()
    cases = db.list_cases()
    return {"cases": cases, "total": len(cases)}


@app.delete("/api/cases/{case_id}")
async def delete_case(case_id: str):
    """Remove a case from the database."""
    db = get_db()
    success = db.delete_case(case_id)
    if not success:
        raise HTTPException(status_code=404, detail="Case not found.")
    return {"success": True, "message": "Case removed from database."}


@app.get("/api/search-cases")
async def search_cases(
    query: str = Query(..., description="Search query"),
    top_k: int = Query(5, description="Number of results to return"),
    model: Optional[str] = Query(None, description="Model to use for answer generation"),
    answer: bool = Query(True, description="Generate an answer using search results"),
):
    """
    Search the case database and optionally generate an answer.
    """
    db = get_db()

    if db.get_case_count() == 0:
        return {
            "query": query,
            "results": [],
            "answer": None,
            "message": "No cases in the database yet. Upload some PDFs first.",
            "disclaimer": config.LEGAL_DISCLAIMER,
        }

    # The stored chunks are token-masked, so the query is embedded in its
    # masked form too — both sides of the similarity search line up.
    # db.search() restores each excerpt for display using the case's own
    # stored token map.
    query_pii = anonymize(query)
    search_results = db.search(query_pii.anonymized_text, top_k=top_k)

    llm_answer = None
    if answer and search_results:
        use_model = get_model(model)
        rag_prompt = _build_rag_prompt(query, search_results)
        anonymized_prompt = anonymize(rag_prompt)

        try:
            raw_answer = await ollama.generate(
                prompt=anonymized_prompt.anonymized_text,
                model=use_model,
                system_prompt=RAG_SYSTEM_PROMPT,
            )
            llm_answer = deanonymize(raw_answer, anonymized_prompt.token_map)
        except ConnectionError:
            llm_answer = "Ollama is not running. Search results are shown above."
        except Exception as e:
            llm_answer = f"Could not generate answer: {str(e)}"

    return {
        "query": query,
        "results": search_results,
        "answer": llm_answer,
        "pii_detected": query_pii.pii_summary,
        "disclaimer": config.LEGAL_DISCLAIMER,
    }


# ──────────────────────────────────────────────
# PII SHIELD PREVIEW (Confidentiality panel)
# ──────────────────────────────────────────────

class PIIPreviewRequest(BaseModel):
    text: str


@app.post("/api/pii/preview")
async def pii_preview(request: PIIPreviewRequest):
    """Show exactly what the AI would see for a given text.

    Detection powered by Presidio (MIT) + Singapore-specific recognizers.
    Nothing is stored and no LLM is called — this endpoint exists so a
    lawyer (or a skeptical client) can verify the shield on their own text.
    """
    result = anonymize(request.text)
    return {
        "anonymized_text": result.anonymized_text,
        "pii_summary": result.pii_summary,
        "summary_line": pii_shield.PIIShield().get_summary(result),
        "engine": pii_shield.engine_info(),
        "egress_locked": egress_guard.egress_locked(),
    }


# ──────────────────────────────────────────────
# PROMPT LIBRARY ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/api/prompts/volumes")
async def list_volumes():
    """List all prompt library volumes with prompt counts."""
    return {"volumes": prompt_library.get_volumes()}


@app.get("/api/prompts")
async def list_prompts(
    q: str = Query("", description="Search query"),
    volume: str = Query("", description="Filter by volume ID"),
    difficulty: str = Query("", description="Filter by difficulty"),
    limit: int = Query(50, description="Results per page"),
    offset: int = Query(0, description="Pagination offset"),
):
    """Search and list prompts from the legal AI prompt library."""
    results, total = prompt_library.search_prompts(
        query=q,
        volume=volume,
        difficulty=difficulty,
        limit=limit,
        offset=offset,
    )
    return {
        "prompts": results,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/prompts/{prompt_id}")
async def get_prompt(prompt_id: str):
    """Get a single prompt by ID."""
    p = prompt_library.get_prompt_by_id(prompt_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prompt not found.")
    return p


@app.get("/api/system/info")
async def system_info():
    """Return hardware specs and model recommendations for the onboarding wizard."""
    import psutil
    import subprocess

    ram_gb = round(psutil.virtual_memory().total / 1e9, 1)
    try:
        disk_free_gb = round(psutil.disk_usage(config.DATA_DIR).free / 1e9, 1)
    except Exception:
        disk_free_gb = round(psutil.disk_usage("/").free / 1e9, 1)

    # GPU detection
    gpu = "none"
    if platform.machine() in ("arm64", "aarch64") and platform.system() == "Darwin":
        gpu = "apple_silicon"
    else:
        try:
            subprocess.run(["nvidia-smi"], capture_output=True, timeout=3, check=True)
            gpu = "nvidia"
        except Exception:
            pass

    # Model recommendation based on RAM
    if ram_gb >= 24:
        recommended = "gemma4:31b"
    elif ram_gb >= 12:
        recommended = "gemma4:26b"
    else:
        recommended = "gemma4:e4b"

    MINIMUM_RAM_GB = 8
    MINIMUM_DISK_GB = 20
    meets_minimum = ram_gb >= MINIMUM_RAM_GB and disk_free_gb >= MINIMUM_DISK_GB

    return {
        "ram_gb":           ram_gb,
        "disk_free_gb":     disk_free_gb,
        "gpu":              gpu,
        "recommended_model": recommended,
        "meets_minimum":    meets_minimum,
        "minimum_ram_gb":   MINIMUM_RAM_GB,
        "minimum_disk_gb":  MINIMUM_DISK_GB,
        "platform":         platform.system(),
        "machine":          platform.machine(),
    }


# Live-usage cache: the dashboard polls every few seconds from several
# places, so results are cached briefly to keep the measurement cheap
# (and to avoid measuring the CPU cost of measuring the CPU).
_usage_cache = {"at": 0.0, "data": None}
_USAGE_TTL = 2.0


def _read_gpu_usage():
    """Best-effort GPU telemetry. Honest about what each platform can report."""
    import subprocess
    # NVIDIA: real utilization + VRAM
    try:
        out = subprocess.run(
            ["nvidia-smi",
             "--query-gpu=utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, timeout=3, check=True, text=True,
        ).stdout.strip().splitlines()
        if out:
            util, used, total = (x.strip() for x in out[0].split(","))
            return {
                "type": "nvidia",
                "util_percent": float(util),
                "vram_used_mb": float(used),
                "vram_total_mb": float(total),
            }
    except Exception:
        pass
    # Apple Silicon: unified memory, no sudo-free utilization number — be
    # honest and report presence + let the RAM meter stand in.
    if platform.machine() in ("arm64", "aarch64") and platform.system() == "Darwin":
        return {"type": "apple_silicon", "util_percent": None,
                "note": "Unified memory — see RAM usage."}
    return {"type": "none"}


@app.get("/api/system/usage")
async def system_usage():
    """Live CPU / RAM / disk / GPU usage for the resource dashboard."""
    import psutil

    now = time.monotonic()
    if _usage_cache["data"] is not None and (now - _usage_cache["at"]) < _USAGE_TTL:
        return _usage_cache["data"]

    vm = psutil.virtual_memory()
    try:
        disk = psutil.disk_usage(config.DATA_DIR)
    except Exception:
        disk = psutil.disk_usage("/")

    # Loaded model (from Ollama) — shown as a "model resident" chip
    loaded_models = []
    if config.CLOUD_PROVIDER == "ollama":
        loaded = await ollama.list_running()
        loaded_models = [
            {
                "name": m.get("name", ""),
                "size_gb": round(m.get("size", 0) / 1e9, 1),
                "vram_gb": round(m.get("size_vram", 0) / 1e9, 1),
            }
            for m in loaded
        ]

    data = {
        "cpu_percent": psutil.cpu_percent(interval=None),
        "cpu_count": psutil.cpu_count(logical=True),
        "ram_percent": vm.percent,
        "ram_used_gb": round(vm.used / 1e9, 1),
        "ram_total_gb": round(vm.total / 1e9, 1),
        "disk_percent": disk.percent,
        "disk_free_gb": round(disk.free / 1e9, 1),
        "gpu": _read_gpu_usage(),
        "loaded_models": loaded_models,
        "cloud_provider": config.CLOUD_PROVIDER,
        "timestamp": datetime.now().isoformat(),
    }
    _usage_cache["at"] = now
    _usage_cache["data"] = data
    return data


@app.get("/api/settings")
async def get_settings():
    """Get current server settings."""
    return {
        "model":        config.DEFAULT_MODEL,
        "mode":         config.DEPLOYMENT_MODE,
        "ollama_url":   config.OLLAMA_BASE_URL,
        "port":         config.BACKEND_PORT,
        "display_name": config.DISPLAY_NAME,
        "firm":         config.FIRM_NAME,
        "role":         config.USER_ROLE,
        "doc_engine":   config.DOC_ENGINE,
        "doc_ocr":      config.DOC_OCR,
        "doc_engines_available": document_parser.available_engines(),
        "cloud_provider":   config.CLOUD_PROVIDER,
        "cloud_model":      config.CLOUD_MODEL,
        "cloud_base_url":   config.CLOUD_BASE_URL,
        "pii_shield_enabled": config.PII_SHIELD_ENABLED,
    }


@app.post("/api/settings")
async def update_settings(update: SettingsUpdate):
    """Update server settings — persisted to data/settings.json immediately."""
    if update.model:
        config.DEFAULT_MODEL = update.model
    if update.mode and update.mode in ("desktop", "server"):
        config.DEPLOYMENT_MODE = update.mode
    if update.display_name is not None:
        config.DISPLAY_NAME = update.display_name
    if update.firm is not None:
        config.FIRM_NAME = update.firm
    if update.role is not None:
        config.USER_ROLE = update.role
    if update.doc_engine in ("fast", "accurate"):
        config.DOC_ENGINE = update.doc_engine
    if update.doc_ocr is not None:
        config.DOC_OCR = bool(update.doc_ocr)
    if update.cloud_provider is not None:
        config.CLOUD_PROVIDER = update.cloud_provider
    if update.cloud_api_key is not None:
        config.CLOUD_API_KEY = update.cloud_api_key
    if update.cloud_model is not None:
        config.CLOUD_MODEL = update.cloud_model
    if update.cloud_base_url is not None:
        config.CLOUD_BASE_URL = update.cloud_base_url
    if update.pii_shield_enabled is not None:
        config.PII_SHIELD_ENABLED = bool(update.pii_shield_enabled)
    config.save_settings()
    return {"success": True, "settings": await get_settings()}


class WipeRequest(BaseModel):
    confirm: str = ""


@app.post("/api/system/wipe")
async def wipe_all_data(request: WipeRequest):
    """Erase every piece of user data this app has stored — cases, search
    index, chat settings, audit logs. Used by the in-app uninstaller.

    Requires {"confirm": "ERASE"} in the body as a deliberate-action check.
    """
    if request.confirm != "ERASE":
        raise HTTPException(
            status_code=400,
            detail='Confirmation required: send {"confirm": "ERASE"}.'
        )

    errors = []
    # Release open handles (chroma/sqlite) before deleting
    try:
        import case_db as _case_db
        _case_db._db = None
    except Exception:
        pass

    data_dir = Path(config.DATA_DIR)
    if data_dir.exists():
        for child in data_dir.iterdir():
            try:
                if child.is_dir():
                    shutil.rmtree(child, ignore_errors=True)
                else:
                    child.unlink(missing_ok=True)
            except Exception as e:
                errors.append(f"{child.name}: {e}")

    audit_logger.log_request(path="/api/system/wipe", method="POST",
                             status=200, duration_ms=0)
    return {
        "success": not errors,
        "errors": errors,
        "message": "All local data erased. You can now quit the app and drag "
                   "it to the Trash / uninstall it.",
    }


# ──────────────────────────────────────────────
# STARTUP / SHUTDOWN
# ──────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize database and check Ollama on startup."""
    config.load_settings()
    # Auto-disable PII shield for offline use (local Ollama only)
    if config.CLOUD_PROVIDER == "ollama" and not config.PII_SHIELD_ENABLED:
        pass  # User explicitly disabled it — respect that for offline
    elif config.CLOUD_PROVIDER != "ollama":
        # Online mode: PII shield is mandatory (data goes to third party)
        config.PII_SHIELD_ENABLED = True
    print("OTG Legal Box backend starting...")
    os.makedirs(config.DATA_DIR, exist_ok=True)
    os.makedirs(config.CASES_DIR, exist_ok=True)
    os.makedirs(config.UPLOADS_DIR, exist_ok=True)

    try:
        db = get_db()
        print(f"Case database ready ({db.get_case_count()} cases indexed)")
    except Exception as e:
        print(f"Case database initialization failed: {e}")

    # Pre-load prompt library (parses markdown files once at startup)
    try:
        prompts = prompt_library.load_all_prompts()
        print(f"Prompt library loaded ({len(prompts)} prompts)")
    except Exception as e:
        print(f"Prompt library load failed: {e}")

    if config.CLOUD_PROVIDER == "ollama":
        ollama_ok = await ollama.is_available()
        if ollama_ok:
            models = await ollama.list_models()
            model_names = [m["name"] for m in models]
            print(f"Ollama running. Models: {model_names}")
            if config.DEFAULT_MODEL not in model_names and model_names:
                print(f"Default model '{config.DEFAULT_MODEL}' not found.")
                print(f"Run: ollama pull {config.DEFAULT_MODEL}")
        else:
            print("Ollama not running. Start it with: ollama serve")
    else:
        print(f"Cloud provider: {config.CLOUD_PROVIDER} (online mode)")

    print(f"API server ready on port {config.BACKEND_PORT} ({config.DEPLOYMENT_MODE} mode)")
    print(f"PII shield: {'ON' if config.PII_SHIELD_ENABLED else 'OFF'}")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    await ollama.close()
    print("OTG Legal Box backend stopped.")


# ──────────────────────────────────────────────
# ENTRY POINT
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    # In server mode, bind to all interfaces so other machines on the network can connect.
    # In desktop mode, bind only to localhost for security.
    host = "0.0.0.0" if config.DEPLOYMENT_MODE == "server" else "127.0.0.1"

    uvicorn.run(
        "main:app",
        host=host,
        port=config.BACKEND_PORT,
        reload=False,
        log_level="info",
    )
