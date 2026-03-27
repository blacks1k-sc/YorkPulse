# Azure Container Registry — private Docker image registry for the frontend image.
# Equivalent to AWS ECR. Images pushed here are pulled by the Container App at deploy time.
resource "azurerm_container_registry" "main" {
  # Name must be globally unique across all of Azure, 5-50 chars, alphanumeric only (no hyphens).
  name                = "${var.app_name}acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # Basic SKU: cheapest tier (~$0.17/day). Sufficient for a single-image portfolio project.
  # Standard/Premium add geo-replication and content trust — not needed here.
  sku = "Basic"

  # Admin credentials allow the Container App to authenticate with a username/password.
  # A managed identity approach is more secure but adds complexity — Basic SKU supports
  # admin auth which is acceptable at portfolio scale. The password is stored as a secret
  # in the Container App definition (see container_app.tf), never in plaintext.
  admin_enabled = true

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}
