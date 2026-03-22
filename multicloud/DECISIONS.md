# DECISIONS.md — Architecture Decision Record
> Every non-trivial decision is logged here with full reasoning.
> This file exists so the developer can speak confidently about
> every choice in interviews and on LinkedIn.

## Format
- **Decision**: What was decided
- **Options Considered**: What alternatives existed
- **Why This Choice**: The reasoning
- **Tradeoffs**: What we gave up
- **Interview Talking Point**: How to explain this to a senior engineer

---

## Decision 001 — IaC Tool: Terraform

**Decision**: Terraform for infrastructure as code on both AWS and Azure

**Options Considered**:
1. AWS CDK — Python-based, AWS-only
2. CloudFormation — AWS-native YAML, verbose
3. Pulumi — cloud-agnostic, smaller community
4. Terraform — cloud-agnostic HCL, industry standard

**Why This Choice**:
Project spans two clouds. Terraform's provider model gives one workflow,
one state backend, one plan/apply cycle for both AWS and Azure.

**Tradeoffs**:
HCL is a new language. CDK would let us use Python we already know.
Multi-cloud capability is worth the learning curve.

**Interview Talking Point**:
"CDK is the right choice for AWS-only projects with complex logic.
The moment you span two clouds you need one tool with a unified state
model. Terraform's provider abstraction gave us that without maintaining
two separate IaC codebases."

---

## Decision 002 — Secret Management: GitHub OIDC over Static Credentials

**Decision**: OIDC federated identity for GitHub Actions on both clouds

**Options Considered**:
1. Hardcoded keys in GitHub Secrets — simple, dangerous
2. Long-lived IAM user keys — common, bad practice
3. OIDC — short-lived tokens, scoped to one workflow run

**Why This Choice**:
Static credentials don't expire. A compromised repo gives an attacker
indefinite cloud access. OIDC tokens expire after the pipeline run and
are scoped to exactly one branch and one workflow.

**Tradeoffs**:
One-time manual setup in both AWS and Azure before pipeline works.
Worth every minute.

**Interview Talking Point**:
"Long-lived credentials are the number one cause of cloud breaches.
OIDC drops the blast radius from 'indefinite cloud access' to
'nothing useful' — the token expires when the pipeline finishes."

---

## Decision 003 — Database: Supabase (deliberate non-migration)

**Decision**: Keep Supabase for PostgreSQL, Auth, and Storage

**Options Considered**:
1. Migrate DB to AWS RDS — full AWS-native story
2. Keep Supabase — pragmatic, zero migration risk

**Why This Choice**:
Supabase Auth is tightly coupled to Supabase DB internally.
RLS policies are production-tested and protecting real user data.
Migrating risks data loss and app downtime for real York students.
The compute migration to ECS is the high-value story.

**Tradeoffs**:
RDS would complete the AWS-native story. Documented as Phase 2
evolution with full migration plan: pg_dump → restore → row count
validation → Secrets Manager update → ECS restart → rollback plan.

**Interview Talking Point**:
"I made a deliberate decision not to migrate the database. Supabase
Auth is tightly coupled to the Supabase DB — decoupling that safely
requires a dedicated migration sprint. I documented the full RDS
migration plan as the next evolution. The interesting infrastructure
story is the compute layer, not replacing a working database."

---

## Decision 004 — Frontend Platform: Azure Container Apps over Static Web Apps

**Decision**: Deploy Next.js on Azure Container Apps, not Static Web Apps

**Options Considered**:
1. Azure Static Web Apps — free, but partial SSR via Azure Functions
2. Azure Container Apps — full SSR, scale-to-zero, ~$2-5/month idle
3. Vercel — already working, zero effort

**Why This Choice**:
Next.js 15 App Router uses SSR. Static Web Apps handles this via
Azure Functions with version constraints and complex config.
Container Apps runs the Docker image directly — full SSR, no hacks.

**Tradeoffs**:
Container Apps costs ~$2-5/month idle vs Static Web Apps free tier.
Full SSR support and simpler deployment is worth the minimal cost.

**Interview Talking Point**:
"Static Web Apps would have required mapping SSR routes to Azure
Functions with version constraints. Container Apps runs the Next.js
Docker image directly — full SSR with no platform-imposed limitations.
The scale-to-zero model means it costs almost nothing when idle."

---

## Decision 005 — AWS WAF: Security-first, not afterthought

**Decision**: AWS WAF attached to ALB with managed rule groups

**Options Considered**:
1. No WAF — common in portfolio projects, exposes API to attacks
2. Custom WAF rules only — high maintenance
3. AWS Managed Rule Groups — maintained by AWS security team

**Why This Choice**:
AWSManagedRulesCommonRuleSet blocks SQLi, XSS, and common exploits.
AWSManagedRulesAmazonIpReputationList blocks known malicious IPs.
WAF logs to CloudWatch — blocked requests visible and alertable.

**Tradeoffs**:
~$5/month cost. Worth it for a live app with real users.

**Interview Talking Point**:
"Every request to the API hits the WAF before touching application
code. SQLi and XSS attempts are blocked at the network edge and
logged to CloudWatch. I have an SNS alarm if blocked request rate
spikes — that pattern indicates an active attack."

---

## Decision 006 — No Default Values for Required Secrets in config.py

**Decision**: Remove hardcoded defaults for `DATABASE_URL` and `JWT_SECRET_KEY`.
Raise an explicit startup error if either is missing. Treat `REDIS_URL` as
optional with a logged warning, not a crash.

**Options Considered**:
1. Keep localhost defaults — app starts locally without any env vars set, but
   silently fails in production with cryptic connection errors
2. Use empty string defaults — app starts but crashes on first DB/JWT operation,
   error is buried in a stack trace
3. Require the vars explicitly — clear startup failure with a human-readable
   message pointing to exactly which env var is missing and how to fix it

**Why This Choice**:
A container that starts but immediately fails every request is harder to debug
than a container that refuses to start with a clear error message. ECS will mark
the task as unhealthy via the health check, but the root cause (missing env var)
is buried in CloudWatch logs.

With explicit required fields + a `model_validator` that raises `ValueError`,
the container logs "DATABASE_URL environment variable is required" and exits
immediately. The fix is obvious. No debugging needed.

`REDIS_URL` is treated differently: rate limiting degrades gracefully without
Redis (the middleware fails open — see `redis.py` `is_allowed()`). A missing
Redis URL should not crash a live app. A WARNING in startup logs is sufficient.

**Tradeoffs**:
Developers must set `DATABASE_URL` and `JWT_SECRET_KEY` in their local `.env`
file before running the app — there is no longer a zero-config local startup.
This is acceptable: `.env.example` documents both vars with generation instructions.

**Interview Talking Point**:
"I removed all hardcoded defaults for secrets in the config. A localhost database
URL inside a container connects to nothing — but the app starts fine and then fails
every request with a cryptic asyncpg error. That's the worst kind of bug: the
container is 'healthy' but completely broken. An explicit startup crash with a clear
message is better than a running process that can't do its job."

---

## Decision 007 — Split requirements.txt into production and dev

**Decision**: Separate `requirements.txt` (production, used by Docker) from
`requirements-dev.txt` (dev tools: ruff, pytest, pytest-asyncio, resend SDK).

**Options Considered**:
1. One requirements.txt with everything — simple, but ships dev tools into prod image
2. Split files with `-r requirements.txt` in dev file — standard Python convention
3. Use a tool like pip-tools or Poetry — better long-term, more complexity for now

**Why This Choice**:
The Docker image (`python:3.12-slim`) installs `requirements.txt`. Before the split,
it installed `ruff`, `pytest`, and `pytest-asyncio` into every production container.
These tools have no runtime purpose and:
- Add ~30MB to image size (slower ECR pushes, slower ECS task pulls)
- Give Trivy more packages to scan — higher chance of a CVE blocking the pipeline
- Signal to a senior engineer that production hygiene hasn't been thought about

The split is the minimal, standard fix. `requirements-dev.txt` starts with
`-r requirements.txt` so developers get all production deps automatically — one
install command covers everything locally.

The `resend` Python SDK was also moved to dev. Production code (`email.py`) calls
the Resend REST API directly via `httpx` — the resend package is never imported.
Installing an unused package in production violates least-footprint principle.

**Tradeoffs**:
Developers must run `pip install -r requirements-dev.txt` (not just requirements.txt)
locally. Documented in `.env.example` and COMMANDS.md. Minor workflow change, correct outcome.

**Interview Talking Point**:
"Trivy scans the Docker image for CVEs in every installed package. If pytest has a
known vulnerability, the pipeline fails and blocks the deploy — even though pytest
is never called in production. Dev dependencies in a production image are attack
surface you didn't need to create. The fix is one extra file and one extra line."

---
---

## Phase 1 — What You Learned (Dockerizing FastAPI + Next.js)

**Read the application code before writing a single line of Dockerfile.**
Every container bug we caught came from reading `config.py`, `main.py`, and `redis.py`
first — not from writing the Dockerfile. The health check path, the localhost defaults,
the Redis failure behaviour: none of this is visible without reading the source. A Dockerfile
written without this context produces a container that works locally and breaks in ECS.

**Exec form vs shell form for CMD is not stylistic — it's operational.**
Shell form (`CMD uvicorn ...`) wraps the process in `/bin/sh -c`. The shell becomes PID 1
and receives SIGTERM from ECS/Azure, but does not forward it. Uvicorn never gets the signal,
never finishes in-flight requests, and is force-killed after 30 seconds on every deploy.
Docker's own linter (`JSONArgsRecommended`) flagged this on the first backend build attempt.
The fix: `entrypoint.sh` with `exec "$@"` replaces the shell with uvicorn. Uvicorn becomes
PID 1. Graceful shutdown works.

**The `entrypoint.sh` + `exec "$@"` pattern is the correct way to chain a pre-start
command with an exec-form CMD.** You cannot use `&&` in exec form JSON arrays. The
entrypoint script runs `alembic upgrade head`, then `exec "$@"` replaces the shell with
the CMD process. One script, one PID 1, correct signal handling.

**`output: 'standalone'` in Next.js is required for Docker but was removed for Vercel.**
The existing frontend Dockerfile was already copying `.next/standalone/` — but `next.config.ts`
didn't have `output: 'standalone'` set, so that directory would never exist. The build would
have appeared to succeed but the runner stage would have copied an empty/nonexistent directory.
Always read the Dockerfile *and* the build config together.

**`node:20-alpine` is correct for Node.js, but `python:3.12-slim` is correct for Python.**
Alpine uses musl libc. Node.js ships pre-built Alpine binaries, so Alpine works fine.
Python packages like asyncpg, cryptography, and grpcio ship manylinux wheels (glibc only).
Alpine would force source compilation — slower builds, more system deps, more attack surface.
The base image decision is not universal: match it to the ecosystem's wheel format.

**Layer caching is free performance — order matters.**
`COPY requirements.txt → pip install → COPY app/` means code changes never re-trigger pip.
The backend rebuild after adding `entrypoint.sh` took 0.2 seconds — pip layer was cached.
Wrong order (`COPY . . → pip install`) would make every single code change trigger a
3-minute full package reinstall.

**`libpq5` not `libpq-dev`. Runtime packages only.**
`libpq-dev` includes compile headers and gcc — needed to build from source, not to run.
All production packages ship pre-built wheels. Dev headers in a production image add size
and CVE surface for no runtime benefit.

**Dead code is real risk at container build time.**
`google-generativeai` was in `requirements.txt` and emitted a `FutureWarning` on every
container startup — polluting CloudWatch logs with noise. `s3.py` referenced three dead
config fields. Neither caused crashes, but both signal to a senior engineer that production
hygiene hasn't been thought about. Clean it before it ships.

---

> More decisions added as project progresses.
> Each phase ends with a "What You Learned" retrospective.
