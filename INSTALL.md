# Installing OTG Legal Box

Four steps. One installer. The AI runtime is built in.

> **Already installed?** See [UNINSTALL.md](UNINSTALL.md) — removal is two clicks.
> **Developer / installing from source?** See the "Developer install" section in [README.md](README.md).

---

## What you need

| What | Why |
|------|-----|
| A Mac (macOS 12+) or Windows 10/11 PC | The app runs as a native desktop app |
| 8 GB RAM minimum, 16 GB recommended | The AI model runs on your own computer |
| 20 GB free disk space | For the app + the AI model |
| An internet connection **once**, during setup | To download the AI model. After that, OTG Legal Box runs fully offline. |

---

## Step 1 — Download

Get the installer from
[the latest release](https://github.com/On-The-Ground-AI/legal-box-public/releases/latest)
(or the Download buttons on the website):

| Platform | File |
|----------|------|
| Mac (Apple Silicon — M1/M2/M3/M4) | `OTG-Legal-Box-<version>-mac-arm64.dmg` |
| Windows 10/11 (64-bit) | `OTG-Legal-Box-<version>-win-x64.exe` |

> **Intel Macs are not covered by the prebuilt DMG.** The build runs on an
> Apple Silicon runner, so the bundled backend binary is arm64-only. On an
> Intel Mac, build from source — see [BUILD-GUIDE.md](BUILD-GUIDE.md).

Each release also ships `SHA256SUMS-macOS.txt` and `SHA256SUMS-windows.txt`
if your IT team wants to verify the download:

```bash
# Mac
shasum -a 256 ~/Downloads/OTG-Legal-Box-*-mac-arm64.dmg
```
```powershell
# Windows
Get-FileHash $HOME\Downloads\OTG-Legal-Box-*-win-x64.exe -Algorithm SHA256
```

## Step 2 — Install the app

**Mac:** double-click the `.dmg`, then drag **OTG Legal Box** onto the
**Applications** folder shortcut. Eject the DMG.

**Windows:** double-click the `.exe` and click through the installer. You'll
get a Start Menu entry and a desktop shortcut.

> **Unsigned-build note:** until code signing is in place (see
> [docs/CODE_SIGNING_ENROLLMENT.md](docs/CODE_SIGNING_ENROLLMENT.md)), both
> platforms block the first launch once.
>
> **Mac:** open the app from Applications, dismiss the "Apple could not
> verify…" warning, then go to **System Settings → Privacy & Security**,
> scroll to the bottom and click **Open Anyway**, then confirm. On macOS 12
> and 13 the older right-click → **Open** → **Open** shortcut also works;
> from macOS 14 onwards, use Privacy & Security.
>
> **Windows:** click **More info → Run anyway** on the SmartScreen prompt.
>
> This is one time per machine, not per launch.

## Step 3 — Open it

Launch **OTG Legal Box**. The app starts its own AI runtime automatically —
there is nothing else to install. (If you already use
[Ollama](https://ollama.com), the app detects and uses your existing one.)

## Step 4 — First-launch wizard

A short setup wizard runs once:

1. **Device Check** — reads your RAM/disk/GPU and recommends the right AI
   model size for this machine.
2. **Download AI model** — one-time download (5–20 GB, 5–30 minutes). After
   this the app runs **fully offline forever**.
3. **Profile** — your name, firm, and role (stamped into audit logs).

You land on the Chat screen, ready to work.

---

## Verifying confidentiality (recommended for firms)

Open **Settings → Confidentiality** to see the PII shield and the egress
lock live, and paste any text to preview exactly what the AI would see.
For a full client-facing walkthrough, see
[docs/CONFIDENTIALITY_DEMO.md](docs/CONFIDENTIALITY_DEMO.md).

**Recommended:** enable full-disk encryption — FileVault (Mac:
System Settings → Privacy & Security) or BitLocker (Windows) — so the case
files stored on this computer are also protected at rest if the machine is
lost or stolen.

---

## Troubleshooting

**"OTG Legal Box is damaged and can't be opened" (Mac, unsigned builds)**
macOS says "damaged" when it means "quarantined and not notarized". Clear the
quarantine flag the browser attached to the download:

```bash
xattr -cr "/Applications/OTG Legal Box.app"
```

Then launch it again and use **Open Anyway** as described in Step 2.

**Model download stalls at 0%**
Check your internet connection. Corporate firewalls sometimes block
`registry.ollama.ai` — try from a home network for the one-time download.

**The app opens but shows "backend not reachable"**
Fully quit and relaunch. Logs live at:
- **Mac:** `~/Library/Logs/OTG Legal Box/`
- **Windows:** `%APPDATA%\OTG Legal Box\logs\`

---

## Where your data lives

Everything stays on this computer:
- **Mac:** `~/Library/Application Support/OTG Legal Box/`
- **Windows:** `%APPDATA%\OTG Legal Box\`

After the one-time model download, the app makes no internet connections —
this is enforced in code (see the Confidentiality panel), not just promised.
You can disable Wi-Fi and everything keeps working.

To add another AI model later: click the **model pill in the top bar** →
**Manage models** → **Download** (needs a temporary internet connection).

## Uninstalling

Two steps — see [UNINSTALL.md](UNINSTALL.md).
