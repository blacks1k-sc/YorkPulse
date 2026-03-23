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
PHASE 2 — Terraform AWS infrastructure (VPC, ECR, ECS Fargate, ALB, WAF, ElastiCache, Secrets Manager, IAM, CloudWatch, SNS)

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
  - [x] secrets.tf (8 Secrets Manager secrets: DB, JWT, Supabase, Redis, SMTP, Gemini, redis-auth-token)
  - [x] iam.tf (ECS execution role, ECS task role, GitHub Actions OIDC role — all least-privilege)
  - [x] alb.tf (internet-facing ALB, target group port 8000, HTTP→HTTPS redirect, HTTPS listener)
  - [x] ecs.tf (ECS cluster, CloudWatch log group, task definition with secrets injection, ECS service rolling deploy)
  - [x] elasticache.tf (Redis 7.1 cache.t3.micro, TLS, auth token from Secrets Manager, private subnets)
  - [x] waf.tf (WAF Web ACL: IP Reputation + CRS + Known Bad Inputs, ALB association, CloudWatch logging)
  - [x] cloudwatch.tf (SNS topic + email, 6 alarms: CPU/memory/5xx/latency/WAF/errors, log metric filter)
  - [x] outputs.tf (ALB DNS, ECR URL, ECS cluster/service, VPC ID, ElastiCache endpoint, IAM role ARN)
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
