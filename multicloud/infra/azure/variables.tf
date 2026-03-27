# All configurable values for the Azure phase live here.
# Pass overrides via -var flags or a terraform.tfvars file (never commit tfvars).

variable "location" {
  description = "Azure region for all resources. canadacentral is closest to York University."
  type        = string
  default     = "canadacentral"
}

variable "app_name" {
  description = "Short name used as a prefix for every resource. Keep it lowercase, no spaces."
  type        = string
  default     = "yorkpulse"
}

variable "environment" {
  description = "Deployment environment. Used in resource names and tags."
  type        = string
  default     = "prod"
}

variable "frontend_image" {
  description = <<-EOT
    Full ACR image URL for the Next.js frontend container.
    Format: yorkpulseacr.azurecr.io/yorkpulse-frontend:<tag>
    Fill this in after the first 'docker push' to ACR.
    Leave empty on the first terraform apply (ACR must exist before you can push).
  EOT
  type    = string
  default = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
  # Default is the Azure sample image — safe placeholder until the real image is pushed.
  # Replace with the actual ACR image URL before going live:
  #   yorkpulseacr.azurecr.io/yorkpulse-frontend:latest
}

variable "container_cpu" {
  description = "vCPU allocated to the frontend container. 0.5 = half a core. Min for Container Apps is 0.25."
  type        = number
  default     = 0.5
}

variable "container_memory" {
  description = "RAM allocated to the frontend container. Must pair with cpu: 0.5 cpu → 1.0Gi memory (Azure requirement)."
  type        = string
  default     = "1.0Gi"
}
