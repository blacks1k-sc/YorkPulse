terraform {
  required_version = ">= 1.3.0"

  required_providers {
    # Azure Resource Manager provider — manages all Azure resources in this module
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  # Remote state stored in Azure Blob Storage — same pattern as AWS uses S3
  # This backend was created manually in the yorkpulse-terraform resource group (run once)
  backend "azurerm" {
    resource_group_name  = "yorkpulse-terraform"
    storage_account_name = "yorkpulsetfstate"
    container_name       = "tfstate"
    key                  = "azure/terraform.tfstate"
    # Auth for the backend itself also uses ARM_* env vars — no credentials in code
  }
}

provider "azurerm" {
  # Auth is handled entirely via environment variables — never hardcode credentials here
  # Required env vars before running terraform init / plan / apply:
  #   ARM_SUBSCRIPTION_ID = fb7e60ee-c894-41ae-bbc3-2e6992fbb382
  #   ARM_TENANT_ID       = 85ef3390-15be-4bf9-a380-84abd60835c2
  #   ARM_CLIENT_ID       = 20518fc6-13ab-4f55-87b2-7a6abea05738
  #   ARM_CLIENT_SECRET   = (from password manager — never commit this)
  features {}
}
