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

---

## Decision 008 — WAF Rule Order: IP Reputation → CRS → Known Bad Inputs

**Decision**: Apply WAF rules in priority order: IP Reputation (1) → Common Rule Set (2) → Known Bad Inputs (3)

**Options Considered**:
1. CRS first — broadest protection first, catches most attacks
2. IP Reputation first — cheapest check first, filters known-bad IPs before content inspection
3. Known Bad Inputs first — most targeted rules first

**Why This Choice**:
WAF evaluates rules in priority order and stops on the first BLOCK match.
IP reputation is the cheapest rule to evaluate (IP lookup vs regex matching on request content).
If an IP is on the reputation list, there's no reason to run the more expensive CRS regex matching.
This ordering minimises WAF CPU cost and exits as early as possible for known-bad sources.

CRS is second because it's the broadest rule group — catches SQLi, XSS, path traversal, and
size violations from sources not yet on the IP reputation list.

Known Bad Inputs is third because it's the most specific (Log4Shell, SSRF patterns, exploit kits).
It's the safety net that catches what CRS misses. Applied last because it has the most
targeted patterns — checking it first would offer no speed benefit.

**Tradeoffs**:
All three rules are evaluated for IPs not on the reputation list. A single WAF hit always
runs two additional rules. At YorkPulse traffic levels, WAF cost is ~$5/month regardless.

**Interview Talking Point**:
"WAF rules are evaluated in priority order and short-circuit on the first match. I put IP
reputation first because it's a hash lookup — cheapest possible check. If the IP is known
bad, I never run the expensive regex matching in the CRS or Known Bad Inputs rules. It's
the same reason you check authentication before authorization."

---

## Decision 009 — ECS Rolling Deploy: min 100%, max 200%

**Decision**: ECS rolling deployment with minimum_healthy_percent=100, maximum_percent=200

**Options Considered**:
1. min=50%, max=100% — ECS stops old task before starting new one (brief downtime)
2. min=100%, max=200% — ECS starts new task first, health checks pass, then stops old one (zero downtime)
3. Blue/green via CodeDeploy — zero downtime, instant rollback, high Terraform complexity

**Why This Choice**:
With desired_count=1 and min=100%:
ECS must keep 1 healthy task running at all times during a deploy.
It cannot stop the old task until the new task passes ALB health checks.
The new task starts → ALB health check passes → old task drains and stops.
Result: zero downtime. Users never hit a task that's being replaced.

max=200% gives ECS the headroom to run 2 tasks simultaneously (1 old + 1 new).
Without max=200%, ECS couldn't start the new task while min=100% requires keeping the old one.

Blue/green adds a CodeDeploy deployment group, two target groups, and lifecycle hooks.
At one task with ~$12/month ElastiCache budget, this complexity has no user-facing benefit.

**Tradeoffs**:
Deploys consume 2× the Fargate capacity momentarily (0.5 vCPU × 2 = 1 vCPU peak).
At YorkPulse traffic and cost levels, this is negligible. Blue/green would be justified
at dozens of tasks or when instant rollback (not rolling rollback) is required by SLA.

**Interview Talking Point**:
"min=100%, max=200% is the zero-downtime rolling deploy pattern for single-task services.
ECS can't stop the old task until the new one is healthy — it starts both simultaneously
for a moment. Blue/green was overkill here: it adds CodeDeploy complexity and a second
target group for a benefit that rolling deploy already provides at this scale."

---

## Decision 010 — ElastiCache TLS + Auth Token (transit_encryption_enabled = true)

**Decision**: Enable TLS on ElastiCache Redis even though it's VPC-internal

**Options Considered**:
1. No TLS — Redis is VPC-internal, encryption "not needed"
2. TLS enabled — data encrypted in transit inside the VPC, auth token required
3. TLS + VPC endpoint — belt-and-suspenders network isolation (future evolution)

**Why This Choice**:
VPC isolation prevents external access, but it doesn't protect against:
- An attacker who compromises another resource inside the VPC
- An attacker who compromises the ECS task networking (ARP spoofing, etc.)
- Accidental misconfiguration that exposes Redis to another VPC segment

TLS encrypts all Redis traffic inside the VPC. Combined with the auth token
(ElastiCache requires a password when TLS is enabled), an attacker who somehow
reaches the Redis port still cannot connect without the token.

Auth token is stored in Secrets Manager (/yorkpulse/prod/redis-auth-token), never hardcoded.
The ECS execution role reads it at task startup and injects it into the REDIS_URL env var.

at_rest_encryption_enabled = true adds AES-256 encryption for data on the ElastiCache
storage layer — belt-and-suspenders with transit encryption.

**Tradeoffs**:
TLS adds ~1-2ms latency on Redis connections vs unencrypted. For rate-limit counters
and session caches, this is imperceptible to users. The security benefit is worth it.
ElastiCache auth tokens have character restrictions (no "@" or "/") — documented in secrets.tf.

**Interview Talking Point**:
"VPC isolation is not a substitute for encryption. If an attacker pivots from one
compromised service inside the VPC, they can reach any other service in the same
security group. TLS + auth token means they still can't read or write Redis data.
Defence in depth: the network doesn't trust, the service also doesn't trust."

---

## Decision 011 — NAT Gateway vs VPC Endpoints

**Decision**: Use NAT Gateway now (covered by AWS credits), plan to swap for VPC endpoints after credits expire

**Options Considered**:
1. NAT Gateway — simple, works immediately, ~$32/month
2. VPC Interface Endpoints — private routes to ECR/S3/SecretsManager, ~$0 for Gateway endpoints, ~$7/endpoint/month for Interface endpoints
3. No NAT / No endpoints — ECS tasks can't reach Supabase, SMTP, or AWS services

**Why This Choice**:
NAT Gateway is the simplest correct solution for Phase 2. ECS tasks in private subnets
need outbound internet access for:
- Supabase (PostgreSQL on port 5432, HTTPS on 443)
- Gmail SMTP (port 587)
- AWS service endpoints (ECR, Secrets Manager, CloudWatch)

VPC Interface Endpoints for ECR, S3, and Secrets Manager would route AWS service traffic
directly through the AWS backbone (never touching the public internet) while saving ~$32/month
vs NAT Gateway. However, setup requires one endpoint per service (ECR = 2 endpoints, S3 = 1,
Secrets Manager = 1) — more Terraform complexity and debugging surface for Phase 2.

Security argument for VPC endpoints:
Traffic to ECR (image pulls), Secrets Manager (secret reads), and CloudWatch (logs) stays
entirely on the AWS private network — never traverses the public internet via NAT.
An attacker who compromises the NAT Gateway cannot intercept these requests.

After AWS credits expire (~5-6 weeks), swap to:
- aws_vpc_endpoint for S3 (Gateway type — free)
- aws_vpc_endpoint for ECR API + DKR (Interface type — ~$7/month each)
- aws_vpc_endpoint for Secrets Manager (Interface type — ~$7/month)
NAT Gateway can then be removed for traffic to AWS services. May still need NAT for Supabase + SMTP.

**Tradeoffs**:
NAT Gateway: $32/month but simpler. One resource instead of 4 endpoints.
VPC Endpoints: saves ~$32/month but adds 4 resources and requires DNS resolution config.

**Interview Talking Point**:
"NAT Gateway is correct for Phase 2 — covered by credits and simpler to debug during
initial setup. After credits run out, I've documented the swap to VPC endpoints:
traffic to ECR, S3, and Secrets Manager moves off the public internet onto the AWS
backbone, saving $32/month and closing the NAT-compromise attack surface. The plan
is in DECISIONS.md. The infrastructure supports it without application changes."

---

## Phase 2 — What You Learned (Terraform AWS Infrastructure)

**Comments are not optional on Terraform — they're part of the security review.**
Every `resource` block has a plain-English comment above it. Every non-obvious argument
has an inline comment explaining WHY, not just what. This is what separates infrastructure
written to be run from infrastructure written to be reviewed. A senior engineer reading
`transit_encryption_enabled = true` with no comment sees "ok". With a comment explaining
the VPC-compromise scenario, they see "this person thought about threat modelling."

**Least-privilege IAM means one reason per permission — document it.**
The ECS task role has exactly three actions: GetSecretValue (scoped to /yorkpulse/prod/*),
CreateLogStream + PutLogEvents (scoped to the specific log group), and elasticache:Connect
(scoped to the specific cluster). Every permission has a comment explaining what it enables
and why the scope is as narrow as it is. If you can't explain a permission, remove it.

**Terraform `depends_on` prevents race conditions that are invisible until production.**
The ECS service depends on the HTTPS listener existing before ECS registers tasks. Without
this, Terraform might create the ECS service before the ALB listener is ready, causing
temporary health check failures on the first apply. Race conditions in infrastructure are
the hardest class of bug — document and prevent them explicitly.

**WAF association is a separate resource from the WAF Web ACL.**
Creating the WAF Web ACL does nothing until you create `aws_wafv2_web_acl_association`.
An unconfigured WAF in "defined but not enforced" state is a common mistake — the
developer thinks they have WAF protection when they don't.

**ElastiCache auth tokens have character restrictions you won't find until apply fails.**
The auth_token for ElastiCache cannot contain "@" or "/" characters. If you generate one
with secrets.token_hex() (which can contain these), the ElastiCache cluster creation fails
with a cryptic error. Use secrets.token_urlsafe(32) and filter out restricted characters,
or use a dedicated generation command. Documented in secrets.tf.

---

## Decision 012 — DNS Migration: Vercel DNS → Route 53

**Decision**: Migrate yorkpulse.com DNS from Vercel to AWS Route 53. Vercel frontend records are preserved — only the DNS nameserver authority moves to AWS.

**Options Considered**:
1. Keep DNS on Vercel — Vercel manages DNS, no migration needed
2. Migrate to Route 53 — AWS manages DNS, enables ACM validation + Route 53 health checks
3. Use a third-party DNS provider (Cloudflare) — free, feature-rich, but adds a non-AWS dependency

**Why This Choice**:
ACM (AWS Certificate Manager) validates TLS certificates by checking for a specific CNAME record in the authoritative DNS for the domain. If DNS is on Vercel, you must manually add validation records to Vercel's dashboard — you cannot automate this with Terraform. Moving DNS to Route 53 means the ACM validation CNAME is a Terraform resource (`aws_route53_record.acm_validation`) — the certificate can be fully automated in CI/CD (Phase 4).

Route 53 also enables:
- Route 53 health checks for api.yorkpulse.com (ALB alias records stop resolving if ALB is unhealthy)
- Latency-based routing (future: route Canadian users to us-east-1, European users to eu-west-1)
- Keeping all production infrastructure in one AWS account for unified billing and observability

**Vercel frontend preserved**:
The Next.js frontend stays on Vercel (yorkpulse.com → A 76.76.21.21, www → CNAME cname.vercel-dns-017.com). Only the backend (api.yorkpulse.com) moves to the ALB. No Vercel rebuild or redeployment is needed.

**Tradeoffs**:
Route 53 costs $0.50/month per hosted zone + $0.40/million queries. At YorkPulse's traffic level, total DNS cost is ~$0.50-$1.00/month. Vercel DNS was free. The ACM automation and health-check capabilities are worth $0.50/month.

CAA records are added for both the root domain and api subdomain to prevent any certificate authority (other than Amazon, Let's Encrypt, Sectigo, Google) from issuing certificates — even via social engineering attacks on the CA.

DMARC starts at `p=none` (monitor-only). After confirming DKIM and SPF pass rates via the Brevo DMARC reports, graduate to `p=quarantine` then `p=reject`.

**Interview Talking Point**:
"Moving DNS to Route 53 unlocks full Terraform automation of the TLS certificate lifecycle. ACM validation CNAMEs become code — the certificate is created, validated, and associated with the ALB in a single `terraform apply`. With Vercel DNS, each ACM renewal requires a manual DNS record update. Route 53 also gives me alias records on the root domain that integrate with Route 53 health checks — if the ALB goes unhealthy, Route 53 stops resolving api.yorkpulse.com automatically."

> More decisions added as project progresses.
> Each phase ends with a "What You Learned" retrospective.
