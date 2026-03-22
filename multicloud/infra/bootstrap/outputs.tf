# Outputs surface important values after "terraform apply" completes.
# Copy these values into the backend block of infra/aws/versions.tf
# and infra/azure/versions.tf so those modules know where to store their state.

# The name of the S3 bucket storing Terraform state.
# Use this as the "bucket" argument in all other modules' backend "s3" blocks.
output "s3_bucket_name" {
  description = "Name of the S3 bucket used to store Terraform remote state"
  value       = aws_s3_bucket.terraform_state.bucket
}

# The name of the DynamoDB table used for state locking.
# Use this as the "dynamodb_table" argument in all other modules' backend "s3" blocks.
output "dynamodb_table_name" {
  description = "Name of the DynamoDB table used for Terraform state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}
