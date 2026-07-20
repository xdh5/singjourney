import uuid
from datetime import datetime, timezone

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import Settings
from app.modules.media.formats import safe_audio_suffix
from app.storage.base import ObjectMetadata

R2_PROVIDER = "cloudflare_r2"
R2_REGION = "auto"
NOT_FOUND_ERROR_CODES = frozenset({"404", "NoSuchKey", "NotFound"})


class R2ConfigurationError(RuntimeError):
    pass


class R2Storage:
    """Cloudflare R2 adapter using its S3-compatible API.

    Credentials remain on the API server. Clients receive operation-specific,
    short-lived URLs and therefore never receive reusable R2 credentials.
    """

    provider = R2_PROVIDER

    def __init__(self, settings: Settings):
        required = {
            "r2_account_id": settings.r2_account_id,
            "r2_access_key_id": settings.r2_access_key_id,
            "r2_secret_access_key": settings.r2_secret_access_key,
            "r2_bucket_name": settings.r2_bucket_name,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise R2ConfigurationError(f"Missing R2 settings: {', '.join(missing)}")
        self.bucket_name = settings.r2_bucket_name
        self.upload_url_ttl_seconds = settings.share_upload_url_ttl_seconds
        self.download_url_ttl_seconds = settings.share_download_url_ttl_seconds
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name=R2_REGION,
            config=Config(signature_version="s3v4"),
        )

    def create_key(self, filename: str | None, content_type: str) -> str:
        now = datetime.now(timezone.utc)
        suffix = safe_audio_suffix(filename, content_type)
        return f"shares/{now:%Y/%m}/{uuid.uuid4().hex}{suffix}"

    def create_upload_url(self, storage_key: str, content_type: str) -> str:
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket_name, "Key": storage_key, "ContentType": content_type},
            ExpiresIn=self.upload_url_ttl_seconds,
        )

    def create_download_url(self, storage_key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": storage_key},
            ExpiresIn=self.download_url_ttl_seconds,
        )

    def stat(self, storage_key: str) -> ObjectMetadata | None:
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=storage_key)
        except ClientError as error:
            code = str(error.response.get("Error", {}).get("Code", ""))
            if code in NOT_FOUND_ERROR_CODES:
                return None
            raise
        return ObjectMetadata(
            byte_size=int(response["ContentLength"]),
            content_type=response.get("ContentType"),
        )

    def delete(self, storage_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket_name, Key=storage_key)
