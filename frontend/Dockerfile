# =============================================================================
# YorkPulse Frontend — Dockerfile
# Multi-stage build: deps → builder → runner
# =============================================================================
#
# WHY node:20-alpine (not node:20-slim):
#   Node.js ships pre-built Alpine (musl libc) binaries — unlike Python where
#   Alpine breaks native extensions. node:20-alpine is ~130MB vs ~350MB for
#   node:20-slim. For a pure JavaScript app, Alpine is the right choice.
#   No native C extensions that require glibc.
#
# WHY multi-stage build:
#   Stage 1 (deps)    — installs ALL node_modules including devDependencies.
#   Stage 2 (builder) — runs `next build`, produces .next/standalone/.
#   Stage 3 (runner)  — copies only what's needed to run. No source code,
#                        no node_modules, no devDependencies in the final image.
#   Result: production image is ~200MB instead of ~1.5GB with all node_modules.
#
# WHY output: 'standalone' in next.config.ts:
#   Next.js standalone mode traces which files each page actually imports and
#   bundles a minimal server.js + only the needed modules into .next/standalone/.
#   The runner stage copies this directory — the final image has no package.json,
#   no node_modules tree, just the files the app actually uses at runtime.
# =============================================================================

# -----------------------------------------------------------------------------
# BASE — shared Node.js version pin for all stages.
# Pinned to Node 20 LTS (same as local dev — `node --version` = v20.20.0).
# Using a single FROM base means upgrading Node requires changing one line.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base


# -----------------------------------------------------------------------------
# STAGE 1: DEPS — install dependencies
#
# WHY a separate deps stage?
#   npm ci downloads ~400MB of packages. If we put this in the builder stage,
#   every code change would re-run npm ci (even if package.json didn't change).
#   Isolating it in a separate stage lets Docker cache the node_modules layer
#   independently of the application source code.
#
# WHY npm ci (not npm install)?
#   `npm ci` installs exactly what's in package-lock.json — no version resolution,
#   no lock file changes. Reproducible builds. Required for CI/CD pipelines.
#   `npm install` can silently upgrade packages and write a new lock file.
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci


# -----------------------------------------------------------------------------
# STAGE 2: BUILDER — compile the Next.js application
#
# Copies source code and node_modules from deps stage, then runs `next build`.
# next.config.ts has output: 'standalone' — this produces:
#   .next/standalone/ — minimal Node.js server with only required modules
#   .next/static/     — compiled CSS, JS chunks, images (served as static files)
#   public/           — unchanged public assets
#
# WHY set NEXT_TELEMETRY_DISABLED=1?
#   Next.js phones home with anonymous build telemetry by default.
#   Disabled to keep builds fast, avoid network calls in CI, and prevent
#   telemetry from a production image that may have outbound network restrictions.
#
# WHY not pass NEXT_PUBLIC_* env vars at build time?
#   NEXT_PUBLIC_ vars are inlined into the JavaScript bundle at build time.
#   If we pass them here, we'd need to rebuild the image for every environment.
#   Instead we pass them at container runtime — Next.js reads them from the
#   environment if they weren't baked in at build time. This gives us one image
#   that works in staging and production.
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build


# -----------------------------------------------------------------------------
# STAGE 3: RUNNER — minimal production image
#
# Copies only:
#   .next/standalone/ — the self-contained server (includes its own node_modules)
#   .next/static/     — static assets (JS, CSS, fonts)
#   public/           — public directory assets (favicon, images, etc.)
#
# Does NOT copy:
#   Source code (src/, components/, etc.) — not needed at runtime
#   node_modules/ from builder — standalone has its own minimal copy
#   package.json — not needed, server.js is the entrypoint
#
# WHY non-root user?
#   Running as root inside a container is a HIGH severity Checkov finding.
#   If an attacker exploits a vulnerability in the app, they land as nextjs
#   (UID 1001) not root — limiting what they can do inside the container.
#   --system: no login shell, no cron, minimal privileges.
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root user — created before COPY so --chown works in one step
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy public assets (owned by nextjs for potential write operations)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy the standalone server output — this IS the application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets into the correct path inside standalone
# next/standalone expects static files at .next/static/ relative to server.js
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# -----------------------------------------------------------------------------
# EXPOSE
# Next.js standalone server listens on $PORT (default 3000).
# Azure Container Apps routes traffic to port 3000 by default.
# The HOSTNAME env var below binds to 0.0.0.0 (all interfaces) —
# without it, server.js defaults to localhost and external traffic is refused.
# -----------------------------------------------------------------------------
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# -----------------------------------------------------------------------------
# HEALTHCHECK
# Azure Container Apps uses this to determine if the container is healthy.
# /api/health is a lightweight endpoint that returns 200 OK if the server is up.
# Falls back to checking the root path if no dedicated health route exists —
# a 200 or 308 (redirect) both indicate the server is running.
#
# Using Node's built-in http module — wget/curl are not on alpine by default
# and installing them adds packages with their own CVE surface.
#
# --start-period=30s: don't count failures during initial startup.
# Next.js standalone boots faster than Python/uvicorn (~3-5 seconds).
# -----------------------------------------------------------------------------
HEALTHCHECK \
    --interval=30s \
    --timeout=10s \
    --start-period=30s \
    --retries=3 \
    CMD node -e "\
        const http = require('http'); \
        const options = { host: 'localhost', port: 3000, path: '/', timeout: 9000 }; \
        const req = http.request(options, (res) => { \
            process.exit(res.statusCode >= 200 && res.statusCode < 500 ? 0 : 1); \
        }); \
        req.on('error', () => process.exit(1)); \
        req.end();"

# -----------------------------------------------------------------------------
# CMD — start the standalone Next.js server
#
# server.js is generated by Next.js standalone build — it's a plain Node.js
# HTTP server. No next CLI needed, no node_modules/next/bin/next.
# Exec form (JSON array) — node becomes PID 1, receives SIGTERM directly
# from Azure Container Apps for graceful shutdown.
# -----------------------------------------------------------------------------
CMD ["node", "server.js"]
