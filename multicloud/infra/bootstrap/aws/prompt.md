Phase 2: Create the AWS Terraform infrastructure for YorkPulse.

Read CLAUDE.md and guide.md first to understand the full architecture.

Create these files in infra/aws/:

─────────────────────────────────────────
versions.tf
─────────────────────────────────────────
- Terraform >= 1.6.0, AWS provider ~> 5.0
- Configure S3 remote backend:
  bucket: "yorkpulse-tf-state-847291"
  key: "aws/terraform.tfstate"
  region: "us-east-1"
  dynamodb_table: "yorkpulse-terraform-locks"
  encrypt: true

─────────────────────────────────────────
variables.tf
─────────────────────────────────────────
- project = "yorkpulse"
- environment = "prod"
- aws_region = "us-east-1"
- backend_image_tag = "latest"
- alert_email = "yorkpulse.app@gmail.com"

─────────────────────────────────────────
vpc.tf
─────────────────────────────────────────
- VPC: 10.0.0.0/16
- 2 public subnets (us-east-1a, us-east-1b) → for ALB
- 2 private subnets (us-east-1a, us-east-1b) → for ECS + ElastiCache
- Internet Gateway → attached to VPC
- NAT Gateway → in one public subnet (ECS needs outbound for Supabase/SMTP)
- Public route table → routes 0.0.0.0/0 to Internet Gateway
- Private route table → routes 0.0.0.0/0 to NAT Gateway
- Security group: ALB → allows 80 + 443 from anywhere
- Security group: ECS tasks → allows 8000 ONLY from ALB security group
- Security group: ElastiCache → allows 6379 ONLY from ECS security group

─────────────────────────────────────────
ecr.tf
─────────────────────────────────────────
- ECR repository: yorkpulse-backend
- Image tag mutability: MUTABLE (allows :latest tag)
- Scan on push: true (basic CVE scanning)
- Lifecycle policy: delete untagged images older than 30 days
  + keep only last 10 tagged images

─────────────────────────────────────────
secrets.tf
─────────────────────────────────────────
- Create these Secrets Manager secrets (empty value — filled manually after apply):
  /yorkpulse/prod/database-url
  /yorkpulse/prod/jwt-secret-key
  /yorkpulse/prod/supabase-url
  /yorkpulse/prod/supabase-key
  /yorkpulse/prod/redis-url
  /yorkpulse/prod/smtp-password
  /yorkpulse/prod/gemini-api-key
- recovery_window_in_days: 7

─────────────────────────────────────────
iam.tf
─────────────────────────────────────────
- ECS Task Execution Role:
  Attach: AmazonECSTaskExecutionRolePolicy
  Add inline policy: allow secretsmanager:GetSecretValue 
  for /yorkpulse/prod/* secrets only
  
- ECS Task Role (what the running container can do):
  Allow: secretsmanager:GetSecretValue for /yorkpulse/prod/*
  Allow: logs:CreateLogStream, logs:PutLogEvents
  Allow: elasticache:Connect (for Redis auth)
  Nothing else — least privilege

- GitHub Actions OIDC Role:
  Trust policy: github.com/actions/oidc
  Condition: repo:YOUR_GITHUB_USERNAME/yorkpulse:ref:refs/heads/main
  Allow: ecr:GetAuthorizationToken, ecr:BatchCheckLayerAvailability,
         ecr:PutImage, ecr:InitiateLayerUpload, ecr:UploadLayerPart,
         ecr:CompleteLayerUpload (ECR push only)
  Allow: ecs:UpdateService, ecs:DescribeServices (deploy only)
  Allow: iam:PassRole (for ECS task roles only)
  Nothing else

─────────────────────────────────────────
alb.tf
─────────────────────────────────────────
- ALB: internet-facing, in public subnets
- Target group: port 8000, protocol HTTP, target type IP
  Health check: /api/v1/health, interval 30s, 
  healthy threshold 2, unhealthy threshold 3
- Listener HTTP:80 → redirect to HTTPS:443
- Listener HTTPS:443 → forward to target group
  (ACM certificate ARN as variable — filled after cert creation)
- Note: Add comment saying ACM cert must be created manually 
  in AWS Console for api.yorkpulse.com before applying

─────────────────────────────────────────
ecs.tf
─────────────────────────────────────────
- ECS Cluster: yorkpulse-cluster
- CloudWatch log group: /ecs/yorkpulse-backend (retention: 30 days)
- Task definition:
  Family: yorkpulse-backend
  CPU: 512 (0.5 vCPU), Memory: 1024 (1GB)
  Network mode: awsvpc
  Requires compatibilities: FARGATE
  Execution role: ECS Task Execution Role (from iam.tf)
  Task role: ECS Task Role (from iam.tf)
  Container definition:
    Image: ECR repo URL + :latest
    Port: 8000
    All secrets injected from Secrets Manager (not hardcoded)
    Environment variables (non-secret):
      CORS_ORIGINS: https://yorkpulse.com,https://www.yorkpulse.com
      AWS_REGION: us-east-1
    Log configuration: awslogs → CloudWatch log group
    
- ECS Service:
  Cluster: yorkpulse-cluster
  Task definition: yorkpulse-backend
  Launch type: FARGATE
  Desired count: 1
  Network: private subnets, ECS security group
  Load balancer: ALB target group
  Deployment: rolling update
    minimum_healthy_percent: 100
    maximum_percent: 200

─────────────────────────────────────────
elasticache.tf
─────────────────────────────────────────
- Subnet group: private subnets
- Redis cluster: cache.t3.micro, single node
- Engine: redis 7.x
- transit_encryption_enabled: true
- auth_token: reference from Secrets Manager
  (store ElastiCache auth token in 
   /yorkpulse/prod/redis-auth-token)
- Add /yorkpulse/prod/redis-auth-token to secrets.tf

─────────────────────────────────────────
waf.tf
─────────────────────────────────────────
- WAF Web ACL: scope REGIONAL (for ALB)
- Default action: allow
- Rules (in order):
  1. AWSManagedRulesAmazonIpReputationList (priority 1)
  2. AWSManagedRulesCommonRuleSet (priority 2)
  3. AWSManagedRulesKnownBadInputsRuleSet (priority 3)
- Associate WAF with ALB
- Logging: send to CloudWatch log group /aws/waf/yorkpulse

─────────────────────────────────────────
cloudwatch.tf
─────────────────────────────────────────
- SNS topic: yorkpulse-alerts
- SNS subscription: email → yorkpulse.app@gmail.com
- CloudWatch alarms:
  1. ECS CPU > 80% for 2 consecutive 5-min periods → SNS
  2. ECS Memory > 80% for 2 consecutive 5-min periods → SNS
  3. ALB 5xx errors > 10 in 5 minutes → SNS
  4. ALB target response time > 2s (p99) → SNS
  5. WAF blocked requests > 100 in 5 minutes → SNS
     (spike = active attack)
- Log metric filter: count ERROR in /ecs/yorkpulse-backend
  Alarm: > 20 errors in 5 minutes → SNS

─────────────────────────────────────────
outputs.tf
─────────────────────────────────────────
Output these values (needed for Phase 3 + Phase 4):
- alb_dns_name
- ecr_repository_url
- ecs_cluster_name
- ecs_service_name
- vpc_id

─────────────────────────────────────────
RULES FOR ALL FILES:
- Every resource block needs plain English comment above it
- Every argument needs inline comment explaining WHY
- Every file needs a header comment explaining what it creates
- NEVER hardcode secrets, ARNs, or account IDs
- Use var.project and var.environment for all name prefixes
- Add all new commands to COMMANDS.md
- Add decisions to DECISIONS.md for: 
  WAF rule order reasoning, 
  ECS rolling deploy settings,
  ElastiCache TLS decision,
  NAT Gateway vs VPC endpoints decision
- After creating all files, output:
  1. Complete file list created
  2. The 3 terraform commands to run (init, plan, apply)
  3. Manual steps required BEFORE terraform apply
     (ACM cert, filling secrets, OIDC provider setup)
  4. Manual steps required AFTER terraform apply
     (filling secret values, DNS update)