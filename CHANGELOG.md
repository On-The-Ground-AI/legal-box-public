# Changelog

All notable changes to OTG Legal Box are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/); this project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.1] — 2026-08-16

First release with downloadable installers. `v1.0.0` was tagged but never
published: both installers built correctly and the release step failed with
`403 Resource not accessible by integration`, so the website's download
buttons pointed at an empty releases page.

### Added
- **Quote verification for AI redlines** (`backend/quote_verify.py`). The
  redline prompt asks the model to "quote the exact text to delete" and the
  result is rendered as a strikethrough, but nothing checked that the quoted
  wording was actually in the contract — a paraphrased clause was displayed
  as though it were the document's own words. Every `~~deletion~~` from
  `POST /api/redline/markup` is now located in the source through a
  progressively looser match ladder (exact → whitespace/case → punctuation,
  with typographic quotes and dashes folded to ASCII).

  A located-but-drifted quote is corrected by **substituting the document's
  real wording**, not by re-prompting, so there is no second inference pass.
  A quote that cannot be located is left exactly as written and flagged —
  rewriting text we could not find would invent a correction. An empty or
  unreadable source reports `unverifiable`, never `not_found`, so "we could
  not check" is never presented as "we checked and it is absent".

  Verification runs **before** de-anonymization and against the same 14 000-
  character excerpt the model received: the model only ever sees PII tokens,
  so comparing restored quotes against the original text would mismatch
  wherever a token's length differs from the value it replaced, and a quote
  matching only past the truncation point is a real finding rather than a
  false negative.

  The response gains an additive `verification` block (counts plus a
  per-quote record); `markup` keeps its existing shape, so current consumers
  are unaffected.

### Fixed
- **Releases were never published, so the website's download buttons led to
  an empty page.** The `v1.0.0` tag built both installers successfully and
  then failed on the release step with `403 Resource not accessible by
  integration` — the default `GITHUB_TOKEN` is read-only in this org. Both
  build workflows now declare `permissions: contents: write`. Their push
  trigger also pointed at `main` rather than the default branch,
  `public-main`.
- `latest.yml` / `latest-mac.yml` were listed as release assets but never
  generated, warning on every run. electron-builder now runs with
  `--publish never` against a configured `publish` provider, which emits the
  auto-update feeds without uploading (the release step owns publishing).
- macOS builds are now ad-hoc codesigned in `electron/build/afterPack.js`.
  Apple Silicon will not execute an arm64 bundle carrying no signature at
  all and reports it as "damaged", which reads to a user as a corrupt
  download rather than a signing gap.
- Intel Mac downloads were advertised but never built — the macOS runner is
  Apple Silicon and PyInstaller produces an arm64-only backend, so an x64
  DMG would have shipped a backend that cannot run. `mac.target` is now
  arm64-only in `electron/package.json` (previously patched in CI), and the
  site, README and INSTALL no longer offer the download.
- Install instructions gave the pre-macOS 14 Gatekeeper workaround
  (right-click → Open), which no longer clears an unsigned app. Replaced
  with **System Settings → Privacy & Security → Open Anyway**.
- Packaged desktop app could not reach its own backend: the frontend used a
  relative `/api` base, which resolves to `file:///api/…` when Electron loads
  the UI from disk. It now targets `http://127.0.0.1:8000` under a `file://`
  origin and keeps the relative base (and Vite proxy) in the dev server.

### Added
- **`RELEASING.md`** — the tag-to-download runbook: how a `v*` tag becomes
  the assets the website links to, the repository permission that has to be
  enabled first, how to recover a failed release, and what still blocks a
  first launch on each platform.
- Per-platform `SHA256SUMS-macOS.txt` / `SHA256SUMS-windows.txt` on every
  release, so a firm's IT can verify a download matches what CI produced.
- The website's download buttons now resolve to the actual `.dmg` / `.exe`
  asset URLs via the GitHub releases API, showing version and file size and
  emphasising the visitor's platform. They fall back to the existing
  `/releases/latest` link when the API is unavailable or no release exists.
- **Windows installer CI**: `.github/workflows/build-windows.yml`, mirroring
  the existing macOS DMG workflow — builds an unsigned `.exe` (NSIS) on a
  Windows GitHub Actions runner, using the Windows Ollama runtime and the
  `legalbox.spec` PyInstaller config that already supported `win32`. Closes
  the gap where only macOS had automated builds; `scripts/build-app.bat` and
  the electron-builder `win` target already existed but had no CI.
- **Live web demo** at `/demo`, linked from the marketing site's top nav:
  a browser-only preview of every tool (Chat, Contract Review, Redlining,
  Bundle Creator, Chronology, Case Search, Prompt Library, PII Shield) with
  downloadable/uploadable sample documents. Deliberately a separate,
  sandboxed surface (`landing/demo/`, `api/demo/`) — it calls the Gemini
  API instead of a local model, since a public web page can't run Ollama,
  and never touches the installed product's data, database, or egress
  guard. PII anonymization still happens client-side before any network
  call. See `landing/demo/README.md`.
- Go-to-market documentation for the free-software / paid-installation model:
  `docs/GO_TO_MARKET.md`, `docs/INSTALL_SERVICE_RUNBOOK.md`, and
  `docs/TECH_LAW_FEST_2026.md`.
- Open-source governance files: `SECURITY.md`, `CONTRIBUTING.md`, this
  changelog, GitHub issue templates, and a pull-request template.

## [1.0.0] — 2026-07-10

First pilot-ready release. All engineering phases of the pilot plan complete.

### Added
- **PII Shield** rebuilt on [Presidio](https://github.com/data-privacy-stack/presidio)
  (MIT) with Singapore recognizers (NRIC/FIN, UEN, passports, postal codes,
  addresses, court case numbers, labelled DOB, Luhn-checked cards,
  context-gated bank accounts); reversible token-map restoration; degradation
  surfaced in `/api/health` and the UI, never silent. First automated test
  suite + per-entity benchmark + CI gate.
- **Provable zero-egress:** socket-level egress guard; ChromaDB telemetry
  disabled; embedding model bundled for fully-offline operation;
  anonymize-at-ingest so the search index stores only masked text; a
  "Confidentiality" panel that previews exactly what the model sees; tightened
  CORS; the scripted client demo in `docs/CONFIDENTIALITY_DEMO.md`.
- **Plug-and-play install/uninstall:** Ollama bundled and lifecycle-managed by
  the desktop app (a user's own Ollama is used if present); single-instance
  lock; in-app "Remove all data…" wipe plus uninstall scripts; CI DMG build
  with GitHub Releases on version tags.
- **Resource dashboard:** live CPU/RAM/disk/GPU endpoint, Settings panel, and
  sidebar meters, with honest reporting on Apple Silicon.
- **Ten built-in tools:** Chat, Summarize, Upload/Search Cases, Contract
  Review, Redlining (with real tracked-changes Word export), Bundle Creator
  (filing-ready assembled PDFs), Chronology, Drafting, and a Prompt Library.
- **Licensing hygiene:** AGPL PyMuPDF removed in favour of a pluggable
  MIT/Apache document pipeline (pdfplumber + MarkItDown fast; Docling
  accurate; optional Tesseract OCR). Every incorporated project credited in
  `NOTICE.md`.

[Unreleased]: https://github.com/On-The-Ground-AI/legal-box-public/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/On-The-Ground-AI/legal-box-public/releases/tag/v1.0.0
