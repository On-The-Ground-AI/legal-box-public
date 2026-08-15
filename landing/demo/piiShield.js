// piiShield.js — client-side PII detection & anonymization for the Legal Box live demo.
//
// This is a faithful port of the Singapore regex recognizers in
// backend/pii_shield.py (NRIC/FIN, passports, UEN, phones, emails, postal
// codes, addresses, court case numbers, labelled DOB, Luhn-checked card
// numbers, context-gated bank accounts). It runs entirely in the browser —
// nothing here ever touches the network. The real installed product also
// runs a spaCy/Presidio NER pass for person & organisation names; this demo
// intentionally runs regex-only (same degraded mode the real app falls back
// to when no NER model is installed) and says so, rather than pretending to
// catch names it can't reliably catch without a model.
//
// window.LegalBoxPII.anonymize(text)   -> { anonymizedText, tokenMap, summary }
// window.LegalBoxPII.deanonymize(text, tokenMap) -> string
// window.LegalBoxPII.describeSummary(summary) -> human-readable string

(function () {
  "use strict";

  const NRIC_RE = /\b([STFG]\d{7}[A-Z])\b/gi;
  const SG_PASSPORT_RE = /\b([EK]\d{7}[A-Z])\b/g;
  const LABELLED_PASSPORT_RE = /passport\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z]{1,2}\d{6,8}[A-Z]?)\b/gid;
  const PHONE_RE = /(\+65[\s\-]?\d{4}[\s\-]?\d{4}|\b[689]\d{7}\b)/g;
  const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
  const DOB_RE = /(?:date\s+of\s+birth|d\.?\s*o\.?\s*b\.?|born(?:\s+on)?)\s*[:\-]?\s*(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?,?\s+\d{4})/gid;
  const CARD_RE = /\b\d(?:[ \-]?\d){12,18}\b/g;
  const POSTAL_CODE_RE = /\b(?:Singapore\s+)?(\d{6})\b/g;
  const UEN_RE = /\b(\d{9}[A-Z]|[A-Z]\d{2}[A-Z]{2}\d{4}[A-Z])\b/gi;
  const BANK_ACCOUNT_RE = /\b(\d{8,12})\b/g;
  const BANK_CONTEXT_RE = /(?:account|acct|a\/c|acc\s*no|iban|bank)\b[^\n]{0,40}$/i;
  const ADDRESS_RE = /\b(?:[Bb]lk|[Bb]lock|BLK|BLOCK|No\.)\s+\d+[A-Z]?[ \t]+[A-Z]\w*(?:[ \t][\w,]+)*(?:,?[ \t]*#\d{2}-\d{2,4})?/g;
  const CASE_NUMBER_RE = /\[\d{4}\]\s+SG[A-Z]{1,4}\s+\d+|\b(?:HC|DC|MC|CA|SGHC|SGCA|SGDC)\/[A-Z]+\s+\d+\/\d{4}\b/gi;

  const TOKEN_RE = /\[[A-Z][A-Z_]*_\d+\]/g;

  const CATEGORY_PRIORITY = [
    "NRIC", "EMAIL", "PHONE", "UEN", "CASE_NO", "PASSPORT",
    "CREDIT_CARD", "DOB", "ADDRESS", "POSTAL_CODE", "BANK_ACCT",
  ];
  const PRIORITY = Object.fromEntries(CATEGORY_PRIORITY.map((c, i) => [c, i]));

  const CATEGORY_LABELS = {
    NRIC: "NRIC/FIN numbers",
    PASSPORT: "passport numbers",
    PHONE: "phone numbers",
    EMAIL: "email addresses",
    DOB: "dates of birth",
    CREDIT_CARD: "credit card numbers",
    ADDRESS: "addresses",
    POSTAL_CODE: "postal codes",
    UEN: "company registration numbers",
    BANK_ACCT: "bank account numbers",
    CASE_NO: "case numbers",
  };

  function luhnValid(digits) {
    let total = 0;
    const reversed = digits.split("").reverse();
    for (let i = 0; i < reversed.length; i++) {
      let n = parseInt(reversed[i], 10);
      if (i % 2 === 1) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      total += n;
    }
    return total % 10 === 0;
  }

  function findAll(re, text, mapFn) {
    const spans = [];
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      spans.push(mapFn(m));
      if (m[0].length === 0) re.lastIndex++; // safety against zero-width matches
    }
    return spans;
  }

  function regexSpans(text) {
    let spans = [];

    spans = spans.concat(findAll(NRIC_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "NRIC", value: m[0].toUpperCase(),
    })));

    spans = spans.concat(findAll(EMAIL_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "EMAIL", value: m[0].toLowerCase(),
    })));

    spans = spans.concat(findAll(PHONE_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "PHONE", value: m[0],
    })));

    spans = spans.concat(findAll(UEN_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "UEN", value: m[0].toUpperCase(),
    })));

    spans = spans.concat(findAll(CASE_NUMBER_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "CASE_NO", value: m[0],
    })));

    spans = spans.concat(findAll(SG_PASSPORT_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "PASSPORT", value: m[0],
    })));

    // Labelled passports: mask only the captured number, using regex `d`-flag
    // group indices (not string search) so it can't land on the wrong
    // occurrence when the same digits appear earlier in the match.
    spans = spans.concat(findAll(LABELLED_PASSPORT_RE, text, (m) => {
      const [start, end] = m.indices[1];
      return { start, end, category: "PASSPORT", value: m[1] };
    }));

    // DOB: mask only the captured date, keep the "date of birth" label
    spans = spans.concat(findAll(DOB_RE, text, (m) => {
      const [start, end] = m.indices[1];
      return { start, end, category: "DOB", value: m[1] };
    }));

    spans = spans.concat(
      findAll(CARD_RE, text, (m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }))
        .filter((s) => {
          const digits = s.value.replace(/[ \-]/g, "");
          return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
        })
        .map((s) => ({ ...s, category: "CREDIT_CARD" }))
    );

    spans = spans.concat(findAll(ADDRESS_RE, text, (m) => ({
      start: m.index, end: m.index + m[0].length, category: "ADDRESS", value: m[0],
    })));

    spans = spans.concat(
      findAll(POSTAL_CODE_RE, text, (m) => ({ start: m.index, end: m.index + m[0].length, value: m[0], digits: m[1] }))
        .filter((s) => {
          const prefix = parseInt(s.digits.slice(0, 2), 10);
          return prefix >= 1 && prefix <= 83;
        })
        .map((s) => ({ start: s.start, end: s.end, category: "POSTAL_CODE", value: s.value }))
    );

    // Bank accounts require an "account"-ish keyword within the preceding 48 chars
    spans = spans.concat(
      findAll(BANK_ACCOUNT_RE, text, (m) => ({ start: m.index, end: m.index + m[0].length, value: m[0] }))
        .filter((s) => BANK_CONTEXT_RE.test(text.slice(Math.max(0, s.start - 48), s.start)))
        .map((s) => ({ ...s, category: "BANK_ACCT" }))
    );

    return spans;
  }

  function resolveOverlaps(spans) {
    const ordered = spans.slice().sort((a, b) => {
      const pa = PRIORITY[a.category] ?? CATEGORY_PRIORITY.length;
      const pb = PRIORITY[b.category] ?? CATEGORY_PRIORITY.length;
      if (pa !== pb) return pa - pb;
      const lenA = a.end - a.start, lenB = b.end - b.start;
      if (lenA !== lenB) return lenB - lenA; // longer span wins
      return a.start - b.start;
    });
    const accepted = [];
    for (const span of ordered) {
      const overlaps = accepted.some((a) => !(span.end <= a.start || span.start >= a.end));
      if (!overlaps) accepted.push(span);
    }
    return accepted;
  }

  // A "session" carries counters/value->token state across multiple
  // anonymize() calls (e.g. every turn of one chat conversation), so the
  // same real value always gets the same token and token numbers are never
  // reused for two different values. deanonymize() should always be called
  // with session.tokenMap, which accumulates for the session's lifetime.
  function createSession() {
    return { tokenMap: {}, valueToToken: {}, counters: {} };
  }

  function anonymize(text, session) {
    const state = session || createSession();
    const spans = resolveOverlaps(regexSpans(text));
    const summary = {}; // only what's newly found in THIS call

    function tokenFor(category, original) {
      const key = category + " " + original;
      if (state.valueToToken[key]) return state.valueToToken[key];
      state.counters[category] = (state.counters[category] || 0) + 1;
      const token = "[" + category + "_" + state.counters[category] + "]";
      state.tokenMap[token] = original;
      state.valueToToken[key] = token;
      summary[category] = (summary[category] || 0) + 1;
      return token;
    }

    let result = text;
    const byStartDesc = spans.slice().sort((a, b) => b.start - a.start);
    for (const span of byStartDesc) {
      const token = tokenFor(span.category, span.value);
      result = result.slice(0, span.start) + token + result.slice(span.end);
    }

    return { anonymizedText: result, session: state, tokenMap: state.tokenMap, summary };
  }

  function deanonymize(text, tokenMap) {
    return text.replace(TOKEN_RE, (m) => (Object.prototype.hasOwnProperty.call(tokenMap, m) ? tokenMap[m] : m));
  }

  function describeSummary(summary) {
    const keys = Object.keys(summary || {});
    if (keys.length === 0) return "No PII detected in this text.";
    const parts = keys.sort().map((cat) => `${summary[cat]} ${CATEGORY_LABELS[cat] || cat}`);
    return `PII detected and anonymized: ${parts.join(", ")}.`;
  }

  window.LegalBoxPII = { anonymize, deanonymize, describeSummary, createSession, CATEGORY_LABELS };
})();
