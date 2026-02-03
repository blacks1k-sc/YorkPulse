"""Authentication API routes."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.models.user import User
from app.schemas.auth import (
    IDUploadRequest,
    IDUploadResponse,
    IDVerificationRequest,
    IDVerificationResponse,
    LoginRequest,
    NameVerificationRequest,
    NameVerificationResponse,
    ProfileUpdateRequest,
    RefreshTokenRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.services.email_validation import email_validation_service
from app.services.gemini import gemini_service
from app.services.jwt import jwt_service
from app.services.s3 import s3_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=SignupResponse)
async def signup(
    request: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Register a new user with York University email.

    1. Validates email is @yorku.ca or @my.yorku.ca
    2. Checks if email already exists
    3. Creates user with unverified status
    4. Sends verification email (magic link)
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()

    if existing_user:
        if existing_user.email_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        # User exists but not verified - resend verification
        token = jwt_service.create_email_verification_token(request.email)
        # TODO: Send email with token
        return SignupResponse(
            message=f"Verification email resent. Check your inbox. (Dev token: {token})",
            email=request.email,
        )

    # Suggest a name from email
    suggested_name = email_validation_service.suggest_name_from_email(request.email)

    # Create new user
    user = User(
        id=uuid.uuid4(),
        email=request.email,
        name=suggested_name or "New User",  # Temporary name
        email_verified=False,
        name_verified=False,
    )
    db.add(user)
    await db.commit()

    # Create verification token
    token = jwt_service.create_email_verification_token(request.email)

    # TODO: Send email with verification link
    # For now, return token in response (development only)

    return SignupResponse(
        message=f"Verification email sent. Check your inbox. (Dev token: {token})",
        email=request.email,
    )


@router.post("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    request: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify email using magic link token.

    Returns JWT tokens on successful verification.
    """
    email = jwt_service.verify_email_token(request.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    # Find user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Mark email as verified
    user.email_verified = True
    await db.commit()

    # Generate tokens
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return VerifyEmailResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        requires_name_verification=not user.name_verified,
    )


@router.post("/login", response_model=SignupResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Request login magic link.

    Sends a magic link to the user's email for passwordless login.
    """
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email. Please sign up first.",
        )

    if not user.email_verified:
        # Resend verification email
        token = jwt_service.create_email_verification_token(request.email)
        return SignupResponse(
            message=f"Email not verified. Verification email resent. (Dev token: {token})",
            email=request.email,
        )

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is banned",
        )

    # Create login token (same as email verification)
    token = jwt_service.create_email_verification_token(request.email)

    # TODO: Send login email

    return SignupResponse(
        message=f"Login link sent to your email. (Dev token: {token})",
        email=request.email,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Refresh access token using refresh token.
    """
    payload = jwt_service.verify_refresh_token(request.refresh_token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = payload.get("sub")
    email = payload.get("email")

    # Verify user still exists and is active
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active or user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is no longer valid",
        )

    # Generate new tokens
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
    )


@router.post("/verify-name", response_model=NameVerificationResponse)
async def verify_name(
    request: NameVerificationRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify user's name against email pattern.

    If first name appears in email, auto-verify.
    Otherwise, require ID upload.
    """
    if user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name already verified and cannot be changed",
        )

    # Check if name matches email pattern
    matches, reason = email_validation_service.name_matches_email(
        request.name, user.email
    )

    if matches:
        # Auto-verify
        user.name = request.name
        user.name_verified = True
        await db.commit()

        return NameVerificationResponse(
            name_verified=True,
            requires_id_upload=False,
            message=reason,
        )

    return NameVerificationResponse(
        name_verified=False,
        requires_id_upload=True,
        message=reason,
    )


@router.post("/upload-id", response_model=IDUploadResponse)
async def get_id_upload_url(
    request: IDUploadRequest,
    user: CurrentUser,
):
    """
    Get presigned URL to upload student ID photo.

    Returns a URL that the client can PUT the image to directly.
    """
    if user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name already verified",
        )

    try:
        upload_url, file_key = s3_service.generate_upload_url(
            folder="student-ids",
            filename=request.filename,
            content_type=request.content_type,
            expires_in=300,  # 5 minutes
        )

        return IDUploadResponse(
            upload_url=upload_url,
            file_key=file_key,
            expires_in=300,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/verify-id", response_model=IDVerificationResponse)
async def verify_student_id(
    request: IDVerificationRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify uploaded student ID using Gemini Vision.

    Extracts name from ID and sets it as the user's verified name.
    """
    if user.name_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name already verified",
        )

    # Get download URL for the uploaded image
    try:
        image_url = s3_service.generate_download_url(request.file_key)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to access uploaded file",
        )

    # Extract name using Gemini
    success, extracted_name, message = await gemini_service.extract_name_from_id(
        image_url
    )

    if not success or not extracted_name:
        return IDVerificationResponse(
            success=False,
            extracted_name=None,
            message=message,
        )

    # Set verified name
    user.name = extracted_name
    user.name_verified = True
    await db.commit()

    # Delete the ID image for privacy (optional - could also rely on S3 lifecycle)
    s3_service.delete_file(request.file_key)

    return IDVerificationResponse(
        success=True,
        extracted_name=extracted_name,
        message="Name verified successfully",
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(user: CurrentUser):
    """Get current user's profile."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        name_verified=user.name_verified,
        email_verified=user.email_verified,
        program=user.program,
        bio=user.bio,
        avatar_url=user.avatar_url,
        campus_days=user.campus_days,
        interests=user.interests,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update current user's profile."""
    if request.program is not None:
        user.program = request.program
    if request.bio is not None:
        user.bio = request.bio
    if request.campus_days is not None:
        user.campus_days = request.campus_days
    if request.interests is not None:
        user.interests = request.interests

    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        name_verified=user.name_verified,
        email_verified=user.email_verified,
        program=user.program,
        bio=user.bio,
        avatar_url=user.avatar_url,
        campus_days=user.campus_days,
        interests=user.interests,
    )
