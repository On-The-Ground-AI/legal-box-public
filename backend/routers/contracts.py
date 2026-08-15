# routers/contracts.py — Contract review and risk flagging
#
# Upload a contract (PDF or DOCX) and get back a structured risk report:
#   - Key parties and their obligations
#   - Unusual or one-sided clauses
#   - Missing standard protections
#   - Overall risk rating (Low / Medium / High)
#   - Recommendations for negotiation
#
# PII is anonymized before the contract reaches the LLM.
#
# Endpoints:
#   POST /api/contracts/review   → Upload a contract, get a risk report

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

import config
from pii_shield import anonymize, deanonymize
from ollama_client import OllamaClient
from document_parser import parse_document

router = APIRouter(prefix="/api/contracts", tags=["contracts"])
ollama = OllamaClient()


# ── System prompt for contract review ─────────────────────────────────────────

CONTRACT_REVIEW_PROMPT = """You are an expert Singapore contract lawyer reviewing a legal agreement.

Analyse the contract carefully and provide a structured review in this exact format:

## 1. Document Overview
- Type of contract
- Parties involved
- Key dates (execution date, term, expiry)
- Governing law and jurisdiction

## 2. Key Obligations
List the main obligations of each party, in plain English.

## 3. Risk Rating: [LOW / MEDIUM / HIGH]
State the overall risk level and explain why in 2-3 sentences.

## 4. Unusual or One-Sided Clauses
List any clauses that are unusual, one-sided, or potentially unfair. For each:
- Clause reference (section number if visible)
- What it says
- Why it is a concern

## 5. Missing Standard Protections
List important clauses that are typically included in this type of contract but appear to be missing or inadequate.

## 6. Key Deadlines and Notice Periods
List any time-sensitive obligations, notice requirements, or deadlines.

## 7. Recommendations
Provide 3-5 specific, actionable recommendations for the client before signing.

---
Important: Be thorough but concise. Use plain English where possible. This review is for a Singapore-qualified lawyer to assess — not legal advice to a layperson."""


@router.post("/review")
async def review_contract(
    file: UploadFile = File(...),
    model: str = Form(""),
    notes: str = Form(""),  # Optional context from the lawyer (e.g. "this is a supplier contract")
):
    """
    Upload a contract PDF or DOCX and get a structured risk analysis.

    Steps:
    1. Extract text from the uploaded file
    2. Anonymize PII (names, NRICs, addresses etc.)
    3. Send to LLM with contract review system prompt
    4. Deanonymize the response
    5. Return the risk report
    """
    # Validate file type
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in (".pdf", ".docx", ".doc"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF (.pdf) and Word (.docx) files are supported."
        )

    # Save to temp file
    suffix = ext
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        shutil.copyfileobj(file.file, tmp)
        tmp.close()

        # Extract text
        try:
            text = parse_document(tmp.name).text
        except Exception as e:
            raise HTTPException(status_code=422, detail=str(e))

        if len(text.strip()) < 100:
            raise HTTPException(
                status_code=422,
                detail="The file appears to be empty or contains no readable text."
            )

        # Anonymize PII
        pii_result = anonymize(text)

        # Build the prompt
        prompt_parts = [f"Please review the following contract:\n\n{pii_result.anonymized_text}"]
        if notes.strip():
            prompt_parts.insert(0, f"Context from the lawyer: {notes}\n\n---\n\n")

        prompt = "".join(prompt_parts)

        # Trim if too long (LLMs have context limits)
        # Keep first 12,000 chars — enough for most contracts
        chars_total = len(prompt)
        truncated = chars_total > 12000
        if truncated:
            prompt = prompt[:12000] + "\n\n[... document truncated for length ...]"

        # Call the LLM
        use_model = config.resolve_model("heavy", model.strip() or None)
        try:
            raw_review = await ollama.generate(
                prompt=prompt,
                model=use_model,
                system_prompt=CONTRACT_REVIEW_PROMPT,
            )
        except ConnectionError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Restore PII in the review
        final_review = deanonymize(raw_review, pii_result.token_map)

        return {
            "filename": filename,
            "review": final_review,
            "model": use_model,
            "pii_detected": pii_result.pii_summary,
            "text_length": len(text),
            "truncated": truncated,
            "chars_used": min(chars_total, 12000),
            "chars_total": chars_total,
            "disclaimer": config.LEGAL_DISCLAIMER,
        }

    finally:
        # Always clean up temp file
        try:
            os.unlink(tmp.name)
        except Exception:
            pass
