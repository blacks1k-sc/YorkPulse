# Pull the current authenticated service principal's details at plan time.
# object_id is used in the Key Vault access policy — it's the identity
# that Terraform is running as, so it gets full vault access to manage secrets.
data "azurerm_client_config" "current" {}

# Root resource group — every Azure resource in Phase 3 lives inside this.
# Deleting this resource group deletes everything inside it (use with care).
resource "azurerm_resource_group" "main" {
  name     = "${var.app_name}-${var.environment}"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}
