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
    AvatarUploadRequest,
    AvatarUploadResponse,
    IDUploadRequest,
    IDUploadResponse,
    IDVerificationRequest,
    IDVerificationResponse,
    LoginRequest,
    NameVerificationRequest,
    NameVerificationResponse,
    OTPResponse,
    ProfileUpdateRequest,
    PublicUserResponse,
    RefreshTokenRequest,
    ResendOTPRequest,
    SignupRequest,
    SignupResponse,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
    VerifyOTPRequest,
)
from app.services.email_validation import email_validation_service
from app.services.gemini import gemini_service
from app.services.jwt import jwt_service
from app.services.s3 import s3_service
from app.services.supabase import supabase_auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=SignupResponse)
async def signup(
    request: SignupRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Register a new user with York University email.

    1. Validates email is @yorku.ca or @my.yorku.ca
    2. Checks if email already exists and is verified
    3. Sends OTP verification email via Supabase (or locally if dev_mode)
    """
    # Check if user already exists and is verified
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()

    if existing_user and existing_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please login instead.",
        )

    # Send OTP via Supabase (or locally if dev_mode)
    success, message = await supabase_auth_service.send_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    return SignupResponse(
        message=message,  # In dev mode, this includes the OTP
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
    Request login OTP code.

    Sends a 6-digit OTP code to the user's email for passwordless login.
    If dev_mode=True, generates a local OTP instead of sending email.
    """
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    # For login, we check if user exists in our DB
    # But we still send OTP for both new and existing users
    # The verify-otp endpoint will handle user creation/login

    if user and user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is banned",
        )

    # Send OTP via Supabase (or locally if dev_mode)
    success, message = await supabase_auth_service.send_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    return SignupResponse(
        message=message,  # In dev mode, this includes the OTP
        email=request.email,
    )


@router.post("/verify-otp", response_model=VerifyEmailResponse)
async def verify_otp(
    request: VerifyOTPRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Verify email using 6-digit OTP code.

    Creates user if new, returns JWT tokens on successful verification.
    If dev_mode=True, verifies against local OTP storage.
    """
    # Verify OTP with Supabase (or locally if dev_mode)
    success, message, session_data = await supabase_auth_service.verify_otp(
        request.email, request.code, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )

    # Find or create user in our database
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user:
        # Create new user
        suggested_name = email_validation_service.suggest_name_from_email(request.email)
        user = User(
            id=uuid.uuid4(),
            email=request.email,
            name=suggested_name or "New User",
            email_verified=True,  # Email is now verified via OTP
            name_verified=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Mark email as verified if not already
        if not user.email_verified:
            user.email_verified = True
            await db.commit()

    # Generate our own JWT tokens (for API auth)
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return VerifyEmailResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        requires_name_verification=not user.name_verified,
    )


@router.post("/resend-otp", response_model=OTPResponse)
async def resend_otp(
    request: ResendOTPRequest,
):
    """
    Resend OTP verification code.

    Rate limited to prevent abuse - client should enforce 60s cooldown.
    If dev_mode=True, generates a local OTP instead of sending email.
    """
    success, message = await supabase_auth_service.resend_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS
            if "rate" in message.lower() or "limit" in message.lower()
            else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        )

    return OTPResponse(
        success=True,
        message=message,  # In dev mode, this includes the OTP
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
    if request.avatar_url is not None:
        user.avatar_url = request.avatar_url
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


@router.post("/avatar-upload", response_model=AvatarUploadResponse)
async def get_avatar_upload_url(
    request: AvatarUploadRequest,
    user: CurrentUser,
):
    """Get a presigned URL for uploading an avatar image."""
    try:
        upload_url, file_key = s3_service.generate_upload_url(
            folder="avatars",
            filename=request.filename,
            content_type=request.content_type,
            expires_in=300,  # 5 minutes
        )

        # Construct the public file URL
        file_url = f"https://{s3_service.bucket_name}.s3.{s3_service.region}.amazonaws.com/{file_key}"

        return AvatarUploadResponse(
            upload_url=upload_url,
            file_url=file_url,
            expires_in=300,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e),
        )


@router.get("/users/{user_id}", response_model=PublicUserResponse)
async def get_public_profile(
    user_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get a user's public profile."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return PublicUserResponse(
        id=str(user.id),
        name=user.name,
        name_verified=user.name_verified,
        program=user.program,
        bio=user.bio,
        avatar_url=user.avatar_url,
        interests=user.interests,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )
