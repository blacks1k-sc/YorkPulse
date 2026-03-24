# TROUBLESHOOTING.md — Phase 2 Deployment Issues and Fixes

> Every issue encountered during the Phase 2 AWS deploy is documented here.
> Format: **Problem → Root Cause → Fix → Lesson Learned**
> Goal: solve any of these again in under 5 minutes.

---

## Issue 1 — ACM Certificate in Wrong Region

**Problem**
`terraform apply` failed when creating the ALB HTTPS listener:
```
Error: creating ELBv2 Listener: CertificateNotFoundException
```

**Root Cause**
The ACM certificate was created in `us-east-2` (Ohio). ALBs can only use ACM certificates
from the **same region** as the load balancer. The ALB is in `us-east-1`.

**Fix**
1. Delete the certificate in us-east-2 via AWS Console → Certificate Manager
2. Request a new certificate in **us-east-1**: `aws acm request-certificate --domain-name api.yorkpulse.com --validation-method DNS --region us-east-1`
3. Add the CNAME validation record to DNS (Route 53 or Vercel)
4. Wait for status: `Issued`, then copy the new ARN
5. Re-run terraform plan/apply with the new ARN

**Lesson Learned**
ACM certificates are regional. Always create them in the same region as the ALB.
For CloudFront, use us-east-1 regardless of the distribution's edge locations.

---

## Issue 2 — Non-Printable Unicode Characters in Terraform Strings

**Problem**
`terraform plan` failed with validation errors on security group and IAM role descriptions:
```
"description" doesn't comply with restrictions: field contains invalid characters
```

**Root Cause**
Em dashes (`—`) and right arrows (`→`) in description strings are multi-byte Unicode characters.
AWS API field validation for `description` fields only allows the ASCII set:
`^[0-9A-Za-z_ .:/()#,@\[\]+=&;{}!$*-]*$`

**Affected files**: `vpc.tf`, `iam.tf`, `elasticache.tf`

**Fix**
Replace all Unicode characters with plain ASCII equivalents:
- `—` (em dash) → `,` or `.`
- `→` (right arrow) → remove or rephrase

Run this to check before apply:
```bash
grep -rn "[^\x00-\x7F]" multicloud/infra/aws/*.tf
```

**Lesson Learned**
Never copy-paste description strings from a rich-text editor or markdown preview.
Write them directly in a code editor. AWS description fields are ASCII-only.

---

## Issue 3 — WAF Logging Configuration Rejected (Two Separate Errors)

**Problem (Part A)**
`terraform apply` failed on `aws_wafv2_web_acl_logging_configuration`:
```
InvalidParameterException: Invalid logging destination
```
Even after appending `:*` to the ARN.

**Root Cause (Part A)**
CloudWatch log group names for WAF logging **must start with `aws-waf-logs-`**.
The original log group was named `/aws/waf/yorkpulse` — this prefix is rejected by the WAF API.

**Problem (Part B)**
After renaming the log group, still got `InvalidParameterException`.

**Root Cause (Part B)**
The `log_destination_configs` ARN must end with `:*`. The Terraform `aws_cloudwatch_log_group.arn`
attribute does not include `:*` — it must be appended explicitly.

**Fix**
In `waf.tf`:
```hcl
resource "aws_cloudwatch_log_group" "waf" {
  name = "aws-waf-logs-${var.project}"  # Must start with "aws-waf-logs-"
  ...
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = ["${aws_cloudwatch_log_group.waf.arn}:*"]  # Must end with :*
  ...
}
```

**Lesson Learned**
AWS WAF has two hard requirements for CloudWatch Logs destinations that aren't well-documented
together: (1) log group name prefix, and (2) ARN suffix. Both must be right simultaneously.

---

## Issue 4 — Secrets Manager Import Failures (Random ARN Suffixes)

**Problem**
`terraform import aws_secretsmanager_secret.database_url /yorkpulse/prod/database-url` failed:
```
Error: Cannot import non-existent remote object
```

**Root Cause**
AWS Secrets Manager appends a random 6-character suffix to secret ARNs:
`/yorkpulse/prod/database-url` becomes `/yorkpulse/prod/database-url-LlFowN`
The `terraform import` command requires the full ARN including the suffix, not the name.

**Fix**
Get the real ARN first:
```bash
aws secretsmanager list-secrets --region us-east-1 \
  --filter Key=name,Values=/yorkpulse/prod/ \
  --query 'SecretList[].{Name:Name,ARN:ARN}' \
  --output table
```
Then import using the full ARN:
```bash
terraform import aws_secretsmanager_secret.database_url \
  arn:aws:secretsmanager:us-east-1:062677866920:secret:/yorkpulse/prod/database-url-LlFowN
```

**Lesson Learned**
Always use `list-secrets` to get real ARNs before importing. Never guess the ARN from the name.

---

## Issue 5 — ECS Task Failed: Gemini API Key Secret Had No Value

**Problem**
ECS tasks failed to start with:
```
TaskFailedToStart: Secret does not exist or has no value
CannotStartContainerError: secret /yorkpulse/prod/gemini-api-key
```

**Root Cause**
The Gemini API key secret was defined in `secrets.tf` and referenced in the ECS task definition,
but YorkPulse doesn't actually use the Gemini API (the dependency was removed from the backend
in a prior cleanup). The secret existed in Secrets Manager with no value.

**Fix**
1. Remove `aws_secretsmanager_secret.gemini_api_key` from `secrets.tf`
2. Remove the `GEMINI_API_KEY` entry from the `secrets` array in `ecs.tf`
3. Delete the secret from AWS with immediate deletion (no recovery window):
   ```bash
   aws secretsmanager delete-secret \
     --secret-id /yorkpulse/prod/gemini-api-key \
     --force-delete-without-recovery \
     --region us-east-1
   ```
4. Remove from Terraform state:
   ```bash
   terraform state rm aws_secretsmanager_secret.gemini_api_key
   ```
5. Redeploy: `terraform apply`

**Lesson Learned**
Every secret referenced in the ECS task definition must have a value in Secrets Manager before
the task can start. An empty secret is treated as a missing secret — ECS will not start the task.
Audit secrets.tf against the actual app config before deploying.

---

## Issue 6 — Docker Image Architecture Mismatch (ARM64 vs AMD64)

**Problem**
ECS tasks failed immediately after pulling the image:
```
CannotPullContainerError: image manifest does not contain descriptor matching platform linux/amd64
```

**Root Cause**
The Docker image was built on Apple Silicon (M3, ARM64) with a plain `docker build`.
Without `--platform linux/amd64`, Docker builds for the host architecture (ARM64).
ECS Fargate defaults to x86_64 (linux/amd64) — incompatible with the ARM64 image.

**Fix**
Rebuild and push with the explicit platform flag:
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 062677866920.dkr.ecr.us-east-1.amazonaws.com

docker buildx build \
  --platform linux/amd64 \
  -t 062677866920.dkr.ecr.us-east-1.amazonaws.com/yorkpulse-backend:latest \
  --push \
  .
```

**Lesson Learned**
Always use `--platform linux/amd64` when building images for ECS. Make it a habit — the flag is
harmless on x86_64 CI runners and mandatory on Apple Silicon. See DECISIONS.md #013.

---

## Issue 7 — ECR Authentication Expired (403 on Push)

**Problem**
`docker push` to ECR returned HTTP 403 Forbidden with no other error message.

**Root Cause**
ECR authentication tokens expire after **12 hours**. The `docker login` from the previous session
had expired.

**Fix**
Re-authenticate before every ECR push session:
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 062677866920.dkr.ecr.us-east-1.amazonaws.com
```

**Lesson Learned**
ECR tokens are short-lived by design. If a push fails with 403, always re-authenticate first
before investigating other causes. The CI/CD pipeline (Phase 4) handles this automatically.

---

## Issue 8 — ECS Service Running Stale Task Definition Revision

**Problem**
After `terraform apply` created task definition revision `:3`, ECS kept running tasks on `:1`.
The service showed the correct desired count but the running tasks used the old revision.

**Root Cause**
`ecs.tf` has `lifecycle { ignore_changes = [task_definition] }` so Terraform doesn't update
the service's task definition on every apply. This is intentional (prevents Terraform fighting
with CI/CD), but means a manual update is needed when the task definition changes outside CI/CD.

**Fix**
Explicitly pin the service to the new revision:
```bash
aws ecs update-service \
  --cluster yorkpulse-prod-cluster \
  --service yorkpulse-prod-backend \
  --task-definition yorkpulse-prod-backend:3 \
  --force-new-deployment \
  --region us-east-1
```

To find the latest revision number:
```bash
aws ecs list-task-definitions \
  --family-prefix yorkpulse-prod-backend \
  --region us-east-1 \
  --query 'taskDefinitionArns[-1]'
```

**Lesson Learned**
`ignore_changes = [task_definition]` is correct for CI/CD pipelines but requires manual
revision pinning during initial setup or manual deploys. Always verify which revision ECS is
running after a task definition change.

---

## Issue 9 — CORS_ORIGINS Format Rejected by Pydantic

**Problem**
FastAPI container started but immediately crashed with:
```
pydantic_settings.exceptions.SettingsError: error parsing value for field "cors_origins"
as a list[AnyHttpUrl]
```

**Root Cause**
`CORS_ORIGINS` was set in the ECS task definition as a comma-separated string:
`"https://yorkpulse.com,https://www.yorkpulse.com"`
Pydantic's `list[AnyHttpUrl]` field type requires a **JSON array string**, not CSV.

**Fix**
In `ecs.tf`, use `jsonencode()`:
```hcl
value = jsonencode(["https://yorkpulse.com", "https://www.yorkpulse.com", "https://api.yorkpulse.com"])
```
This produces: `["https://yorkpulse.com","https://www.yorkpulse.com","https://api.yorkpulse.com"]`

**Lesson Learned**
Check `backend/app/core/config.py` for any `list[...]` or `set[...]` Pydantic fields — all of
them need JSON array format when passed as environment variables. See DECISIONS.md #014.

---

## Issue 10 — CloudWatch Log Group Did Not Exist on First Deploy

**Problem**
ECS task started but no logs appeared. After checking ECS events:
```
Error creating log stream: ResourceNotFoundException: The specified log group does not exist
```

**Root Cause**
The CloudWatch log group `/ecs/yorkpulse-backend` was defined in `ecs.tf` as an
`aws_cloudwatch_log_group` resource. On the first `terraform apply` attempt that partially failed,
the log group resource was not created but the task definition was. When ECS started a task,
the CloudWatch log driver tried to write to a log group that didn't exist yet.

**Fix**
Create the log group manually to unblock the deploy:
```bash
aws logs create-log-group \
  --log-group-name /ecs/yorkpulse-backend \
  --region us-east-1
```
Then re-run `terraform apply` to bring state in sync (Terraform will either adopt or no-op).

**Lesson Learned**
On a partially failed apply, resources created later in the dependency chain may reference
resources from earlier in the chain that weren't created. Always check which resources were
actually created after a partial failure: `terraform state list | grep log_group`.
