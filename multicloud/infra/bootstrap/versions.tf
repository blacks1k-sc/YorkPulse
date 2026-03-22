# Pin the minimum Terraform version and the AWS provider version.
# This ensures everyone working on this project (and CI/CD) uses
# compatible tooling and doesn't get surprised by breaking changes.

terraform {
  # Require Terraform 1.6.0 or higher.
  # 1.6.0 introduced test framework improvements and is the stable LTS baseline.
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"

      # ~> 5.0 means "5.x but not 6.0" — accepts patch and minor updates
      # within version 5, but won't auto-upgrade to a major version with
      # breaking changes.
      version = "~> 5.0"
    }
  }
}

# Tell the AWS provider which region to deploy resources into.
# us-east-1 is chosen because it has the widest AWS service availability
# and lowest latency for most North American users.
provider "aws" {
  region = "us-east-1"
}
