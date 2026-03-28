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
PHASE 4 — GitHub Actions: OIDC + Trivy + Checkov + staging + prod approval gate [IN PROGRESS]

## Phase 3 Live State (as of 2026-03-27)
### Azure (canadacentral)
- Container App URL: `https://yorkpulse-frontend.wonderfulplant-691f2e03.canadacentral.azurecontainerapps.io`
- ACR: `yorkpulseacr.azurecr.io` (Basic SKU, admin enabled)
- Container App: `yorkpulse-frontend` (0.5 cpu / 1.0Gi, 1-3 replicas, port 3000)
- Key Vault: `https://yorkpulse-prod-kv.vault.azure.net/`
- Resource Group: `yorkpulse-prod` (canadacentral)
- Log Analytics: `yorkpulse-prod-logs` (PerGB2018, 30-day retention)
- Subscription: `fb7e60ee-c894-41ae-bbc3-2e6992fbb382` (personal Azure for Students — nrup1618@outlook.com)
- Tenant: `85ef3390-15be-4bf9-a380-84abd60835c2`
- Service Principal: `yorkpulse-terraform` — App ID: `20518fc6-13ab-4f55-87b2-7a6abea05738`
- Terraform state: `yorkpulsetfstate` storage account / `tfstate` container / `azure/terraform.tfstate` key
- Frontend DNS: NOT yet cut over — `yorkpulse.com` still points to Vercel

### ARM env vars (required before every `terraform apply` in infra/azure/)
```bash
export ARM_CLIENT_ID="20518fc6-13ab-4f55-87b2-7a6abea05738"
export ARM_TENANT_ID="85ef3390-15be-4bf9-a380-84abd60835c2"
export ARM_SUBSCRIPTION_ID="fb7e60ee-c894-41ae-bbc3-2e6992fbb382"
export ARM_CLIENT_SECRET="<from password manager>"
```

## Phase 2 Live State (as of 2026-03-23)
- ECS Service: `yorkpulse-prod-backend` running task definition revision 3
- Task status: RUNNING — health checks returning 200 OK
- ALB DNS: `yorkpulse-prod-alb-399906510.us-east-1.elb.amazonaws.com`
- Backend health endpoint: `http://yorkpulse-prod-alb-399906510.us-east-1.elb.amazonaws.com/api/v1/health`
- 7 secrets active in Secrets Manager: database-url, jwt-secret-key, supabase-url, supabase-key, redis-url, smtp-password, redis-auth-token
- Redis: Upstash (external TLS) via redis-url secret — ElastiCache provisioned but not yet active
- WAF: active with 3 managed rule groups (IP Reputation, CRS, Known Bad Inputs)
- CloudWatch logs: /ecs/yorkpulse-backend active, SNS email subscription confirmed

## DNS + Traffic Cutover Status (as of 2026-03-26) — DEFERRED
**NOT yet cut over.** Production traffic still runs through the old stack:
- `api.yorkpulse.com` Cloudflare CNAME still points to **Render** (not the ALB)
- Frontend (`NEXT_PUBLIC_API_URL`) still calls the **Render** backend URL
- The ECS backend is live and healthy but receives zero real user traffic

**Why deferred**: Cutting over mid-project would couple three risky changes (DNS, frontend config,
backend) without the CI/CD safety net that Phase 4 provides. Deferring until the full stack
is validated end-to-end reduces the blast radius of a failed cutover.

**Planned cutover order** (after Phase 3 + Phase 4 are complete):
1. Update `NEXT_PUBLIC_API_URL` → `https://api.yorkpulse.com` in Azure Key Vault / Vercel env
2. Deploy Azure frontend (Phase 3) with the new API URL
3. Set up CI/CD pipeline (Phase 4) so rollback is one pipeline re-run
4. Flip Cloudflare CNAME: `api.yorkpulse.com` → ALB DNS
5. Point `yorkpulse.com` DNS to Azure Container Apps (replaces Vercel)
6. Monitor for 24h, then shut down Render + Vercel

## Phase Checklist
- [x] Phase 0   → CLAUDE.md, DECISIONS.md, SECURITY.md, COMMANDS.md, COST.md
- [x] Phase 0.5 → infra/bootstrap/main.tf → S3 bucket + DynamoDB lock (run once manually)
- [x] Phase 1   → Dockerize FastAPI backend + Next.js frontend
  - [x] backend/Dockerfile (python:3.12-slim, non-root, layer caching, healthcheck)
  - [x] backend/entrypoint.sh (alembic migrations + exec form → uvicorn as PID 1)
  - [x] backend/.dockerignore
  - [x] backend/requirements.txt split from requirements-dev.txt
  - [x] backend/app/core/config.py hardened (required secrets, no defaults)
  - [x] frontend/Dockerfile (node:20-alpine, multi-stage, standalone, healthcheck)
  - [x] frontend/.dockerignore
  - [x] frontend/next.config.ts (output: standalone enabled)
  - [x] Both images build clean — zero warnings, zero errors
  - [x] Both images run locally — backend 200 OK, frontend serves on port 3000
- [x] Phase 2   → Terraform: VPC + ECR + ECS Fargate + ALB + WAF + ElastiCache + Secrets Manager + IAM + CloudWatch + SNS
  - [x] versions.tf (S3 remote backend, AWS provider ~> 5.0)
  - [x] variables.tf (project, environment, region, image tag, alert email, ACM cert ARN, GitHub username)
  - [x] vpc.tf (VPC 10.0.0.0/16, 2 public + 2 private subnets, IGW, NAT GW, route tables, 3 security groups)
  - [x] ecr.tf (yorkpulse-backend repo, MUTABLE, scan on push, lifecycle policy: 30d untagged + 10 tagged)
  - [x] secrets.tf (7 Secrets Manager secrets: DB, JWT, Supabase URL+key, Redis URL, SMTP, redis-auth-token)
  - [x] iam.tf (ECS execution role, ECS task role, GitHub Actions OIDC role — all least-privilege)
  - [x] alb.tf (internet-facing ALB, target group port 8000, HTTP→HTTPS redirect, HTTPS listener)
  - [x] ecs.tf (ECS cluster, CloudWatch log group, task definition with secrets injection, ECS service rolling deploy)
  - [x] elasticache.tf (Redis 7.1 cache.t3.micro, TLS, auth token from Secrets Manager, private subnets)
  - [x] waf.tf (WAF Web ACL: IP Reputation + CRS + Known Bad Inputs, ALB association, CloudWatch logging)
  - [x] cloudwatch.tf (SNS topic + email, 6 alarms: CPU/memory/5xx/latency/WAF/errors, log metric filter)
  - [x] outputs.tf (ALB DNS, ECR URL, ECS cluster/service, VPC ID, ElastiCache endpoint, IAM role ARN)
  - [x] route53.tf (full DNS for yorkpulse.com: ACM validation, DKIM, DMARC, CAA, Vercel, api subdomain)
  - [x] TROUBLESHOOTING.md (10 documented issues encountered during Phase 2 deploy)
- [x] Phase 3   → Terraform: Azure Container Apps + Key Vault + Azure Monitor
  - [x] providers.tf (azurerm ~> 3.0, azurerm backend — yorkpulsetfstate/tfstate/azure/terraform.tfstate)
  - [x] variables.tf (location, app_name, environment, frontend_image, container_cpu, container_memory)
  - [x] main.tf (azurerm_resource_group yorkpulse-prod + azurerm_client_config data source)
  - [x] acr.tf (yorkpulseacr, Basic SKU, admin_enabled — globally unique name)
  - [x] container_app.tf (Log Analytics workspace + Container App Environment + Container App frontend)
  - [x] keyvault.tf (yorkpulse-prod-kv, standard SKU, full SP access policy via azurerm_client_config)
  - [x] outputs.tf (acr_login_server, container_app_url, resource_group_name, key_vault_uri, log_analytics_workspace_id)
  - [x] Frontend live: https://yorkpulse-frontend.wonderfulplant-691f2e03.canadacentral.azurecontainerapps.io
  - [x] TROUBLESHOOTING.md Phase 3 section (5 issues documented)
- [~] Phase 4   → GitHub Actions: OIDC + Trivy + Checkov + staging + prod approval gate [IN PROGRESS]
  - [x] .github/workflows/deploy.yml (security-scan → deploy-backend → deploy-frontend)
  - [x] .github/workflows/pr-check.yml (security-scan on PRs)
  - [ ] Add GitHub Secrets (AWS_ROLE_ARN, AZURE_CLIENT_ID/SECRET/TENANT/SUBSCRIPTION)
  - [ ] Verify OIDC trust between GitHub Actions and AWS IAM role
  - [ ] First pipeline run — confirm all 3 jobs green
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

## Phase 3 Known Gotchas (learned from Azure deploy)
1. **Never use a university Azure tenant for portfolio projects** — IT policies block Container Apps, ACR, and Key Vault. Use a personal Azure for Students account.
2. **Register Microsoft.App and Microsoft.OperationalInsights before first terraform apply** on a new subscription — `az provider register --namespace Microsoft.App` then wait ~2 min for "Registered".
3. **Use ARM_* env vars, not `az login`, for all Terraform Azure auth** — the Azure CLI has a Mac bug where `az storage` and `az group` use different token caches. SP auth bypasses this.
4. **Two-step apply: first apply bootstraps ACR with placeholder image, second apply switches to real image** — ACR must exist before you can push. Default `frontend_image` is the Azure sample app.
5. **Key Vault access policy needs `object_id`, not `client_id`** — use `data "azurerm_client_config" "current"` to auto-resolve the correct object_id from whoever is authenticated.
6. **Service Principal passwords starting with `-` break CLI arg parsing** — use `--password=<value>` syntax (equals sign, no space) when the password starts with a dash.
7. **ACR tokens expire after 3 hours** — re-run `az acr login --name yorkpulseacr` before every docker push. Terraform SP auth is unaffected (uses the azurerm provider directly).

## Phase 2 Known Gotchas (learned from production deploy)
1. **Always build Docker images with `--platform linux/amd64`** for ECS. Apple Silicon builds ARM64 — Fargate is x86_64. Image will fail to start silently.
2. **ECR tokens expire every 12 hours** — re-run `aws ecr get-login-password | docker login ...` before pushing.
3. **After `terraform apply` on ECS task definition, explicitly pin the new revision** in `update-service --task-definition name:N` — ECS may ignore the new revision if `ignore_changes = [task_definition]` is set.
4. **CORS_ORIGINS must be a JSON array string for Pydantic** — use `jsonencode([...])` in ecs.tf, not a CSV string.
5. **WAF log group names MUST start with `aws-waf-logs-`** — any other prefix is rejected by the WAF logging API.
6. **ACM certificates must be created in us-east-1** for ALB use — certificates in other regions are not usable by regional ALBs.
7. **Secrets Manager ARNs have random suffixes** after creation (e.g. `/yorkpulse/prod/database-url-LlFowN`) — use `list-secrets` to get real ARNs for `terraform import`.

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
