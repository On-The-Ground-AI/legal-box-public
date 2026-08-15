# test_egress_guard.py — the egress guard turns "nothing leaves the machine"
# from a promise into an enforced property. These tests prove it holds.

import socket

import pytest

import egress_guard


@pytest.fixture(autouse=True)
def guard_installed():
    egress_guard.install()
    assert egress_guard.egress_locked()


def test_loopback_is_allowed():
    # Connecting to a closed loopback port must fail with a *connection*
    # error, never a PermissionError — i.e. the guard let it through.
    s = socket.socket()
    s.settimeout(0.5)
    with pytest.raises(OSError) as exc:
        s.connect(("127.0.0.1", 59999))
    assert not isinstance(exc.value, PermissionError)
    s.close()


def test_non_loopback_ip_is_blocked():
    # The guard must reject the connect BEFORE any network I/O happens, so
    # this raises immediately regardless of whether the host is reachable.
    s = socket.socket()
    with pytest.raises(PermissionError):
        s.connect(("8.8.8.8", 53))
    s.close()


def test_connect_ex_is_also_blocked():
    s = socket.socket()
    with pytest.raises(PermissionError):
        s.connect_ex(("1.1.1.1", 80))
    s.close()


def test_private_lan_ip_is_blocked():
    # Non-loopback private addresses (e.g. another machine on the office LAN)
    # are also blocked unless explicitly allowed via OLLAMA_URL.
    s = socket.socket()
    with pytest.raises(PermissionError):
        s.connect(("192.168.1.50", 8080))
    s.close()
