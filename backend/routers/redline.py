# routers/redline.py — Document Redlining Tool
#
# Two modes:
#
# 1. AI CONTRACT MARKUP (single document)
#    Upload a contract + specify your client's position (e.g. "buyer", "tenant")
#    The AI reads the contract and suggests specific clause-level edits:
#      - What to delete (marked with strikethrough)
#      - What to add (marked with brackets)
#      - Why each change protects your client
#
# 2. DOCUMENT COMPARISON (two documents)
#    Upload two versions of a document (e.g. their draft vs our draft)
#    Returns a structured diff showing additions, deletions, and unchanged text
#    No LLM needed for this — pure text comparison
#
# PII is anonymized before any text reaches the LLM.
#
# Endpoints:
#   POST /api/redline/markup   → AI markup of a single contract
#   POST /api/redline/compare  → Compare two document versions

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import difflib
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

import config
from pii_shield import anonymize, deanonymize
from ollama_client import OllamaClient
from document_parser import parse_document
from quote_verify import verify_redline_markup

router = APIRouter(prefix="/api/redline", tags=["redline"])
ollama = OllamaClient()


# ── System prompt for AI markup ───────────────────────────────────────────────

def _markup_system_prompt(client_role: str) -> str:
    return f"""You are a senior Singapore contract lawyer reviewing a contract on behalf of the {client_role}.

Your job is to redline this contract — mark up specific changes to protect your client's position.

Use EXACTLY this format for your changes:

~~[text to delete]~~
**[replacement or new text to insert]**
> **Why:** [one sentence explaining why this change protects the {client_role}]

Rules:
- Only mark up clauses that actually need changing
- Be specific — quote the exact text to delete
- Keep your additions precise and in proper legal language
- If a clause is acceptable as-is, skip it
- Group related changes in the same section
- After the redlines, add a section: ## Summary of Key Changes (bullet points)

Focus on: liability caps, indemnities, IP ownership, termination rights, payment terms, dispute resolution, governing law."""


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/markup")
async def ai_markup(
    file: UploadFile = File(...),
    client_role: str = Form("buyer"),  # buyer, seller, landlord, tenant, employer, employee, borrower, lender
    context: str = Form(""),           # Optional: extra context from the lawyer
    model: str = Form(""),
):
    """
    Upload a contract and get AI-generated redlines protecting your client's position.

    The AI suggests specific edits: what to delete, what to add, and why.
    PII is anonymized before the contract reaches the AI.
    """
    filename = file.filename or "contract"
    ext = Path(filename).suffix.lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported.")

    use_model = config.resolve_model("heavy", model.strip() or None)

    # Save to temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()

        # Extract text
        try:
            text = parse_document(tmp.name).text
        except Exception as e:
            raise HTTPException(status_code=422, detail=str(e))

        if len(text.strip()) < 100:
            raise HTTPException(status_code=422, detail="File appears to be empty or unreadable.")

        # Anonymize PII
        pii_result = anonymize(text)

        # Trim to fit LLM context (contracts can be very long)
        excerpt = pii_result.anonymized_text[:14000]
        truncated = len(pii_result.anonymized_text) > 14000

        prompt_parts = []
        if context.strip():
            prompt_parts.append(f"Context from the lawyer: {context}\n\n---\n\n")
        prompt_parts.append(f"Contract to redline (representing the {client_role}):\n\n{excerpt}")
        if truncated:
            prompt_parts.append("\n\n[Document was truncated — only the first portion is shown]")

        prompt = "".join(prompt_parts)

        try:
            raw_markup = await ollama.generate(
                prompt=prompt,
                model=use_model,
                system_prompt=_markup_system_prompt(client_role),
            )
        except ConnectionError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Check every ~~deletion~~ against the contract before showing it to
        # anyone. This runs BEFORE deanonymize() and against `excerpt`, not
        # the full document, so both sides are in the same text space:
        #   - the model only ever saw anonymized text, so it can only quote
        #     anonymized text; comparing restored quotes against the original
        #     would mismatch wherever a token's length differs from the real
        #     value it replaced
        #   - the model only ever saw the first 14 000 characters, so a quote
        #     that matches only beyond the cut is a genuine finding, not a
        #     false negative
        verified_markup, verification = verify_redline_markup(raw_markup, excerpt)

        # Restore PII in the response
        final_markup = deanonymize(verified_markup, pii_result.token_map)

        # Corrected excerpts came out of the anonymized text, so they carry
        # tokens too and must be restored the same way before display.
        verification_payload = verification.to_dict()
        for quote in verification_payload["quotes"]:
            quote["quote"] = deanonymize(quote["quote"], pii_result.token_map)
            if quote["source_excerpt"]:
                quote["source_excerpt"] = deanonymize(
                    quote["source_excerpt"], pii_result.token_map
                )

        return {
            "filename": filename,
            "client_role": client_role,
            "markup": final_markup,
            "model": use_model,
            "pii_detected": pii_result.pii_summary,
            "truncated": truncated,
            "original_length": len(text),
            "verification": verification_payload,
            "disclaimer": config.LEGAL_DISCLAIMER,
        }

    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass


@router.post("/compare")
async def compare_documents(
    file_a: UploadFile = File(...),    # Original / their version
    file_b: UploadFile = File(...),    # New / our version
    label_a: str = Form("Original"),
    label_b: str = Form("Revised"),
):
    """
    Compare two versions of a document and return a structured diff.

    Shows: additions (green), deletions (red), and unchanged text.
    No LLM required — pure text comparison using difflib.
    PII is NOT anonymized here because both documents stay local (no LLM).
    """
    for uploaded in [file_a, file_b]:
        ext = Path(uploaded.filename or "").suffix.lower()
        if ext not in (".pdf", ".docx", ".doc"):
            raise HTTPException(
                status_code=400,
                detail=f"Only PDF and DOCX files are supported (got: {uploaded.filename})"
            )

    texts = []
    tmp_paths = []

    try:
        for uploaded in [file_a, file_b]:
            ext = Path(uploaded.filename or "").suffix.lower()
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            shutil.copyfileobj(uploaded.file, tmp)
            tmp.close()
            tmp_paths.append(tmp.name)

            try:
                text = parse_document(tmp.name).text
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"Could not read {uploaded.filename}: {str(e)}")
            texts.append(text)

        text_a, text_b = texts

        chunks = _diff_chunks(text_a, text_b, label_a, label_b)

        # Summary statistics
        additions = sum(1 for c in chunks if c["type"] == "insert")
        deletions = sum(1 for c in chunks if c["type"] == "delete")
        modifications = sum(1 for c in chunks if c["type"] == "replace")

        return {
            "label_a": label_a,
            "label_b": label_b,
            "filename_a": file_a.filename,
            "filename_b": file_b.filename,
            "chunks": chunks,
            "summary": {
                "additions": additions,
                "deletions": deletions,
                "modifications": modifications,
                "total_changes": additions + deletions + modifications,
            },
            "disclaimer": config.LEGAL_DISCLAIMER,
        }

    finally:
        for path in tmp_paths:
            try:
                os.unlink(path)
            except Exception:
                pass


def _diff_chunks(text_a: str, text_b: str, label_a: str, label_b: str) -> list:
    """Line-level diff as UI-friendly chunks (shared by /compare and /export-docx)."""
    lines_a = text_a.splitlines(keepends=True)
    lines_b = text_b.splitlines(keepends=True)

    matcher = difflib.SequenceMatcher(None, lines_a, lines_b, autojunk=False)
    chunks = []
    for opcode, a0, a1, b0, b1 in matcher.get_opcodes():
        if opcode == "equal":
            chunks.append({
                "type": "equal",
                "text": "".join(lines_a[a0:a1]),
            })
        elif opcode == "delete":
            chunks.append({
                "type": "delete",
                "text": "".join(lines_a[a0:a1]),
                "label": f"Removed from {label_a}",
            })
        elif opcode == "insert":
            chunks.append({
                "type": "insert",
                "text": "".join(lines_b[b0:b1]),
                "label": f"Added in {label_b}",
            })
        elif opcode == "replace":
            chunks.append({
                "type": "replace",
                "old_text": "".join(lines_a[a0:a1]),
                "new_text": "".join(lines_b[b0:b1]),
                "label": "Modified",
            })
    return chunks


@router.post("/export-docx")
async def export_tracked_changes_docx(
    file_a: UploadFile = File(...),    # Original / their version
    file_b: UploadFile = File(...),    # New / our version
    label_a: str = Form("Original"),
    label_b: str = Form("Revised"),
):
    """
    Compare two document versions and download a Word file with REAL tracked
    changes (w:ins / w:del) — reviewable with Accept/Reject in Microsoft Word.

    Like /compare, no LLM is involved and both documents stay local, so PII
    anonymization is not applied.
    """
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask
    from redline_docx import build_tracked_changes_docx

    texts = []
    tmp_paths = []
    try:
        for uploaded in [file_a, file_b]:
            ext = Path(uploaded.filename or "").suffix.lower()
            if ext not in (".pdf", ".docx"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Only PDF and DOCX files are supported (got: {uploaded.filename})"
                )
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
            shutil.copyfileobj(uploaded.file, tmp)
            tmp.close()
            tmp_paths.append(tmp.name)
            try:
                texts.append(parse_document(tmp.name).text)
            except Exception as e:
                raise HTTPException(status_code=422, detail=f"Could not read {uploaded.filename}: {str(e)}")

        chunks = _diff_chunks(texts[0], texts[1], label_a, label_b)

        out = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        out.close()
        title = f"Redline: {label_a} vs {label_b}"
        build_tracked_changes_docx(chunks, title=title, out_path=out.name)

        base = Path(file_b.filename or "document").stem
        return FileResponse(
            out.name,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{base}-redline-tracked-changes.docx",
            background=BackgroundTask(lambda: os.unlink(out.name)),
        )
    finally:
        for path in tmp_paths:
            try:
                os.unlink(path)
            except Exception:
                pass
