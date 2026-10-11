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


def client_ip(request) -> str:
    """Best-effort client IP extraction."""
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "") or "0.0.0.0"
