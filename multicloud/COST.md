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
