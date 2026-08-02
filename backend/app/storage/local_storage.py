import os
from .base import StorageBackend
from ..config.settings import settings


class LocalStorage(StorageBackend):
    """Local disk storage — used for development when storage_backend=local."""

    def __init__(self):
        self._base_dir = settings.audio_dir

    def _full_path(self, path: str) -> str:
        return os.path.join(self._base_dir, path)

    async def save(self, path: str, data: bytes) -> str:
        full_path = self._full_path(path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as f:
            f.write(data)
        return path

    async def read(self, path: str) -> bytes:
        full_path = self._full_path(path)
        if not os.path.exists(full_path):
            raise FileNotFoundError(path)
        with open(full_path, "rb") as f:
            return f.read()

    async def delete(self, path: str) -> None:
        full_path = self._full_path(path)
        if os.path.exists(full_path):
            os.remove(full_path)

    def get_url(self, path: str) -> str:
        return f"/audio/{path}"