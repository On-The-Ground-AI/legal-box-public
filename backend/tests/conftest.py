# conftest.py — shared fixtures for the Legal Box backend test suite
#
# The suite runs fully offline. All LLM calls are intercepted by the
# `llm_capture` fixture, which records exactly what would have been sent to
# the model — that captured prompt is what the PII no-leak assertions run
# against.

import json
import re
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

FIXTURES_DIR = Path(__file__).parent / "fixtures"

TOKEN_RE = re.compile(r"\[[A-Z][A-Z_]*_\d+\]")


def load_fixtures():
    """Return [(name, text, manifest), ...] for every fixture document."""
    out = []
    for txt in sorted(FIXTURES_DIR.glob("*.txt")):
        manifest_path = txt.with_suffix(".json")
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        out.append((txt.stem, txt.read_text(encoding="utf-8"), manifest))
    return out


FIXTURE_DOCS = load_fixtures()
FIXTURE_IDS = [name for name, _, _ in FIXTURE_DOCS]


@pytest.fixture(params=FIXTURE_DOCS, ids=FIXTURE_IDS)
def fixture_doc(request):
    """(name, text, manifest) for each synthetic Singapore legal document."""
    return request.param


def all_regex_values(manifest):
    """Every planted PII value that the regex layer must always catch."""
    return [v for values in manifest["regex_pii"].values() for v in values]


def all_ner_values(manifest):
    """Person/org names — caught when a NER engine is active."""
    return [v for values in manifest.get("ner_pii", {}).values() for v in values]


class LLMCapture:
    """Captures every prompt that would reach the LLM and fakes a response.

    The default responder echoes back every [CATEGORY_N] token it saw, so
    endpoint tests can verify the de-anonymization round trip. Individual
    tests can swap `responder` for endpoint-specific output shapes (e.g.
    JSONL for chronology, numbered lines for bundles).
    """

    def __init__(self):
        self.calls = []  # each: {"messages": [...], "system": str|None}
        self.responder = self.echo_tokens

    def sent_text(self):
        """All text that left for the 'LLM' across every call."""
        parts = []
        for call in self.calls:
            if call["system"]:
                parts.append(call["system"])
            parts.extend(m["content"] for m in call["messages"])
        return "\n".join(parts)

    @staticmethod
    def echo_tokens(messages, system_prompt):
        text = "\n".join(m["content"] for m in messages)
        tokens = list(dict.fromkeys(TOKEN_RE.findall(text)))
        return "Draft response referencing " + " and ".join(tokens) if tokens else "Draft response."


@pytest.fixture
def llm_capture(monkeypatch):
    """Patch OllamaClient.chat so no test ever needs a live Ollama.

    OllamaClient.generate() delegates to chat(), so this single patch covers
    every LLM code path in the backend.
    """
    from ollama_client import OllamaClient

    capture = LLMCapture()

    async def fake_chat(self, messages, model=None, system_prompt=None):
        capture.calls.append({"messages": messages, "system": system_prompt})
        return capture.responder(messages, system_prompt)

    monkeypatch.setattr(OllamaClient, "chat", fake_chat)
    return capture
