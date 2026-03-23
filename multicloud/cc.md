Before anything else, do Phase 0 completely.

Create these 5 files at the project root with the exact content specified:

─────────────────────────────────────────
FILE 1: CLAUDE.md
─────────────────────────────────────────
# CLAUDE.md — Project Mentor File
> Claude Code reads this file automatically at the start of every session.
> Update this file continuously as the project evolves.
> This is the single source of truth for project state.

## Project Identity
- Name: YorkPulse Multi-Cloud Infrastructure
- Domain: yorkpulse.com (live, real students using it)
- Purpose: Lift YorkPulse onto production-grade multi-cloud infrastructure
  to showcase DevSecOps, Cloud, and IaC skills for job applications
- Developer: 4th year CS student, cloud beginner, learning by building
- Goal: Impress senior engineers, hiring managers, and recruiters on LinkedIn

## Golden Rule
The app (YorkPulse) must stay live and working at all times.
Never break production. Never migrate things that don't need migrating.
Every decision must be defensible under senior engineer questioning.

## Current Phase
PHASE 0.5 — Bootstrap Terraform remote state (next up)

## Phase Checklist
- [x] Phase 0   → CLAUDE.md, DECISIONS.md, SECURITY.md, COMMANDS.md, COST.md
- [ ] Phase 0.5 → infra/bootstrap/main.tf → S3 bucket + DynamoDB lock (run once manually)
- [ ] Phase 1   → Dockerize FastAPI backend + Next.js frontend
- [ ] Phase 2   → Terraform: VPC + ECR + ECS Fargate + ALB + WAF + ElastiCache + Secrets Manager + IAM + CloudWatch + SNS
- [ ] Phase 3   → Terraform: Azure Container Apps + Key Vault + Azure Monitor
- [ ] Phase 4   → GitHub Actions: OIDC + Trivy + Checkov + staging + prod approval gate
- [ ] Phase 5   → CloudWatch dashboards + WAF logs + Azure Monitor alerts
- [ ] Phase 6   → README, COST.md, architecture diagram, LinkedIn post

## Final Architecture
### AWS (Stateful layer)
- ECS Fargate → FastAPI backend
- ElastiCache Redis → rate limiting + caching (VPC-internal)
- Secrets Manager → all backend secrets
- WAF → attached to ALB, blocks SQLi/XSS/bad IPs
- CloudWatch + SNS → logs, alarms, email alerts
- ALB + VPC + ECR → networking + container registry
- S3 + DynamoDB → Terraform remote state

### Azure (Stateless layer)
- Container Apps → Next.js SSR frontend + backend mirror
- Key Vault → frontend secrets
- Azure Monitor → frontend observability

### Supabase (deliberate non-migration)
- PostgreSQL → primary database
- Auth → OTP + JWT
- Storage → files and images

## Tech Stack
- Backend: FastAPI (Python 3.12)
- Frontend: Next.js 15 (React, SSR via standalone output)
- IaC: Terraform (both clouds, one workflow)
- CI/CD: GitHub Actions + OIDC (zero stored credentials)
- Security scanning: Trivy (Docker CVEs) + Checkov (Terraform misconfigs)
- Containers: Docker

## Rules Claude Code Must ALWAYS Follow
1. Update CLAUDE.md phase checklist when a phase completes (mark [x])
2. Add an entry to DECISIONS.md for every non-trivial technical choice
3. Add every new terminal command to COMMANDS.md with plain English explanation
4. Add plain English comments above every function and every Terraform resource block
5. NEVER hardcode secrets, API keys, or credentials anywhere
6. NEVER use Static Web Apps for Next.js (SSR requires Container Apps)
7. NEVER migrate the Supabase DB — document RDS as future evolution only
8. ALWAYS use least-privilege IAM — document why each permission exists
9. When a decision had multiple options, explain the tradeoff in DECISIONS.md
10. Flag anything that would concern a senior engineer in a code review
11. At end of each phase add "What You Learned" to DECISIONS.md
12. Keep README.md updated as a living document

## Folder Structure
yorkpulse/ (existing repo)
├── backend/                    → FastAPI (existing)
├── frontend/                   → Next.js (existing)
├── infra/
│   ├── bootstrap/              → Phase 0.5 (run once)
│   ├── aws/                    → Phase 2
│   └── azure/                  → Phase 3
├── .github/workflows/          → Phase 4
├── docs/                       → Phase 6
├── CLAUDE.md                   → this file
├── DECISIONS.md
├── SECURITY.md
├── COMMANDS.md
└── COST.md

─────────────────────────────────────────
FILE 2: DECISIONS.md
─────────────────────────────────────────
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
> More decisions added as project progresses.
> Each phase ends with a "What You Learned" retrospective.

─────────────────────────────────────────
FILE 3: SECURITY.md
─────────────────────────────────────────
# SECURITY.md — Security Posture

## Principles
- Least privilege IAM: every role has only what it needs, nothing more
- No static credentials: OIDC for all CI/CD authentication
- No secrets in code: Secrets Manager + Key Vault only
- Defence in depth: WAF → ALB → Security Groups → ECS → App
- Encryption in transit: TLS everywhere, ElastiCache TLS enabled
- Private networking: ECS tasks in private subnets, no direct internet access

## Defence Layers

Internet
→ AWS WAF (blocks SQLi, XSS, bad IPs)
→ ALB (TLS termination, HTTPS only)
→ Security Group (only ALB can reach ECS)
→ ECS Task (private subnet, no public IP)
→ FastAPI (input validation, parameterized queries)
→ ElastiCache (VPC-internal, TLS + auth token)
→ Supabase (RLS policies, JWT validation)
→ Secrets Manager (secrets never in env at build time)


## VPC Endpoints (Security Decision, not just Cost)
Traffic to ECR, S3, and Secrets Manager stays on AWS private network.
Never traverses the public internet. Security benefit first.
Cost saving (~$32/month vs NAT Gateway) is secondary.

## ElastiCache Security
- In-transit encryption: enabled
- Auth token: stored in Secrets Manager, rotatable
- Access: VPC-internal only, no public endpoint

## IAM Roles (documented as created)
| Role | Purpose | Permissions | Why |
|------|---------|-------------|-----|
| TBD  | TBD     | TBD         | TBD |

## CI/CD Security Gates
- Trivy: scans Docker image for CVEs, fails pipeline on CRITICAL
- Checkov: scans Terraform for misconfigs, fails on HIGH severity
- OIDC: no stored credentials on GitHub, tokens expire per run
- Environment gates: staging auto-deploys, production requires approval

## Threat Model
| Threat | Mitigation |
|--------|-----------|
| Compromised GitHub repo | OIDC — no static creds to steal |
| Container escape | Fargate isolation, non-root user |
| SQL injection | WAF + parameterized queries (SQLAlchemy) |
| Secrets exposure | Secrets Manager injection at runtime |
| DDoS / bad IPs | WAF IP reputation list |
| Misconfigured infra | Checkov scans every Terraform change |
| Vulnerable dependencies | Trivy scans every Docker build |

─────────────────────────────────────────
FILE 4: COMMANDS.md
─────────────────────────────────────────
# COMMANDS.md — Terminal Commands Reference
> Every command used in this project is documented here.
> Built for someone learning infrastructure from scratch.
> Never assume a command is obvious — always explain it.

## Format
**Command**: exact command
**What it does**: plain English
**When you use it**: real-world context
**Expected output**: what success looks like

---

## Git
**Command**: `git checkout -b multi-cloud-infra`
**What it does**: Creates a new branch called multi-cloud-infra and switches to it
**When you use it**: Before making any infrastructure changes — keeps main branch clean
**Expected output**: "Switched to a new branch 'multi-cloud-infra'"

---

## AWS CLI
**Command**: `aws sts get-caller-identity`
**What it does**: Asks AWS "who am I?" — returns your account ID and IAM user
**When you use it**: Verify AWS CLI is authenticated before running any AWS commands
**Expected output**: JSON with UserId, Account number, and Arn

**Command**: `aws configure`
**What it does**: Sets up AWS CLI with your access key, secret, region, and output format
**When you use it**: First time setup, or switching AWS accounts
**Expected output**: Prompts for 4 values, no output on success

---

## Azure CLI
**Command**: `az login`
**What it does**: Opens browser to sign into Azure, stores credentials locally
**When you use it**: First time setup or when Azure session expires
**Expected output**: JSON list of your Azure subscriptions

**Command**: `az account show`
**What it does**: Shows which Azure subscription you're currently working in
**When you use it**: Verify Azure CLI is authenticated before running Azure commands
**Expected output**: JSON with subscription name, ID, and tenant

---

## Terraform
> Commands will be added here starting Phase 0.5

---

## Docker
> Commands will be added here starting Phase 1

─────────────────────────────────────────
FILE 5: COST.md
─────────────────────────────────────────
# COST.md — Cloud Cost Breakdown

## Credits Available
- AWS: $100
- Azure: $100

## AWS Monthly Estimate
| Service | Cost/month | Notes |
|---------|-----------|-------|
| ECS Fargate (0.5vCPU/1GB) | ~$15 | Per-second billing |
| ALB | ~$18 | Always-on |
| ElastiCache cache.t3.micro | ~$12 | VPC-internal Redis |
| NAT Gateway | ~$35 | Most expensive line item |
| WAF | ~$5 | Managed rule groups |
| Secrets Manager (6 secrets) | ~$3 | Per secret/month |
| CloudWatch + ECR | ~$3 | Logs + image storage |
| **Total** | **~$91/month** | Credits last ~5-6 weeks |

## Azure Monthly Estimate
| Service | Cost/month | Notes |
|---------|-----------|-------|
| Container Apps (idle) | ~$2-5 | Scale-to-zero |
| Key Vault | ~$1 | Per 10k operations |
| Azure Monitor | ~$2 | Basic metrics |
| **Total** | **~$5-8/month** | Credits last 12-20 months |

## Cost Optimizations Applied
- Single-AZ only (no Multi-AZ) — saves ~50% on ElastiCache
- Scale-to-zero on Azure — idles at $0
- CloudWatch log retention: 30 days (not unlimited)
- ECR lifecycle policy: auto-delete untagged images after 30 days

## After Credits Run Out
Swap NAT Gateway → VPC Endpoints for ECR, S3, Secrets Manager
Saves ~$32/month. AWS drops from ~$91 to ~$59/month.
Documented as post-credit migration in DECISIONS.md.

## Current Stack Cost (before migration)
- Render (backend): $0 (free tier, cold starts)
- Vercel (frontend): $0 (free tier)
- Supabase: $0 (free tier)
- Total: $0 but with limitations

─────────────────────────────────────────

After creating all 5 files, do the following:
1. Confirm each file was created with a directory listing
2. Tell me the current phase (should be Phase 0.5)
3. Give me the 3 exact terminal commands to run for Phase 0.5
   with plain English explanation of what each one does