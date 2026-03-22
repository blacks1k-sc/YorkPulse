# =============================================================================
# BOOTSTRAP — Terraform Remote State Infrastructure
# =============================================================================
# PURPOSE: Create the S3 bucket and DynamoDB table that store Terraform's
# state file for every other module in this project (infra/aws/, infra/azure/).
#
# WHY NO BACKEND BLOCK HERE:
# This is the bootstrapping paradox — you can't store Terraform state remotely
# in an S3 bucket before that bucket exists. So this module runs with local
# state only. After "terraform apply" completes, all other modules declare this
# S3 bucket as their remote backend. Run this file exactly once, then never again.
# =============================================================================


# -----------------------------------------------------------------------------
# S3 BUCKET — Stores terraform.tfstate for all other Terraform modules
# -----------------------------------------------------------------------------
# The state file is Terraform's memory. It tracks every resource it has created.
# Without it, Terraform doesn't know what exists and will try to create duplicates
# or fail to destroy things correctly. Storing it in S3 means it's shared across
# your laptop, CI/CD, and any future team members.
resource "aws_s3_bucket" "terraform_state" {
  # The bucket name must be globally unique across all AWS accounts worldwide.
  # We add a random suffix (847291) to avoid name collisions with other users.
  bucket = "yorkpulse-tf-state-847291"

  # Prevent accidental deletion of this bucket via terraform destroy.
  # If this bucket is deleted, ALL Terraform state is lost and infrastructure
  # becomes unmanageable. This is a safety net.
  lifecycle {
    prevent_destroy = true
  }
}

# Enable versioning on the state bucket.
# WHY: Every time terraform apply runs, the state file is overwritten.
# Versioning keeps a full history of every state version so you can roll back
# to a previous state if something goes wrong (e.g., a bad apply corrupts state).
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  versioning_configuration {
    status = "Enabled" # Keep all previous versions of the state file
  }
}

# Enable server-side encryption on the state bucket.
# WHY: The state file contains sensitive data — resource IDs, ARNs, and
# sometimes plaintext outputs. AES256 encrypts it at rest so even if someone
# gains direct S3 access, the contents are protected.
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # AWS-managed key encryption — no extra cost
    }
  }
}

# Block ALL public access to the state bucket.
# WHY: S3 buckets are private by default, but AWS accounts can have settings
# that accidentally allow public access. This resource hard-locks the bucket
# so no policy or ACL can ever make it publicly accessible, regardless of
# account-level settings. The state file must never be publicly readable.
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true # Block any attempt to set public ACLs
  block_public_policy     = true # Block any bucket policy that grants public access
  ignore_public_acls      = true # Ignore any existing public ACLs
  restrict_public_buckets = true # Restrict access even if policy says otherwise
}


# -----------------------------------------------------------------------------
# DYNAMODB TABLE — State locking to prevent concurrent terraform applies
# -----------------------------------------------------------------------------
# The problem: if two engineers (or two CI/CD runs) run "terraform apply"
# at exactly the same time, they both read the current state, make changes,
# and write back — resulting in one overwriting the other's changes.
# This corrupts infrastructure silently.
#
# The solution: before any apply starts, Terraform writes a lock record to
# this DynamoDB table. If a lock already exists, the second apply waits or
# fails. Only one apply runs at a time. When done, the lock is released.
resource "aws_dynamodb_table" "terraform_locks" {
  name = "yorkpulse-terraform-locks"

  # PAY_PER_REQUEST means you only pay per read/write operation.
  # Since terraform apply runs infrequently, this costs almost nothing
  # (~$0.00 for a handful of lock acquisitions per day).
  # The alternative (PROVISIONED) would charge for reserved capacity 24/7.
  billing_mode = "PAY_PER_REQUEST"

  # LockID is the required primary key name for Terraform state locking.
  # Terraform writes the state file path as the LockID value.
  # This is not configurable — Terraform hardcodes this attribute name.
  hash_key = "LockID"

  attribute {
    name = "LockID" # Must match hash_key exactly
    type = "S"      # S = String type (Terraform writes the state path as a string)
  }
}
