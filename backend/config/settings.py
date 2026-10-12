"""
Django settings for the community-voting-platform backend.

Reads configuration from environment variables with sane defaults matching
.env.example at the repo root. A tiny .env parser loads repo-root .env if
present (no python-dotenv dependency).
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent      # backend/
REPO_ROOT = BASE_DIR.parent                            # repo root


def _load_dotenv(path: Path) -> None:
    """Minimal .env parser: KEY=VALUE lines, '#' comments, optional quotes."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_dotenv(REPO_ROOT / ".env")


def env(name, default=None):
    return os.environ.get(name, default)


def env_list(name, default=""):
    raw = env(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --- Path setup: allow `apps.polls` style imports with manage.py in backend/ ---
import sys  # noqa: E402

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# --- Core ---
SECRET_KEY = env("SECRET_KEY", "dev-insecure-secret-key")
DEBUG = env("DEBUG", "true").strip().lower() in ("1", "true", "yes", "on")
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1,backend")

# --- Production startup assertions (fail fast on insecure config) ---
if not DEBUG:
    from django.core.exceptions import ImproperlyConfigured  # noqa: E402

    if SECRET_KEY == "dev-insecure-secret-key":
        raise ImproperlyConfigured(
            "SECRET_KEY is still the insecure development default; "
            "set a strong SECRET_KEY when DEBUG=false."
        )
    if not os.environ.get("STAFF_API_TOKEN", "").strip():
        raise ImproperlyConfigured(
            "STAFF_API_TOKEN must be set when DEBUG=false so staff bearer "
            "access is available alongside session authentication."
        )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.core",
    "apps.polls",
    "apps.results",
    "apps.moderation",
    "management",  # standalone management/commands package (seed_polls, init_db)
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.RequestIdMiddleware",
    "apps.core.middleware.RequestTimingMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --- Database ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "voting_db"),
        "USER": env("POSTGRES_USER", "voting_user"),
        "PASSWORD": env("POSTGRES_PASSWORD", "voting_password"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5402"),
    }
}

# Support a full DATABASE_URL if provided (simple postgres:// parsing).
_db_url = env("DATABASE_URL")
if _db_url:
    from urllib.parse import urlsplit, parse_qs

    parts = urlsplit(_db_url)
    db = DATABASES["default"]
    if parts.hostname:
        db["HOST"] = parts.hostname
    if parts.port:
        db["PORT"] = str(parts.port)
    if parts.username:
        db["USER"] = parts.username
    if parts.password:
        db["PASSWORD"] = parts.password
    if parts.path.lstrip("/"):
        db["NAME"] = parts.path.lstrip("/")
    query = parse_qs(parts.query)
    sslmode = query.get("sslmode", [None])[0]
    if sslmode and db["HOST"] not in ("localhost", "127.0.0.1", "::1", "db", "postgres"):
        # Local docker Postgres does not support SSL; only require it remotely.
        db["OPTIONS"] = {"sslmode": sslmode}

# --- Auth / passwords ---
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

# --- i18n / tz ---
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# --- Static ---
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# --- Production hardening (applied only when DEBUG=false) ---
if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = "DENY"
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # Do NOT force HTTPS behind the local docker nginx proxy; enable in real
    # deployments via env (SECURE_SSL_REDIRECT=true) once TLS terminates.
    SECURE_SSL_REDIRECT = env("SECURE_SSL_REDIRECT", "false").strip().lower() in ("1", "true", "yes", "on")
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = SECURE_SSL_REDIRECT
    CSRF_COOKIE_SECURE = SECURE_SSL_REDIRECT

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS ---
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ORIGINS", "http://localhost:5102,http://127.0.0.1:5102"
) or ["http://localhost:5102", "http://127.0.0.1:5102"]
CORS_ALLOW_CREDENTIALS = True
CORS_PREFLIGHT_MAX_AGE = 3600
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-request-id",
    "idempotency-key",
]

# --- Domain salts ---
TRUSTED_PROXIES = env("TRUSTED_PROXIES", "")  # comma-separated CIDRs, e.g. 172.16.0.0/12
VOTE_HASH_SALT = env("VOTE_HASH_SALT", "dev_pepper_salt_for_voter_ip_hashing")
SEED_VOTE_SALT = env("SEED_VOTE_SALT", "dev_deterministic_seed_salt_for_fixtures")
_raw_staff_token = os.environ.get("STAFF_API_TOKEN", "").strip()
_debug_mode = os.environ.get("DEBUG", "").strip().lower() in ("1", "true", "yes")
if _raw_staff_token:
    STAFF_API_TOKEN = _raw_staff_token
elif _debug_mode:
    # Dev convenience only; never enabled in production (DEBUG=false).
    STAFF_API_TOKEN = "dev-staff-token"
else:
    STAFF_API_TOKEN = ""
    import warnings  # noqa: E402

    warnings.warn(
        "STAFF_API_TOKEN is not set; staff bearer-token access is disabled. "
        "Session staff authentication remains available.",
        RuntimeWarning,
    )

# --- DRF ---
REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "apps.core.rendering.EnvelopeRenderer",
        "djangorestframework_camel_case.render.CamelCaseJSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "djangorestframework_camel_case.parser.CamelCaseJSONParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.rendering.EnvelopePagination",
    "PAGE_SIZE": 12,
    "EXCEPTION_HANDLER": "apps.core.rendering.envelope_exception_handler",
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "vote": "10/min",
        "results": "120/min",
        "telemetry": "5/min",
    },
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}

# --- Logging with X-Request-Id correlation ---
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "format": '{"level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
        },
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
