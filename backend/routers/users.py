# routers/users.py — User management for server mode
#
# In desktop mode (single user) this data is mostly unused.
# In server mode (LEGALBOX_MODE=server), multiple lawyers on the same office
# WiFi can have separate profiles and case databases.
#
# Access control is trusted-LAN — no passwords. The firm's network is the
# security boundary, consistent with how shared office file servers work.

import json
import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config

router = APIRouter(prefix="/api/users", tags=["users"])

USERS_PATH = os.path.join(config.DATA_DIR, "users.json")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load() -> dict:
    if os.path.exists(USERS_PATH):
        try:
            return json.load(open(USERS_PATH))
        except Exception:
            pass
    # Bootstrap from current settings
    slug = _slugify(config.DISPLAY_NAME)
    return {
        "current": slug,
        "users": [
            {
                "slug":  slug,
                "name":  config.DISPLAY_NAME,
                "firm":  config.FIRM_NAME,
                "role":  config.USER_ROLE,
                "color": "#0f1f3d",
            }
        ],
    }


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
    json.dump(data, open(USERS_PATH, "w"), indent=2)


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]", "-", name.lower().strip()).strip("-") or "user"
    return re.sub(r"-+", "-", base)


def _unique_slug(base: str, existing: list) -> str:
    existing_slugs = {u["slug"] for u in existing}
    if base not in existing_slugs:
        return base
    i = 2
    while f"{base}-{i}" in existing_slugs:
        i += 1
    return f"{base}-{i}"


AVATAR_COLORS = [
    "#0f1f3d", "#c9a84c", "#2d6a4f", "#8338ec",
    "#e63946", "#457b9d", "#e76f51", "#264653",
]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_users():
    """List all users and the currently active user."""
    data = _load()
    return {
        "current": data.get("current"),
        "users":   data.get("users", []),
    }


class CreateUserBody(BaseModel):
    name: str
    firm: Optional[str] = ""
    role: Optional[str] = "Associate"


@router.post("")
async def create_user(body: CreateUserBody):
    """Create a new user profile (server mode)."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required.")

    data = _load()
    users = data.get("users", [])
    slug = _unique_slug(_slugify(body.name), users)
    color = AVATAR_COLORS[len(users) % len(AVATAR_COLORS)]

    new_user = {
        "slug":  slug,
        "name":  body.name.strip(),
        "firm":  body.firm or "",
        "role":  body.role or "Associate",
        "color": color,
    }
    users.append(new_user)
    data["users"] = users
    _save(data)

    # Create per-user data directory
    os.makedirs(os.path.join(config.DATA_DIR, "users", slug), exist_ok=True)

    return {"user": new_user}


@router.post("/{slug}/switch")
async def switch_user(slug: str):
    """Set the active user (server mode)."""
    data = _load()
    users = data.get("users", [])
    if not any(u["slug"] == slug for u in users):
        raise HTTPException(status_code=404, detail=f"User '{slug}' not found.")

    data["current"] = slug
    _save(data)

    # Update in-memory config so audit logs pick up the new name
    current_user = next(u for u in users if u["slug"] == slug)
    config.DISPLAY_NAME = current_user["name"]
    config.FIRM_NAME    = current_user.get("firm", "")
    config.USER_ROLE    = current_user.get("role", "Associate")

    return {"current": slug}


@router.delete("/{slug}")
async def remove_user(slug: str):
    """Remove a user from the list (data directory is preserved)."""
    data = _load()
    users = data.get("users", [])
    if not any(u["slug"] == slug for u in users):
        raise HTTPException(status_code=404, detail=f"User '{slug}' not found.")
    if len(users) <= 1:
        raise HTTPException(status_code=400, detail="Cannot remove the last user.")

    data["users"] = [u for u in users if u["slug"] != slug]
    if data.get("current") == slug:
        data["current"] = data["users"][0]["slug"]
    _save(data)

    return {"success": True}
