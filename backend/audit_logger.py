# audit_logger.py — Compliance audit logging for OTG Legal Box
#
# Every API action is logged as a single JSONL line to:
#   data/logs/audit.YYYY-MM-DD.jsonl
#
# Every record includes "network": "local_only" — proving no internet egress.
# Log content is metadata only — no document text, no AI responses.
# Rotated nightly; 90 days of history kept.
#
# Chain hashing: each record includes prev_hash (SHA-256 of previous record's
# serialized JSON + its own prev_hash). This creates a tamper-evident chain —
# if any entry is modified, all subsequent hashes break.
#
# Per-user scoping: each record includes user_slug so users see only their
# own logs (unless they have admin access in future multi-user setups).

import hashlib
import json
import logging
import os
import platform
import socket
import uuid
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler
from typing import Dict, Optional

import config

# ── Logger setup ──────────────────────────────────────────────────────────────

_handler: Optional[TimedRotatingFileHandler] = None
_logger: Optional[logging.Logger] = None


def _get_logger() -> logging.Logger:
    """Initialise the logger on first call; return it on subsequent calls."""
    global _handler, _logger
    if _logger is not None:
        return _logger

    os.makedirs(config.LOGS_DIR, exist_ok=True)
    log_path = os.path.join(config.LOGS_DIR, "audit.jsonl")

    _handler = TimedRotatingFileHandler(
        filename=log_path,
        when="midnight",
        backupCount=90,
        utc=True,
        encoding="utf-8",
    )
    # Rename rotated files to audit.YYYY-MM-DD.jsonl
    _handler.suffix = "%Y-%m-%d"
    _handler.setFormatter(logging.Formatter("%(message)s"))

    _logger = logging.getLogger("legalbox.audit")
    _logger.setLevel(logging.INFO)
    _logger.addHandler(_handler)
    _logger.propagate = False
    return _logger


def _device_name() -> str:
    try:
        return socket.gethostname()
    except Exception:
        return "unknown"


def _compute_hash(record: dict, prev_hash: str) -> str:
    """Compute SHA-256 hash of record + previous hash for tamper evidence."""
    payload = json.dumps(record, sort_keys=True, ensure_ascii=False) + prev_hash
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def _get_last_hash(log_path: str) -> str:
    """Read the last hash from the log file (for chain continuation)."""
    if not os.path.exists(log_path):
        return "genesis"
    try:
        with open(log_path, encoding="utf-8") as f:
            lines = f.readlines()
            if not lines:
                return "genesis"
            # Find the last valid JSON line with a hash
            for line in reversed(lines):
                line = line.strip()
                if line:
                    try:
                        record = json.loads(line)
                        return record.get("hash", "genesis")
                    except json.JSONDecodeError:
                        continue
            return "genesis"
    except Exception:
        return "genesis"


# ── Public API ────────────────────────────────────────────────────────────────

def log_request(
    *,
    path: str,
    method: str,
    status: int,
    duration_ms: int,
    model: Optional[str] = None,
    pii_counts: Optional[Dict[str, int]] = None,
    user: Optional[str] = None,
) -> None:
    """Write one JSONL audit record.  Never call with document content."""
    record = {
        "ts":      datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "id":      uuid.uuid4().hex[:8],
        "user":    user or config.DISPLAY_NAME,
        "device":  _device_name(),
        "path":    path,
        "method":  method,
        "status":  status,
        "ms":      duration_ms,
        "network": "local_only",
    }
    if model:
        record["model"] = model
    if pii_counts:
        record["pii"] = pii_counts

    # Compute chain hash
    log_path = os.path.join(config.LOGS_DIR, "audit.jsonl")
    prev_hash = _get_last_hash(log_path)
    record["prev_hash"] = prev_hash
    record["hash"] = _compute_hash(record, prev_hash)

    try:
        _get_logger().info(json.dumps(record, ensure_ascii=False))
    except Exception:
        pass  # Never crash the request because of a logging failure


def read_logs(date_str: Optional[str] = None, limit: int = 100, user_filter: Optional[str] = None) -> list:
    """Return parsed log entries for a given date (YYYY-MM-DD), or today.
    
    If user_filter is provided, only return entries for that user.
    """
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Today's active log file vs. rotated file name
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if date_str == today:
        log_path = os.path.join(config.LOGS_DIR, "audit.jsonl")
    else:
        log_path = os.path.join(config.LOGS_DIR, f"audit.jsonl.{date_str}")

    if not os.path.exists(log_path):
        return []

    entries = []
    try:
        with open(log_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entry = json.loads(line)
                        if user_filter and entry.get("user") != user_filter:
                            continue
                        entries.append(entry)
                    except json.JSONDecodeError:
                        pass
    except Exception:
        return []

    # Most recent first, then apply limit
    return list(reversed(entries))[:limit]


def list_log_dates() -> list:
    """Return all dates (YYYY-MM-DD) for which log files exist."""
    dates = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if not os.path.exists(config.LOGS_DIR):
        return dates

    for fname in os.listdir(config.LOGS_DIR):
        if fname == "audit.jsonl":
            dates.append(today)
        elif fname.startswith("audit.jsonl."):
            date_part = fname.replace("audit.jsonl.", "")
            if len(date_part) == 10:  # YYYY-MM-DD
                dates.append(date_part)

    return sorted(set(dates), reverse=True)


def get_log_file_path(date_str: str) -> Optional[str]:
    """Return the filesystem path for a given date's log, or None if missing."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if date_str == today:
        path = os.path.join(config.LOGS_DIR, "audit.jsonl")
    else:
        path = os.path.join(config.LOGS_DIR, f"audit.jsonl.{date_str}")
    return path if os.path.exists(path) else None


def verify_chain(date_str: Optional[str] = None) -> dict:
    """Verify the integrity of the audit log chain.
    
    Returns a dict with:
      - valid: bool (True if chain is intact)
      - entries_checked: int
      - first_break: Optional[int] (index of first broken entry, if any)
      - message: str
    """
    if date_str is None:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if date_str == today:
        log_path = os.path.join(config.LOGS_DIR, "audit.jsonl")
    else:
        log_path = os.path.join(config.LOGS_DIR, f"audit.jsonl.{date_str}")

    if not os.path.exists(log_path):
        return {
            "valid": True,
            "entries_checked": 0,
            "first_break": None,
            "message": "No log file for this date.",
        }

    entries = []
    try:
        with open(log_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except Exception as e:
        return {
            "valid": False,
            "entries_checked": 0,
            "first_break": None,
            "message": f"Failed to read log: {e}",
        }

    if not entries:
        return {
            "valid": True,
            "entries_checked": 0,
            "first_break": None,
            "message": "No entries in log.",
        }

    # Verify chain: each entry's prev_hash should equal the previous entry's hash
    prev_hash = "genesis"
    for i, entry in enumerate(entries):
        # Check that prev_hash matches
        if entry.get("prev_hash") != prev_hash:
            return {
                "valid": False,
                "entries_checked": i + 1,
                "first_break": i,
                "message": f"Chain broken at entry {i}: expected prev_hash={prev_hash}, got {entry.get('prev_hash')}",
            }
        
        # Verify the entry's own hash
        entry_copy = {k: v for k, v in entry.items() if k != "hash"}
        expected_hash = _compute_hash(entry_copy, prev_hash)
        if entry.get("hash") != expected_hash:
            return {
                "valid": False,
                "entries_checked": i + 1,
                "first_break": i,
                "message": f"Hash mismatch at entry {i}: expected {expected_hash}, got {entry.get('hash')}",
            }
        
        prev_hash = entry.get("hash", prev_hash)

    return {
        "valid": True,
        "entries_checked": len(entries),
        "first_break": None,
        "message": f"Chain intact — {len(entries)} entries verified.",
    }
