# routers/chronology.py — Chronology generator for litigation documents
#
# Upload litigation documents (PDFs or DOCX) and get back a structured
# chronology of events: who did what, on what date, with the source document.
#
# Lawyers can use this to:
#   - Build a timeline for pleadings
#   - Spot gaps or inconsistencies in the facts
#   - Prepare for trial
#
# PII is anonymized before documents reach the LLM.
#
# Endpoints:
#   POST /api/chronology/extract   → Extract events from uploaded files
#   POST /api/chronology/from-text → Extract events from pasted text

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import shutil
import tempfile
import json
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

import config
from pii_shield import anonymize, deanonymize
from ollama_client import OllamaClient
from document_parser import parse_document

router = APIRouter(prefix="/api/chronology", tags=["chronology"])
ollama = OllamaClient()


# ── System Prompt ─────────────────────────────────────────────────────────────

CHRONOLOGY_SYSTEM_PROMPT = """You are a Singapore litigation lawyer extracting a chronology from legal documents.

From the provided text, extract every significant event and date.

For each event, output a JSON object on its own line (one per event) with these exact fields:
{
  "date": "YYYY-MM-DD or descriptive date like 'January 2023' or 'Early 2023'",
  "event": "Clear, factual description of what happened (1-2 sentences)",
  "parties": "Who was involved (e.g. 'Plaintiff', 'Defendant', 'Both parties')",
  "source": "Which document or section this comes from",
  "significance": "Why this event matters legally (optional, 1 sentence)"
}

Rules:
- Include dates in ISO format (YYYY-MM-DD) where possible
- Use approximate dates like "January 2023" if exact date is unknown
- Be factual — don't interpret or add information not in the document
- Focus on legally significant events (agreements, payments, breaches, notices, court filings)
- Ignore procedural events unless significant
- Output ONLY the JSON objects, one per line. No other text."""


@router.post("/extract")
async def extract_chronology_from_files(
    files: List[UploadFile] = File(...),
    model: str = Form(""),
    matter_title: str = Form(""),
):
    """
    Upload one or more PDF/DOCX litigation documents.
    Returns a structured chronology of events extracted from all documents.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one file.")

    use_model = config.resolve_model("heavy", model.strip() or None)
    all_events = []
    processed_files = []
    errors = []

    for uploaded_file in files:
        filename = uploaded_file.filename or "unknown"
        ext = Path(filename).suffix.lower()

        if ext not in (".pdf", ".docx", ".doc"):
            errors.append(f"{filename}: unsupported file type (use PDF or DOCX)")
            continue

        # Save to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        try:
            shutil.copyfileobj(uploaded_file.file, tmp)
            tmp.close()

            # Extract text
            try:
                text = parse_document(tmp.name).text
            except Exception as e:
                errors.append(f"{filename}: {str(e)}")
                continue

            # Anonymize PII
            pii_result = anonymize(text)

            # Trim to fit LLM context (keep most important parts)
            excerpt = pii_result.anonymized_text[:8000]

            prompt = (
                f"Document: {filename}\n\n"
                f"{excerpt}"
                + ("\n\n[... document truncated ...]" if len(pii_result.anonymized_text) > 8000 else "")
            )

            try:
                raw_response = await ollama.generate(
                    prompt=prompt,
                    model=use_model,
                    system_prompt=CHRONOLOGY_SYSTEM_PROMPT,
                )
            except ConnectionError as e:
                raise HTTPException(status_code=503, detail=str(e))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            # Parse the JSON events from the response
            events = _parse_events(raw_response, source=filename, token_map=pii_result.token_map)
            all_events.extend(events)
            processed_files.append(filename)

        finally:
            try:
                os.unlink(tmp.name)
            except Exception:
                pass

    if not all_events and errors:
        raise HTTPException(status_code=422, detail="; ".join(errors))

    # Sort all events by date
    sorted_events = _sort_events(all_events)

    return {
        "matter_title": matter_title,
        "events": sorted_events,
        "total_events": len(sorted_events),
        "processed_files": processed_files,
        "errors": errors,
        "disclaimer": config.LEGAL_DISCLAIMER,
    }


class TextChronologyRequest(BaseModel):
    text: str
    matter_title: str = ""
    source_label: str = "Pasted text"
    model: Optional[str] = None


@router.post("/from-text")
async def extract_chronology_from_text(request: TextChronologyRequest):
    """
    Extract a chronology from text pasted directly into the request.
    Useful when the lawyer wants to paste a key document section.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Please provide some text.")

    use_model = config.resolve_model("heavy", request.model)

    # Anonymize PII
    pii_result = anonymize(request.text)

    # Trim to context limit
    excerpt = pii_result.anonymized_text[:8000]

    prompt = f"Document: {request.source_label}\n\n{excerpt}"

    try:
        raw_response = await ollama.generate(
            prompt=prompt,
            model=use_model,
            system_prompt=CHRONOLOGY_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    events = _parse_events(raw_response, source=request.source_label, token_map=pii_result.token_map)
    sorted_events = _sort_events(events)

    return {
        "matter_title": request.matter_title,
        "events": sorted_events,
        "total_events": len(sorted_events),
        "disclaimer": config.LEGAL_DISCLAIMER,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_events(raw_response: str, source: str, token_map: dict) -> List[dict]:
    """
    Parse JSON events from the LLM response.
    The LLM outputs one JSON object per line.
    """
    events = []
    for line in raw_response.strip().split("\n"):
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            event = json.loads(line)
            # Restore PII in event fields
            for field in ("event", "parties", "significance"):
                if field in event and event[field]:
                    event[field] = deanonymize(event[field], token_map)
            # Ensure source is set
            if not event.get("source"):
                event["source"] = source
            events.append(event)
        except json.JSONDecodeError:
            # LLM sometimes adds extra text — skip malformed lines
            continue
    return events


def _sort_events(events: List[dict]) -> List[dict]:
    """Sort events by date. ISO dates sort correctly as strings."""
    def sort_key(event):
        date = event.get("date", "")
        # ISO dates (YYYY-MM-DD) sort correctly; others go to end
        if date and len(date) == 10 and date[4] == "-":
            return date
        # Try to extract a year for partial dates like "January 2023"
        import re
        year_match = re.search(r"\b(19|20)\d{2}\b", date)
        if year_match:
            return year_match.group(0)
        return "9999"  # Unknown dates go to end

    return sorted(events, key=sort_key)
