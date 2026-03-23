# DOCUMENTATION.md — Project Journey & Technical Record

> This file is the living narrative of the YorkPulse multi-cloud infrastructure project.
> It documents every phase completed, every decision made, why it was made,
> what alternatives existed, and what was learned.
> Written so that a future engineer (or a recruiter) can follow the full story
> from zero to production-grade multi-cloud infrastructure.

---

## What Is This Project?

**YorkPulse** (yorkpulse.com) is a student community platform built exclusively for
York University students. It is live, has real users, and contains:

- **The Vault** — anonymous forum
- **Marketplace** — buy/sell between students
- **Side Quests** — buddy finder / activity posts
- **Course Chat** — chat rooms for all 7,706 York courses
- **Gigs** — student job board
- **Messaging** — real-time direct messages

The infrastructure project is NOT a rebuild of the app. It is a lift of the existing
production app onto production-grade multi-cloud infrastructure to demonstrate
DevSecOps, Cloud Engineering, and IaC skills for job applications.

**The app must stay live at all times. Never break production.**

---

## Starting Point — What Was Already Running

Before this project began, YorkPulse was deployed on:

| Layer | Provider | Limitation |
|-------|---------|-----------|
| Backend (FastAPI) | Render (free tier) | ~15 min cold starts after inactivity |
| Frontend (Next.js 15) | Vercel (hobby tier) | Limited bandwidth, no team features |
| Database (PostgreSQL) | Supabase (free tier) | Project pauses after 7 days of inactivity |
| Redis / Cache | External free tier | Limited memory, shared, unreliable |
| File Storage | Supabase Storage | Fine — already migrated from S3, staying |
| Auth (OTP + JWT) | Supabase Auth | Fine — staying |

**Total cost: $0/month. Total reliability: not production-grade.**

---

## Architecture Decision: Why Multi-Cloud?

A single-cloud setup would have been simpler. The decision to use both AWS and Azure
was deliberate and portfolio-driven:

- AWS alone demonstrates compute migration (Render → ECS Fargate)
- Azure alone demonstrates frontend infrastructure
- **Both together** demonstrates true multi-cloud capability — the ability to design,
  deploy, and operate infrastructure across two different providers using one IaC tool
- Most senior cloud engineering roles expect exposure to multiple clouds
- The Terraform provider model makes two-cloud management tractable with one workflow

---

## Final Target Architecture

```
Internet
    │
    ▼
AWS WAF ─── blocks SQLi, XSS, known bad IPs before hitting application code
    │
    ▼
ALB (Application Load Balancer) ─── HTTPS only, TLS termination
    │
    ▼
ECS Fargate ─── FastAPI backend (private subnet, no public IP)
    │         ├── reads secrets from Secrets Manager at startup
    │         ├── connects to ElastiCache Redis (VPC-internal, sub-ms latency)
    │         └── connects to Supabase (DB + Auth + Storage) via NAT Gateway
    │
    ├── CloudWatch ─── structured JSON logs, 30-day retention
    │       └── alarms → SNS topic → yorkpulse.app@gmail.com
    │
    └── ECR ─── Docker image registry (single source of truth for both clouds)

                        │ (Azure pulls from ECR)
                        ▼
              Azure Container Apps
                  ├── Next.js 15 SSR frontend
                  └── FastAPI backend mirror
                        ├── Azure Key Vault → frontend secrets
                        └── Azure Monitor → logs + metrics
                                (scale-to-zero when idle → ~$0 cost)

Supabase (untouched — deliberate non-migration)
    ├── PostgreSQL → primary database
    ├── Auth → OTP + JWT
    └── Storage → images and files
```

---

## Phase 0 — Project Scaffolding

**Date**: 2026-03-20
**Status**: ✅ Complete

### What Was Done

Created the 5 foundational documentation files in `multicloud/`:

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Single source of truth for project state. Claude Code reads this automatically. Tracks current phase, architecture, rules. |
| `DECISIONS.md` | Architecture Decision Record. Every non-trivial technical choice logged with reasoning and interview talking points. |
| `SECURITY.md` | Security posture document. Defence layers, threat model, IAM roles, CI/CD gates. |
| `COMMANDS.md` | Every terminal command used in this project with plain-English explanations. Built for learning from scratch. |
| `COST.md` | Cloud cost breakdown. AWS ~$91/month, Azure ~$5–8/month. Credits: $100 AWS + $100 Azure. |

### Why Do This First?

Before writing a single line of infrastructure code, documenting the architecture forces
clarity on every decision. A senior engineer reviewing this project will read these files
first. They signal that the developer understands *why* each choice was made, not just *what*
was done.

It also sets the rules that every future phase must follow — no hardcoded secrets,
no Static Web Apps for SSR, no Supabase DB migration, etc.

### What Was Learned

- Documenting decisions before implementing them prevents half-built pivots
- The `CLAUDE.md` file acts as a project memory — Claude Code reads it on every session
  and immediately knows the project state without re-explaining it
- Writing interview talking points forces you to understand your own decisions well
  enough to explain them under pressure

---

## Phase 0.5 — Terraform Remote State Bootstrap

**Date**: 2026-03-20
**Status**: ✅ Complete (files written — `terraform apply` still to run manually)

### The Problem Being Solved

Terraform keeps a state file (`terraform.tfstate`) that tracks every resource it manages.
By default this lives on your local disk. This creates two critical problems:

1. **Corruption risk**: If two people (or two CI/CD pipeline runs) run `terraform apply`
   simultaneously, they both read the current state, both make changes, and one overwrites
   the other. Infrastructure silently diverges from what Terraform thinks exists.

2. **Single point of failure**: If your laptop dies, you lose the state file. Terraform
   can no longer manage the infrastructure — it doesn't know what it created.

The solution: store the state file in S3 (shared, versioned, encrypted) and use DynamoDB
as a distributed lock table (only one apply runs at a time).

### The Bootstrapping Paradox

Here's the problem: you can't use Terraform to create the S3 bucket that stores
Terraform's own state file. If you try, Terraform looks for the remote backend first,
can't find it, and fails before creating anything.

**Solution**: a dedicated `infra/bootstrap/` module that:
- Uses **local state only** (no backend block)
- Creates the S3 bucket and DynamoDB table
- Is run **exactly once, manually**
- After it runs, every other module (`infra/aws/`, `infra/azure/`) declares
  this S3 bucket as their remote backend

### Files Created

```
infra/bootstrap/
├── versions.tf   — pins Terraform >= 1.6.0 and AWS provider ~> 5.0
├── main.tf       — creates the S3 bucket and DynamoDB table
└── outputs.tf    — outputs bucket name and table name for use in other modules
```

### versions.tf — Why Pin Versions?

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

- `>= 1.6.0` — minimum Terraform version. Prevents running on old Terraform that
  might behave differently. Anyone cloning this repo gets a clear error if their
  Terraform is too old.
- `~> 5.0` — "pessimistic constraint" meaning 5.x but not 6.0. Accepts patch and
  minor updates (security fixes) but won't auto-upgrade to a major version with
  breaking changes.

### main.tf — Every Resource Explained

**S3 bucket** (`aws_s3_bucket`):
- Name: `yorkpulse-tf-state-847291` — suffix added because S3 bucket names are
  globally unique across ALL AWS accounts worldwide. Without the suffix, the name
  `yorkpulse-tf-state` is almost certainly taken by someone else.
- `lifecycle { prevent_destroy = true }` — if `terraform destroy` is ever run on
  the bootstrap module, Terraform will refuse to delete this bucket. Deleting it
  would lose ALL Terraform state for every other module. This is a hard safety net.

**S3 versioning** (`aws_s3_bucket_versioning`):
- Every time `terraform apply` runs, the state file is overwritten in S3.
- Versioning keeps every previous version of the state file.
- If a bad apply corrupts the state, you can restore the previous version from S3.
- This is the equivalent of git history for your infrastructure state.

**S3 encryption** (`aws_s3_bucket_server_side_encryption_configuration`):
- The state file contains sensitive data: resource IDs, ARNs, and sometimes plaintext
  output values.
- `AES256` encrypts every object at rest using AWS-managed keys. No cost added.
- Without this, the state file sits as plaintext in S3.

**S3 public access block** (`aws_s3_bucket_public_access_block`):
- All four flags set to `true` — this hard-locks the bucket against any public access.
- Even if an IAM policy or bucket ACL accidentally grants public access, this resource
  overrides it. The state file can never become publicly readable regardless of
  other configuration.

**DynamoDB table** (`aws_dynamodb_table`):
- Name: `yorkpulse-terraform-locks`
- `billing_mode = "PAY_PER_REQUEST"` — you pay per read/write operation rather than
  reserving capacity. For a lock table that's hit only during `terraform apply` runs,
  this costs essentially $0.
- `hash_key = "LockID"` — this exact attribute name is hardcoded by Terraform's
  S3 backend. Terraform writes the state file path as the LockID value to acquire
  the lock, and deletes the record when done.

### outputs.tf — Why Output These?

After `terraform apply`, the output values are printed to the terminal:
```
s3_bucket_name     = "yorkpulse-tf-state-847291"
dynamodb_table_name = "yorkpulse-terraform-locks"
```

These values are copied into the `backend "s3"` block of every other Terraform module:

```hcl
terraform {
  backend "s3" {
    bucket         = "yorkpulse-tf-state-847291"
    key            = "aws/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "yorkpulse-terraform-locks"
    encrypt        = true
  }
}
```

`key` is the path inside the bucket where the state file is stored.
`infra/aws/` uses `"aws/terraform.tfstate"`.
`infra/azure/` will use `"azure/terraform.tfstate"`.
This keeps state files for different modules isolated inside the same bucket.

### The 3 Commands to Run (in order)

```bash
# Step 1 — Initialize: download the AWS provider, prepare working directory
cd infra/bootstrap && terraform init
# Expected: "Terraform has been successfully initialized!"

# Step 2 — Plan: preview exactly what will be created, touch nothing
terraform plan
# Expected: "Plan: 5 to add, 0 to change, 0 to destroy."
# (5 = 1 bucket + versioning + encryption + public access block + 1 DynamoDB table)

# Step 3 — Apply: create the resources (type "yes" when prompted)
terraform apply
# Expected: "Apply complete! Resources: 5 added, 0 changed, 0 destroyed."
```

After `apply`, commit the local `infra/bootstrap/terraform.tfstate` to git.
It only contains the S3 bucket and DynamoDB table — no secrets.

### What Was Learned

- The bootstrapping paradox is a real and well-known problem in the Terraform community.
  The `infra/bootstrap/` pattern (separate module, local state, run once) is the
  industry-standard solution.
- `prevent_destroy = true` is not just good practice — for this specific resource,
  it is non-negotiable. Losing the state bucket means losing control of all infrastructure.
- S3 bucket names being globally unique is a gotcha. Always add a random numeric suffix.
- The DynamoDB `LockID` attribute name is not configurable — Terraform hardcodes it.
  If you name it anything else, locking silently breaks.

---

## Key Design Decisions (Summary)

### Why Terraform over AWS CDK / CloudFormation?

CDK is Python-based and AWS-only. This project spans two clouds. Using CDK for AWS and
Bicep for Azure would mean two completely different IaC codebases, two state management
systems, two plan/apply workflows. Terraform's provider model gives one HCL language,
one `terraform plan`, one state backend for both AWS and Azure.

### Why Keep Supabase (Not Migrate to RDS)?

Supabase Auth is tightly coupled to the Supabase PostgreSQL instance internally.
RLS (Row Level Security) policies protecting real user data were written for Supabase.
Migrating the database while keeping Supabase Auth running would require either:
a) running two databases simultaneously, or
b) migrating Auth at the same time — a full, dangerous sprint.

The compute migration (Render → ECS Fargate) is the high-value portfolio story.
Replacing a working database mid-project for no user-facing benefit is engineering
recklessness, not engineering excellence. The full RDS migration plan is documented
as a future Phase 2 evolution.

### Why Azure Container Apps for Next.js (Not Static Web Apps)?

Next.js 15 with App Router uses Server-Side Rendering — it requires a running
Node.js server at request time. Azure Static Web Apps supports SSR via Azure Functions
(hybrid rendering mode) but with version constraints and complex `staticwebapp.config.json`
mapping. Azure Container Apps runs the Next.js Docker container directly — full SSR,
no platform constraints, scale-to-zero billing. The right tool for the job.

### Why AWS WAF?

Most portfolio projects have no WAF. YorkPulse has real York University students using it.
A live app without a WAF is an open invitation for SQLi, XSS, and credential stuffing attacks.
AWS Managed Rule Groups (`AWSManagedRulesCommonRuleSet`, `AWSManagedRulesAmazonIpReputationList`)
are maintained by the AWS security team — they block known attack patterns updated continuously.
At ~$5/month, it is the highest-value security control in the stack.

### Why OIDC Instead of IAM User Keys for CI/CD?

Long-lived AWS access keys stored in GitHub Secrets are the #1 cause of cloud account compromises.
If the GitHub repo is ever leaked or compromised, those keys give an attacker indefinite access
to the AWS account. OIDC (OpenID Connect) federation issues a short-lived token scoped to
exactly one pipeline run on exactly one branch. The token expires when the pipeline finishes.
There are no static credentials to steal.

### Why DevSecOps (Trivy + Checkov)?

Security scanning added to CI/CD — not as an afterthought audit, but as a pipeline blocker:
- **Trivy** scans the Docker image for CVEs in the base OS and pip packages. Pipeline fails
  on CRITICAL findings. A critical CVE in production is a breach waiting to happen.
- **Checkov** scans all `.tf` files for misconfigurations: open security groups, unencrypted
  S3 buckets, ECS tasks running as root, Secrets Manager without KMS. Pipeline fails on HIGH.

The difference between DevOps and DevSecOps is that security is not optional.

### Why SNS Alerting?

CloudWatch alarms are only useful if someone sees them. Without SNS, an alarm fires silently
in the AWS console — nobody knows until they log in and check. With an SNS topic subscribed
to `yorkpulse.app@gmail.com`, every alarm (5xx spike, WAF blocked request surge, high CPU,
memory pressure) sends an immediate email. For a live app, this is the difference between
noticing an incident in minutes vs. hours.

### Why VPC Endpoints (Security + Cost)?

Without VPC endpoints, ECS tasks in private subnets must route traffic to AWS services
(ECR for image pulls, Secrets Manager for secret retrieval, S3 for CloudWatch logs) through
the NAT Gateway — which means traffic exits the VPC onto the public internet, then returns
via AWS public endpoints.

VPC endpoints create private routes: traffic to ECR, S3, and Secrets Manager stays entirely
on the AWS private backbone network. It never touches the public internet.
Security benefit is primary. Cost saving (~$32/month vs NAT Gateway after credits expire) is secondary.

---

## Credits & Cost Reality Check

| Cloud | Credit | Monthly Burn | Runway |
|-------|--------|-------------|--------|
| AWS | $100 | ~$91/month | ~5–6 weeks |
| Azure | $100 | ~$5–8/month (idle) | 12–20 months |

**After AWS credits run out**: swap NAT Gateway for VPC endpoints.
AWS cost drops from ~$91 to ~$59/month. Document this in DECISIONS.md when it happens.

---

## Phase 1 — Dockerize the Backend (FastAPI)

**Date**: 2026-03-20
**Status**: ✅ Backend Dockerfile built, tested locally, running — frontend Dockerfile next

### What We Read First (and Why)

Before writing a single line of Dockerfile, we read:
- `backend/requirements.txt` — to understand all dependencies and spot dev-only packages
- `backend/app/main.py` — to understand startup sequence, middleware, and route prefixes
- `backend/app/core/config.py` — to find every env var the app needs and spot dangerous defaults
- `backend/app/core/middleware.py` — to understand Redis failure behaviour
- `backend/app/services/redis.py` — to confirm rate limiter fails open (safe degradation)
- `backend/app/api/routes/health.py` — to get the exact health check URL path

**Why read before writing?** A Dockerfile written without understanding the app will work
locally but break in ECS in non-obvious ways. The most common container bugs come from
not reading the application code — wrong health check path, localhost defaults, missing env vars.

### Issues Found and Fixed Before Building

These issues were found by reading the source before writing the Dockerfile.
All of them were fixed immediately — they would have caused the container to either crash
at startup or silently misbehave in production.

---

**🔴 WILL BREAK IN CONTAINER — `config.py` line 20: hardcoded localhost for DATABASE_URL**

```python
database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/yorkpulse"
```

`localhost` inside a container refers to the container itself — not Supabase, not RDS.
If `DATABASE_URL` is not injected as an env var at runtime, the app starts but every
database operation fails with a connection refused error.

**Fix applied**: `DATABASE_URL` and `JWT_SECRET_KEY` changed to `Optional[str] = None`.
A `@model_validator(mode="after")` now runs at startup and raises a `ValueError` with a
human-readable message if either is missing. The container refuses to start instead of
starting and failing every request with a cryptic asyncpg error.

In ECS these are injected from AWS Secrets Manager. In local dev they must be in `.env`.

---

**🔴 FIXED — `config.py`: hardcoded localhost for REDIS_URL**

```python
# Before
redis_url: str = "redis://localhost:6379"

# After
redis_url: Optional[str] = None
```

ElastiCache is not at `localhost` — it has its own VPC-internal endpoint.
`REDIS_URL` is treated as **optional** (not required like DATABASE_URL) because Redis
failure is graceful: `RateLimitMiddleware.is_allowed()` wraps all Redis calls in
`except Exception: return True` — if Redis is unreachable, rate limiting is silently
disabled and requests are allowed through. The app doesn't crash.

**Fix applied**: Changed to `Optional[str] = None`. The `model_validator` logs a WARNING
at startup (`REDIS_URL is not set. Rate limiting will be disabled...`) instead of crashing.
The warning is visible in CloudWatch logs but doesn't block the app.

---

**🔴 FIXED — `config.py`: weak hardcoded JWT default**

```python
# Before
jwt_secret_key: str = "your-super-secret-key-change-in-production"

# After
jwt_secret_key: Optional[str] = None
```

With the original default, if `JWT_SECRET_KEY` env var was not set, the app started and
signed tokens with a publicly-known weak key. An attacker who read the source code could
forge valid JWTs with no effort. The app appeared healthy — it was silently compromised.

**Fix applied**: Changed to `Optional[str] = None`. The `model_validator` raises a
`ValueError` at startup if missing: `"JWT_SECRET_KEY environment variable is required. Generate
a strong key with: python -c 'import secrets; print(secrets.token_hex(32))'"`. Clear failure,
obvious fix.

---

**🟡 FIXED — Dead AWS S3 fields in `config.py`**

```python
# Removed
aws_access_key_id: str = ""
aws_secret_access_key: str = ""
s3_bucket_name: str = "yorkpulse-uploads"
```

The project migrated from S3 to Supabase Storage. `s3.py` exists but is never imported
anywhere in `main.py` or any route — it is dead code. These config fields were dead config.

**Fix applied**: Fields removed from `config.py`. `aws_region` kept — it will be needed
in Phase 2 when the ECS task calls Secrets Manager and ElastiCache using the AWS SDK
(boto3) with IAM role auth (no static credentials needed).

---

**🟡 FIXED — Dev tools installed in production image**

`ruff`, `pytest`, `pytest-asyncio`, and the `resend` Python SDK were in `requirements.txt`,
meaning they were installed in every production Docker image.

- Adds ~30MB to image size (slower ECR pushes, slower ECS task cold starts)
- Gives Trivy more packages to scan → higher chance of a CVE blocking the CI/CD pipeline
- `resend` SDK was also in there — production code calls the Resend REST API directly
  via `httpx`, it never imports the `resend` package

**Fix applied**: Split into two files:
- `requirements.txt` — production deps only (used by Docker)
- `requirements-dev.txt` — starts with `-r requirements.txt` then adds: `ruff`, `pytest`,
  `pytest-asyncio`, `resend`. Install locally with `pip install -r requirements-dev.txt`.

---

**✅ SAFE — Redis failure is graceful**

`RateLimitMiddleware.is_allowed()` wraps every Redis operation in `except Exception: return True`.
If Redis is unreachable, rate limiting is silently disabled and all requests are allowed through.
This is correct behaviour — the app doesn't crash, it degrades gracefully.
Worth knowing: a Redis outage is invisible in application logs. Set a CloudWatch alarm on
ElastiCache connection errors to catch this.

---

**✅ SAFE — Health check path is `/api/v1/health` (not `/health`)**

The health router is registered in `main.py` with `prefix=settings.api_prefix` (`"/api/v1"`).
The full path is `/api/v1/health`. The Dockerfile HEALTHCHECK uses this exact path.
Using just `/health` would return a 404 and mark the container permanently unhealthy.

### What the Dockerfile Does (Every Decision Justified)

**Base image: `python:3.12-slim`**
- Matches the app's Python version (requirements.txt uses 3.12 features)
- `slim` removes build tools and docs — ~130MB vs ~1GB for the full image
- Not Alpine — musl libc breaks pre-built wheels for asyncpg/cryptography/grpcio

**No `gcc` in system deps**
- The original Dockerfile had `gcc`. Removed intentionally.
- All packages in `requirements.txt` ship pre-built manylinux wheels. No compilation needed.
- `gcc` adds to image size and Trivy CVE surface. Never install build tools in production images.
- Only `libpq5` is needed — the runtime PostgreSQL client library for asyncpg.

**Non-root user created BEFORE copying files**
- `groupadd --system appuser && useradd --system --gid appuser --no-create-home appuser`
- Checkov flags containers running as root as HIGH severity
- Created before COPY so ownership can be set in a single `chown` layer

**Layer caching order: requirements → pip install → app code**
- Copy `requirements.txt` → `pip install` → `COPY app/`
- Code changes don't invalidate the pip layer → rebuilds take seconds not minutes
- Original Dockerfile had `COPY . .` before the ownership step — this copies everything
  including `.env`, `venv/`, `__pycache__`, test files. The new `.dockerignore` fixes this.

**EXPOSE 8000 (hardcoded, not `$PORT`)**
- Original Dockerfile used `EXPOSE $PORT` — a variable. The `EXPOSE` instruction doesn't
  actually read environment variables at build time. It would show as `EXPOSE 0` in inspection.
- ECS doesn't use `$PORT` — the port is declared in the task definition.

**HEALTHCHECK path: `/api/v1/health` via Python urllib**
- `curl` is not on `python:3.12-slim`. Installing it adds a package with its own CVE history.
- Python's `urllib` is always available — same result, zero extra dependencies.
- `--start-period=40s` prevents ECS from killing the container during the import-heavy startup.

**ENTRYPOINT + CMD: exec form via `entrypoint.sh`**

The Dockerfile needs to run `alembic upgrade head` (DB migrations) before starting uvicorn.
The naive fix is shell form CMD:

```dockerfile
# ❌ Shell form — DO NOT USE
CMD alembic upgrade head && uvicorn app.main:app ...
```

This works but creates a critical problem: shell form runs the command inside `/bin/sh -c`,
making the shell PID 1. When ECS sends `SIGTERM` to stop the container (during a rolling
deploy or scale-down), the shell receives it — but does not forward it to uvicorn.
Uvicorn never gets the signal, never finishes in-flight requests, and gets killed forcibly
after a 30-second timeout. Every production deploy is a hard kill.

**Fix**: A dedicated `entrypoint.sh` script:

```sh
#!/bin/sh
set -e
echo "Running database migrations..."
alembic upgrade head
echo "Starting server..."
exec "$@"   # ← exec REPLACES the shell with the CMD process
```

The key is `exec "$@"` — this replaces the shell process with uvicorn. Uvicorn becomes
PID 1. It receives SIGTERM directly from ECS. Graceful shutdown works correctly.

The Dockerfile then uses:
```dockerfile
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info"]
```

`ENTRYPOINT` runs the script. `CMD` provides arguments passed as `"$@"` to `exec`.
Both are exec form (JSON array) — no shell wrappers anywhere in the call chain.

### The First Build — What Happened

**First attempt** (before entrypoint.sh fix):

```bash
cd backend
docker build -t yorkpulse-backend:local .
```

Build succeeded but Docker emitted one warning:
```
JSONArgsRecommended: JSON arguments recommended for CMD to prevent unintended
behavior related to OS signals (line 157)
```

This confirmed the SIGTERM problem described above. Docker's own linter flagged it.

**Second build** (after adding `entrypoint.sh`):

```bash
docker build -t yorkpulse-backend:local .
```

Output (key lines):
```
#15 [10/11] COPY entrypoint.sh .
#15 DONE 0.0s
#16 [11/11] RUN chown -R appuser:appuser /app && chmod +x /app/entrypoint.sh
#16 DONE 0.2s
#17 exporting to image
#17 naming to docker.io/library/yorkpulse-backend:local done
#17 DONE 0.1s
```

**Zero warnings. Zero errors. Build complete.**

Notice layers 7–14 all show `CACHED` — the pip install layer was not re-run because
`requirements.txt` hadn't changed. Only the new `entrypoint.sh` layer was added.
This is layer caching working exactly as designed.

### Running the Container Locally

```bash
# Start the container with your local .env file
docker run --rm --env-file .env -p 8000:8000 yorkpulse-backend:local
```

The container:
1. Runs `alembic upgrade head` (migrations — idempotent, safe every start)
2. `exec`s into uvicorn on `0.0.0.0:8000`
3. Uvicorn imports all modules and starts the async event loop

```bash
# Verify the health endpoint (in a second terminal)
curl http://localhost:8000/api/v1/health
# Expected: {"status":"healthy","service":"yorkpulse-api"}

# Check the image size
docker image ls yorkpulse-backend:local
# Expected: ~500-600MB (python:3.12-slim base + packages)

# Stream container logs
docker ps                          # get CONTAINER ID
docker logs -f <container_id>      # tail logs in real time

# Stop the container
docker stop <container_id>
```

### What Was Learned

- **Read the app code before writing the Dockerfile.** The health check path, the localhost
  defaults, the Redis failure behaviour — none of this is visible from the Dockerfile alone.
  A Dockerfile written without reading `config.py`, `main.py`, and `redis.py` would have
  produced a container that works locally and silently breaks in ECS.
- **Exec form vs shell form is not stylistic.** Docker's own linter (`JSONArgsRecommended`)
  flagged it immediately on the first build. The difference is whether uvicorn ever receives
  SIGTERM — graceful shutdown vs a 30-second forced kill on every production deploy.
- **`entrypoint.sh` + `exec "$@"` is the correct pattern for "run a pre-start command then
  start the server."** The `exec` builtin replaces the current process — it's not a subprocess.
  After `exec`, the shell is gone. Uvicorn inherits PID 1 and all its signal handling.
- **Layer caching is free performance.** Only touching `entrypoint.sh` meant the entire pip
  install layer was served from cache. Code changes should never trigger a full package reinstall.
- **`libpq5` not `libpq-dev`.** Runtime library only. Dev packages (compile headers, gcc) add
  size and CVE surface with no runtime purpose. Never install build tools in production images.
- **Pre-built manylinux wheels make `python:3.12-slim` the correct choice.** Alpine musl libc
  breaks asyncpg and cryptography wheels. Always try slim (Debian-based, glibc) first.

---

## What's Next — Phase 1 (Frontend)

**Goal**: Dockerize the Next.js 15 frontend.

The Next.js Dockerfile needs:
- `output: 'standalone'` in `next.config.ts` to produce a self-contained Node.js server
- Multi-stage build: `builder` stage (full Node.js, runs `npm run build`) →
  `runner` stage (minimal Node.js, copies only the standalone output)
- Non-root user
- `EXPOSE 3000`
- CMD: `node server.js` (the standalone output's entrypoint)

The frontend is deployed on Azure Container Apps (not Static Web Apps — SSR requires it).
Both the frontend and backend Docker images are pushed to the same ECR registry.
Azure Container Apps pulls from ECR using a cross-account credential stored in Azure Key Vault.

---

## File Map — Where Everything Lives

```
yorkpulse/                          ← repo root
├── backend/                        ← FastAPI app
│   ├── app/                        ← application code
│   │   └── core/config.py          ← Phase 1 ✅ (fixed: required secrets, no defaults)
│   ├── requirements.txt            ← Phase 1 ✅ (production only — dev tools removed)
│   ├── requirements-dev.txt        ← Phase 1 ✅ (new: ruff, pytest, resend for local use)
│   ├── entrypoint.sh               ← Phase 1 ✅ (runs alembic then exec's uvicorn as PID 1)
│   ├── Dockerfile                  ← Phase 1 ✅ (python:3.12-slim, non-root, healthcheck)
│   └── .dockerignore               ← Phase 1 ✅ (excludes .env, venv, __pycache__, etc.)
├── frontend/                       ← Next.js 15 app (Dockerfile coming next)
├── infra/
│   └── bootstrap/                  ← Phase 0.5 ✅
│       ├── versions.tf             ← Terraform + AWS provider version pins
│       ├── main.tf                 ← S3 bucket + DynamoDB lock table
│       └── outputs.tf              ← bucket name + table name outputs
└── multicloud/                     ← planning and documentation hub
    ├── CLAUDE.md                   ← project state, current phase, rules
    ├── DECISIONS.md                ← architecture decision record (5 decisions)
    ├── SECURITY.md                 ← security posture, threat model, defence layers
    ├── COMMANDS.md                 ← every terminal command with plain-English docs
    ├── COST.md                     ← AWS + Azure cost breakdown, credit runway
    ├── DOCUMENTATION.md            ← this file — full journey narrative
    ├── guide.md                    ← detailed deployment guide (services, decisions)
    ├── prompt.md                   ← original project setup instructions
    └── cc.md                       ← Phase 0 implementation spec
```
