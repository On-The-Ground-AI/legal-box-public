## What this changes

<!-- A short description of the change and why. -->

## The two promises (required)

- [ ] **Nothing leaves the machine** — this change opens no new non-loopback
      connection and adds no dependency that phones home. (If it touches
      networking/embeddings/model downloads, explain below.)
- [ ] **PII never reaches the model** — any new text sent to Ollama goes
      through the PII shield (anonymize → de-anonymize), and the no-leak test
      still passes.

<!-- If either box can't be ticked, explain here. -->

## Checklist

- [ ] `pytest backend/tests -q` green (or only NER tests skip in an offline sandbox)
- [ ] `npm run build` in `frontend/` succeeds
- [ ] New dependencies are permissively licensed (no GPL/AGPL/LGPL/SSPL/BUSL in the shipped bundle)
- [ ] New/changed third-party use is credited in `NOTICE.md`
- [ ] Docs updated if behaviour changed
- [ ] `CHANGELOG.md` updated under `[Unreleased]`

## How I tested
