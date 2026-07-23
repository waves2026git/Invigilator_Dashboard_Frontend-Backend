"""
MongoDB connection using Motor (async driver).
Shares the same database as main backend.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None

DB_NAME = "exam_system"  # ponytail: hardcoded, add to settings if multi-tenant needed


async def init_db() -> None:
    """Initialize MongoDB connection on startup."""
    global _client, _db
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _db = _client[DB_NAME]
    # Create indexes
    await _db.devices.create_index("device_uuid", unique=True)
    await _db.devices.create_index("device_number", unique=True, sparse=True)
    await _db.assignments.create_index("device_uuid")
    await _db.assignments.create_index([("device_uuid", 1), ("status", 1)])


def get_db() -> AsyncIOMotorDatabase:
    """Return the database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db


async def close_db() -> None:
    """Close MongoDB connection on shutdown."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
