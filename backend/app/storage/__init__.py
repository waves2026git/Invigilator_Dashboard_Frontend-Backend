from ..config.settings import settings
from .base import StorageBackend
from .local_storage import LocalStorage
from .cloud_storage import CloudStorage

_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        backend = settings.storage_backend
        if backend == "local":
            _storage = LocalStorage()
        elif backend == "cloud":
            _storage = CloudStorage()
        else:
            raise ValueError(f"Unknown storage backend: {backend}")
    return _storage