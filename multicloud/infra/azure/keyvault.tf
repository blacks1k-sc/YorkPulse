# Azure Key Vault — encrypted secret storage for the frontend.
# Equivalent to AWS Secrets Manager. Stores NEXT_PUBLIC_* env vars and any future secrets.
# Container Apps can read secrets from Key Vault via Key Vault references (Phase 5 evolution).
resource "azurerm_key_vault" "main" {
  # Name must be globally unique across all of Azure, 3-24 chars, alphanumeric + hyphens.
  name                = "${var.app_name}-${var.environment}-kv"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # tenant_id ties the vault to your Azure AD tenant — only identities in this tenant
  # can be granted access, even if the vault is public-facing.
  tenant_id = data.azurerm_client_config.current.tenant_id

  # Standard SKU: ~$0.03/10,000 operations. Supports secrets, keys, and certificates.
  # Premium adds HSM-backed keys — not needed for a portfolio project.
  sku_name = "standard"

  # Soft-delete: if the vault or a secret is deleted, it's recoverable for 7 days.
  # Prevents accidental permanent data loss. 7 days is the minimum Azure allows.
  soft_delete_retention_days = 7

  # purge_protection: when false, an authorised user can permanently purge a soft-deleted vault.
  # Set to true in regulated environments. false keeps things simple for portfolio work.
  purge_protection_enabled = false

  # Access policy for the Terraform service principal (the identity running terraform apply).
  # object_id comes from data.azurerm_client_config.current — automatically resolves to
  # whoever is authenticated via the ARM_CLIENT_ID env var.
  # This allows Terraform to create, read, and manage secrets in the vault.
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    # Full secret permissions: Terraform needs to create and read secrets,
    # delete old values during updates, and recover accidentally deleted secrets.
    secret_permissions = [
      "Get",
      "List",
      "Set",
      "Delete",
      "Recover",
      "Purge",
      "Backup",
      "Restore",
    ]

    # Full key permissions: required if you later use Key Vault for encryption keys
    # (e.g. customer-managed keys for storage encryption). Added now to avoid a
    # second access policy update later.
    key_permissions = [
      "Get",
      "List",
      "Create",
      "Delete",
      "Update",
      "Recover",
      "Purge",
      "Backup",
      "Restore",
    ]

    # Certificate permissions: not used today but included for completeness.
    # Remove if you want strictly least-privilege — no certificates are planned.
    certificate_permissions = [
      "Get",
      "List",
      "Create",
      "Delete",
      "Update",
      "Recover",
      "Purge",
      "Backup",
      "Restore",
      "Import",
    ]
  }

  tags = {
    Environment = var.environment
    Project     = var.app_name
  }
}
