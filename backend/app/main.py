import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.config.logging_config import get_logger, setup_logging
from app.database import init_db, close_db
from app.api import devices_router, assignments_router, auth_router, recordings_router, data_router
from app.websocket import ws_router
from app.services.offline_detector import offline_detection_loop

setup_logging()
logger = get_logger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Device Management API v%s", settings.app_version)
    await init_db()
    task = asyncio.create_task(offline_detection_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    await close_db()
    logger.info("Device Management API shut down.")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(devices_router)
app.include_router(assignments_router)
app.include_router(auth_router)
app.include_router(recordings_router)
app.include_router(data_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}
