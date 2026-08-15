# Code signing enrollment — Apple and Windows

Signing removes the scariest step of installation: the macOS "unidentified
developer" block and the Windows SmartScreen "Windows protected your PC"
warning. This page is the owner's runbook for obtaining both credentials.
Costs and processes as of mid-2026 — verify on the linked official pages.

---

## Part 1 — Apple (macOS): Developer ID + notarization

**What you get:** a *Developer ID Application* certificate to sign the app,
plus Apple **notarization** (an automated malware scan by Apple). A signed +
notarized DMG opens with a normal double-click — no right-click → Open, no
`xattr` commands.

**Cost:** US$99/year (Apple Developer Program).
**Elapsed time:** minutes for individuals; **2 days–2 weeks for
organizations** (D-U-N-S verification), so start early.

### Step 1 — Prerequisites

1. An **Apple ID** with two-factor authentication enabled
   (create at https://account.apple.com).
2. Enrolling as an **organization** (recommended — the installer then shows
   "On The Ground AI" instead of a personal name) additionally requires:
   - **Legal entity name** exactly as registered with ACRA
   - A **D-U-N-S Number** for the entity. Check/request free at
     https://developer.apple.com/enroll/duns-lookup/ — issuing a new number
     takes up to 5 business days.
   - Authority to sign agreements for the company (or have the owner do the
     final step).
   - A website and a work email on the company domain.

### Step 2 — Enroll

1. Go to **https://developer.apple.com/programs/enroll/**
2. Sign in with the Apple ID → choose **Organization** (or Individual)
3. Enter the D-U-N-S number and entity details; Apple may phone/email to
   verify — respond quickly, this is the usual delay
4. Pay the US$99 fee. You're enrolled when the account shows
   "Apple Developer Program — Active"

### Step 3 — Create the Developer ID certificate

On a Mac, signed in to Xcode (or via the web portal):

1. https://developer.apple.com/account → **Certificates, Identifiers &
   Profiles** → Certificates → **+**
2. Choose **Developer ID Application** (this is the one for apps distributed
   OUTSIDE the App Store — not "Apple Distribution")
3. Follow the CSR instructions (Keychain Access → Certificate Assistant →
   Request a Certificate from a Certificate Authority)
4. Download the certificate and double-click to install it into the login
   keychain of the build machine
5. Export it as a `.p12` (with a strong password) for CI use

### Step 4 — Create an App Store Connect API key (for notarization)

1. https://appstoreconnect.apple.com → **Users and Access** →
   **Integrations** → **App Store Connect API** → generate a **Team Key**
   with **Developer** role
2. Note the **Key ID**, **Issuer ID**, and download the `.p8` file (only
   downloadable once — store it in the password manager)

### Step 5 — Wire it into the Legal Box build

Local build (on a Mac with the cert in the keychain):

```bash
# electron/package.json: change  "notarize": false  to:
#   "notarize": { "teamId": "<YOUR_TEAM_ID>" }
export APPLE_API_KEY=/path/to/AuthKey_XXXX.p8
export APPLE_API_KEY_ID=<Key ID>
export APPLE_API_ISSUER=<Issuer ID>
# remove CSC_IDENTITY_AUTO_DISCOVERY=false from scripts/build-app.sh
./scripts/build-app.sh
```

CI (`.github/workflows/build-mac.yml`): add repository secrets
`MAC_CERT_P12` (base64 of the .p12), `MAC_CERT_PASSWORD`, `APPLE_API_KEY_P8`,
`APPLE_API_KEY_ID`, `APPLE_API_ISSUER`, `APPLE_TEAM_ID`, then set
`CSC_LINK`/`CSC_KEY_PASSWORD` env vars on the electron-builder step and drop
`CSC_IDENTITY_AUTO_DISCOVERY: 'false'`. electron-builder handles signing and
notarization automatically once these are present.

**Verify:** on a clean Mac, download the DMG, double-click — it must open
with no Gatekeeper prompt. `spctl -a -vv "/Applications/OTG Legal Box.app"`
should print `accepted · source=Notarized Developer ID`.

Official docs: https://developer.apple.com/support/enrollment/ and
https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution

---

## Part 2 — Windows: Authenticode code signing

**What you get:** removal of the SmartScreen "Run anyway" wall.

**The 2026 reality:** since June 2023, code-signing certificates must live
in hardware (HSM) — you can no longer buy a simple .pfx file. There are two
sensible routes:

### Option A (recommended): Azure Trusted Signing

Microsoft's own signing service — cheapest and simplest for SmartScreen
reputation, and it integrates with CI.

- **Cost:** ~US$9.99/month (Basic tier)
- **Requirement:** an Azure account; for the "public trust" identity your
  organization must be verifiable (ACRA record works; a company must
  generally be ≥3 years old for org validation — younger companies can use
  individual validation)

Steps:

1. Create an Azure account → search **Trusted Signing** in the portal
2. Create a Trusted Signing **account** (region: closest, e.g. Southeast
   Asia), then an **Identity Validation** request (organization or
   individual) — upload ACRA/business documents; validation takes days
3. Create a **Certificate Profile** (Public Trust) once validation passes
4. Sign in CI: use the `azure/trusted-signing-action` GitHub Action (or
   `signtool` with the Trusted Signing dlib) on a `build-win.yml` workflow;
   authenticate with a service-principal secret stored in repo secrets
5. electron-builder: set `win.signtoolOptions` / a custom `sign` hook per
   electron-builder's Azure Trusted Signing docs

Official docs: https://learn.microsoft.com/azure/trusted-signing/

### Option B: OV/EV certificate from a CA (SSL.com, DigiCert, Sectigo, GlobalSign)

- **Cost:** roughly US$250–450/year (OV) or US$350–700/year (EV), typically
  delivered on a USB token or via the CA's cloud-HSM/eSigner service
- **EV certificates get immediate SmartScreen reputation**; OV builds
  reputation over downloads (expect warnings for the first days/weeks)
- Validation: the CA verifies the company against the business registry
  (ACRA) and calls a listed phone number — allow ~1–5 business days
- CI signing with a USB token is painful; prefer the CA's cloud-signing
  option (e.g. SSL.com eSigner) if you go this route

### Wire into the build (either option)

- Add a `build-win.yml` CI workflow (Windows runner) mirroring the Mac one
- electron-builder signs the NSIS installer when signing credentials are
  present; set `verifyUpdateCodeSignature` and the publisher name to match
  the certificate subject exactly
- **Verify:** on a clean Windows 11 machine, download and run the EXE — no
  SmartScreen interruption (EV / Trusted Signing) or a plain publisher
  dialog showing "On The Ground AI"

---

## Recommendation and sequence

1. **Today:** start Apple organization enrollment (D-U-N-S is the long
   pole) and, if the pilot firm has Windows machines, the Azure Trusted
   Signing identity validation — both are waiting games.
2. **When Apple enrollment completes:** create the Developer ID cert + API
   key, flip `notarize` in `electron/package.json`, add the CI secrets —
   the existing build workflow then produces double-click-installable DMGs.
3. **Windows:** only invest if the pilot actually includes Windows
   machines; Trusted Signing at ~$10/month is the default choice.

Budget: **US$99/yr (Apple) + ~US$120/yr (Azure Trusted Signing)** covers
both platforms.
