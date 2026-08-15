# Security Policy

OTG Legal Box is used by law firms to process confidential and privileged
material. We take security reports seriously and appreciate responsible
disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for a security vulnerability.**

Email **haojun@ontheground.agency** with:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if you have one),
- the version / commit you tested,
- any suggested remediation.

We aim to acknowledge reports within **3 business days** and to provide a
remediation plan or fix timeline within **10 business days**. We'll keep you
updated as we work on a fix and will credit you in the release notes unless
you prefer to remain anonymous.

## Scope — what we especially want to hear about

Because the product's core promise is that **nothing leaves the machine** and
**client PII never reaches the language model**, these classes of bug are the
highest priority:

- **Egress escape** — any way the backend process opens a non-loopback
  network connection despite the egress guard (`backend/egress_guard.py`), or
  any bundled dependency that phones home at runtime.
- **PII leak** — any input where the shield (`backend/pii_shield.py`) fails to
  mask a supported identifier before text reaches the model, or where the
  anonymize → restore round-trip corrupts or exposes data.
- **Local privilege / data exposure** — path traversal in the upload/download
  endpoints, arbitrary file read/write, or a way for one Server-mode user to
  read another's data.
- **Audit integrity** — any way an action that reaches the model is not
  recorded, or a way to write false entries.

## Known limitations (by design, not vulnerabilities)

These are documented trade-offs, not bugs — please don't file them as
vulnerabilities, but do tell us if you can push past the stated boundary:

- **Server mode** binds to the local network and has **no authentication** —
  access control is "trusted LAN," like a shared office file server. It is
  off by default; Desktop mode binds to localhost only. See
  [docs/INSTALL_SERVICE_RUNBOOK.md](docs/INSTALL_SERVICE_RUNBOOK.md).
- **Data at rest is not encrypted by the application.** Uploaded files live
  in the local data folder; the PII shield keeps raw identifiers out of the
  search index, not off the disk. Full-disk encryption
  (FileVault / BitLocker) is the recommended at-rest control.
- **The PII shield is not perfect recall.** It is a strong safety net, not a
  guarantee; every output is a draft for review by a qualified lawyer. The
  Confidentiality panel lets users verify masking on their own text.
- **Unsigned builds** show OS "unidentified developer" warnings until code
  signing is enrolled (see [docs/CODE_SIGNING_ENROLLMENT.md](docs/CODE_SIGNING_ENROLLMENT.md)).

## Supported versions

This project is pre-1.x in spirit even at version 1.0.0 — security fixes land
on the default branch and in the latest release. We do not backport to older
tags. Always run the latest release.
