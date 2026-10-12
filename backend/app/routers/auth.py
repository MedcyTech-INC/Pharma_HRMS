from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, TokenResponse
from app.utils.security import verify_password, create_access_token, create_refresh_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    # 1. Find user by email
    stmt = select(Employee).where(Employee.email == request.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # 2. Verify Password (handles both raw Supabase passwords for now, and bcrypt)
    # WARNING: This assumes a migration to bcrypt has not yet happened for this user
    # If the password starts with $2b$, it's bcrypt. Otherwise, it's plain text (legacy).
    is_valid = False
    if user.password.startswith("$2b$"):
        is_valid = verify_password(request.password, user.password)
    else:
        # Legacy plain text comparison (will be removed after Alembic migration)
        is_valid = (request.password == user.password)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # 3. Generate Tokens
    token_payload = {"sub": str(user.id), "role": user.role}
    access_token = create_access_token(data=token_payload)
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(user.id),
        role=user.role
    )
