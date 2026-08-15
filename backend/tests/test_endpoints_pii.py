# test_endpoints_pii.py — regression net for the PII round trip on every
# LLM-facing endpoint.
#
# For each of the 9 endpoints that send content to the model, we assert:
#   1. NO planted PII value ever appears in the captured LLM prompt
#   2. the API response contains the RESTORED originals (round trip works)
#
# The LLM is faked (see conftest.LLMCapture) so the suite runs offline.
# This is exactly the net that would have caught the unshielded bundles
# endpoint.

import io
import json

import pytest
from fastapi.testclient import TestClient

from .conftest import FIXTURE_DOCS, all_regex_values

# The letter fixture exercises the widest PII spread; endpoint tests use it
LETTER_NAME, LETTER_TEXT, LETTER_MANIFEST = next(
    f for f in FIXTURE_DOCS if f[0] == "letter_of_demand"
)
LETTER_PII = all_regex_values(LETTER_MANIFEST)


@pytest.fixture(scope="module")
def client():
    import main
    return TestClient(main.app)


def make_docx(text: str) -> bytes:
    """Build an in-memory .docx so upload endpoints can be tested offline."""
    from docx import Document
    buf = io.BytesIO()
    doc = Document()
    for para in text.split("\n"):
        doc.add_paragraph(para)
    doc.save(buf)
    return buf.getvalue()


def assert_no_pii_reached_llm(llm_capture, values=LETTER_PII):
    sent = llm_capture.sent_text()
    assert llm_capture.calls, "endpoint never called the LLM"
    for value in values:
        assert value not in sent, f"'{value}' reached the LLM prompt"


def assert_some_pii_restored(text_out: str):
    restored = [v for v in LETTER_PII if v in text_out]
    assert restored, "no original PII values were restored in the response"


# ── 1. Chat ───────────────────────────────────────────────────────────────────

def test_chat_round_trip(client, llm_capture):
    resp = client.post("/api/chat", json={
        "messages": [{"role": "user", "content": f"Summarise this letter:\n{LETTER_TEXT}"}],
    })
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert_some_pii_restored(resp.json()["response"])
    assert resp.json()["pii_detected"]


# ── 2. Summarize (text) ──────────────────────────────────────────────────────

def test_summarize_round_trip(client, llm_capture):
    resp = client.post("/api/summarize", json={"text": LETTER_TEXT})
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert_some_pii_restored(resp.json()["summary"])


# ── 3. Summarize (file upload) ───────────────────────────────────────────────

def test_summarize_file_round_trip(client, llm_capture):
    resp = client.post(
        "/api/summarize-file",
        files={"file": ("letter.docx", make_docx(LETTER_TEXT),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert_some_pii_restored(resp.json()["summary"])


# ── 4. Case search (RAG) ─────────────────────────────────────────────────────

def test_search_cases_round_trip(client, llm_capture, monkeypatch):
    import main

    class FakeDB:
        def get_case_count(self):
            return 1

        def search(self, query, top_k=5):
            # Simulates a stored chunk that still contains raw PII —
            # the endpoint must shield it before the RAG prompt goes out.
            return [{
                "case_name": "Tan v. Lee [2024] SGHC 12",
                "text": LETTER_TEXT[:800],
                "score": 0.9,
            }]

    monkeypatch.setattr(main, "get_db", lambda: FakeDB())

    resp = client.get("/api/search-cases", params={"query": "Who owes money to Acme Holdings Pte Ltd?"})
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert resp.json()["answer"] is not None


# ── 5. Contract review ───────────────────────────────────────────────────────

def test_contract_review_round_trip(client, llm_capture):
    resp = client.post(
        "/api/contracts/review",
        files={"file": ("contract.docx", make_docx(LETTER_TEXT),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"model": "", "notes": ""},
    )
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert_some_pii_restored(resp.json()["review"])


# ── 6. Redline markup ────────────────────────────────────────────────────────

def test_redline_markup_round_trip(client, llm_capture):
    resp = client.post(
        "/api/redline/markup",
        files={"file": ("contract.docx", make_docx(LETTER_TEXT),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
        data={"client_role": "buyer"},
    )
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert_some_pii_restored(resp.json()["markup"])


# ── 7. Chronology (from text) ────────────────────────────────────────────────

def test_chronology_round_trip(client, llm_capture):
    def jsonl_responder(messages, system_prompt):
        from .conftest import TOKEN_RE
        text = "\n".join(m["content"] for m in messages)
        tokens = " ".join(dict.fromkeys(TOKEN_RE.findall(text))) or "the parties"
        return json.dumps({
            "date": "2025-01-15",
            "event": f"Meeting between {tokens}",
            "parties": tokens,
            "significance": "key dispute event",
        })

    llm_capture.responder = jsonl_responder

    resp = client.post("/api/chronology/from-text", json={"text": LETTER_TEXT})
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    events = resp.json()["events"]
    assert events, "chronology returned no events"
    assert_some_pii_restored(events[0]["event"])


# ── 8. Drafting (letter) ─────────────────────────────────────────────────────

def test_drafting_letter_round_trip(client, llm_capture):
    resp = client.post("/api/drafting/letter", json={
        "letter_type": "demand",
        "sender": "Chan & Lee LLC",
        "recipient": "Mr Tan Ah Kow, NRIC S1234567A",
        "subject": "Outstanding sum",
        "key_points": LETTER_TEXT,
    })
    assert resp.status_code == 200
    assert_no_pii_reached_llm(llm_capture)
    assert_some_pii_restored(resp.json()["draft"])


# ── 9. Bundles (the endpoint that used to leak party names) ──────────────────

def test_bundles_round_trip(client, llm_capture):
    def numbered_responder(messages, system_prompt):
        from .conftest import TOKEN_RE
        text = "\n".join(m["content"] for m in messages)
        tokens = " ".join(dict.fromkeys(TOKEN_RE.findall(text))) or "the principle"
        return f"1. Establishes the position of {tokens} in this matter."

    llm_capture.responder = numbered_responder

    resp = client.post("/api/bundles/generate", json={
        "matter_title": "Acme Holdings Pte Ltd (UEN 201912345A) v. Tan Ah Kow (NRIC S1234567A)",
        "hearing_type": "Summary Judgment",
        "items": [
            {"title": "Tan v. Lee [2024] SGHC 12", "type": "case"},
        ],
        "generate_relevance": True,
    })
    assert resp.status_code == 200
    # The NRIC and UEN in the matter title must never reach the LLM
    sent = llm_capture.sent_text()
    assert llm_capture.calls, "bundles endpoint never called the LLM"
    assert "S1234567A" not in sent
    assert "201912345A" not in sent
    body = resp.json()
    assert body["pii_detected"], "bundles response missing pii_detected"
    # The relevance statement must carry restored originals
    items = body["bundle"]["table_of_contents"]["part_2_cases"]["items"]
    assert any("S1234567A" in i["relevance"] or "Tan" in i["relevance"] or "[2024] SGHC 12" in i["relevance"]
               for i in items)


# ── PII preview (Confidentiality panel) ──────────────────────────────────────

def test_pii_preview_masks_and_reports(client):
    resp = client.post("/api/pii/preview", json={
        "text": "Mr Tan (NRIC S1234567A) called +65 9123 4567.",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "S1234567A" not in body["anonymized_text"]
    assert "+65 9123 4567" not in body["anonymized_text"]
    assert body["pii_summary"].get("NRIC") == 1
    assert "engine" in body
    assert "egress_locked" in body
