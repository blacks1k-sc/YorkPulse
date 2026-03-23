I want you to act as the technical mentor and architect for this entire project.
Before writing a single line of code, do the following:

1. Create a file called CLAUDE.md at the project root with this exact content:

---
# CLAUDE.md — Project Mentor File
> Claude Code reads this file automatically. Update it continuously as the project evolves.

## Project Identity
- Name: yorkpulse-multicloud
- App: YorkPulse (yorkpulse.com) — a student community platform for York University
  - Features: The Vault (anonymous forum), Marketplace (buy/sell), Side Quests (buddy finder),
    Course Chat, Gigs, and real-time Messaging
- Purpose: Portfolio showcase demonstrating multi-cloud (AWS + Azure) deployment,
  CI/CD pipelines, IAM security, and Infrastructure as Code using Terraform
  on top of a real, production-grade full-stack application
- Developer: 4th year CS student, complete cloud beginner, learning by building
- Goal: Impress senior engineers, recruiters, and hiring managers on LinkedIn

## Tech Stack
- Backend: FastAPI (Python 3.12) — already live on Render
- Frontend: Next.js 16 (React 19) — already live on Vercel
- Database: PostgreSQL via Supabase (production) + asyncpg driver
- Cache / Rate-limiting: Redis
- Auth: Passwordless OTP via email (Gmail SMTP), JWT tokens
- Storage: Supabase Storage (images/attachments)
- Containerization: Docker
- AWS: ECR, ECS Fargate, VPC, ALB, IAM, CloudWatch, RDS PostgreSQL (prod migration target)
- Azure: Container Apps (backend mirror) OR Static Web Apps (frontend mirror), Azure Monitor
- IaC: Terraform (both clouds)
- CI/CD: GitHub Actions with OIDC (no hardcoded secrets)

## Current Phase
Phase 1 — Dockerizing the existing YorkPulse app

## Phases
- [x] Phase 0: Project scaffolding and mentor setup
- [ ] Phase 0.5: Terraform remote state bootstrap (S3 + DynamoDB) — run once before all other Terraform
- [ ] Phase 1: Dockerize FastAPI backend + Next.js frontend
- [ ] Phase 2: Terraform for AWS (VPC + ECR + ECS Fargate + ALB + IAM + Secrets Manager)
- [ ] Phase 3: Terraform for Azure (Container Apps + Static Web Apps SSR-aware config)
- [ ] Phase 4: GitHub Actions CI/CD with OIDC + DevSecOps gates (Trivy + Checkov) + Environment approvals
- [ ] Phase 5: Observability (CloudWatch + Azure Monitor)
- [ ] Phase 6: README + COST.md + architecture diagram + LinkedIn post

## Architecture Decisions Log
> See DECISIONS.md for full reasoning on every decision

| Decision | Choice | Date |
|----------|--------|------|
| App | YorkPulse (real production app) | 2026-03-20 |
| Backend framework | FastAPI | pre-existing |
| Frontend framework | Next.js 16 | pre-existing |
| IaC tool | Terraform | 2026-03-20 |
| Secret management | GitHub OIDC (no static credentials) | 2026-03-20 |
| Terraform state | S3 + DynamoDB remote backend | 2026-03-20 |
| Security scanning | Trivy + Checkov in CI (DevSecOps gate) | 2026-03-20 |
| Deploy strategy | Rolling deployment (not blue/green) | 2026-03-20 |
| GitHub Environments | staging (auto) + production (manual approval) | 2026-03-20 |
| Next.js on Azure | SSR via Container Apps (not Static Web Apps) | 2026-03-20 |

## Rules Claude Code Must Follow
1. ALWAYS update CLAUDE.md when a phase is completed or a major decision is made
2. ALWAYS add an entry to DECISIONS.md for every non-trivial technical choice
3. ALWAYS add plain-English comments above every function — the developer is learning
4. NEVER use hardcoded secrets, API keys, or credentials anywhere
5. ALWAYS use least-privilege IAM — document exactly why each permission exists
6. When writing Terraform, explain every resource block with inline comments
7. When something could have been done multiple ways, explain the tradeoff in DECISIONS.md
8. At the end of each phase, add a "What You Just Learned" section to DECISIONS.md
9. Keep the README.md updated as a living document
10. Flag anything that would concern a senior engineer in a code review

## SSR Note (Next.js 16 + Azure)
Next.js 16 with App Router uses Server-Side Rendering (SSR) — it is NOT a static site.
Azure Static Web Apps supports SSR only via its hybrid rendering mode (backed by Azure Functions).
If SSR complexity is too high, deploy the frontend on Azure Container Apps instead.
Document this decision in DECISIONS.md. The infra/azure/main.tf must account for this explicitly.

## Folder Structure
yorkpulse-multicloud/
├── backend/                # FastAPI application (existing YorkPulse backend)
├── frontend/               # Next.js 16 app (existing YorkPulse frontend)
├── infra/
│   ├── bootstrap/         # S3 + DynamoDB for Terraform remote state — run ONCE manually
│   ├── aws/               # Terraform for AWS (VPC, ECR, ECS, ALB, IAM, Secrets Manager)
│   └── azure/             # Terraform for Azure (Container Apps, SSR config)
├── .github/
│   └── workflows/         # GitHub Actions CI/CD (DevSecOps: Trivy + Checkov gates)
├── docs/
│   └── architecture.png   # Architecture diagram
├── tests/                 # pytest test suite
├── CLAUDE.md              # This file — mentor brain
├── DECISIONS.md           # Architecture decision log
├── SECURITY.md            # Security posture documentation
├── COST.md                # Estimated AWS + Azure costs vs current Render + Vercel
└── README.md              # Public-facing project README
---

2. Create a file called DECISIONS.md at the project root with this exact content:

---
# DECISIONS.md — Architecture Decision Record
> Every non-trivial decision made in this project is logged here with full reasoning.
> This file exists so the developer can reflect, learn, and speak confidently about
> every choice in an interview or LinkedIn post.

## How to Read This File
Each entry follows this format:
- **Decision**: What was decided
- **Options Considered**: What alternatives existed
- **Why This Choice**: The reasoning
- **Tradeoffs**: What we gave up
- **Interview Talking Point**: How to explain this to a recruiter

---

## Decision 001 — App Choice: YorkPulse (real production app)

**Decision**: Use the existing YorkPulse platform as the showcase application instead of building a toy app

**Options Considered**:
1. Hello World API — too simple, no real-world value
2. URL Shortener — simple and common, but purpose-built to be discarded
3. Todo/Notes API — overdone, every bootcamp grad has one
4. YorkPulse (yorkpulse.com) — a real student community platform already in production

**Why This Choice**:
YorkPulse is a real, deployed, full-stack application with a FastAPI backend, Next.js frontend,
PostgreSQL database, Redis cache, Supabase auth/storage, and real users. Deploying it on
multi-cloud infrastructure makes the portfolio piece credible — it's not a demo app built
just to be deployed, it's a real product being migrated to production-grade cloud infra.
Recruiters and senior engineers can actually visit yorkpulse.com and see the running app.

**Tradeoffs**:
More complex than a toy app. The existing codebase has environment-specific config,
Supabase dependencies, and Redis — all of which must be handled correctly in the cloud setup.
But this complexity is exactly what makes it impressive.

**Interview Talking Point**:
"Instead of deploying a hello-world app, I took YorkPulse — a real student platform I built
for York University — and built production-grade multi-cloud infrastructure around it.
This meant containerizing a FastAPI backend with Supabase and Redis dependencies,
writing Terraform for AWS ECS Fargate and Azure Container Apps, and wiring up a
GitHub Actions CI/CD pipeline with OIDC auth. Everything you see is based on real requirements,
not a toy problem."

---

## Decision 002 — IaC Tool: Terraform over AWS CDK / CloudFormation / Bicep

**Decision**: Use Terraform for infrastructure as code on both AWS and Azure

**Options Considered**:
1. AWS CDK — AWS-native, write infra in Python/TypeScript. Great for AWS-only.
2. CloudFormation — AWS-native, YAML/JSON. Verbose and AWS-locked.
3. Pulumi — like CDK but cloud-agnostic. Smaller community.
4. Terraform — cloud-agnostic HCL, massive community, works on AWS AND Azure

**Why This Choice**:
Since we're deploying on both AWS AND Azure, we need a tool that works on both clouds
with the same workflow. Terraform is the industry standard for this. One tool, two clouds,
consistent patterns. It's also the most requested IaC skill in job postings.

**Tradeoffs**:
HCL (HashiCorp Configuration Language) is a new language to learn. CDK would let us
use Python which we already know. But the multi-cloud capability is worth it.

**Interview Talking Point**:
"I chose Terraform because the project spans two cloud providers. Using cloud-native
tools like CDK or CloudFormation would have meant maintaining two completely different
IaC codebases. Terraform's provider model let me use the same workflow and state
management approach for both AWS and Azure."

---

## Decision 003 — Secret Management: GitHub OIDC over Static Credentials

**Decision**: Use OpenID Connect (OIDC) for GitHub Actions to authenticate with AWS and Azure

**Options Considered**:
1. Hardcode AWS_ACCESS_KEY_ID in GitHub Secrets — simple but dangerous
2. Long-lived IAM user keys in GitHub Secrets — common but bad practice
3. OIDC federated identity — no static credentials, tokens expire automatically

**Why This Choice**:
Static credentials are the #1 cause of cloud security breaches. If your GitHub repo
is ever compromised, a hardcoded key gives an attacker full access to your cloud account.
OIDC issues short-lived tokens only when the pipeline runs, scoped to exactly what it needs.
This is how mature engineering teams do it.

**Tradeoffs**:
More complex initial setup. Requires configuring a trust relationship between GitHub
and AWS/Azure. Worth every minute.

**Interview Talking Point**:
"Rather than storing long-lived AWS credentials in GitHub Secrets, I configured OIDC
federation so GitHub Actions assumes an IAM role with a short-lived token. The token
expires after the pipeline run, so there are no persistent credentials to leak.
This follows AWS security best practices and is what I'd do in production."

---

## Decision 004 — Terraform Remote State: S3 + DynamoDB

**Decision**: Store Terraform state in an S3 bucket with DynamoDB locking instead of locally

**Options Considered**:
1. Local state file (`terraform.tfstate`) — simplest, but dangerous in a team or CI/CD context
2. Terraform Cloud — managed state, but adds a new service dependency
3. S3 + DynamoDB — AWS-native, cheap, standard, works with GitHub Actions

**Why This Choice**:
If two engineers (or two CI/CD runs) run `terraform apply` simultaneously without state locking,
Terraform will make conflicting changes and corrupt the infrastructure state. DynamoDB provides
a distributed lock: only one apply runs at a time. The S3 bucket stores the state file with
versioning so you can roll back if something goes wrong.

**Tradeoffs**:
Must be bootstrapped manually once (chicken-and-egg: can't use Terraform to create the bucket
that stores Terraform state). The `infra/bootstrap/main.tf` is run once manually, then never again.

**Interview Talking Point**:
"I used S3 with versioning and a DynamoDB lock table as a remote backend for Terraform state.
This means every `terraform apply` — whether run locally or in GitHub Actions — acquires a lock
first, so concurrent runs can never corrupt the state. I bootstrapped this manually with a
separate `infra/bootstrap/` module, which is a standard pattern in production Terraform setups."

---

## Decision 005 — DevSecOps Security Gate: Trivy + Checkov in CI

**Decision**: Add Trivy (container CVE scanning) and Checkov (Terraform misconfiguration scanning)
as required CI jobs that run before any deploy

**Options Considered**:
1. No scanning — fast, but ships vulnerabilities to production silently
2. Snyk — popular but requires an account and has free-tier limits
3. Trivy + Checkov — both open-source, zero accounts needed, run in GitHub Actions

**Why This Choice**:
Security scanning in the pipeline (not as a manual afterthought) is the difference between
DevOps and DevSecOps. Trivy catches known CVEs in the Docker base image and dependencies.
Checkov catches Terraform misconfigs (e.g., S3 bucket without encryption, security group open to 0.0.0.0/0).
The pipeline FAILS if critical CVEs or HIGH severity misconfigs are found — this enforces security
as a hard requirement, not a suggestion.

**Tradeoffs**:
Adds ~2-3 minutes to the CI pipeline. Worth it: catching a critical CVE in CI is free;
fixing a breach in production is not.

**Interview Talking Point**:
"I made this a DevSecOps pipeline, not just DevOps. Before any image is pushed to ECR,
Trivy scans it for CVEs and the pipeline fails on critical findings. Checkov scans all
Terraform files for security misconfigurations — things like open security groups or
unencrypted S3 buckets — and fails on HIGH severity. Security is a gate, not an audit."

---

## Decision 006 — Deployment Strategy: Rolling over Blue/Green

**Decision**: Use ECS rolling deployment instead of blue/green

**Options Considered**:
1. Blue/green (AWS CodeDeploy) — zero-downtime, instant rollback, but complex and costs more
2. Rolling deployment — built into ECS, simpler Terraform, still zero-downtime with health checks
3. Recreate — kills all tasks then starts new ones (downtime, never acceptable for prod)

**Why This Choice**:
Rolling deployment is ECS's default behavior. It replaces tasks one at a time, waiting for
each new task to pass ALB health checks before terminating the old one. For YorkPulse's traffic
levels, this gives effectively zero downtime without the added complexity of CodeDeploy.
Rollback is achieved by redeploying the previous ECR image tag (documented in COMMANDS.md —
achievable in under 2 minutes).

**Tradeoffs**:
During a rolling deploy, both old and new versions of the app run simultaneously for a short window.
If you push a breaking DB schema change alongside an app change, this can cause errors.
Mitigation: always make schema changes backwards-compatible before deploying new app code.

**Interview Talking Point**:
"I chose rolling deployment over blue/green because the added operational complexity of
CodeDeploy isn't justified at YorkPulse's scale. ECS rolling updates replace tasks one at a time,
waiting for ALB health checks to pass before terminating old tasks — effectively zero downtime.
Rollback is a single AWS CLI command to force a new deployment with the previous image tag."

---

## Decision 007 — GitHub Environment Gates: Staging + Production

**Decision**: Use two GitHub Environments — staging (auto-deploy) and production (manual approval)

**Options Considered**:
1. Deploy directly to production on every push to main — fast but dangerous
2. Branch-based environments (main → staging, tags → prod) — more git discipline needed
3. GitHub Environments with protection rules — approval gate built into GitHub, no extra tooling

**Why This Choice**:
GitHub Environments let you require a named reviewer to approve a production deploy before
GitHub Actions proceeds. Staging auto-deploys on every push to main so you can verify the
change works. Production only deploys after a human has signed off. This is a standard
pattern at companies with real users — pushing to prod without review is how outages happen.

**Tradeoffs**:
Manual approval adds latency to production deploys. Acceptable for a platform with real users.

**Interview Talking Point**:
"I configured two GitHub Environments. Staging auto-deploys on every push to main.
Production has a required reviewer — meaning even I have to explicitly approve before
the GitHub Actions job proceeds to deploy to the live ECS service. This protects real users
from accidental deploys and is the same pattern used at most companies doing continuous delivery."

---

## Decision 008 — Next.js 16 SSR on Azure: Container Apps over Static Web Apps

**Decision**: Deploy the Next.js 16 frontend on Azure Container Apps, not Azure Static Web Apps

**Options Considered**:
1. Azure Static Web Apps — free, great for static/ISG sites, supports SSR via Azure Functions (hybrid mode)
2. Azure Container Apps — runs the Next.js Docker container directly, full SSR support, scales to zero
3. Keep on Vercel — simplest, but doesn't demonstrate Azure frontend deployment

**Why This Choice**:
Next.js 16 with App Router uses Server-Side Rendering for many routes. Azure Static Web Apps
hybrid rendering mode is limited and requires specific Next.js version compatibility.
Azure Container Apps can run the exact same Docker container that runs locally, with full SSR,
no compatibility constraints, and scale-to-zero billing. It's the more robust choice.

**Tradeoffs**:
Container Apps costs slightly more than Static Web Apps (which is free tier). But scale-to-zero
means the Azure frontend mirror costs ~$0 when not in use, since this is a secondary instance.

**Interview Talking Point**:
"Next.js 16 with App Router is a full SSR framework, not a static site generator.
I deployed it on Azure Container Apps rather than Static Web Apps because Container Apps
can run the Docker image directly with full SSR support and no version constraints.
Scale-to-zero means the Azure copy costs essentially nothing when idle."

---

## Decision 009 — RDS PostgreSQL: Deliberately Deferred

**Decision**: Do not migrate the YorkPulse database from Supabase to AWS RDS.

**Options Considered**:
1. Migrate DB to RDS immediately — full AWS-native story, but high risk for real users
2. Run dual-DB (Supabase + RDS simultaneously) — complex, error-prone, unnecessary
3. Keep Supabase DB, migrate only compute to AWS — clean, safe, correct scope for this project

**Why This Choice**:
Supabase Auth is tightly coupled to the Supabase PostgreSQL instance — auth metadata, user
records, and RLS policies all live there. Migrating the DB while keeping Supabase Auth is
either a dual-DB mess or a full Auth migration, neither of which is justified here.
YorkPulse has real users. The compute migration (Render → ECS Fargate) is the high-value story.
The $100 AWS credit is better spent on WAF, ElastiCache, and NAT Gateway.

**Future RDS migration plan (documented in README)**:
pg_dump → RDS restore → row count validation → DNS cutover (Route 53 weighted routing) → rollback plan.
Full plan exists and is executable — not the right trade-off at initial migration.

**Interview Talking Point**:
"I made a deliberate decision not to migrate the database. Supabase Auth is tightly coupled
to the Supabase DB — migrating one without the other is a full Auth migration, not justified
for this scope. Here's exactly what the migration would require and what's blocking it.
The compute migration to ECS is the high-value story."

---
> More decisions will be added as the project progresses.
> Each phase completion will include a "What You Learned" retrospective.
---

3. Create SECURITY.md with this content:

---
# Security Posture

## Principles
- Least privilege IAM: every role has only the permissions it needs, nothing more
- No static credentials: OIDC used for all CI/CD authentication
- No secrets in code: all sensitive values via environment variables or secret managers
- HTTPS only: TLS enforced at load balancer / CDN layer
- Non-root containers: all Docker images run as non-root user
- OTP-based auth: YorkPulse uses passwordless email OTP — no passwords to leak

## IAM Roles (to be documented as created)
| Role | Purpose | Permissions | Why These Permissions |
|------|---------|-------------|----------------------|
| TBD  | TBD     | TBD         | TBD                  |

## Threat Model
- Compromised GitHub repo → mitigated by OIDC (no static creds to steal)
- Container escape → mitigated by non-root user + Fargate isolation
- SQL injection → mitigated by parameterized queries (asyncpg + SQLAlchemy)
- OTP spam → mitigated by rate limiting (Redis) and redirect of unregistered users to signup
- Secrets leak → DATABASE_URL, JWT_SECRET_KEY, SUPABASE_KEY etc. stored in AWS Secrets Manager / Azure Key Vault, never in code
---

4. Create COST.md with this content:

---
# COST.md — Estimated Monthly Cloud Costs

> This file documents what the multi-cloud YorkPulse infrastructure costs to run,
> the credits available, how long they last, and how this compares to the current setup.

## Credits Available
| Cloud | Credit Amount | Source |
|-------|--------------|--------|
| AWS | $100 | AWS promotional credit |
| Azure | $100 | Azure promotional credit |
| **Total** | **$200** | — |

## Current Setup (Baseline — before this project)
| Service | Provider | Monthly Cost | Limitation |
|---------|---------|-------------|-----------|
| Backend (FastAPI) | Render (free tier) | $0 | ~15 min cold starts after inactivity |
| Frontend (Next.js) | Vercel (hobby tier) | $0 | Limited bandwidth, no team features |
| Database | Supabase (free tier) | $0 | Project pauses after 7 days of inactivity |
| Redis | External (free tier) | $0 | Limited memory, shared |
| **Total** | | **$0/month** | Multiple production limitations |

## AWS Full Stack — Monthly Cost
> With $100 AWS credit, this runs for approximately **2.5–3 months** at no out-of-pocket cost.

| Service | Config | Est. Cost/month |
|---------|--------|----------------|
| ECS Fargate | 0.5 vCPU, 1 GB RAM, ~720 hrs/month | ~$15 |
| ALB | 1 load balancer, low traffic | ~$16 |
| ECR | 1 image repo, ~1GB storage | ~$0.10 |
| RDS PostgreSQL | db.t3.micro, 20GB, Single-AZ | ~$15 |
| ElastiCache Redis | cache.t3.micro, Single-AZ | ~$12 |
| NAT Gateway | 1 AZ, low data transfer | ~$32 |
| CloudWatch | Logs (30-day retention) + metrics + alarms | ~$3 |
| Secrets Manager | ~10 secrets | ~$4 |
| Data transfer | Low outbound traffic | ~$1 |
| **AWS Total** | **Full production stack** | **~$98/month** |

> Note: NAT Gateway is included here because $100 credit covers the full production stack.
> After credits run out, replace NAT Gateway with VPC endpoints to drop to ~$66/month.

### What the AWS credit unlocks (vs cost-constrained setup)
- **RDS PostgreSQL** (db.t3.micro) — replaces Supabase free DB with a self-managed, always-on database
- **ElastiCache Redis** (cache.t3.micro) — replaces external Redis with a VPC-internal, low-latency cache; enables the rate-limiting middleware in `backend/app/main.py`
- **NAT Gateway** — simpler VPC networking; no need to configure VPC endpoints for every AWS service
- **Larger Fargate task** (0.5 vCPU / 1GB RAM instead of 0.25/0.5) — headroom for FastAPI under real load

## Azure Full Stack — Monthly Cost
> With $100 Azure credit, this runs for approximately **6–12 months** due to scale-to-zero.

| Service | Config | Est. Cost/month |
|---------|--------|----------------|
| Container Apps (FastAPI mirror) | 0.5 vCPU, 1 GB RAM, scale-to-zero | ~$5–10 when active, $0 when idle |
| Container Apps (Next.js SSR frontend) | 0.5 vCPU, 1 GB RAM, scale-to-zero | ~$8–12 when active, $0 when idle |
| Azure Key Vault | ~10 secrets | ~$0.03 |
| Azure Monitor | Basic logs + alerts | ~$1–3 |
| Managed TLS (Container Apps) | Included | $0 |
| **Azure Total** | **Active traffic** | **~$15–25/month** |
| **Azure Total** | **Mostly idle (portfolio)** | **~$2–5/month** |

> Azure Container Apps scale-to-zero means the Azure side costs almost nothing when not serving traffic,
> which is expected for a portfolio mirror. The $100 Azure credit will last the lifetime of the project.

## Credit Runway Summary
| Cloud | Monthly Cost | Credit | Months Covered |
|-------|-------------|--------|---------------|
| AWS (full stack, active) | ~$98 | $100 | ~1 month |
| AWS (after credits: no NAT GW) | ~$66 | — | out-of-pocket |
| Azure (mostly idle) | ~$2–5 | $100 | 20–50 months |
| Azure (active traffic) | ~$15–25 | $100 | 4–6 months |

> **Decision**: Use full AWS stack with NAT Gateway + RDS + ElastiCache while credits last.
> When AWS credits run out, swap NAT Gateway for VPC endpoints (saves ~$32/month) to bring cost to ~$66/month.
> Document this transition point in a future DECISIONS.md entry.

## Cost Best Practices Applied (regardless of credits)
- **CloudWatch log retention**: 30 days — prevents unbounded log storage cost
- **Single-AZ for RDS and ElastiCache**: Multi-AZ doubles the cost; not needed for a portfolio project
- **Azure scale-to-zero**: Azure Container Apps idle at $0 by default
- **Free managed TLS**: Azure Container Apps and ACM (AWS) both provide free SSL certs
- **ECR lifecycle policy**: Auto-delete untagged images older than 30 days to keep storage minimal
---

5. Create a placeholder README.md:

5. Create a file called COMMANDS.md at the project root with this content:

---
# COMMANDS.md — Terminal Commands Reference
> Every command used in this project is logged here with plain-English explanations.
> This file exists so the developer builds real muscle memory and can explain
> every command confidently in interviews.

## How to Read This File
Each command is documented as:
- **Command**: The exact terminal command
- **What it does**: Plain English explanation
- **When you use it**: The real-world context
- **Output to expect**: What success looks like

---
> Commands will be added here as the project progresses, organized by category:
> Docker | Terraform | AWS CLI | Azure CLI | GitHub Actions | Git

## Rollback — Redeploy Previous Image (AWS ECS)

**Command**:
```bash
# Step 1: Find the previous image tag in ECR
aws ecr describe-images \
  --repository-name yorkpulse-backend \
  --query 'sort_by(imageDetails,& imagePushedAt)[-2].imageTags[0]' \
  --output text

# Step 2: Force a new ECS deployment using that image tag
aws ecs update-service \
  --cluster yorkpulse-cluster \
  --service yorkpulse-backend \
  --force-new-deployment \
  --task-definition yorkpulse-backend:<PREVIOUS_REVISION>
```

**What it does**: Tells ECS to roll out a new deployment using the task definition revision
that points to the previous Docker image tag. ECS performs a rolling update with health checks.

**When you use it**: When a bad deploy goes to production and you need to revert in under 2 minutes.

**Output to expect**: ECS begins a rolling replacement of tasks. ALB health checks verify the old
image is healthy before fully cutting over. Watch progress with:
```bash
aws ecs describe-services --cluster yorkpulse-cluster --services yorkpulse-backend \
  --query 'services[0].deployments'
```
---

IMPORTANT RULE: Every time you introduce a terminal command anywhere in this project
(in instructions, scripts, CI/CD files, or Terraform), you MUST also add it to
COMMANDS.md under the appropriate category with full explanation. Never assume the
developer knows what a command does — always document it.

---
# yorkpulse-multicloud

> YorkPulse (yorkpulse.com) — a real student community platform for York University,
> deployed on multi-cloud infrastructure with a full CI/CD pipeline,
> Infrastructure as Code, and security-first IAM design.

## Architecture
*(diagram coming in Phase 6)*

## Tech Stack
- **App**: YorkPulse — student community platform (yorkpulse.com)
- **Backend**: FastAPI (Python 3.12) + PostgreSQL + Redis + Supabase
- **Frontend**: Next.js 16 (React 19)
- **Infrastructure**: Terraform
- **AWS**: ECS Fargate, ECR, VPC, ALB, CloudWatch
- **Azure**: Container Apps (backend mirror), Azure Monitor
- **CI/CD**: GitHub Actions with OIDC
- **Security**: Least-privilege IAM, no static credentials

## Phases
See CLAUDE.md for current progress.
---

After creating all four files, confirm by listing the project root directory structure.
Then tell me: what is the next concrete action for Phase 1 (Dockerizing the YorkPulse backend)?
