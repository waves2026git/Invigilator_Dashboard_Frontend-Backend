import logging
import logging.handlers
import os
from app.config import settings


def setup_logging() -> None:
    os.makedirs(settings.log_dir, exist_ok=True)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(settings.log_level)

    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # Rotating file handler — one file per concern
    for logger_name, filename in [
        ("app.api", "api.log"),
        ("app.websocket", "websocket.log"),
        ("app.services", "services.log"),
    ]:
        fh = logging.handlers.RotatingFileHandler(
            os.path.join(settings.log_dir, filename),
            maxBytes=5 * 1024 * 1024,
            backupCount=3,
            encoding="utf-8",
        )
        fh.setFormatter(fmt)
        logging.getLogger(logger_name).addHandler(fh)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
