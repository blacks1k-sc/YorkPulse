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
