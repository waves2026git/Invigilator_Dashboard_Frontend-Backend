"""
JWT authentication for device-management backend.
Uses same JWT secret as main backend for shared auth.
Invigilators use role="invigilator" in users collection.
"""

from datetime import timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings
from app.utils.timezone import now_ist

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(subject: str, role: str = "invigilator") -> str:
    payload = {
        "sub": subject,
        "role": role,
        "exp": now_ist() + timedelta(hours=24),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_invigilator(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    """Verify JWT and return user_id if role is invigilator."""
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "invigilator":
        raise HTTPException(status_code=403, detail="Invigilator access required")
    return payload["sub"]
