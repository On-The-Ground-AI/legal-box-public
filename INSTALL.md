# Installing OTG Legal Box

Three steps. One installer. The AI runtime is built in.

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

## Step 1 — Install the app

**Mac:** double-click the `OTG-Legal-Box-<version>-mac-arm64.dmg` (Apple
Silicon) or `…-mac-x64.dmg` (Intel), then drag **OTG Legal Box** onto the
**Applications** folder shortcut. Eject the DMG.

**Windows:** double-click `OTG-Legal-Box-Setup-<version>.exe` and click
through the installer. You'll get a Start Menu entry and a desktop shortcut.

> **Unsigned-build note:** until code signing is in place, macOS will warn
> that the app is from an unidentified developer — right-click the app →
> **Open** → **Open** (one time only). On Windows, click **More info → Run
> anyway** on the SmartScreen prompt. Signed builds remove this step.

## Step 2 — Open it

Launch **OTG Legal Box**. The app starts its own AI runtime automatically —
there is nothing else to install. (If you already use
[Ollama](https://ollama.com), the app detects and uses your existing one.)

## Step 3 — First-launch wizard

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
Run `xattr -cr "/Applications/OTG Legal Box.app"` in Terminal, then
right-click → Open.

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
