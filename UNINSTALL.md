# Uninstalling OTG Legal Box

Removal is now two steps on any platform. Nothing Legal Box creates is left
behind.

---

## Step 1 — Erase your data (inside the app)

1. Open **OTG Legal Box → Settings → About**
2. Click **Remove all data…** and type `ERASE` to confirm

This permanently deletes every case you uploaded, the search index, chat
settings, and audit logs from this computer.

> Skip this step if you plan to reinstall later and want to keep your data —
> reinstalling over existing data works fine.

## Step 2 — Remove the app

**Mac:** quit the app, then drag **OTG Legal Box** from Applications to the
Trash.

**Windows:** **Settings → Apps → Installed apps → OTG Legal Box → Uninstall**.

That's it.

---

## Optional — remove the AI models and Ollama

The downloaded AI model files (5–20 GB) are stored by Ollama and survive the
app uninstall so other Ollama apps can keep using them. To remove them too,
run the bundled script:

**Mac / Linux:**
```bash
./scripts/uninstall.sh        # interactive; also covers steps 1–2 leftovers
```

**Windows:** double-click `scripts\uninstall.bat`.

If you only installed Ollama for Legal Box, you can then remove Ollama itself
(Mac: drag from Applications; Windows: Settings → Apps → Ollama → Uninstall)
and delete `~/.ollama`.

---

## Manual paths (for IT administrators)

Everything the app writes lives here:

| Platform | Paths |
|---|---|
| macOS | `~/Library/Application Support/OTG Legal Box/`, `~/Library/Logs/OTG Legal Box/`, `~/Library/Preferences/ai.ontheground.legalbox.plist` |
| Windows | `%APPDATA%\OTG Legal Box\`, `%LOCALAPPDATA%\OTG Legal Box\` |
| Models | `~/.ollama/models` (or the app's own data folder when the bundled Ollama runtime is used) |

The app runs entirely as an unprivileged user-space process — no services,
drivers, or kernel extensions — so a clean removal is always possible.
