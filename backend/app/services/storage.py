"""Supabase Storage service for file uploads."""

import uuid
from datetime import datetime

from supabase import create_client, Client

from app.core.config import settings


class StorageService:
    """Service for Supabase Storage file operations."""

    def __init__(self):
        self._client: Client | None = None
        self.buckets = {
            "avatars": "avatars",
            "chat-images": "chat-images",
            "marketplace": "marketplace",
            "vault": "marketplace",
            "student-ids": "student-ids",
        }

    @property
    def client(self) -> Client:
        """Lazy initialization of Supabase client."""
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise ValueError("Supabase URL and key must be configured")
            self._client = create_client(settings.supabase_url, settings.supabase_key)
        return self._client

    def is_configured(self) -> bool:
        """Check if Supabase is properly configured."""
        return bool(settings.supabase_url and settings.supabase_key)

    def _generate_file_path(self, folder: str, filename: str) -> str:
        """Generate a unique file path."""
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        unique_id = str(uuid.uuid4())[:8]
        extension = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
        return f"{folder}/{timestamp}/{unique_id}.{extension}"

    def _get_bucket_for_folder(self, folder: str) -> str:
        """Map folder to bucket name."""
        if folder in self.buckets:
            return self.buckets[folder]
        # Default bucket based on folder prefix
        if folder.startswith("avatar"):
            return "avatars"
        elif folder.startswith("chat") or folder.startswith("message"):
            return "chat-images"
        elif folder.startswith("marketplace") or folder.startswith("listing"):
            return "marketplace"
        elif folder.startswith("student") or folder.startswith("id"):
            return "student-ids"
        return "uploads"

    def upload_file(
        self,
        folder: str,
        filename: str,
        file_data: bytes,
        content_type: str,
    ) -> str:
        """Upload a file directly to Supabase Storage.

        Args:
            folder: Folder path (e.g., "avatars", "marketplace")
            filename: Original filename
            file_data: File bytes
            content_type: MIME type of the file

        Returns:
            Public URL of the uploaded file
        """
        if not self.is_configured():
            raise ValueError("Supabase Storage not configured")

        bucket = self._get_bucket_for_folder(folder)
        file_path = self._generate_file_path(folder, filename)

        try:
            # Upload to Supabase Storage
            self.client.storage.from_(bucket).upload(
                file_path,
                file_data,
                file_options={"content-type": content_type}
            )

            # Get public URL
            public_url = self.client.storage.from_(bucket).get_public_url(file_path)
            return public_url

        except Exception as e:
            raise ValueError(f"Failed to upload file: {e}")

    def generate_upload_url(
        self,
        folder: str,
        filename: str,
        content_type: str,
        expires_in: int = 300,
    ) -> tuple[str, str, str]:
        """Generate a signed URL for uploading a file.

        Args:
            folder: Folder path in bucket (e.g., "avatars", "marketplace")
            filename: Original filename
            content_type: MIME type of the file
            expires_in: URL expiration in seconds (default 5 minutes)

        Returns:
            Tuple of (signed_upload_url, file_path, public_url)
        """
        if not self.is_configured():
            raise ValueError("Supabase Storage not configured")

        bucket = self._get_bucket_for_folder(folder)
        file_path = self._generate_file_path(folder, filename)

        try:
            # Create signed upload URL
            response = self.client.storage.from_(bucket).create_signed_upload_url(file_path)

            signed_url = response.get("signedURL") or response.get("signed_url")
            if not signed_url:
                # Fallback: construct the URL manually for direct upload
                signed_url = f"{settings.supabase_url}/storage/v1/object/{bucket}/{file_path}"

            # Get public URL (will be accessible after upload)
            public_url = self.client.storage.from_(bucket).get_public_url(file_path)

            return signed_url, file_path, public_url

        except Exception as e:
            raise ValueError(f"Failed to generate upload URL: {e}")

    def get_public_url(self, bucket: str, file_path: str) -> str:
        """Get the public URL for a file.

        Args:
            bucket: Bucket name
            file_path: Path to file in bucket

        Returns:
            Public URL
        """
        if not self.is_configured():
            raise ValueError("Supabase Storage not configured")

        return self.client.storage.from_(bucket).get_public_url(file_path)

    def generate_signed_url(self, bucket: str, file_path: str, expires_in: int = 3600) -> str:
        """Generate a signed URL for downloading a private file.

        Args:
            bucket: Bucket name
            file_path: Path to file in bucket
            expires_in: URL expiration in seconds (default 1 hour)

        Returns:
            Signed download URL
        """
        if not self.is_configured():
            raise ValueError("Supabase Storage not configured")

        try:
            response = self.client.storage.from_(bucket).create_signed_url(file_path, expires_in)
            return response.get("signedURL") or response.get("signed_url", "")
        except Exception as e:
            raise ValueError(f"Failed to generate signed URL: {e}")

    def delete_file(self, bucket: str, file_path: str) -> bool:
        """Delete a file from Supabase Storage.

        Args:
            bucket: Bucket name
            file_path: Path to file in bucket

        Returns:
            True if deleted successfully
        """
        if not self.is_configured():
            return False

        try:
            self.client.storage.from_(bucket).remove([file_path])
            return True
        except Exception:
            return False

    def delete_by_url(self, url: str) -> bool:
        """Delete a file by its public URL.

        Args:
            url: Public URL of the file

        Returns:
            True if deleted successfully
        """
        if not self.is_configured():
            return False

        try:
            # Parse URL to get bucket and path
            # URL format: https://xxx.supabase.co/storage/v1/object/public/bucket/path
            parts = url.split("/storage/v1/object/public/")
            if len(parts) != 2:
                return False

            bucket_and_path = parts[1]
            bucket = bucket_and_path.split("/")[0]
            file_path = "/".join(bucket_and_path.split("/")[1:])

            return self.delete_file(bucket, file_path)
        except Exception:
            return False


# Singleton instance
storage_service = StorageService()
