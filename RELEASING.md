# Releasing OTG Legal Box

How a version number becomes two downloadable installers on the website.

The website's **Download for Mac** / **Download for Windows** buttons resolve
to assets on the repo's *latest GitHub Release*. No release, no download —
that is the whole dependency chain. Everything below exists to produce that
release.

---

## The mechanism

```
git tag v1.2.3  ──push──▶  build-mac.yml     ──▶  .dmg  ─┐
                           build-windows.yml ──▶  .exe  ─┴─▶ GitHub Release
                                                                   │
                                              landing/index.html ◀──┘
                                              (reads /releases/latest
                                               via the GitHub API and
                                               rewrites the buttons)
```

Both workflows run on **any** push that touches the app, but the
`Publish GitHub Release` step is gated on `startsWith(github.ref, 'refs/tags/v')`.
**A tag is what publishes.** Pushing to `public-main` only produces Actions
artifacts, which expire after 14 days and are not publicly downloadable.

---

## Cutting a release

### 1. Bump the version

`electron/package.json` → `"version"`. This value lands in every filename
(`OTG-Legal-Box-1.2.3-mac-arm64.dmg`), so it must change for every release —
re-tagging the same version produces colliding asset names.

Update `CHANGELOG.md` in the same commit.

### 2. Commit and push to the default branch

```bash
git add electron/package.json CHANGELOG.md
git commit -m "chore: release v1.2.3"
git push origin public-main
```

### 3. Tag and push the tag

```bash
git tag v1.2.3
git push origin v1.2.3
```

The tag is a separate push. `git push` alone does **not** send tags, and this
is the single most common reason a release never appears.

### 4. Watch both workflows

**Actions** tab → "Build macOS DMG" and "Build Windows EXE". Roughly 10–15
minutes each; they run in parallel and both attach to the same release.

### 5. Verify the release page

<https://github.com/On-The-Ground-AI/legal-box-public/releases/latest> should
list:

| Asset | What it is |
|-------|-----------|
| `OTG-Legal-Box-<v>-mac-arm64.dmg` | Mac installer (what the button links to) |
| `OTG-Legal-Box-<v>-mac-arm64.zip` | Same app, consumed by electron-updater |
| `OTG-Legal-Box-<v>-win-x64.exe` | Windows installer (what the button links to) |
| `latest-mac.yml` / `latest.yml` | Auto-update feeds |
| `SHA256SUMS-macOS.txt` / `SHA256SUMS-windows.txt` | Download verification |

### 6. Check the website

The buttons pick up the new release automatically — they query the GitHub API
on page load. No Vercel redeploy is needed. Hard-refresh and confirm the
buttons show the new version and a file size.

---

## Prerequisites (one-time, per repository)

These are the settings that made the first attempt fail. Confirm them before
tagging.

### Actions must be allowed to write releases

`permissions: contents: write` is declared in both workflow files. It is
necessary but **not sufficient** — an org- or repo-level default can still
cap the token at read-only:

**Settings → Actions → General → Workflow permissions** must be
**Read and write permissions**.

> Without this the build succeeds, uploads a 2 GB artifact, and then fails on
> the last step with `403 Resource not accessible by integration`. That is
> exactly what happened to `v1.0.0`: both installers built correctly and were
> simply never published.

### The tag must be pushed to this repository

Tags created locally and never pushed trigger nothing.

---

## Recovering a failed release

**The build succeeded but the release step failed** (permissions fixed after
the fact): re-run the failed jobs from the Actions run page — "Re-run failed
jobs". The tag is unchanged, so it republishes to the same version.

**The tag is already published and you need to replace the assets:** delete
the release *and* the tag, then re-tag.

```bash
git push --delete origin v1.2.3
git tag -d v1.2.3
# delete the release in the GitHub UI too, then repeat steps 3–5
```

Prefer bumping to a new patch version over reusing a tag — anyone who already
downloaded the old asset keeps a file whose checksum no longer matches.

---

## What users get, and what still blocks them

Both installers are **unsigned**. They install and run correctly, but each
platform interrupts the first launch once:

- **macOS** — the app is *ad-hoc* signed by `electron/build/afterPack.js`.
  That is what allows an arm64 build with no Developer ID to launch at all;
  without any signature the kernel refuses to execute it and macOS reports
  the app as "damaged". Gatekeeper still requires a one-time
  **System Settings → Privacy & Security → Open Anyway**.
- **Windows** — SmartScreen shows "Windows protected your PC" until the
  installer builds download reputation. **More info → Run anyway**.

Both prompts disappear once code signing is in place. The enrollment runbook,
with costs and lead times, is
[docs/CODE_SIGNING_ENROLLMENT.md](docs/CODE_SIGNING_ENROLLMENT.md) — Apple's
D-U-N-S verification is the long pole, so start it well before a release you
want to be friction-free.

**Intel Macs are not covered.** The macOS job runs on an Apple Silicon runner
and PyInstaller compiles an arm64-only backend, so `mac.target` is arm64-only
by design — an x64 DMG would ship a backend that cannot run. Intel users build
from source per [BUILD-GUIDE.md](BUILD-GUIDE.md).

---

## Release checklist

- [ ] `electron/package.json` version bumped
- [ ] `CHANGELOG.md` updated
- [ ] **Settings → Actions → General** set to *Read and write permissions*
- [ ] Commit pushed to `public-main`
- [ ] Tag pushed (`git push origin vX.Y.Z`)
- [ ] Both workflows green
- [ ] Release page lists the `.dmg`, the `.exe`, and both checksum files
- [ ] Website buttons show the new version
- [ ] Installed and launched the DMG on a Mac that has never run the app
- [ ] Installed and launched the EXE on a clean Windows machine
