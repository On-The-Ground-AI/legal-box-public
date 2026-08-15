# egress_guard.py — makes "nothing leaves the machine" an enforced property,
# not a promise.
#
# Once installed, any attempt by this backend process to open a network
# connection to a non-loopback address raises PermissionError. The backend's
# only legitimate peer is Ollama (localhost); even model downloads go
# backend → local Ollama, and it is Ollama's own process that talks to the
# internet. So the guard can be unconditional for the backend.
#
# The one sanctioned exception: if OLLAMA_URL is explicitly configured to a
# non-loopback host (a firm running Ollama on a separate machine), that host
# alone is allowed.
#
# Escape hatch for development only: LEGALBOX_ALLOW_EGRESS=1 skips
# installation — and /api/health then reports egress_locked: false so the
# downgrade is visible.

import ipaddress
import os
import socket
from urllib.parse import urlparse

_installed = False
_allowed_hosts = set()   # extra allowed IPs (resolved from OLLAMA_URL)


def _is_loopback(host) -> bool:
    if isinstance(host, bytes):
        try:
            host = host.decode()
        except Exception:
            return False
    if host in ("localhost", ""):
        return True
    try:
        return ipaddress.ip_address(host.split("%")[0]).is_loopback
    except ValueError:
        return False


def _resolve_ollama_exception() -> None:
    """If OLLAMA_URL points off-box (explicit user config), allow that host."""
    url = os.environ.get("OLLAMA_URL", "")
    if not url:
        return
    host = urlparse(url).hostname or ""
    if not host or _is_loopback(host):
        return
    try:
        for info in socket.getaddrinfo(host, None):
            _allowed_hosts.add(info[4][0])
    except Exception:
        pass


def install() -> None:
    """Patch socket.socket.connect (and connect_ex) with a loopback-only gate."""
    global _installed
    if _installed:
        return
    if os.environ.get("LEGALBOX_ALLOW_EGRESS") == "1":
        return  # dev escape hatch; surfaced via egress_locked() = False

    _resolve_ollama_exception()

    original_connect = socket.socket.connect
    original_connect_ex = socket.socket.connect_ex

    def _check(address):
        # AF_UNIX passes a path string — always local, always fine
        if isinstance(address, (str, bytes)):
            return
        host = address[0]
        if _is_loopback(host) or host in _allowed_hosts:
            return
        raise PermissionError(
            f"Egress blocked by Legal Box confidentiality guard: "
            f"refusing outbound connection to {host!r}. "
            f"All processing is local-only by design."
        )

    def guarded_connect(self, address):
        _check(address)
        return original_connect(self, address)

    def guarded_connect_ex(self, address):
        _check(address)
        return original_connect_ex(self, address)

    socket.socket.connect = guarded_connect
    socket.socket.connect_ex = guarded_connect_ex
    _installed = True


def egress_locked() -> bool:
    """True when the loopback-only guard is active (reported in /api/health)."""
    return _installed
