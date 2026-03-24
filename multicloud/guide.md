# Multi-Cloud Deployment Guide — YorkPulse

> YorkPulse (yorkpulse.com) is a real student community platform for York University.
> This guide explains what parts of the app get deployed where (AWS vs Azure),
> what each cloud service does, and what you can do with each one.
> Built as a portfolio showcase: multi-cloud infra, Terraform IaC, GitHub Actions CI/CD, OIDC IAM.

---

## The App: YorkPulse

YorkPulse is a full-stack student platform with:
- **Backend**: FastAPI (Python 3.12) — already live on Render
- **Frontend**: Next.js 16 (React 19) — already live on Vercel
- **Database**: PostgreSQL (Supabase)
- **Cache / Rate-limiting**: Redis
- **Auth**: Passwordless OTP via email, JWT tokens
- **Storage**: Supabase Storage (profile images, attachments)
- **Features**: The Vault (anonymous forum), Marketplace, Side Quests, Course Chat, Gigs, Messaging

The goal of this project is NOT to rewrite YorkPulse — it's to lift it onto
production-grade multi-cloud infrastructure using Terraform, Docker, and GitHub Actions.

---

## What Gets Deployed Where

### AWS — Primary Backend Cloud

AWS hosts the FastAPI backend runtime, cache, and all backend secrets.
AWS is chosen as the primary cloud because ECS Fargate + ECR is the industry-standard
serverless container stack most hiring managers and senior engineers expect to see.

| Service | AWS Equivalent | What It Does in YorkPulse |
|---------|---------------|--------------------------|
| Container Registry | **ECR** | Single source of truth for all Docker images (backend + frontend). GitHub Actions pushes here on every merge. |
| Container Runtime | **ECS Fargate** | Runs the FastAPI backend container (0.5 vCPU / 1GB RAM). Serverless — no EC2 instances to manage. |
| Load Balancer | **ALB** (Application Load Balancer) | Receives public HTTPS traffic, routes to ECS tasks. Replaces Render's proxy. |
| Web Application Firewall | **AWS WAF** | Attached to the ALB. Blocks SQLi, XSS, and known malicious IPs before requests reach application code. Blocked requests logged to CloudWatch. |
| Networking | **VPC + NAT Gateway** | Isolates ECS and ElastiCache in private subnets. NAT Gateway allows outbound internet (Supabase Storage, Gmail SMTP) from private subnets without exposing them publicly. |
| Cache | **ElastiCache Redis** (cache.t3.micro) | VPC-internal Redis with transit encryption enabled and auth token stored in Secrets Manager (never hardcoded). Enables the rate-limiting middleware in `main.py`. |
| Secrets | **Secrets Manager** | Stores `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET_KEY`, `REDIS_URL`, `SMTP_PASSWORD`, ElastiCache auth token. Injected into ECS at runtime — never in the Docker image. |
| Alerting | **SNS** (`yorkpulse-alerts`) | SNS topic subscribed to `yorkpulse.app@gmail.com`. All CloudWatch alarms notify this topic. |
| Observability | **CloudWatch** | Structured JSON logs from FastAPI. Alarms for 5xx errors, high CPU, memory, WAF blocked request spikes — all routed to SNS. |
| IAM | **IAM Roles + OIDC** | Least-privilege roles for the ECS task and for the GitHub Actions deploy pipeline. |

**Terraform folder:** `infra/aws/`

#### AWS Deployment Flow

```
GitHub push to main
  → GitHub Actions (OIDC → assumes IAM role)
    → Trivy + Checkov security scan (pipeline fails if CRITICAL CVEs or HIGH misconfigs)
      → docker build → push to ECR
        → ECS Fargate pulls new image → rolling deploy
          → WAF (attached to ALB) filters SQLi, XSS, bad IPs
            → ALB routes clean traffic to ECS tasks
              → FastAPI reads secrets from Secrets Manager
                → Connects to Supabase (DB + Auth + Storage) + ElastiCache (Redis)
                  → CloudWatch collects logs → SNS alerts on alarm breach
```

---

### Azure — Secondary / Frontend Cloud

Azure mirrors the backend as a second cloud and/or hosts a copy of the Next.js frontend.
This demonstrates true multi-cloud capability — the same app running on two different providers.

| Service | Azure Equivalent | What It Does in YorkPulse |
|---------|-----------------|--------------------------|
| Frontend Hosting | **Container Apps** | Hosts the Next.js 16 frontend with full SSR support. Static Web Apps hybrid mode is insufficient for App Router SSR — Container Apps runs the Docker container directly. Scale-to-zero. Free managed TLS. |
| Backend Mirror | **Container Apps** | Runs the same FastAPI Docker image from ECR on Azure. Scale-to-zero when idle. Demonstrates true multi-cloud. |
| Secrets | **Azure Key Vault** | Stores frontend env vars (`NEXT_PUBLIC_API_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_URL`) injected into Container Apps at deploy time. |
| Observability | **Azure Monitor** | Logs + metrics for both Container Apps (backend mirror + Next.js frontend). |
| Identity | **Workload Identity (OIDC)** | GitHub Actions authenticates to Azure without any stored client secrets or passwords. |

**Terraform folder:** `infra/azure/`

---

## Service Decision Summary

| Component | Deployed On | Why |
|-----------|------------|-----|
| FastAPI backend (primary) | **AWS ECS Fargate** | Industry-standard serverless container platform |
| Next.js frontend | **Azure Container Apps** | SSR requires a running Node.js server; Static Web Apps hybrid mode is version-limited and insufficient |
| Redis / Cache | **AWS ElastiCache** (cache.t3.micro) | Same VPC as ECS → sub-millisecond latency, no public endpoint, transit encryption, enables `main.py` rate-limiting |
| Secrets (backend) | **AWS Secrets Manager** | Injected into ECS at runtime; never in code or Docker image |
| Secrets (frontend) | **Azure Key Vault** | Injected into Next.js Container App at deploy time |
| WAF | **AWS WAF** (attached to ALB) | Blocks SQLi, XSS, bad IPs before hitting application code |
| Logs (backend) | **AWS CloudWatch** | Structured JSON logs from FastAPI; 30-day retention |
| Logs (frontend) | **Azure Monitor** | Logs + metrics from Next.js Container App |
| Alerting | **AWS SNS** → `yorkpulse.app@gmail.com` | All CloudWatch alarms notify the `yorkpulse-alerts` SNS topic |
| DB + Auth + Storage | **Supabase** (deliberate non-migration) | Auth is tightly coupled to Supabase DB; migrating a live DB mid-project risks data loss for real users. Documented in DECISIONS.md. |
| IaC | **Terraform** (both clouds) | One tool, two providers — most in-demand IaC skill in job postings |
| CI/CD | **GitHub Actions + OIDC** | No stored credentials; OIDC federation for both AWS and Azure |
| Security scanning | **Trivy + Checkov** in pipeline | Trivy: container CVE scan. Checkov: Terraform misconfiguration scan. Both are pipeline blockers. |
| Container registry | **AWS ECR** (single source of truth) | Both ECS (AWS) and Container Apps (Azure) pull from the same ECR registry |

---

## What You Can Do on Each Cloud

### AWS — What's Possible

- **Secrets injection**: `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET_KEY`, `REDIS_URL`, `SMTP_PASSWORD`, ElastiCache auth token — all in Secrets Manager, referenced in the ECS task definition. The container never sees them in plain text at build time.
- **WAF**: AWS WAF attached to the ALB with AWS managed rule groups (AWSManagedRulesCommonRuleSet, AWSManagedRulesSQLiRuleSet). Blocked requests logged to CloudWatch. $5/month covered by credits.
- **ElastiCache Redis** (cache.t3.micro): VPC-internal Redis with `transit_encryption_enabled = true` and an auth token stored in Secrets Manager. Same VPC as ECS → sub-millisecond latency, no public endpoint needed. Enables rate-limiting middleware in `backend/app/main.py`.
- **SNS alerting**: SNS topic `yorkpulse-alerts` subscribed to `yorkpulse.app@gmail.com`. Every CloudWatch alarm (5xx spike, high CPU, WAF blocked request surge, memory pressure) notifies this topic.
- **Auto-scaling**: ECS auto-scaling policy — scale out on CPU > 70% or ALB request count. YorkPulse traffic spikes around semester start; this handles it automatically.
- **Custom domain**: Point `api.yorkpulse.com` to the ALB via Route 53 + ACM (free managed TLS cert).
- **VPC Endpoints**: Traffic to ECR, S3, and Secrets Manager stays on the AWS private network via VPC endpoints — never traverses the public internet. Security benefit first, cost optimization second (saves ~$32/month vs NAT Gateway after credits run out).
- **Structured logging**: FastAPI already uses Python `logging` module. CloudWatch captures JSON logs with 30-day retention. Alarms on `ERROR` count > 10 in 5 min → SNS → email.
- **After credits run out (~5–6 weeks)**: Swap NAT Gateway for VPC endpoints. Cost drops from ~$88 to ~$56/month.

### Azure — What's Possible

- **Next.js SSR**: Container Apps runs the Next.js standalone Docker image directly — full App Router SSR support, no compatibility constraints, no Azure Functions workaround needed.
- **Scale-to-zero**: Both Container Apps (Next.js frontend + FastAPI mirror) scale to 0 replicas when idle → $0 cost. The $100 Azure credit will last the lifetime of this portfolio project.
- **Custom domain + free TLS**: Free managed TLS cert on Container Apps custom domains (e.g., `app.yorkpulse.com` for Next.js on Azure, `api-azure.yorkpulse.com` for the backend mirror).
- **Key Vault integration**: `NEXT_PUBLIC_API_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_URL` stored in Azure Key Vault and injected into the Next.js Container App at deploy time via Terraform. Same conceptual pattern as AWS Secrets Manager.
- **Azure Monitor alerts**: Alert on HTTP 5xx rate, response time P99 > 2s, or memory pressure — alerts visible in Azure Portal and exportable to email.

---

## CI/CD Pipeline Breakdown

```
On push to main:

  Job 1 — Deploy Backend to AWS
  ─────────────────────────────
  1. Checkout code
  2. Authenticate to AWS via OIDC (no AWS_ACCESS_KEY_ID stored anywhere)
  3. docker build -t yorkpulse-backend ./backend
  4. docker push to ECR
  5. Update ECS service → rolling deploy starts
  6. ECS pulls new image, drains old tasks, health checks ALB

  Job 2 — Deploy Frontend (Next.js SSR) to Azure Container Apps
  ──────────────────────────────────────────────────────────────
  1. Checkout code
  2. Authenticate to Azure via OIDC Workload Identity (no AZURE_CLIENT_SECRET stored)
  3. docker build --target runner -t yorkpulse-frontend ./frontend
  4. docker push to ECR (single registry — Azure Container Apps pulls from ECR)
  5. Update Azure Container App → rolling deploy of new Next.js image
```

No `AWS_ACCESS_KEY_ID`, no `AZURE_CLIENT_SECRET` stored in GitHub. Both clouds use OIDC federation.

---

## Environment Variables — Where They Come From in Production

| Variable | Used By | Cloud Source |
|----------|---------|-------------|
| `DATABASE_URL` | FastAPI | AWS Secrets Manager → ECS env (points to **Supabase** PostgreSQL — not migrated to RDS, see DECISIONS.md) |
| `REDIS_URL` | FastAPI | AWS Secrets Manager → ECS env (points to **ElastiCache** endpoint inside VPC) |
| `JWT_SECRET_KEY` | FastAPI | AWS Secrets Manager → ECS env |
| `SUPABASE_URL` | FastAPI | AWS Secrets Manager → ECS env |
| `SUPABASE_KEY` | FastAPI | AWS Secrets Manager → ECS env |
| `SUPABASE_URL` | Next.js | Azure Key Vault → Container Apps env |
| `SUPABASE_ANON_KEY` | Next.js | Azure Key Vault → Container Apps env |
| `SMTP_PASSWORD` | FastAPI (email OTP) | AWS Secrets Manager → ECS env |
| `ELASTICACHE_AUTH_TOKEN` | FastAPI | AWS Secrets Manager → ECS env (never hardcoded) |
| `CORS_ORIGINS` | FastAPI | ECS task definition env (non-secret) |
| `NEXT_PUBLIC_API_URL` | Next.js | Azure Key Vault → Container Apps env (non-secret but kept in Key Vault for consistency) |

---

---

## Phase 0.5 — Terraform Remote State Bootstrap

**Run this once manually before any other Terraform.**

`infra/bootstrap/main.tf` provisions:
- **S3 bucket** with versioning + AES-256 encryption → stores the `terraform.tfstate` file
- **DynamoDB table** with a `LockID` primary key → prevents concurrent `terraform apply` runs

Why this exists: if two engineers (or two CI/CD pipeline runs) run `terraform apply` at the same
time without a lock, Terraform writes conflicting state and corrupts your infrastructure.
The DynamoDB lock table ensures only one apply runs at a time.

**Chicken-and-egg note**: You can't use Terraform to create the S3 bucket that Terraform needs
to store its own state. This bootstrap folder is the one exception — run it manually once,
then all other Terraform modules reference it as their remote backend.

```hcl
# Every other infra module starts with this backend block:
terraform {
  backend "s3" {
    bucket         = "yorkpulse-terraform-state"
    key            = "aws/terraform.tfstate"   # or "azure/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "yorkpulse-terraform-locks"
    encrypt        = true
  }
}
```

---

## DevSecOps Pipeline (Security Gate in CI)

This is what makes the pipeline **DevSecOps**, not just DevOps.

Two security scanning jobs run in GitHub Actions **before** any image is pushed to ECR or any
deploy job starts. The pipeline **fails hard** if findings exceed the threshold.

### Trivy — Container CVE Scanner

Scans the built Docker image for known CVEs (Common Vulnerabilities and Exposures) in:
- The base OS image (e.g., Python Alpine or Debian)
- Installed pip packages (from `requirements.txt`)

Pipeline fails on: **CRITICAL** severity CVEs.

```yaml
- name: Scan Docker image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: yorkpulse-backend:${{ github.sha }}
    format: table
    exit-code: '1'           # fail the pipeline
    severity: 'CRITICAL'
```

### Checkov — Terraform Misconfiguration Scanner

Scans all `.tf` files for security misconfigurations before they are ever applied. Examples of
what it catches:
- S3 bucket without encryption or public-access block
- Security group open to `0.0.0.0/0` on all ports
- ECS task without read-only root filesystem
- Secrets Manager secret without KMS encryption

Pipeline fails on: **HIGH** or **CRITICAL** severity misconfigs.

```yaml
- name: Scan Terraform with Checkov
  uses: bridgecrewio/checkov-action@master
  with:
    directory: infra/
    soft_fail: false         # fail the pipeline
    check: CKV_AWS_*         # AWS checks only (add CKV_AZURE_* for Azure)
```

### Pipeline Job Order

```
push to main
  │
  ├── job: security-scan     (Trivy + Checkov) — MUST PASS
  │         │
  │         ▼ (only if security-scan passes)
  ├── job: build-push        (docker build → ECR push)
  │         │
  │         ▼
  ├── job: deploy-staging    (ECS deploy → staging environment, auto)
  │         │
  │         ▼ (requires manual approval from repo owner)
  └── job: deploy-production (ECS deploy → production environment)
```

---

## GitHub Environment Gates

Two GitHub Environments are configured in the repo settings:

| Environment | Deploy trigger | Protection rule |
|-------------|---------------|----------------|
| `staging` | Auto on every push to `main` | None — immediate deploy |
| `production` | After staging succeeds | Required reviewer (repo owner) must approve |

This means: even the repo owner has to explicitly click "Approve" before GitHub Actions
proceeds to touch the live ECS service. No accidental production deploys.

In the GitHub Actions YAML, production jobs declare:

```yaml
jobs:
  deploy-production:
    environment: production   # triggers the approval gate
    needs: deploy-staging
    ...
```

---

## Rollback Strategy

**Chosen approach**: Rolling deployment with manual ECR tag rollback.

ECS rolling deployment replaces tasks one at a time, waiting for ALB health checks before
terminating old tasks. This gives effectively zero downtime on deploys.

**Rollback in under 2 minutes**:

```bash
# 1. Find the previous image tag pushed to ECR
aws ecr describe-images \
  --repository-name yorkpulse-backend \
  --query 'sort_by(imageDetails,& imagePushedAt)[-2].imageTags[0]' \
  --output text

# 2. Force ECS to redeploy the previous task definition revision
aws ecs update-service \
  --cluster yorkpulse-cluster \
  --service yorkpulse-backend \
  --force-new-deployment \
  --task-definition yorkpulse-backend:<PREVIOUS_REVISION>
```

ECS begins a rolling replacement back to the old image. ALB health checks verify the old
version is healthy before cutting over. Watch progress:

```bash
aws ecs describe-services --cluster yorkpulse-cluster --services yorkpulse-backend \
  --query 'services[0].deployments'
```

**Why not blue/green?** ECS + CodeDeploy blue/green adds significant Terraform complexity
(two target groups, CodeDeploy deployment group, lifecycle hooks). At YorkPulse's current
traffic levels, rolling deployment with a fast image-tag rollback achieves the same safety
guarantee with far less infrastructure overhead.

---

## Next.js SSR on Azure — What You Need to Know

Next.js 16 with App Router is **not a static site**. Many routes use Server-Side Rendering (SSR),
which means a Node.js server must be running at request time. This has implications:

| Option | SSR Support | Cost | Complexity |
|--------|------------|------|-----------|
| Azure Static Web Apps (hybrid mode) | Partial — backed by Azure Functions, version-limited | Free tier | High — requires `staticwebapp.config.json` mapping |
| **Azure Container Apps** | Full — runs the Next.js Docker container directly | Scale-to-zero | Low |
| Vercel (keep existing) | Full | Free hobby tier | Zero (already deployed) |

**Decision**: Deploy Next.js on **Azure Container Apps** (not Static Web Apps).

The Next.js Dockerfile for Container Apps:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

This requires `output: 'standalone'` in `next.config.ts` for the standalone build to work
(it was removed from the main YorkPulse config for Vercel — add it back only in this Dockerfile context).

---

## Phase Checklist

| Phase | What Gets Built | Where |
|-------|----------------|-------|
| 0 | CLAUDE.md, DECISIONS.md, SECURITY.md, COMMANDS.md, COST.md | Local |
| 0.5 | `infra/bootstrap/main.tf` → S3 state bucket + DynamoDB lock table (run **once** manually) | AWS |
| 1 | Dockerize FastAPI backend + Next.js frontend (standalone mode for Container Apps) | Local |
| 2 | Terraform: VPC + ECR + ECS Fargate + ALB + **WAF** + ElastiCache + Secrets Manager + IAM + CloudWatch + **SNS** | AWS |
| 3 | Terraform: Azure Container Apps (FastAPI mirror + Next.js SSR frontend) + Key Vault + Azure Monitor | Azure |
| 4 | GitHub Actions: OIDC + Trivy + Checkov + staging env (auto-deploy) + production env (manual approval gate) | GitHub → AWS + Azure |
| 5 | CloudWatch dashboards + WAF logs + Azure Monitor alerts | AWS + Azure |
| 6 | README, COST.md final numbers, architecture diagram, LinkedIn post | — |

---

## COST.md — Estimated Monthly Costs

**Credits available: $100 AWS + $100 Azure**

| Setup | Monthly Cost | Credit Coverage |
|-------|-------------|----------------|
| Current (Render + Vercel + Supabase free tiers) | **$0** (with limitations: cold starts, pauses) | — |
| AWS full stack (ECS + WAF + ElastiCache + NAT GW + ALB + SNS + CloudWatch) | **~$88/month** | AWS $100 credit → **~5–6 weeks** |
| AWS after credits (swap NAT GW → VPC endpoints) | **~$56/month** | out-of-pocket |
| Azure (Container Apps, mostly idle / scale-to-zero) | **~$2–5/month** | Azure $100 credit → 20–50 months |
| Azure (Container Apps, active traffic) | **~$15–25/month** | Azure $100 credit → 4–6 months |

**AWS cost breakdown (no RDS — Supabase DB deliberately kept):**
| Service | Est. Cost/month |
|---------|----------------|
| ECS Fargate (0.5 vCPU / 1GB, ~720hrs) | ~$15 |
| ALB | ~$16 |
| AWS WAF (Web ACL + managed rule groups) | ~$5 |
| ElastiCache Redis (cache.t3.micro, Single-AZ) | ~$12 |
| NAT Gateway (1 AZ, low data) | ~$32 |
| CloudWatch (logs 30-day retention + metrics + alarms) | ~$3 |
| Secrets Manager (~10 secrets) | ~$4 |
| SNS + data transfer | ~$1 |
| **AWS Total** | **~$88/month** |

**Best practices applied regardless of credits:**
- CloudWatch log retention: 30 days (not unlimited)
- ElastiCache: Single-AZ only (Multi-AZ doubles cost, unnecessary for portfolio)
- Azure scale-to-zero: Container Apps idle at $0 by default
- ECR lifecycle policy: auto-delete untagged images older than 30 days
- After credits: swap NAT Gateway for VPC endpoints (saves ~$32/month)

---

## Folder Structure

```
yorkpulse-multicloud/
├── backend/                    # FastAPI app (existing YorkPulse backend)
│   ├── app/
│   ├── requirements.txt
│   └── Dockerfile              # ← Phase 1
├── frontend/                   # Next.js 16 app (SSR via standalone output)
│   ├── src/
│   ├── package.json
│   └── Dockerfile              # ← Phase 1 (standalone build for Container Apps)
├── infra/
│   ├── bootstrap/              # ← Phase 0.5 — run ONCE manually
│   │   └── main.tf             # S3 state bucket + DynamoDB lock table
│   ├── aws/
│   │   ├── main.tf             # VPC, NAT Gateway, ECR, ECS Fargate, ALB, ElastiCache
│   │   ├── waf.tf              # AWS WAF Web ACL + managed rule groups attached to ALB
│   │   ├── iam.tf              # ECS task role + GitHub OIDC trust (least-privilege)
│   │   ├── secrets.tf          # Secrets Manager entries (SUPABASE_KEY, JWT_SECRET_KEY, ELASTICACHE_AUTH_TOKEN etc.)
│   │   └── cloudwatch.tf       # Log groups (30-day retention) + alarms + SNS topic (yorkpulse-alerts → email)
│   └── azure/
│       ├── main.tf             # Container Apps (backend + Next.js SSR frontend)
│       ├── keyvault.tf         # Azure Key Vault for secrets
│       └── monitor.tf          # Azure Monitor alerts
├── .github/
│   └── workflows/
│       └── deploy.yml          # Full pipeline: Trivy → Checkov → build → staging → production (approval gate)
├── docs/
│   └── architecture.png        # Phase 6
├── CLAUDE.md
├── DECISIONS.md
├── SECURITY.md
├── COMMANDS.md                 # Includes rollback commands
├── COST.md                     # AWS + Azure cost breakdown vs Render + Vercel
└── README.md
```

---

## DECISIONS.md — RDS PostgreSQL: Deferred

> This entry goes in `DECISIONS.md`. It is one of the most important decisions in the project
> because it shows engineering maturity: knowing when NOT to migrate something.

**Decision**: Do not migrate the YorkPulse database from Supabase to AWS RDS at this time.

**Why deferred**:
- Supabase Auth is tightly coupled to the Supabase PostgreSQL instance — auth metadata, user records, and RLS policies all live in the same database. Migrating only the DB while keeping Supabase Auth would require either a dual-DB setup or a full Supabase Auth migration simultaneously.
- YorkPulse has real users. Migrating a live production database mid-project introduces data loss risk and application downtime that is not justified by portfolio value alone.
- The high-value story of this project is the **compute migration** (Render → ECS Fargate) and the multi-cloud pipeline, not the database layer.
- The $100 AWS credit is better spent on WAF, ElastiCache, and NAT Gateway than on an RDS instance that duplicates an already-working database.

**Future evolution (Phase 2 roadmap)**:
The full RDS migration plan is documented in README.md:
1. `pg_dump` from Supabase → compressed SQL file
2. Provision RDS PostgreSQL (db.t3.micro, Single-AZ) via Terraform
3. `pg_restore` into RDS
4. Row count validation across all tables (must match exactly)
5. Update `DATABASE_URL` in Secrets Manager to RDS endpoint
6. Blue/green DNS cutover (Route 53 weighted routing: 10% RDS → validate → 100% RDS)
7. Rollback plan: revert `DATABASE_URL` in Secrets Manager (< 2 minutes)

**Interview talking point**:
"I made a deliberate decision not to migrate the database. Supabase Auth is tightly coupled to the Supabase DB — migrating one without the other is either a dual-database mess or a full Supabase Auth migration, neither of which is justified for this project scope. Here's exactly what the migration would require and what's blocking it. The compute migration to ECS is the high-value story."

---

## README.md — Architecture Decisions Section

> This content belongs under an "Architecture Decisions" heading in `README.md`.

The database, auth, and file storage deliberately remain on Supabase.

Migrating production systems requires justification beyond portfolio value. Supabase Auth is tightly coupled to the Supabase PostgreSQL instance — RLS policies, auth metadata, and user records all reside there. Migrating the DB while keeping Supabase Auth is not a clean operation for a live platform with real users.

RDS migration is documented as a future Phase 2 evolution with a full cutover plan: `pg_dump` → RDS restore → row count validation → weighted DNS cutover → rollback procedure. The plan exists and is executable — it was simply not the right trade-off during initial cloud migration.

---

## SECURITY.md — VPC Endpoints

> This entry belongs in `SECURITY.md` under a "Network Security" section.

**VPC Endpoints for ECR, S3, and Secrets Manager**

Traffic from ECS tasks to the following AWS services stays entirely on the AWS private network via Interface VPC Endpoints — it never traverses the public internet:
- **ECR** (image pulls during ECS task startup)
- **S3** (ECR layer storage, CloudWatch log delivery)
- **Secrets Manager** (secret retrieval at container startup)

This is a **security decision first, cost optimization second**. Even with a NAT Gateway present, configuring VPC endpoints means sensitive operations (pulling production secrets, pulling Docker images) never leave the AWS backbone network. An attacker who compromises the NAT Gateway cannot intercept these requests.

After the AWS credit runs out, replacing the NAT Gateway with VPC endpoints also saves ~$32/month — but the security rationale stands regardless of cost.

---

## COMMANDS.md — Phase 0.5 Bootstrap (Terraform Remote State)

> These three commands go in `COMMANDS.md` under the `## Terraform` category.
> Run them **once** before any other Terraform work. Never run them again.

### Step 1 — Initialize the bootstrap module

```bash
cd infra/bootstrap
terraform init
```

**What it does**: Downloads the AWS Terraform provider and prepares the working directory.
Terraform needs to be initialized before it can plan or apply anything.

**When you use it**: Once, the very first time you enter the `infra/bootstrap/` directory.

**Output to expect**: `Terraform has been successfully initialized!`

---

### Step 2 — Preview what will be created

```bash
terraform plan
```

**What it does**: Shows you exactly what AWS resources Terraform will create — the S3 bucket
(with versioning and AES-256 encryption) and the DynamoDB table (for state locking) — without
actually creating anything. Always run this before `apply` so there are no surprises.

**When you use it**: Every time before `terraform apply`, to review changes before they happen.

**Output to expect**: `Plan: 2 to add, 0 to change, 0 to destroy.`

---

### Step 3 — Create the remote state infrastructure

```bash
terraform apply
```

**What it does**: Creates the two AWS resources shown in the plan:
1. An **S3 bucket** (`yorkpulse-terraform-state`) with versioning + server-side AES-256 encryption.
   This stores the `terraform.tfstate` file for all other Terraform modules.
2. A **DynamoDB table** (`yorkpulse-terraform-locks`) with a `LockID` primary key.
   This prevents two `terraform apply` runs from corrupting state simultaneously.

**When you use it**: Once only, immediately after `terraform plan` confirms the expected output.
After this runs, every other Terraform module (`infra/aws/`, `infra/azure/`) will reference this
S3 bucket as their remote backend.

**Output to expect**: `Apply complete! Resources: 2 added, 0 changed, 0 destroyed.`

> **Why this runs locally and not in CI**: This is the chicken-and-egg bootstrap. The CI pipeline
> uses the S3 bucket for state — but you need to create the bucket before the pipeline can use it.
> After this one-time manual apply, commit the `terraform.tfstate` for the bootstrap module itself
> to git (it only contains the S3 and DynamoDB resource — no secrets).

---

## Key Constraints to Know

- **Database deliberately stays on Supabase.** Supabase Auth is tightly coupled to the Supabase DB (auth metadata, RLS policies). Migrating the DB mid-project risks data loss and downtime for real users. RDS migration is documented in DECISIONS.md as a future evolution with a full cutover plan (pg_dump → restore → row count validation → DNS cutover → rollback).
- **Redis**: ElastiCache (cache.t3.micro) replaces external Redis. Lives inside the VPC — sub-ms latency to ECS, no public endpoint. `transit_encryption_enabled = true`, auth token in Secrets Manager. Enable rate-limiting middleware in `backend/app/main.py` once ElastiCache is confirmed reachable.
- **WAF**: AWS WAF is attached to the ALB with AWS managed rule groups. Blocks SQLi and XSS at the edge. Blocked request logs go to CloudWatch → SNS alarm if spike detected.
- **ECS Fargate has no persistent disk.** All file storage goes to Supabase Storage. Never write files inside the container.
- **CORS_ORIGINS must include the ALB URL** when the backend moves to ECS. Update this env var in the ECS task definition.
- **NAT Gateway** (credits cover it). ECS tasks in private subnets use the NAT Gateway to reach Supabase and Gmail SMTP. After credits run out (~5–6 weeks), swap for VPC endpoints to save ~$32/month. Security benefit of VPC endpoints: traffic to ECR/S3/Secrets Manager stays on the AWS private network entirely.
- **ECR is the single image registry** for both clouds. Azure Container Apps pulls images from ECR — you need to give Azure a cross-account pull credential (ECR pull-through cache or IAM credentials stored in Azure Key Vault).
- **OIDC is a one-time manual setup** in both AWS (IAM OIDC provider) and Azure (Workload Identity Federation) before GitHub Actions can authenticate to either cloud.
- **Terraform state** must NOT be committed to git. Stored in S3 + DynamoDB (bootstrapped in Phase 0.5).
- **Admin email** (`yorkpulse.app@gmail.com`) and OTP logic stay as-is — no cloud migration needed for SMTP.
