"""IP normalization + hashing utilities (privacy-preserving voter identity)."""
import hashlib
import ipaddress

from django.conf import settings


def normalize_ip(raw_ip: str) -> str:
    """Normalize an IP literal. IPv6 per RFC 5952 (best effort); IPv4 as-is."""
    try:
        ip = ipaddress.ip_address(raw_ip.strip())
    except ValueError:
        return (raw_ip or "").strip().lower()
    if ip.version == 6:
        # /64 prefix guard per spec edge cases, compressed RFC 5952 form.
        prefix = ipaddress.ip_network(f"{ip.compressed}/64", strict=False)
        return str(prefix.network_address) + "/64"
    return str(ip)


def hash_voter_ip(raw_ip: str) -> str:
    """SHA-256 hex of normalized IP + VOTE_HASH_SALT (64 chars)."""
    normalized = normalize_ip(raw_ip or "")
    salt = settings.VOTE_HASH_SALT
    return hashlib.sha256(f"{normalized}{salt}".encode("utf-8")).hexdigest()


def seed_ip_hash(index: int, poll_key: str = "seed") -> str:
    """Deterministic synthetic voter hash using SEED_VOTE_SALT (never VOTE_HASH_SALT)."""
    import os

    salt = os.environ.get("SEED_VOTE_SALT", "dev_deterministic_seed_salt_for_fixtures")
    raw = f"seed-{poll_key}-{index}"
    return hashlib.sha256(f"198.51.100.{index % 254 + 1}{salt}{raw}".encode("utf-8")).hexdigest()


TRUSTED_PROXY_NETWORKS = [
    ipaddress.ip_network(net)
    for net in ("127.0.0.0/8", "::1/128", "172.16.0.0/12", "10.0.0.0/8", "192.168.0.0/16")
]


def _is_trusted_proxy(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str.strip())
    except ValueError:
        return False
    return any(ip in net for net in TRUSTED_PROXY_NETWORKS)


def client_ip(request) -> str:
    """Best-effort, spoof-resistant client IP extraction.

    Only honors X-Forwarded-For when the direct peer (REMOTE_ADDR) is a trusted
    proxy; then picks the rightmost non-trusted IP in the chain so clients
    cannot inject arbitrary addresses through the header.
    """
    remote_addr = request.META.get("REMOTE_ADDR", "") or "0.0.0.0"
    if not _is_trusted_proxy(remote_addr):
        return remote_addr
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if not forwarded:
        return remote_addr
    chain = [part.strip() for part in forwarded.split(",") if part.strip()]
    # Walk from rightmost to leftmost, skipping trusted proxies.
    for candidate in reversed(chain):
        if not _is_trusted_proxy(candidate):
            return candidate
    return remote_addr
