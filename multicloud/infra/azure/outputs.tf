# Outputs — values printed after terraform apply completes.
# Copy these for manual steps: docker push to ACR, update frontend URL in DNS, etc.

# The login server URL for the Azure Container Registry.
# Format: yorkpulseacr.azurecr.io
# Use this as the prefix when tagging and pushing Docker images:
#   docker tag yorkpulse-frontend:local <acr_login_server>/yorkpulse-frontend:latest
#   docker push <acr_login_server>/yorkpulse-frontend:latest
output "acr_login_server" {
  description = "ACR hostname used as the image registry prefix in docker tag / docker push"
  value       = azurerm_container_registry.main.login_server
}

# The public HTTPS URL assigned to the frontend Container App by Azure.
# Format: https://yorkpulse-frontend.<random-hash>.canadacentral.azurecontainerapps.io
# This is the URL to validate the frontend is serving before cutting over DNS.
# After DNS cutover: point yorkpulse.com to this URL (or set a custom domain on the Container App).
output "container_app_url" {
  description = "Public HTTPS URL of the frontend Container App — use this to validate before DNS cutover"
  value       = "https://${azurerm_container_app.frontend.ingress[0].fqdn}"
}

# The name of the resource group containing all Phase 3 Azure resources.
# Useful for az CLI commands that require --resource-group.
output "resource_group_name" {
  description = "Azure resource group name — pass to az CLI commands with --resource-group"
  value       = azurerm_resource_group.main.name
}

# The URI of the Key Vault — base URL for all vault operations and secret references.
# Format: https://yorkpulse-prod-kv.vault.azure.net/
# Use this to construct Key Vault secret references in Azure Container Apps (Phase 5).
output "key_vault_uri" {
  description = "Key Vault base URI — use to construct secret references and az keyvault commands"
  value       = azurerm_key_vault.main.vault_uri
}

# The Log Analytics workspace ID — useful for writing az monitor log queries.
output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID — use for az monitor log-analytics query commands"
  value       = azurerm_log_analytics_workspace.main.workspace_id
}
