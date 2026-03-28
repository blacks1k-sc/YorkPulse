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

---

## Phase 3 — Azure

---

## Issue 11 — York University Azure Subscription Blocked by IT Policy

**Problem**
`terraform apply` failed immediately on every Azure resource creation:
```
Error: creating Resource Group: RequestDisallowedByPolicy
Policy: "Restrict allowed resource types" — resource type microsoft.resources/resourcegroups is not allowed
```
Even creating a resource group in the York University Azure tenant was blocked.

**Root Cause**
York University IT enforces Azure Policy at the tenant and subscription level. These policies
restrict which resource types, regions, and SKUs students can create — designed to prevent
runaway cloud spend. Container Apps, ACR, and Key Vault are all on the restricted list.
There is no way to override these policies as a student user.

**Fix**
Created a new personal Azure account (nrup1618@outlook.com) with an Azure for Students
subscription via azure.microsoft.com/en-us/free/students — separate from the York tenant.
This gives full subscription owner permissions with a $100 credit and no policy restrictions.
Updated all Terraform variables and ARM env vars to point to the new subscription.

**Lesson Learned**
Never use a university or corporate Azure tenant for portfolio or personal infrastructure projects.
University tenants enforce IT policies that block the resource types needed for real-world projects.
Personal accounts with Azure for Students or Pay-As-You-Go always have full control.
The personal account also persists after graduation — the university account gets revoked.

---

## Issue 12 — Azure CLI `az storage` SubscriptionNotFound Despite Correct Login

**Problem**
`az group list` returned results correctly (York personal subscription visible), but
`az storage account create` returned:
```
(SubscriptionNotFound) The subscription 'fb7e60ee...' could not be found.
```
The subscription existed and was set correctly with `az account set`.

**Root Cause**
A Mac-specific bug in the Azure CLI where `az storage` commands use a different authentication
path than `az group` / `az account` commands. Cached tokens from the old York University tenant
persisted in the storage auth cache even after switching subscriptions via `az account set`.
The `az group` commands read the current active subscription correctly; `az storage` commands
silently used the cached stale token from a different tenant.

**Fix**
Created the Terraform state storage account manually via the Azure Portal (UI) instead of CLI,
then ran `terraform init` which connected to the existing storage account without issues.
Permanent fix: use the Terraform azurerm provider with ARM_* env vars for all Azure operations —
the provider uses Service Principal credentials that are unaffected by CLI token caching.

**Lesson Learned**
`az group` and `az storage` use different internal auth paths on macOS. After switching tenants,
run `az logout && az login` to clear all cached tokens before running `az storage` commands.
Better: use Service Principal auth (ARM_* env vars) for all Terraform operations — it bypasses
the CLI token cache entirely and works identically in CI/CD pipelines.

---

## Issue 13 — Microsoft.App Provider Not Registered (409 Conflict)

**Problem**
`terraform apply` on `azurerm_container_app_environment` failed with:
```
Code="MissingSubscriptionRegistration"
Message="The subscription is not registered to use namespace 'Microsoft.App'"
StatusCode=409
```
Also appeared for `Microsoft.OperationalInsights` when creating the Log Analytics workspace.

**Root Cause**
New Azure subscriptions do not automatically register resource providers. Each Azure service
lives under a namespace (Microsoft.App for Container Apps, Microsoft.OperationalInsights for
Log Analytics) that must be explicitly registered before resources of that type can be created.
This is a one-time setup step per subscription — it is not documented in the Terraform provider
docs and only appears as a 409 error at apply time.

**Fix**
Register both namespaces before running `terraform apply`:
```bash
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
# Wait for registration (~1-2 minutes), then verify:
az provider show --namespace Microsoft.App --query "registrationState"
az provider show --namespace Microsoft.OperationalInsights --query "registrationState"
# Output should be "Registered" before running terraform apply
```

**Lesson Learned**
New Azure subscriptions need provider namespaces registered before first use. Container Apps
requires both Microsoft.App and Microsoft.OperationalInsights (because the Container App
Environment requires a Log Analytics workspace). Always register providers before `terraform apply`
on a fresh subscription. Add these two `az provider register` commands to the project runbook
(see COMMANDS.md).

---

## Issue 14 — Service Principal Password Starting With Dash Parsed as CLI Flag

**Problem**
When creating the Service Principal for Terraform auth, `az ad sp create-for-rbac` generated
a password starting with `-`. Using it in subsequent `az` commands returned:
```
argument --password/-p: expected one argument
```
The shell interpreted the password value as a CLI flag.

**Root Cause**
Passwords starting with `-` are misinterpreted by argument parsers as flag prefixes.
The standard `--password <value>` syntax has a space between flag and value, which allows
the shell to attempt flag parsing before string parsing.

**Fix**
Use the `=` syntax to bind the value directly to the flag with no space:
```bash
--password="<value starting with dash>"
```
Or regenerate credentials until the password does not start with `-`:
```bash
az ad sp credential reset --id <app-id>
```

**Lesson Learned**
Always use `--flag=value` syntax when a value might start with `-`. This applies to any CLI tool,
not just Azure CLI. When generating Service Principal credentials programmatically, validate that
the password does not start with `-` before storing it, or always use `=` syntax as a habit.

---

## Issue 15 — Two-Step `terraform apply` Required for Container Apps + ACR

**Problem**
On the first `terraform apply`, the Container App creation failed because the `frontend_image`
variable referenced an ACR image that didn't exist yet — ACR was being created in the same apply.
On subsequent runs with `frontend_image` left empty, the Container App used the placeholder image
but couldn't pull from ACR until after the image was pushed.

**Root Cause**
Chicken-and-egg dependency: ACR must exist before you can push an image, but the Container App
needs an image URL at creation time. Terraform creates both resources in the same apply, so
the image doesn't exist in ACR at the moment the Container App is configured.

**Fix**
Two-step deploy process:
1. First apply: creates ACR and all infrastructure. Container App starts with the Azure sample
   placeholder image (`mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`).
   ```bash
   terraform apply
   ```
2. Push the real image to ACR after it exists:
   ```bash
   az acr login --name yorkpulseacr
   docker buildx build --platform linux/amd64 \
     -t yorkpulseacr.azurecr.io/yorkpulse-frontend:latest --push .
   ```
3. Second apply: updates the Container App to use the real image.
   ```bash
   terraform apply -var='frontend_image=yorkpulseacr.azurecr.io/yorkpulse-frontend:latest'
   ```

**Lesson Learned**
When a container registry and a container runtime are provisioned together in the same Terraform
apply, always use a placeholder image for the first apply. The `variables.tf` default is set to
the Azure sample app image exactly for this reason. Document the two-step process in COMMANDS.md
so future deploys follow the correct sequence.
