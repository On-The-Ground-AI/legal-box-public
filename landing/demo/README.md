# Live Web Demo

A browser-only, hosted preview of OTG Legal Box, linked from the "Live Demo"
button in `landing/index.html`. It exists so a prospect can try the actual
workflow — upload a sample contract, get a risk report, redline it, build a
bundle, extract a chronology, search sample cases, browse the prompt library,
and run the PII shield — without installing anything.

**This is deliberately a different architecture from the installed product.**
The real app (`backend/` + `frontend/` + `electron/`) runs entirely on the
firm's own computer, with a runtime egress guard that makes it physically
incapable of reaching the internet. A public web page can't do that — there's
no local machine to run Ollama on — so this demo instead calls the
[Gemini API](https://ai.google.dev/gemini-api) (`gemini-2.5-flash-lite`, chosen
for low cost) from a Vercel serverless function. It is its own sandboxed
surface (`landing/demo/` for the frontend, `api/demo/` for the backend) and
never touches the real product's data directory, database, or Ollama
integration.

## How privacy is handled here

Every tool anonymizes text with `piiShield.js` **in the browser**, before
anything is sent to `/api/demo/*` — this is a faithful line-for-line port of
`backend/pii_shield.py`'s Singapore regex recognizers (NRIC/FIN, passports,
UEN, phones, emails, dates of birth, Luhn-checked card numbers, addresses,
postal codes, context-gated bank accounts, court case numbers). The token map
that lets the browser restore real values after the model replies **never
leaves the browser** — only anonymized text and the model's anonymized reply
cross the network. The demo runs regex-only (no spaCy/Presidio NER), so unlike
the installed app it does not mask person/organisation names — the PII Shield
tab says so explicitly, the same way `backend/pii_shield.py`'s
`engine_info()` reports degraded mode rather than failing silently.

Even so: **don't paste real client or confidential information into this
demo.** It's shown a banner saying exactly that. Use the bundled sample
documents (`data/sample-docs/`) or made-up text.

## Setup

Set these environment variables on the Vercel project (Project Settings →
Environment Variables):

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | — | A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Without it, every AI-backed endpoint returns a clear 503 — the rest of the demo (PII shield, prompt library, sample docs, case search, redline compare) still works, since none of those need an LLM. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-lite` | Override the model. |
| `DEMO_COOKIE_SECRET` | Recommended | a hardcoded dev fallback | HMAC secret signing the per-browser rate-limit cookie. Set a real random value in production so the fallback (checked into this repo) isn't relied on. |
| `DEMO_DAILY_LIMIT` | No | `25` | Max AI-backed calls per browser per UTC day. This is a soft, cookie-based limit (see below) meant to bound cost, not a security control. |

No npm install step is required — the serverless functions call the Gemini
REST API directly with `fetch` (no SDK dependency), so `vercel.json`'s
existing zero-dependency build stays accurate.

## Rate limiting & cost control

There's no database behind this demo, so the daily cap lives in a signed
cookie (`api/demo/_lib/rateLimit.js`): an HMAC-signed `{count, day}` pair the
server can verify but a client can't forge, reset at UTC midnight. This is a
**soft** limit — clearing cookies resets it — appropriate for a marketing
demo, not a substitute for watching the Gemini billing dashboard. Combined
with the cheap model, short `maxOutputTokens`, and per-request text caps
(`MAX_CHARS` constants in each `api/demo/*.js` file), a single visitor
exploring every tool costs a small fraction of a cent.

## Local development

There's no bundler — `landing/demo/` is plain HTML/CSS/JS, same as the rest of
`landing/`. To test locally: run `vercel dev` from the repo root (respects
`vercel.json`'s rewrites and picks up `api/demo/*.js` automatically), or serve
`landing/` with any static file server and proxy `/api/demo/*` yourself.

## Files

```
landing/demo/
├── index.html          Single-page shell: 8 tabs, one per tool
├── app.js               All client logic — tab switching, PII wrapping, rendering
├── piiShield.js         Ported PII engine (see above) — zero dependencies
├── styles.css            Matches the main landing page's dark theme
├── data/
│   ├── manifest.json     Sample document metadata (which tools each doc suits)
│   ├── corpus.json       Same sample docs, prepped for the Case Search tab
│   ├── prompts.json      Curated ~128-prompt subset of the real prompt library
│   └── sample-docs/*.txt  Synthetic Singapore legal documents with planted PII
api/demo/
├── _lib/
│   ├── gemini.js         Gemini REST call wrapper (no SDK)
│   ├── prompts.js        System prompts, ported from backend/routers/*.py
│   ├── rateLimit.js      Signed-cookie daily cap
│   └── http.js           Shared request/response/error handling
├── chat.js, contract-review.js, redline.js, chronology.js, bundle.js,
└── search-answer.js      One handler per AI-backed tool
```
