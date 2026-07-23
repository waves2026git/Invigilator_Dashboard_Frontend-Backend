from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Device Management API"
    app_version: str = "1.0.0"
    debug: bool = False

    mongodb_uri: str = "mongodb://localhost:27017/exam_system"

    # Seconds without heartbeat before a device is marked offline
    offline_threshold_seconds: int = 90

    # How often the background task checks for stale devices (seconds)
    offline_check_interval_seconds: int = 30

    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    log_level: str = "INFO"
    log_dir: str = "logs"

    # JWT (shared with main backend)
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()