from .devices import router as devices_router
from .assignments import router as assignments_router
from .auth import router as auth_router
from .recordings import router as recordings_router
from .data import router as data_router

__all__ = ["devices_router", "assignments_router", "auth_router", "recordings_router", "data_router"]
