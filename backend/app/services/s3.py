"""S3 service for file uploads."""

import uuid
from datetime import datetime

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings


class S3Service:
    """Service for S3 file operations."""

    def __init__(self):
        self.bucket_name = settings.s3_bucket_name
        self.region = settings.aws_region

        # Initialize client only if credentials are provided
        if settings.aws_access_key_id and settings.aws_secret_access_key:
            self.client = boto3.client(
                "s3",
                region_name=self.region,
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                config=Config(signature_version="s3v4"),
            )
        else:
            self.client = None

    def generate_upload_url(
        self,
        folder: str,
        filename: str,
        content_type: str,
        expires_in: int = 300,
    ) -> tuple[str, str]:
        """Generate a presigned URL for uploading a file.

        Args:
            folder: Folder path in bucket (e.g., "student-ids", "marketplace")
            filename: Original filename
            content_type: MIME type of the file
            expires_in: URL expiration in seconds (default 5 minutes)

        Returns:
            Tuple of (presigned_url, file_key)
        """
        if not self.client:
            raise ValueError("S3 client not configured")

        # Generate unique file key
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4())[:8]
        extension = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        file_key = f"{folder}/{timestamp}/{unique_id}.{extension}"

        try:
            url = self.client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": file_key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return url, file_key
        except ClientError as e:
            raise ValueError(f"Failed to generate upload URL: {e}")

    def generate_download_url(self, file_key: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for downloading a file.

        Args:
            file_key: S3 object key
            expires_in: URL expiration in seconds (default 1 hour)

        Returns:
            Presigned download URL
        """
        if not self.client:
            raise ValueError("S3 client not configured")

        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": file_key,
                },
                ExpiresIn=expires_in,
            )
            return url
        except ClientError as e:
            raise ValueError(f"Failed to generate download URL: {e}")

    def delete_file(self, file_key: str) -> bool:
        """Delete a file from S3.

        Args:
            file_key: S3 object key

        Returns:
            True if deleted successfully
        """
        if not self.client:
            return False

        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=file_key)
            return True
        except ClientError:
            return False

    def file_exists(self, file_key: str) -> bool:
        """Check if a file exists in S3.

        Args:
            file_key: S3 object key

        Returns:
            True if file exists
        """
        if not self.client:
            return False

        try:
            self.client.head_object(Bucket=self.bucket_name, Key=file_key)
            return True
        except ClientError:
            return False


# Singleton instance
s3_service = S3Service()
