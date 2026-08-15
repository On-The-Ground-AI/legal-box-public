# pii_shield.py — PII Detection and Anonymization for Singapore Legal Documents
#
# PII detection powered by Presidio (MIT License,
# https://github.com/data-privacy-stack/presidio — the open-source PII
# framework originally created by Microsoft), combined with Singapore-specific
# recognizers built for OTG Legal Box. Restoration (de-anonymization) is our
# own reversible token-map layer; Presidio is used for detection only.
#
# This module is the core privacy protection layer.
# It detects and replaces personal information BEFORE any text reaches the LLM.
# After the LLM responds, it puts the real names back.
#
# Detection runs as a single pass over the ORIGINAL text:
#   1. Singapore regex recognizers (always on): NRIC/FIN, passports, UEN,
#      phones, emails, postal codes, street addresses, court case numbers,
#      labelled dates of birth, Luhn-checked card numbers, context-gated
#      bank accounts.
#   2. Presidio AnalyzerEngine (when available): PERSON, ORGANIZATION,
#      EMAIL_ADDRESS, PHONE_NUMBER, CREDIT_CARD, IBAN_CODE — backed by a
#      spaCy NER model (en_core_web_lg preferred, en_core_web_sm fallback).
#   3. If Presidio is unavailable, spaCy NER runs directly (PERSON/ORG);
#      if spaCy is also unavailable, regex-only mode. Either downgrade is
#      reported through engine_info()/ner_active() — never silent.
# Overlapping candidate spans are resolved by category priority (then span
# length), and winning spans are replaced end-to-start so offsets stay valid.

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

# ── Detection engines (best-effort imports; degradation is surfaced) ────────

try:
    import spacy
    _SPACY_IMPORTED = True
except Exception:
    spacy = None
    _SPACY_IMPORTED = False

_NER_MODEL_PREFERENCE = ("en_core_web_lg", "en_core_web_sm")


def _load_spacy_model():
    """Load the best available spaCy model. Returns (nlp, model_name)."""
    if not _SPACY_IMPORTED:
        return None, None
    for name in _NER_MODEL_PREFERENCE:
        try:
            return spacy.load(name), name
        except Exception:
            continue
    return None, None


_NLP, _NER_MODEL_NAME = _load_spacy_model()
_SPACY_AVAILABLE = _NLP is not None

# Presidio analyzer is initialised lazily on first use (it takes a moment to
# build); _PRESIDIO_STATE is None = not tried, False = failed, engine = ready.
_PRESIDIO_STATE = None
# Presidio entity type → Legal Box category
_PRESIDIO_ENTITIES = {
    "PERSON": "PERSON",
    "ORGANIZATION": "ORG",
    "EMAIL_ADDRESS": "EMAIL",
    "PHONE_NUMBER": "PHONE",
    "CREDIT_CARD": "CREDIT_CARD",
    "IBAN_CODE": "BANK_ACCT",
}


def _get_presidio():
    """Build (once) and return the Presidio AnalyzerEngine, or None."""
    global _PRESIDIO_STATE
    if _PRESIDIO_STATE is not None:
        return _PRESIDIO_STATE or None
    if not _SPACY_AVAILABLE:
        # Presidio's NLP engine needs a spaCy model; without one we can't
        # do better than regex-only mode anyway.
        _PRESIDIO_STATE = False
        return None
    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": _NER_MODEL_NAME}],
            "ner_model_configuration": {
                "model_to_presidio_entity_mapping": {
                    "PERSON": "PERSON",
                    "PER": "PERSON",
                    "ORG": "ORGANIZATION",
                    "GPE": "LOCATION",
                    "LOC": "LOCATION",
                    "NORP": "NRP",
                },
                # ORGANIZATION is ignored by Presidio's default config as
                # too noisy; legal documents need company names masked, so
                # we keep it and accept some over-masking.
                "labels_to_ignore": ["O", "CARDINAL", "ORDINAL", "QUANTITY",
                                     "PERCENT", "MONEY", "DATE", "TIME",
                                     "LANGUAGE", "LAW", "WORK_OF_ART",
                                     "EVENT", "FAC", "PRODUCT"],
            },
        }
        provider = NlpEngineProvider(nlp_configuration=configuration)
        engine = AnalyzerEngine(
            nlp_engine=provider.create_engine(),
            supported_languages=["en"],
        )
        _PRESIDIO_STATE = engine
        return engine
    except Exception:
        _PRESIDIO_STATE = False
        return None


def ner_active() -> bool:
    """True when a NER model is loaded and person/org names are detected.

    When False the shield is DEGRADED: regex classes (NRIC, phones, emails…)
    still work but names and organisations pass through unmasked. Callers
    must surface this to the user — never let it fail silently.
    """
    return _SPACY_AVAILABLE


def engine_info() -> Dict[str, object]:
    """Which detection engine is live — reported in /api/health and the
    Confidentiality panel so degradation is visible, never silent."""
    engine = "regex-fallback"
    if _get_presidio() is not None:
        engine = "presidio"
    elif _SPACY_AVAILABLE:
        engine = "spacy-fallback"
    return {
        "engine": engine,
        "ner_model": _NER_MODEL_NAME,
        "ner_active": ner_active(),
    }


# ──────────────────────────────────────────────
# DATA STRUCTURES
# ──────────────────────────────────────────────

@dataclass
class PIIResult:
    """Holds the result of anonymization: anonymized text + a map to reverse it."""
    anonymized_text: str
    token_map: Dict[str, str]  # token (e.g. [NRIC_1]) → original value (e.g. S1234567A)
    pii_summary: Dict[str, int]  # how many of each type were found


@dataclass
class _Span:
    start: int
    end: int
    category: str
    value: str  # the exact original substring to store in the token map


# Matches any placeholder token we emit, e.g. [PERSON_1], [POSTAL_CODE_12]
_TOKEN_RE = re.compile(r"\[[A-Z][A-Z_]*_\d+\]")


# ──────────────────────────────────────────────
# SINGAPORE REGEX RECOGNIZERS (always on, both engines)
# ──────────────────────────────────────────────

# NRIC / FIN: starts with S, T, F, or G; 7 digits; ends with a letter
_NRIC_PATTERN = re.compile(
    r'\b([STFG]\d{7}[A-Z])\b',
    re.IGNORECASE
)

# Singapore passport numbers: E or K + 7 digits + checksum letter.
# Foreign passports vary too much for a bare pattern, so those are only
# caught when labelled (e.g. "Passport No: X1234567").
_SG_PASSPORT_PATTERN = re.compile(
    r'\b([EK]\d{7}[A-Z])\b'
)
_LABELLED_PASSPORT_PATTERN = re.compile(
    r'passport\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z]{1,2}\d{6,8}[A-Z]?)\b',
    re.IGNORECASE
)

# Singapore phone numbers:
#   +65 XXXX XXXX  |  +65XXXXXXXX  |  8-digit starting with 6,8,9
_PHONE_PATTERN = re.compile(
    r'(\+65[\s\-]?\d{4}[\s\-]?\d{4}|\b[689]\d{7}\b)',
)

# Email addresses (standard pattern)
_EMAIL_PATTERN = re.compile(
    r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'
)

# Dates of birth: only when labelled, to avoid masking every date in a
# judgment. Catches "DOB: 12/3/1985", "born on 12 March 1985",
# "date of birth 1985-03-12".
_DOB_PATTERN = re.compile(
    r'(?:date\s+of\s+birth|d\.?\s*o\.?\s*b\.?|born(?:\s+on)?)\s*[:\-]?\s*'
    r'(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}'
    r'|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}'
    r'|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|'
    r'Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?,?\s+\d{4})',
    re.IGNORECASE
)

# Credit / debit card numbers: 13–19 digits with optional space/dash
# separators. Candidates are confirmed with a Luhn checksum before masking,
# so ordinary long reference numbers are left alone. (Presidio's own
# CREDIT_CARD recognizer also runs when available; overlaps are deduped.)
_CARD_PATTERN = re.compile(
    r'\b\d(?:[ \-]?\d){12,18}\b'
)

# Singapore postal codes: 6-digit numbers starting with 01–83
_POSTAL_CODE_PATTERN = re.compile(
    r'\b(Singapore\s+)?(\d{6})\b'
)

# Singapore UEN (Unique Entity Number):
#   Business: 9-digit + letter  (e.g. 201912345A)
#   LLP/Society: 10-digit + letter (e.g. T08LL1234A)
_UEN_PATTERN = re.compile(
    r'\b(\d{9}[A-Z]|[A-Z]\d{2}[A-Z]{2}\d{4}[A-Z])\b',
    re.IGNORECASE
)

# Bank account numbers: 8–12 consecutive digits. Too many things look like
# this (postal codes, dates, case references), so a match only counts when
# an account-ish keyword appears shortly before it.
_BANK_ACCOUNT_PATTERN = re.compile(
    r'\b(\d{8,12})\b'
)
_BANK_CONTEXT_PATTERN = re.compile(
    r'(?:account|acct|a/c|acc\s*no|iban|bank)\b[^\n]{0,40}$',
    re.IGNORECASE
)

# Singapore street address pattern:
#   "Block 123", "Blk 45", "No. 12" followed by a Capitalised street name and
#   an optional unit number. The street name must start with a capital letter
#   and the match never crosses a line break — otherwise phrases like
#   "account no. 123456789 today" get mistaken for addresses.
_ADDRESS_PATTERN = re.compile(
    r'\b(?:[Bb]lk|[Bb]lock|BLK|BLOCK|No\.)\s+\d+[A-Z]?[ \t]+'
    r'[A-Z]\w*(?:[ \t][\w,]+)*'
    r'(?:,?[ \t]*#\d{2}-\d{2,4})?'
)

# Court case numbers: e.g. [2024] SGCA 12, HC/S 123/2024, DC/S 456/2024
_CASE_NUMBER_PATTERN = re.compile(
    r'\[\d{4}\]\s+SG[A-Z]{1,4}\s+\d+|'
    r'\b(?:HC|DC|MC|CA|SGHC|SGCA|SGDC)/[A-Z]+\s+\d+/\d{4}\b',
    re.IGNORECASE
)

# When two candidate spans overlap, the category earlier in this list wins.
# A tie on priority is broken by span length (longer wins), then position.
_CATEGORY_PRIORITY = [
    "NRIC",
    "EMAIL",
    "PHONE",
    "UEN",
    "CASE_NO",
    "PASSPORT",
    "CREDIT_CARD",
    "DOB",
    "ADDRESS",
    "POSTAL_CODE",
    "BANK_ACCT",
    "PERSON",
    "ORG",
]
_PRIORITY = {cat: i for i, cat in enumerate(_CATEGORY_PRIORITY)}


def _luhn_valid(digits: str) -> bool:
    """Luhn checksum used by all major card networks."""
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


# ──────────────────────────────────────────────
# MAIN PII SHIELD CLASS
# ──────────────────────────────────────────────

class PIIShield:
    """
    Detects and anonymizes Singapore-specific PII in text.

    Usage:
        shield = PIIShield()
        result = shield.anonymize("Client John Tan, NRIC S1234567A, called on +65 9123 4567")
        # result.anonymized_text → "Client [PERSON_1], NRIC [NRIC_1], called on [PHONE_1]"

        # After LLM processing:
        restored = shield.deanonymize(llm_response, result.token_map)
        # Gets back the original names
    """

    def anonymize(self, text: str) -> PIIResult:
        """
        Scan text for PII and replace with tokens.
        Returns the anonymized text and a map for reversing it later.
        """
        spans = self._collect_spans(text)
        spans = _resolve_overlaps(spans)

        token_map: Dict[str, str] = {}
        value_to_token: Dict[Tuple[str, str], str] = {}
        counters: Dict[str, int] = {}
        pii_summary: Dict[str, int] = {}

        def token_for(category: str, original: str) -> str:
            key = (category, original)
            if key in value_to_token:
                return value_to_token[key]
            counters[category] = counters.get(category, 0) + 1
            token = f"[{category}_{counters[category]}]"
            token_map[token] = original
            value_to_token[key] = token
            pii_summary[category] = pii_summary.get(category, 0) + 1
            return token

        # Replace end-to-start so earlier offsets stay valid
        result = text
        for span in sorted(spans, key=lambda s: s.start, reverse=True):
            token = token_for(span.category, span.value)
            result = result[:span.start] + token + result[span.end:]

        return PIIResult(
            anonymized_text=result,
            token_map=token_map,
            pii_summary=pii_summary,
        )

    def _collect_spans(self, text: str) -> List[_Span]:
        """Run every detector against the original text; return candidate spans."""
        spans = self._regex_spans(text)

        analyzer = _get_presidio()
        if analyzer is not None:
            spans.extend(self._presidio_spans(analyzer, text))
        elif _SPACY_AVAILABLE and _NLP:
            # Degraded: no Presidio, but direct spaCy NER still masks names.
            doc = _NLP(text)
            for ent in doc.ents:
                if ent.label_ in ("PERSON", "ORG") and ent.text.strip():
                    category = "PERSON" if ent.label_ == "PERSON" else "ORG"
                    spans.append(
                        _Span(ent.start_char, ent.end_char, category, ent.text)
                    )

        return spans

    def _presidio_spans(self, analyzer, text: str) -> List[_Span]:
        """Presidio built-in recognizers (names, orgs, emails, phones, cards)."""
        try:
            results = analyzer.analyze(
                text=text,
                language="en",
                entities=list(_PRESIDIO_ENTITIES.keys()),
                score_threshold=0.4,
            )
        except Exception:
            return []
        spans = []
        for r in results:
            category = _PRESIDIO_ENTITIES.get(r.entity_type)
            value = text[r.start:r.end]
            if category and value.strip():
                spans.append(_Span(r.start, r.end, category, value))
        return spans

    def _regex_spans(self, text: str) -> List[_Span]:
        """Singapore-specific recognizers — always on, whichever NER engine runs."""
        spans: List[_Span] = []

        for m in _NRIC_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "NRIC", m.group(0).upper()))

        for m in _EMAIL_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "EMAIL", m.group(0).lower()))

        for m in _PHONE_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "PHONE", m.group(0)))

        for m in _UEN_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "UEN", m.group(0).upper()))

        for m in _CASE_NUMBER_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "CASE_NO", m.group(0)))

        for m in _SG_PASSPORT_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "PASSPORT", m.group(0)))

        # Labelled passports: mask only the number, keep the "Passport No:" label
        for m in _LABELLED_PASSPORT_PATTERN.finditer(text):
            spans.append(_Span(m.start(1), m.end(1), "PASSPORT", m.group(1)))

        # DOB: mask only the date, keep the "date of birth" label
        for m in _DOB_PATTERN.finditer(text):
            spans.append(_Span(m.start(1), m.end(1), "DOB", m.group(1)))

        for m in _CARD_PATTERN.finditer(text):
            digits = re.sub(r"[ \-]", "", m.group(0))
            if 13 <= len(digits) <= 19 and _luhn_valid(digits):
                spans.append(_Span(m.start(), m.end(), "CREDIT_CARD", m.group(0)))

        for m in _ADDRESS_PATTERN.finditer(text):
            spans.append(_Span(m.start(), m.end(), "ADDRESS", m.group(0)))

        for m in _POSTAL_CODE_PATTERN.finditer(text):
            prefix = int(m.group(2)[:2])
            if 1 <= prefix <= 83:
                spans.append(_Span(m.start(), m.end(), "POSTAL_CODE", m.group(0)))

        # Bank accounts require an "account" keyword within the preceding 40 chars
        for m in _BANK_ACCOUNT_PATTERN.finditer(text):
            context = text[max(0, m.start() - 48):m.start()]
            if _BANK_CONTEXT_PATTERN.search(context):
                spans.append(_Span(m.start(), m.end(), "BANK_ACCT", m.group(0)))

        return spans

    def deanonymize(self, text: str, token_map: Dict[str, str]) -> str:
        """
        Reverse anonymization: replace tokens back with original PII values.
        Call this on the LLM's response to restore real names.

        Tokens are matched whole ([PERSON_1] can never corrupt [PERSON_10])
        and unknown tokens are left untouched. If the LLM mangled any tokens
        beyond recognition, a metadata-only count is written to the audit log.
        """
        restored = _TOKEN_RE.sub(
            lambda m: token_map.get(m.group(0), m.group(0)), text
        )

        if token_map:
            # Anything still token-shaped after substitution was not in the
            # map — usually a placeholder the LLM invented or mangled.
            our_categories = {t.rsplit("_", 1)[0] for t in token_map}
            leftover = [
                tok for tok in _TOKEN_RE.findall(restored)
                if tok.rsplit("_", 1)[0] in our_categories
            ]
            if leftover:
                _log_unresolved(len(leftover))

        return restored

    def get_summary(self, pii_result: PIIResult) -> str:
        """Return a human-readable summary of what PII was found."""
        if not pii_result.pii_summary:
            return "No PII detected."
        parts = []
        for category, count in sorted(pii_result.pii_summary.items()):
            label = {
                "PERSON": "person names",
                "ORG": "organisations",
                "NRIC": "NRIC/FIN numbers",
                "PASSPORT": "passport numbers",
                "PHONE": "phone numbers",
                "EMAIL": "email addresses",
                "DOB": "dates of birth",
                "CREDIT_CARD": "credit card numbers",
                "ADDRESS": "addresses",
                "POSTAL_CODE": "postal codes",
                "UEN": "company registration numbers",
                "BANK_ACCT": "bank account numbers",
                "CASE_NO": "case numbers",
            }.get(category, category)
            parts.append(f"{count} {label}")
        return f"PII detected and anonymized: {', '.join(parts)}."


def _resolve_overlaps(spans: List[_Span]) -> List[_Span]:
    """Keep the highest-priority span wherever candidates overlap.

    Sort by (category priority, longer span first, position); greedily accept
    spans that do not overlap an already-accepted one.
    """
    ordered = sorted(
        spans,
        key=lambda s: (_PRIORITY.get(s.category, len(_PRIORITY)), -(s.end - s.start), s.start),
    )
    accepted: List[_Span] = []
    for span in ordered:
        if all(span.end <= a.start or span.start >= a.end for a in accepted):
            accepted.append(span)
    return accepted


def _log_unresolved(count: int) -> None:
    """Record (metadata only) that the LLM response contained leftover tokens."""
    try:
        import audit_logger
        audit_logger.log_request(
            path="pii/deanonymize",
            method="INTERNAL",
            status=200,
            duration_ms=0,
            pii_counts={"UNRESOLVED_TOKENS": count},
        )
    except Exception:
        pass  # Never fail a response because of logging


# Module-level singleton for convenience
_shield = PIIShield()

def anonymize(text: str) -> PIIResult:
    """Convenience function: anonymize text using the default PIIShield."""
    return _shield.anonymize(text)

def deanonymize(text: str, token_map: Dict[str, str]) -> str:
    """Convenience function: restore PII tokens to original values."""
    return _shield.deanonymize(text, token_map)
