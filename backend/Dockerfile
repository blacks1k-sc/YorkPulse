# =============================================================================
# YorkPulse Backend — Dockerfile
# =============================================================================
# WHY python:3.12-slim (not python:3.12 full):
#   Full image is ~1GB. Slim is ~130MB. Removes build tools, docs, unused libs.
#   Smaller image = faster ECS task pulls, smaller CVE surface for Trivy.
#
# WHY NOT Alpine:
#   Alpine uses musl libc. asyncpg, cryptography, and grpcio (from google-
#   generativeai) ship pre-built manylinux wheels that require glibc. Alpine
#   would force compiling from source — slower builds, more system deps.
#   python:3.12-slim is Debian-based (glibc) — all pre-built wheels work.
# =============================================================================
FROM python:3.12-slim

# -----------------------------------------------------------------------------
# SYSTEM DEPENDENCIES
# libpq5 = PostgreSQL client library required by asyncpg at runtime.
# We use libpq5 (runtime only), NOT libpq-dev (which adds compile headers
# and gcc — unnecessary since all our packages ship pre-built wheels).
# gcc is explicitly NOT installed — it's a build tool with no runtime purpose
# and it dramatically increases image size and CVE surface area.
# rm -rf /var/lib/apt/lists/* removes the apt package index from this layer,
# keeping the layer as small as possible.
# -----------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------------------------------------------------------
# NON-ROOT USER — created BEFORE copying any files
# Running as root inside a container is a Checkov HIGH finding and a real
# security risk. If an attacker escapes the container, they land as root.
# --system: no login shell, no cron, no unnecessary privileges
# --no-create-home: no home directory overhead
# We create the group explicitly so the GID is stable and predictable.
# -----------------------------------------------------------------------------
RUN groupadd --system appuser && useradd --system --gid appuser --no-create-home appuser

# -----------------------------------------------------------------------------
# WORKING DIRECTORY
# All subsequent COPY, RUN, CMD instructions operate relative to /app.
# This is also where uvicorn resolves the 'app.main:app' module path.
# -----------------------------------------------------------------------------
WORKDIR /app

# -----------------------------------------------------------------------------
# LAYER CACHING — copy requirements.txt FIRST, pip install, THEN copy code.
#
# Docker caches each instruction as an image layer. When you rebuild:
# - If requirements.txt hasn't changed → Docker reuses the pip layer (fast)
# - If app code changed but requirements didn't → pip layer still reused
# - Only if requirements.txt changes does pip re-run (slow, ~3-5 min)
#
# If you did COPY . . first then pip install, every single code change would
# invalidate the pip cache and force a full reinstall. Never do that.
# -----------------------------------------------------------------------------
COPY requirements.txt .

# Upgrade pip first to get latest security patches and resolver improvements.
# --no-cache-dir: don't store pip's download cache inside the image layer.
# On a laptop, pip caches wheels for future installs. Inside Docker, the layer
# IS the cache — we never reinstall in this container. Cache wastes ~100-200MB.
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# -----------------------------------------------------------------------------
# APPLICATION CODE
# Copy only the app/ subdirectory — not the entire backend/ tree.
# .dockerignore (same directory as this Dockerfile) excludes:
#   .env, .env.*, __pycache__, venv/, .venv/, *.pyc, .git, tests/, etc.
# Copying the whole tree would risk baking .env secrets into the image.
# -----------------------------------------------------------------------------
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY entrypoint.sh .

# -----------------------------------------------------------------------------
# OWNERSHIP
# Give appuser ownership of /app so it can write temp files if needed.
# Done before USER switch — chown requires root permissions.
# Single RUN keeps this as one layer.
# -----------------------------------------------------------------------------
RUN chown -R appuser:appuser /app \
    && chmod +x /app/entrypoint.sh

# -----------------------------------------------------------------------------
# SWITCH TO NON-ROOT
# Every instruction after this line runs as appuser (UID non-0).
# The container entrypoint process (uvicorn) also runs as appuser.
# -----------------------------------------------------------------------------
USER appuser

# -----------------------------------------------------------------------------
# EXPOSE
# Documents that the application binds to port 8000 inside the container.
# This does NOT publish the port to the host — that's done at runtime
# with -p 8000:8000 locally, or via the ECS task definition port mapping.
# The ALB target group health checks also use this port.
# Using a hardcoded port (not $PORT variable) — ECS doesn't use $PORT;
# the port is declared in the task definition, not the container env.
# -----------------------------------------------------------------------------
EXPOSE 8000

# -----------------------------------------------------------------------------
# HEALTH CHECK
# Docker and ECS run this command every 30 seconds.
# 3 consecutive failures → container marked unhealthy → ECS stops routing
# traffic to it and starts a replacement task automatically.
#
# CRITICAL PATH: /api/v1/health — NOT /health.
# The health router is registered with prefix=settings.api_prefix ("/api/v1")
# in main.py. The full URL is /api/v1/health. /health returns a 404.
#
# Using Python's built-in urllib — NOT curl.
# curl is not installed in python:3.12-slim. Installing it just for health
# checks adds an unnecessary package with its own CVE history.
# urllib is part of Python's standard library — zero extra dependencies.
#
# --start-period=40s: don't count failures during the first 40 seconds.
# The app needs startup time to: import all modules, build the DB connection
# pool (asyncpg), connect Redis, and run lifespan() startup code.
# Without start-period, ECS kills the container before it finishes booting.
# -----------------------------------------------------------------------------
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=40s \
    --retries=3 \
    CMD python -c \
        "import urllib.request, sys; \
         urllib.request.urlopen('http://localhost:8000/api/v1/health', timeout=9); \
         sys.exit(0)"

# -----------------------------------------------------------------------------
# CMD — start the application
#
# --host 0.0.0.0  CRITICAL: binds uvicorn to ALL network interfaces inside
#                 the container. Without this, uvicorn defaults to 127.0.0.1
#                 (loopback only) — the ALB health checker and all external
#                 traffic would get "connection refused". Always 0.0.0.0.
#
# --port 8000     Must match EXPOSE and the ECS task definition port mapping.
#
# --workers 1     One process per container. ECS scales by adding more tasks,
#                 not more workers per task. Multiple workers = unpredictable
#                 memory sizing and broken graceful shutdown on Fargate.
#
# --log-level info Logs go to stdout → ECS ships them to CloudWatch Logs.
#                 Never log to a file — logs vanish when the container stops.
#
# EXEC FORM (JSON array) not shell form ("uvicorn ..."):
# Exec form runs uvicorn as PID 1 directly. It receives SIGTERM from ECS
# during task stops and shuts down gracefully (finishes in-flight requests).
# Shell form wraps in /bin/sh -c — the shell intercepts SIGTERM but never
# forwards it to uvicorn, causing a 30-second forced kill on every deploy.
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# ENTRYPOINT + CMD — exec form so uvicorn becomes PID 1 and receives SIGTERM.
#
# ENTRYPOINT runs entrypoint.sh which:
#   1. Runs `alembic upgrade head` (idempotent — safe to run every start)
#   2. exec "$@" — replaces the shell with CMD (uvicorn becomes PID 1)
#
# CMD provides the default arguments passed to ENTRYPOINT.
# Exec form (JSON array) — no shell wrapper, uvicorn receives SIGTERM
# directly and shuts down gracefully on ECS task stop / rolling deploy.
# -----------------------------------------------------------------------------
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--log-level", "info"]
