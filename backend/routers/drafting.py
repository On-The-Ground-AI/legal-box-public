# routers/drafting.py — Legal Drafting Assistant
#
# Generate professional legal drafts:
#   - Letters and emails (to opposing counsel, clients, courts)
#   - Billing narratives (for time recording)
#   - Pleading structure assistance (statement of claim, defence)
#
# The LLM uses context provided by the lawyer to generate a draft.
# PII in the context is anonymized before reaching the LLM, then restored.
#
# Endpoints:
#   POST /api/drafting/letter       → Draft a legal letter or email
#   POST /api/drafting/billing      → Generate billing narrative
#   POST /api/drafting/pleading     → Draft pleading structure

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from pii_shield import anonymize, deanonymize
from ollama_client import OllamaClient

router = APIRouter(prefix="/api/drafting", tags=["drafting"])
ollama = OllamaClient()


# ── System prompts ────────────────────────────────────────────────────────────

LETTER_SYSTEM_PROMPT = """You are a senior Singapore litigation lawyer drafting professional legal correspondence.

Write in a formal, precise legal tone appropriate for Singapore law firms.
Use proper salutations and closings (e.g. "Dear Sirs", "Yours faithfully").
Structure the letter clearly with:
- Opening paragraph stating the purpose
- Body paragraphs with the substance
- Closing paragraph with next steps or requests
- Appropriate sign-off

Do NOT include placeholder text like [YOUR NAME] — use the context provided.
Keep the letter professional, firm, and factually precise."""


BILLING_SYSTEM_PROMPT = """You are a Singapore law firm lawyer writing billing narratives for time recording.

Generate professional billing narrative entries that:
- Accurately describe the legal work done
- Use standard legal billing language
- Are appropriately detailed (not too vague, not too wordy)
- Follow the format: [Activity verb] [what was done] [purpose/matter context]

Examples of good billing language:
- "Reviewing and annotating contract; advising client on key risks"
- "Drafting letter of demand; reviewing instructions"
- "Attending client meeting to discuss litigation strategy"
- "Researching case law on limitation periods; preparing research memo"

Output only the billing narrative entries, one per line."""


PLEADING_SYSTEM_PROMPT = """You are a Singapore civil litigation lawyer drafting pleadings.

Follow Singapore Rules of Court 2021 requirements:
- Statements of Claim should set out the material facts chronologically
- Each paragraph should contain one distinct allegation
- Prayers for relief should be specific and complete
- Use clear, numbered paragraphs
- Avoid evidence — only plead material facts

Format using proper pleading structure:
1. Heading (court, case number if known, parties)
2. Introduction of parties
3. Material facts in numbered paragraphs
4. Cause(s) of action
5. Prayers for relief"""


# ── Request Models ────────────────────────────────────────────────────────────

class LetterRequest(BaseModel):
    letter_type: str           # "demand", "without_prejudice", "to_client", "to_court", "general"
    sender: str = ""           # Who is writing (e.g. "Chan & Lee LLC, for the Plaintiff")
    recipient: str = ""        # Who it's addressed to
    subject: str = ""          # Subject matter
    key_points: str            # What the letter needs to say (bullet points or notes)
    matter_reference: str = "" # Matter/file reference
    model: Optional[str] = None


class BillingRequest(BaseModel):
    activities: str            # Description of work done (notes/bullet points)
    matter_type: str = ""      # e.g. "commercial litigation", "conveyancing"
    model: Optional[str] = None


class PleadingRequest(BaseModel):
    pleading_type: str         # "statement_of_claim", "defence", "reply", "counterclaim"
    party_role: str            # "plaintiff" or "defendant"
    facts: str                 # Key facts to include
    causes_of_action: str = "" # What the claims are (for plaintiff)
    relief_sought: str = ""    # What remedies are sought (for plaintiff)
    model: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/letter")
async def draft_letter(request: LetterRequest):
    """
    Draft a professional legal letter or email.
    Provide key points and context; the LLM writes the full letter.
    """
    use_model = config.resolve_model("heavy", request.model)

    # Map letter type to a description
    letter_type_labels = {
        "demand": "letter of demand",
        "without_prejudice": "without prejudice letter",
        "to_client": "client update letter",
        "to_court": "letter to court",
        "general": "general legal letter",
    }
    letter_label = letter_type_labels.get(request.letter_type, "legal letter")

    # Build the prompt — anonymize all user-provided content
    raw_prompt = (
        f"Draft a {letter_label} with the following details:\n\n"
        f"From: {request.sender or 'Our firm, for the client'}\n"
        f"To: {request.recipient or 'The recipient'}\n"
        f"Subject/Matter: {request.subject or 'As described below'}\n"
        + (f"Our matter reference: {request.matter_reference}\n" if request.matter_reference else "")
        + f"\nKey points to include:\n{request.key_points}"
    )

    pii_result = anonymize(raw_prompt)

    try:
        raw_draft = await ollama.generate(
            prompt=pii_result.anonymized_text,
            model=use_model,
            system_prompt=LETTER_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    final_draft = deanonymize(raw_draft, pii_result.token_map)

    return {
        "draft": final_draft,
        "letter_type": letter_label,
        "model": use_model,
        "pii_detected": pii_result.pii_summary,
        "disclaimer": config.LEGAL_DISCLAIMER,
    }


@router.post("/billing")
async def generate_billing_narrative(request: BillingRequest):
    """
    Generate professional billing narrative entries from activity notes.
    Useful for time recording at the end of a busy day.
    """
    use_model = config.resolve_model("heavy", request.model)

    raw_prompt = (
        f"Generate billing narrative entries for the following work done"
        + (f" on a {request.matter_type} matter" if request.matter_type else "")
        + f":\n\n{request.activities}"
    )

    pii_result = anonymize(raw_prompt)

    try:
        raw_narratives = await ollama.generate(
            prompt=pii_result.anonymized_text,
            model=use_model,
            system_prompt=BILLING_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    final_narratives = deanonymize(raw_narratives, pii_result.token_map)

    # Parse into individual entries
    entries = [
        line.strip()
        for line in final_narratives.split("\n")
        if line.strip() and not line.strip().startswith("#")
    ]

    return {
        "narratives": entries,
        "raw_text": final_narratives,
        "model": use_model,
        "pii_detected": pii_result.pii_summary,
        "disclaimer": config.LEGAL_DISCLAIMER,
    }


@router.post("/pleading")
async def draft_pleading(request: PleadingRequest):
    """
    Draft a pleading structure (statement of claim, defence, etc.)
    following Singapore Rules of Court 2021 requirements.
    """
    use_model = config.resolve_model("heavy", request.model)

    # Map pleading type to a label
    pleading_labels = {
        "statement_of_claim": "Statement of Claim",
        "defence": "Defence",
        "reply": "Reply",
        "counterclaim": "Defence and Counterclaim",
    }
    pleading_label = pleading_labels.get(request.pleading_type, "Pleading")

    raw_prompt = (
        f"Draft a {pleading_label} for the {request.party_role}.\n\n"
        f"Key facts:\n{request.facts}\n"
    )
    if request.causes_of_action:
        raw_prompt += f"\nCauses of action / grounds of defence:\n{request.causes_of_action}\n"
    if request.relief_sought:
        raw_prompt += f"\nRelief sought / prayers:\n{request.relief_sought}\n"

    pii_result = anonymize(raw_prompt)

    try:
        raw_draft = await ollama.generate(
            prompt=pii_result.anonymized_text,
            model=use_model,
            system_prompt=PLEADING_SYSTEM_PROMPT,
        )
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    final_draft = deanonymize(raw_draft, pii_result.token_map)

    return {
        "draft": final_draft,
        "pleading_type": pleading_label,
        "model": use_model,
        "pii_detected": pii_result.pii_summary,
        "disclaimer": config.LEGAL_DISCLAIMER,
    }
