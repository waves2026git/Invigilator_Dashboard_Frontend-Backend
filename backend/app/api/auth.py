"""
Invigilator authentication routes.
Uses shared users collection with role="invigilator".
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from app.config.logging_config import get_logger
from app.database import get_db
from app.auth import verify_password, create_token, get_current_invigilator

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger("app.api.auth")


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    name: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    """Invigilator login — uses shared users collection."""
    db = get_db()
    
    # Find user with role=invigilator
    user = await db.users.find_one({
        "email": body.email,
        "role": "invigilator"
    })
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    if not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    token = create_token(str(user["_id"]), role="invigilator")
    logger.info("Invigilator login: %s", body.email)
    
    return LoginResponse(
        token=token,
        user_id=str(user["_id"]),
        name=user.get("name", "Invigilator"),
        role="invigilator"
    )


@router.get("/me")
async def get_current_user(user_id: str = Depends(get_current_invigilator)):
    """Get current user info — requires auth header."""
    db = get_db()
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
    }
