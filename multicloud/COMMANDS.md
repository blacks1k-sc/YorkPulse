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

## Terraform — Phase 0.5 Bootstrap (Run Once Only)

> These three commands create the S3 bucket and DynamoDB table that store
> Terraform's state file for all future infrastructure work.
> Run them exactly once, in this order, from the repo root.

**Command**: `cd infra/bootstrap && terraform init`
**What it does**: Downloads the AWS provider plugin (~5.0) into a local .terraform/
  directory. Prepares the working directory so Terraform can communicate with AWS.
  No AWS resources are created. No state file is written yet.
**When you use it**: Once — the very first time you enter infra/bootstrap/.
  Also run again if you add a new provider or upgrade the provider version.
**Expected output**: "Terraform has been successfully initialized!"

---

**Command**: `terraform plan`
**What it does**: Connects to AWS using your configured credentials, reads current
  AWS state, and computes exactly what it would create. Prints a diff showing:
  - 1 S3 bucket (yorkpulse-tf-state-847291) — versioned, AES256 encrypted, fully private
  - 3 S3 sub-resources (versioning config, encryption config, public access block)
  - 1 DynamoDB table (yorkpulse-terraform-locks) — PAY_PER_REQUEST, LockID hash key
  Nothing is created. Read this output carefully before running apply.
**When you use it**: Always before terraform apply. Never skip this step.
**Expected output**: "Plan: 5 to add, 0 to change, 0 to destroy."

---

**Command**: `terraform apply`
**What it does**: Executes the plan. Terraform prints the plan again and asks you
  to type "yes" to confirm. After confirmation it creates all 5 resources:
  1. S3 bucket (yorkpulse-tf-state-847291) with versioning, AES256 encryption,
     and full public access block — stores terraform.tfstate for infra/aws/ and infra/azure/.
  2. DynamoDB table (yorkpulse-terraform-locks) — every future terraform apply acquires
     a lock here first, preventing two concurrent applies from corrupting state.
  A local terraform.tfstate is written in infra/bootstrap/ tracking these resources.
  Commit this local state file to git — it only contains the bucket and table, no secrets.
**When you use it**: Once only, immediately after reviewing plan output.
**Expected output**: "Apply complete! Resources: 5 added, 0 changed, 0 destroyed."

> Why this runs locally and not in CI: This is the bootstrapping paradox.
> The CI pipeline needs the S3 bucket to store state — but you can't store state
> in a bucket that doesn't exist yet. This one-time manual apply creates the bucket
> so every other module can declare it as their remote backend like this:
>
>   terraform {
>     backend "s3" {
>       bucket         = "yorkpulse-tf-state-847291"
>       key            = "aws/terraform.tfstate"
>       region         = "us-east-1"
>       dynamodb_table = "yorkpulse-terraform-locks"
>       encrypt        = true
>     }
>   }

---

## Docker — Phase 1 Backend

> Run all Docker commands from inside the backend/ directory.
> You need a real .env file with valid secrets to test locally.
> The container reads env vars at startup — without them it starts
> but immediately fails to connect to the database and Redis.

---

**Command**: `docker build -t yorkpulse-backend:local .`
**What it does**: Builds the Docker image from backend/Dockerfile and tags it
  as "yorkpulse-backend:local". Docker reads the build context (all files in
  backend/ minus those in .dockerignore), runs each instruction as a layer,
  and produces a local image. First build is slow (pip install). Subsequent
  builds with unchanged requirements.txt are fast (cached pip layer).
**When you use it**: Every time you change the Dockerfile or app code and
  want to test the container locally before pushing to ECR.
**Expected output**: "Successfully built <hash>" and "Successfully tagged yorkpulse-backend:local"

---

**Command**: `docker run --rm --env-file .env -p 8000:8000 yorkpulse-backend:local`
**What it does**: Starts a container from the image you just built.
  --rm: automatically removes the container when it stops (keeps things tidy)
  --env-file .env: reads your local .env file and injects every variable as
    an environment variable inside the container. This is how secrets get in
    at runtime without being baked into the image.
  -p 8000:8000: maps port 8000 on your laptop to port 8000 inside the container.
    Format is "host_port:container_port". After this you can visit
    http://localhost:8000/api/v1/health in your browser.
  Logs stream to your terminal in real time (stdout → your terminal).
**When you use it**: To test the running container locally before any cloud deployment.
**Expected output**: Uvicorn startup logs, then the app serving on port 8000.

---

**Command**: `curl http://localhost:8000/api/v1/health`
**What it does**: Sends a GET request to the health endpoint while the container
  is running. Verifies the app started correctly and is accepting connections.
**When you use it**: Immediately after docker run, while the container is still running
  in another terminal tab.
**Expected output**: `{"status":"healthy","service":"yorkpulse-api"}`

---

**Command**: `docker ps`
**What it does**: Lists all currently running containers with their IDs, image names,
  ports, and how long they've been running.
**When you use it**: To find a running container's ID so you can run docker logs or docker stop.
**Expected output**: A table with CONTAINER ID, IMAGE, COMMAND, CREATED, STATUS, PORTS, NAMES

---

**Command**: `docker logs <container_id>`
**What it does**: Prints all stdout/stderr output from a running or stopped container.
  Add -f flag (docker logs -f <id>) to stream logs in real time (like tail -f).
**When you use it**: When the container starts but something goes wrong. All FastAPI
  and uvicorn log output appears here — look for "ERROR" lines.
**Expected output**: Uvicorn startup lines, then request logs as traffic arrives.

---

**Command**: `docker stop <container_id>`
**What it does**: Sends SIGTERM to the container's PID 1 (uvicorn in our case),
  waits 10 seconds for graceful shutdown (finishing in-flight requests), then
  sends SIGKILL if still running. Our Dockerfile uses exec form CMD so uvicorn
  receives SIGTERM directly and shuts down cleanly.
**When you use it**: To stop a running container. Get the container_id from docker ps.
**Expected output**: The container ID echoed back, then the container stops.

---

**Command**: `docker image ls yorkpulse-backend`
**What it does**: Lists all local images with the name "yorkpulse-backend" showing
  their tags and sizes. Useful to see how large the image is and confirm it was built.
**When you use it**: After docker build to confirm the image exists and check its size.
**Expected output**: A table showing the image tag, ID, creation date, and size (~300-400MB).

---

## Docker — Phase 1 Frontend

> Run all Docker commands from inside the frontend/ directory.
> The frontend image does NOT need a .env file at runtime — Next.js NEXT_PUBLIC_*
> vars can be passed with -e flags since they're read at startup, not build time.

---

**Command**: `docker build -t yorkpulse-frontend:local .`
**What it does**: Runs the multi-stage Next.js build:
  Stage 1 (deps)    — npm ci installs all node_modules (~5 seconds)
  Stage 2 (builder) — next build compiles the app into .next/standalone/ (~10 seconds)
  Stage 3 (runner)  — copies only .next/standalone/, .next/static/, and public/ into
                       a clean node:20-alpine base. No source code, no full node_modules.
  The .dockerignore excludes node_modules from the build context so Docker doesn't
  upload 400MB before npm ci downloads them again.
**When you use it**: Every time you change frontend code or next.config.ts.
**Expected output**: 3 build stages completing, "naming to docker.io/library/yorkpulse-frontend:local done"

---

**Command**: `docker run --rm -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://localhost:8000 yorkpulse-frontend:local`
**What it does**: Starts the standalone Next.js server.
  --rm: removes the container when stopped
  -p 3000:3000: maps laptop port 3000 to container port 3000
  -e NEXT_PUBLIC_API_URL=...: injects the backend URL as a runtime env var.
    NEXT_PUBLIC_* vars set at runtime are read by Next.js standalone server
    and made available to client-side code.
  The server starts in ~31ms (standalone is pre-compiled — no JIT at startup).
**When you use it**: To test the frontend container locally before deploying to Azure.
**Expected output**: "▲ Next.js 16.1.6 — ✓ Ready in 31ms"

---

**Command**: `lsof -ti:3000 | xargs kill -9`
**What it does**: Finds and kills whatever process is using port 3000.
  lsof -ti:3000: lists process IDs using port 3000 (-t = PIDs only, -i = network)
  xargs kill -9: passes each PID to kill -9 (force kill, no graceful shutdown)
**When you use it**: When docker run fails with "address already in use" on port 3000.
  Common when a local Next.js dev server (npm run dev) is still running.
**Expected output**: No output — port is freed silently.

---

**Command**: `docker image ls`
**What it does**: Lists ALL local Docker images — both backend and frontend.
  Shows image name, tag, ID, creation time, and size.
**When you use it**: To compare image sizes, confirm both images exist, or clean up old images.
**Expected output**: Table showing yorkpulse-backend:local and yorkpulse-frontend:local.
  Backend: ~500-600MB (python:3.12-slim + all pip packages)
  Frontend: ~200MB (node:20-alpine + standalone output only — no full node_modules)

---

## Terraform — Phase 2: AWS Infrastructure (infra/aws/)

> Run these commands from inside the multicloud/infra/aws/ directory.
> Phase 0.5 bootstrap (infra/bootstrap/) must have been applied before this.
> The S3 state bucket and DynamoDB lock table must already exist.
> Complete ALL manual pre-apply steps before running terraform apply.

---

**Command**: `cd multicloud/infra/aws && terraform init`
**What it does**: Downloads the AWS provider plugin (~5.0) and connects Terraform to the
  S3 remote backend created in Phase 0.5. After this command, terraform.tfstate is stored
  in S3 (not locally). DynamoDB locking is active — concurrent applies are blocked.
  No AWS resources are created yet.
**When you use it**: Once when first entering the infra/aws/ directory.
  Also run after adding a new provider or upgrading provider versions.
**Expected output**: "Terraform has been successfully initialized!" + backend confirmation message.

---

**Command**: `terraform plan -var='acm_certificate_arn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID' -var='github_username=YOUR_GITHUB_USERNAME'`
**What it does**: Previews ALL AWS resources that will be created — VPC, subnets, security groups,
  NAT Gateway, ECR, ECS cluster + task definition + service, ALB, target group, listeners,
  WAF Web ACL + association, ElastiCache Redis, Secrets Manager secrets (empty), IAM roles,
  CloudWatch log groups + alarms + metric filter, SNS topic + email subscription.
  Nothing is created. Read every resource in the output carefully.
**When you use it**: Always before terraform apply. Never skip. Pass both required variables.
**Expected output**: "Plan: ~50 to add, 0 to change, 0 to destroy." (approximate count)

---

**Command**: `terraform apply -var='acm_certificate_arn=arn:aws:acm:us-east-1:ACCOUNT:certificate/ID' -var='github_username=YOUR_GITHUB_USERNAME'`
**What it does**: Creates all AWS infrastructure resources defined in infra/aws/.
  Prompts for "yes" confirmation before creating anything. State is saved to S3.
  After apply: Secrets Manager secrets are created but EMPTY — fill them manually.
  SNS sends a confirmation email to yorkpulse.app@gmail.com — click to confirm.
**When you use it**: After reviewing terraform plan output. After completing ALL manual pre-apply steps.
**Expected output**: "Apply complete! Resources: ~50 added, 0 changed, 0 destroyed."
  Followed by output block showing ALB DNS name, ECR URL, ECS cluster/service names.

---

**Command**: `terraform output`
**What it does**: Prints all output values defined in outputs.tf:
  alb_dns_name, ecr_repository_url, ecs_cluster_name, ecs_service_name, vpc_id,
  elasticache_endpoint, github_actions_role_arn, sns_alerts_topic_arn.
  Copy these values for the manual post-apply steps.
**When you use it**: After terraform apply completes. Also any time you need to recall output values.
**Expected output**: Key-value list of all output names and their values.

---

## AWS CLI — Phase 2 Operations

---

**Command**: `aws secretsmanager put-secret-value --secret-id /yorkpulse/prod/database-url --secret-string "postgresql+asyncpg://user:password@host:5432/postgres?sslmode=require"`
**What it does**: Fills the empty DATABASE_URL secret created by Terraform with the actual value.
  The ECS task will fail to start until this (and all other secrets) are filled.
  Repeat for each secret: jwt-secret-key, supabase-url, supabase-key, redis-url, smtp-password,
  redis-auth-token.
**When you use it**: Immediately after terraform apply, before starting any ECS tasks.
**Expected output**: JSON with ARN, Name, and VersionId of the updated secret.

---

**Command**: `aws secretsmanager put-secret-value --secret-id /yorkpulse/prod/redis-auth-token --secret-string "$(python3 -c 'import secrets; t=secrets.token_urlsafe(32); print(t.replace("@","").replace("/",""))')"`
**What it does**: Generates a random 32-byte URL-safe token (no "@" or "/" which ElastiCache forbids),
  and stores it as the ElastiCache auth token. This token must be set BEFORE terraform apply
  because elasticache.tf reads it from Secrets Manager during the ElastiCache cluster creation.
**When you use it**: Before the first terraform apply (not after — ElastiCache reads it during apply).
**Expected output**: JSON with ARN, Name, and VersionId.

---

**Command**: `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com`
**What it does**: Gets a temporary ECR authentication token (valid 12 hours) and logs Docker into
  the ECR registry. After this, docker push to ECR works. The CI/CD pipeline does this automatically
  via the GitHub Actions OIDC role — this command is for manual pushes only.
**When you use it**: When you want to manually push a Docker image to ECR for testing.
**Expected output**: "Login Succeeded"

---

**Command**: `aws ecs describe-services --cluster yorkpulse-prod-cluster --services yorkpulse-prod-backend --query 'services[0].deployments'`
**What it does**: Shows the current deployment status of the ECS service.
  Each deployment has a status (PRIMARY, ACTIVE), desired count, running count, and pending count.
  During a rolling deploy: you'll see two deployments (PRIMARY = new, ACTIVE = old being drained).
  After deploy completes: only PRIMARY remains.
**When you use it**: After triggering a deploy (manually or via CI/CD) to monitor rollout progress.
**Expected output**: JSON array of deployment objects with status, rolloutState, runningCount.

---

**Command**: `aws ecs update-service --cluster yorkpulse-prod-cluster --service yorkpulse-prod-backend --force-new-deployment`
**What it does**: Forces ECS to start a rolling deployment using the current task definition.
  Useful for pulling a new :latest image without changing the task definition revision.
  ECS starts a new task, waits for health checks, then drains the old task.
**When you use it**: When you want to redeploy without a code change (e.g. to pick up a new :latest tag).
**Expected output**: JSON of the updated service configuration.

---

**Command**: `aws wafv2 get-web-acl --name yorkpulse-prod-waf --scope REGIONAL --id $(aws wafv2 list-web-acls --scope REGIONAL --query 'WebACLs[?Name==`yorkpulse-prod-waf`].Id' --output text) --region us-east-1`
**What it does**: Retrieves the full WAF Web ACL configuration — all rules, priorities, and status.
  Useful to verify WAF is correctly configured after terraform apply.
**When you use it**: To verify WAF rules are applied correctly. Also run after any WAF changes.
**Expected output**: JSON with all three managed rule groups (IP Reputation, CRS, Known Bad Inputs).

---

**Command**: `aws sns publish --topic-arn <sns_alerts_topic_arn> --message "Test alarm from YorkPulse infra setup" --subject "TEST: SNS Alert"`
**What it does**: Publishes a test message to the yorkpulse-alerts SNS topic.
  Verifies that the email subscription is confirmed and delivering.
  Replace <sns_alerts_topic_arn> with the value from terraform output sns_alerts_topic_arn.
**When you use it**: After confirming the SNS email subscription — verifies end-to-end delivery.
**Expected output**: JSON with MessageId. Email arrives at yorkpulse.app@gmail.com within 60 seconds.

---

## Route 53 — DNS Migration (route53.tf)

---

**Command**: `terraform output route53_nameservers`
**What it does**: Prints the four Route 53 nameservers assigned to the yorkpulse.com hosted zone.
  These are the nameservers you must enter at Name.com to complete the DNS migration.
  Format: ns-XXX.awsdns-YY.com, ns-XXX.awsdns-YY.co.uk, ns-XXX.awsdns-YY.net, ns-XXX.awsdns-YY.org
**When you use it**: After terraform apply — copy all four values before going to Name.com.
**Expected output**: A list of four nameserver hostnames.

---

**Command**: Update nameservers at Name.com — go to:
  Name.com → My Domains → yorkpulse.com → Nameservers → Use Custom Nameservers
  Delete existing nameservers, add all four from terraform output route53_nameservers.
**What it does**: Delegates DNS authority for yorkpulse.com from Name.com's nameservers to Route 53.
  Until this step, all Route 53 records exist but are unreachable — DNS queries still hit
  Name.com's nameservers which have no knowledge of your Route 53 records.
  After updating: DNS queries for yorkpulse.com and all subdomains resolve via Route 53.
**When you use it**: After terraform apply — AFTER copying the four Route 53 nameservers.
  Do this at a low-traffic time (late night). Propagation: up to 48 hours, usually < 1 hour.
**Expected outcome**: After propagation, `dig yorkpulse.com NS` returns the Route 53 nameservers.

---

**Command**: `dig yorkpulse.com NS +short`
**What it does**: Queries the NS (nameserver) records for yorkpulse.com.
  After updating nameservers at Name.com, this should return the four Route 53 nameservers.
  Until propagation completes, it may still show Name.com's old nameservers.
**When you use it**: To check if nameserver propagation has completed (check every 15-30 minutes after updating).
**Expected output**: Four lines, each ending with awsdns-XX.com / .co.uk / .net / .org

---

**Command**: `dig api.yorkpulse.com A +short`
**What it does**: Queries the A record for api.yorkpulse.com.
  During setup: returns 127.0.0.1 (placeholder from route53.tf api_placeholder record).
  After switching to ALB alias record: returns the ALB's current IP addresses (rotates as ALB scales).
**When you use it**: To verify DNS is resolving after nameserver propagation. Also to confirm
  the ALB alias record is live after switching from the placeholder.
**Expected output (placeholder phase)**: 127.0.0.1
**Expected output (ALB alias phase)**: One or more AWS ALB IP addresses (changes over time)

---

**Command**: `dig yorkpulse.com A +short`
**What it does**: Queries the A record for the root domain (Vercel frontend).
  Should return 76.76.21.21 (Vercel's Anycast IP) after nameserver propagation.
  Verifies that the Vercel frontend is still reachable after migrating DNS to Route 53.
**When you use it**: Immediately after nameserver propagation to confirm Vercel frontend is not broken.
**Expected output**: 76.76.21.21

---

**Command**: `dig _dmarc.yorkpulse.com TXT +short`
**What it does**: Queries the DMARC policy TXT record for yorkpulse.com.
  Verifies that the DMARC record is live and returning the correct policy string.
**When you use it**: After nameserver propagation — to verify all email records are live.
**Expected output**: "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com"

---

**Command**: `dig brevo1._domainkey.yorkpulse.com CNAME +short`
**What it does**: Queries the Brevo DKIM CNAME record (selector 1).
  Verifies that Brevo DKIM signing is correctly configured.
**When you use it**: After nameserver propagation — to verify email records are live.
**Expected output**: b1.yorkpulse-com.dkim.brevo.com.

---

**Command**: `aws route53 list-resource-record-sets --hosted-zone-id Z01059542TIO3YH228MAS --query 'ResourceRecordSets[].{Name:Name,Type:Type}' --output table`
**What it does**: Lists all DNS records in the Route 53 hosted zone in a human-readable table.
  Useful to verify all records from route53.tf were created correctly after terraform apply.
**When you use it**: After terraform apply — spot-check that all expected records are present.
**Expected output**: Table with one row per record: ACM validation CNAME, Brevo DKIM CNAMEs,
  Resend DKIM TXT, DMARC TXT, Brevo verify TXT, SPF TXT, MX, CAA (×2), A (×2 Vercel), CNAME (www), A (api placeholder).

---

## ECS Debugging Commands

> Use these when a deployment is misbehaving, tasks are failing to start,
> or you need to inspect the running service without ssh access.

---

**Command**: `aws ecs describe-services --cluster yorkpulse-prod-cluster --services yorkpulse-prod-backend --region us-east-1 --query 'services[0].{Running:runningCount,Desired:desiredCount,Pending:pendingCount}'`
**What it does**: Shows how many ECS tasks are running vs desired vs pending for the backend service.
  Healthy state: Running=1, Desired=1, Pending=0.
  During a rolling deploy: Running=1, Desired=1, Pending=1 briefly, then settles back to Running=1.
**When you use it**: Any time you want to confirm the service is healthy after a deploy or config change.
**Expected output**: JSON with Running, Desired, Pending counts.

---

**Command**: `aws logs tail /ecs/yorkpulse-backend --region us-east-1 --since 10m`
**What it does**: Streams the last 10 minutes of live FastAPI logs from CloudWatch to your terminal.
  Equivalent to "tail -f" on the container's stdout/stderr. Shows uvicorn request logs,
  Python logging output, and any startup errors (Secrets Manager failures, DB connection errors).
  Change --since 10m to --since 1h for longer history, or omit to follow live.
**When you use it**: After a deploy to watch startup logs, or when investigating errors.
**Expected output**: Timestamped log lines from uvicorn and the FastAPI app.

---

**Command**: `aws ecs update-service --cluster yorkpulse-prod-cluster --service yorkpulse-prod-backend --force-new-deployment --region us-east-1`
**What it does**: Forces ECS to start a new rolling deployment with the current task definition revision.
  Useful when you pushed a new :latest image to ECR but didn't change the task definition —
  ECS won't detect the new image automatically without --force-new-deployment.
  Does NOT change the task definition revision.
**When you use it**: After manually pushing a new image to ECR and wanting ECS to pull it.
**Expected output**: JSON of the updated service object.

---

**Command**: `aws ecs describe-services --cluster yorkpulse-prod-cluster --services yorkpulse-prod-backend --region us-east-1 --query 'services[0].taskDefinition'`
**What it does**: Shows the exact ARN (including revision number) of the task definition currently
  registered to the ECS service. Format: arn:aws:ecs:...:task-definition/yorkpulse-prod-backend:N
  If ECS is using an old revision despite a new terraform apply, this tells you the actual revision.
**When you use it**: When you suspect ECS is running a stale task definition revision.
**Expected output**: Full task definition ARN with revision number at the end (e.g. :3).

---

**Command**: `aws ecs update-service --cluster yorkpulse-prod-cluster --service yorkpulse-prod-backend --task-definition yorkpulse-prod-backend:N --force-new-deployment --region us-east-1`
**What it does**: Explicitly pins the ECS service to a specific task definition revision (replace N
  with the revision number). Terraform may leave the service on an old revision if the
  ignore_changes lifecycle block is in effect. This command bypasses that and forces the new revision.
  The rolling deploy (min 100% / max 200%) ensures zero downtime.
**When you use it**: When terraform apply created a new task definition revision but ECS didn't
  pick it up automatically. Check the revision number first with describe-services above.
**Expected output**: JSON of the updated service showing the new taskDefinition ARN.

---

**Command**: `aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 062677866920.dkr.ecr.us-east-1.amazonaws.com`
**What it does**: Gets a fresh 12-hour ECR authentication token and logs Docker into the ECR registry.
  ECR tokens expire every 12 hours. Without re-authenticating, docker push returns HTTP 403.
  Must be run before any docker push to ECR — the CI/CD pipeline does this automatically,
  but manual pushes require it explicitly.
**When you use it**: Before manually pushing an image to ECR, or after getting a 403 error on push.
**Expected output**: "Login Succeeded"

---

**Command**: `docker buildx build --platform linux/amd64 -t 062677866920.dkr.ecr.us-east-1.amazonaws.com/yorkpulse-backend:latest --push .`
**What it does**: Builds the Docker image explicitly for linux/amd64 (x86_64) and pushes it to ECR.
  CRITICAL on Apple Silicon (M1/M2/M3): without --platform linux/amd64, the image is built for
  ARM64 and ECS Fargate (which runs x86_64) will fail with "image manifest does not contain
  descriptor matching platform linux/amd64". Always use this command for ECS deployments.
  --push sends the image directly to ECR (no separate docker push needed).
**When you use it**: For every manual image build intended for ECS. Run from backend/ directory.
**Expected output**: Build output ending with "pushed" confirmation and the ECR image digest.
