import asyncio
from functools import partial
import boto3
from botocore.exceptions import ClientError
from .base import StorageBackend
from ..config.settings import settings


class CloudStorage(StorageBackend):
    """Cloudflare R2 storage via S3-compatible API."""

    def __init__(self):
        self._bucket = settings.r2_bucket_name
        self._public_url = settings.r2_public_url.rstrip('/')
        self._client = boto3.client(
            's3',
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name='auto',
        )

    def _run(self, fn, *args, **kwargs):
        loop = asyncio.get_running_loop()
        return loop.run_in_executor(None, partial(fn, *args, **kwargs))

    async def save(self, path: str, data: bytes) -> str:
        await self._run(self._client.put_object, Bucket=self._bucket, Key=path, Body=data)
        return path

    async def read(self, path: str) -> bytes:
        try:
            resp = await self._run(self._client.get_object, Bucket=self._bucket, Key=path)
            return resp['Body'].read()
        except ClientError as e:
            if e.response['Error']['Code'] in ('NoSuchKey', '404'):
                raise FileNotFoundError(path)
            raise

    async def delete(self, path: str) -> None:
        await self._run(self._client.delete_object, Bucket=self._bucket, Key=path)

    def get_url(self, path: str) -> str:
        return f"{self._public_url}/{path}"