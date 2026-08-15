# Contributing to OTG Legal Box

Thanks for your interest. OTG Legal Box is MIT-licensed and free for anyone to
use, run, modify, and ship. Contributions are welcome — bug reports, fixes,
new Singapore recognizers, prompt-library improvements, docs, and features.

## The one rule that overrides everything

**Nothing may break the two core promises:**

1. **Nothing leaves the machine.** No new runtime dependency may phone home;
   no code path may open a non-loopback network connection except to a local
   (or explicitly configured off-box) Ollama. If your change touches
   networking, embeddings, telemetry, or model downloads, say so in the PR and
   explain why the egress guard still holds.
2. **Client PII never reaches the language model.** Any new endpoint that
   sends text to Ollama must route it through the PII shield
   (`backend/pii_shield.py`) — anonymize before, de-anonymize after — exactly
   like the existing tools. There is a test that fails the build if planted
   PII reaches a captured prompt; keep it passing.

A change that weakens either promise will not be merged, however useful it is
otherwise.

## Development setup

Full developer instructions are in [README.md](README.md) ("Developer
install"). In short:

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt pytest hypothesis
python -m spacy download en_core_web_lg   # or en_core_web_sm

# Frontend
cd ../frontend
npm ci
npm run build         # or: npm run dev  (Vite dev server on :3000)
```

The desktop shell lives in `electron/`; build installers with
`scripts/build-app.sh` (see [BUILD-GUIDE.md](BUILD-GUIDE.md)).

> In sandboxes without access to model downloads, the PII shield degrades to
> regex-fallback mode and the NER-dependent tests skip — this is expected. CI
> runs the full NER tier.

## Before you open a pull request

- [ ] `pytest backend/tests -q` is green (or only NER tests skip, in an
      offline sandbox).
- [ ] `npm run build` in `frontend/` succeeds.
- [ ] New PII-handling code has a test proving no leak and a clean round-trip.
- [ ] New third-party dependencies are **permissively licensed** (MIT, BSD,
      Apache-2.0). **No GPL/AGPL/LGPL/SSPL/BUSL** in anything that ships in the
      app bundle — it would poison the MIT distribution. Dev-only tools that
      never ship may be AGPL if their output (not their code) is what's used;
      document the boundary in [NOTICE.md](NOTICE.md).
- [ ] Every incorporated project is credited in [NOTICE.md](NOTICE.md) with
      its license and how it's used.
- [ ] Docs updated if behaviour changed (README, USER_GUIDE, or the relevant
      runbook in `docs/`).

## Coding conventions

- Match the surrounding style; keep comments about *why*, not *what*.
- Keep `pii_shield.py` and `egress_guard.py` small and readable — they are the
  files a skeptical firm actually reads. Clarity there is a feature.
- Prefer adding a Singapore recognizer as a `PatternRecognizer`-style regex in
  `pii_shield.py` with a test fixture over reaching for a heavyweight
  dependency.

## Reporting bugs and requesting features

Use the GitHub issue templates. For anything security-sensitive — especially
an egress escape or a PII leak — **do not open a public issue**; follow
[SECURITY.md](SECURITY.md) instead.

## Legal

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE). Don't submit code you don't have the right
to license, and don't paste in code from GPL/AGPL sources.
