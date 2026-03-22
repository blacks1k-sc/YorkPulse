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
