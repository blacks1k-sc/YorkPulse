# Log Analytics workspace — required by the Container App Environment for structured logging.
# Container Apps stream stdout/stderr to this workspace automatically.
# Equivalent to CloudWatch log groups on the AWS side.
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.app_name}-${var.environment}-logs"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # PerGB2018: pay only for data ingested. At YorkPulse traffic, cost is ~$0-$2/month.
  # Free tier gives 5GB/month — frontend SSR logs should stay well under that.
  sku               = "PerGB2018"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}

# Container App Environment — the shared hosting boundary for all Container Apps.
# Think of it as the VPC equivalent for Azure Container Apps: networking, logging,
# and compute resources are shared within one Environment.
resource "azurerm_container_app_environment" "main" {
  name                       = "${var.app_name}-${var.environment}-env"
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}

# Container App — runs the Next.js frontend as a serverless container.
# Azure manages scaling, networking, and TLS termination — no cluster to manage.
resource "azurerm_container_app" "frontend" {
  name                         = "${var.app_name}-frontend"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name

  # Single revision mode: only one active revision at a time.
  # Traffic goes 100% to the latest revision after each deploy.
  # Use "Multiple" for blue/green or A/B — not needed here.
  revision_mode = "Single"

  # ACR admin password stored as a named secret inside the Container App.
  # Secrets defined here are referenced by name in the registry block below —
  # the actual password never appears in plaintext in any Terraform output or state diff.
  secret {
    name  = "acr-password"
    value = azurerm_container_registry.main.admin_password
  }

  # Tell the Container App how to authenticate with ACR to pull the image.
  # password_secret_name references the secret defined above — not a raw password.
  registry {
    server               = azurerm_container_registry.main.login_server
    username             = azurerm_container_registry.main.admin_username
    password_secret_name = "acr-password"
  }

  template {
    # Scale the frontend between 1 and 3 replicas based on HTTP request load.
    # min_replicas = 1 means there is always one warm instance — no cold start latency for users.
    # max_replicas = 3 handles traffic spikes without manual intervention.
    min_replicas = 1
    max_replicas = 3

    container {
      name = "frontend"

      # var.frontend_image defaults to the Azure sample image until the real image is pushed.
      # Update this variable after 'docker buildx build --push' to ACR (see COMMANDS.md).
      image  = var.frontend_image
      cpu    = var.container_cpu
      memory = var.container_memory

      # NEXT_PUBLIC_API_URL is baked into Next.js at startup (not build time with standalone).
      # Points to the ECS backend via its API subdomain — over HTTPS, WAF-protected.
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = "https://api.yorkpulse.com"
      }

      # NODE_ENV = production disables Next.js development helpers and enables optimisations.
      env {
        name  = "NODE_ENV"
        value = "production"
      }
    }
  }

  # Ingress: make the Container App reachable from the public internet on port 3000.
  # Azure terminates TLS and assigns a *.azurecontainerapps.io HTTPS URL automatically.
  # external_enabled = true means public traffic is allowed (not just internal VNet traffic).
  ingress {
    external_enabled = true
    target_port      = 3000

    # Route 100% of traffic to the latest revision on every deploy.
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}
