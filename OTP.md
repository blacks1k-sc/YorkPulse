# YorkPulse OTP Authentication Architecture

This document provides a complete walkthrough of the OTP (One-Time Password) authentication system used in YorkPulse, from the moment a user enters their email to successful authentication.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Flow Diagram](#flow-diagram)
4. [Frontend Components](#frontend-components)
5. [Backend Services](#backend-services)
6. [Email Delivery (Resend)](#email-delivery-resend)
7. [Step-by-Step Flow](#step-by-step-flow)
8. [Dev Mode](#dev-mode)
9. [Security Considerations](#security-considerations)
10. [Environment Configuration](#environment-configuration)

---

## Overview

YorkPulse uses **passwordless authentication** via email OTP. Users sign in by:
1. Entering their York University email (@yorku.ca or @my.yorku.ca)
2. Receiving a 6-digit verification code via email
3. Entering the code to authenticate

This approach eliminates password management while ensuring only York University students can access the platform.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐                │
│  │ Login Page  │───▶│  useAuth.ts  │───▶│   api.ts        │                │
│  │ (React)     │    │  (Hooks)     │    │   (API Client)  │                │
│  └─────────────┘    └──────────────┘    └────────┬────────┘                │
└──────────────────────────────────────────────────┼──────────────────────────┘
                                                   │ HTTP POST
                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (FastAPI)                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  auth.py        │───▶│  supabase.py    │───▶│  email.py       │         │
│  │  (Routes)       │    │  (OTP Service)  │    │  (Resend)       │         │
│  └─────────────────┘    └────────┬────────┘    └────────┬────────┘         │
│                                  │                      │                   │
│                         ┌────────▼────────┐             │                   │
│                         │  In-Memory OTP  │             │                   │
│                         │  Storage        │             │                   │
│                         │  (_otps dict)   │             │                   │
│                         └─────────────────┘             │                   │
└─────────────────────────────────────────────────────────┼───────────────────┘
                                                          │ API Call
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESEND (Email Service)                             │
│                                                                              │
│  Sends HTML email with OTP code to user's York email address                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Flow Diagram

```
User                    Frontend                  Backend                   Resend
 │                         │                         │                         │
 │  1. Enter email         │                         │                         │
 │────────────────────────▶│                         │                         │
 │                         │  2. POST /auth/login    │                         │
 │                         │────────────────────────▶│                         │
 │                         │                         │  3. Generate OTP        │
 │                         │                         │  4. Store OTP           │
 │                         │                         │  5. Send email          │
 │                         │                         │────────────────────────▶│
 │                         │                         │                         │
 │                         │  6. Return success      │◀────────────────────────│
 │                         │◀────────────────────────│                         │
 │  7. Show OTP input      │                         │                         │
 │◀────────────────────────│                         │                         │
 │                         │                         │                         │
 │  8. Receive email       │                         │                         │
 │◀────────────────────────────────────────────────────────────────────────────│
 │                         │                         │                         │
 │  9. Enter OTP code      │                         │                         │
 │────────────────────────▶│                         │                         │
 │                         │ 10. POST /auth/verify   │                         │
 │                         │────────────────────────▶│                         │
 │                         │                         │ 11. Verify OTP          │
 │                         │                         │ 12. Create/Find User    │
 │                         │                         │ 13. Generate JWT        │
 │                         │ 14. Return tokens       │                         │
 │                         │◀────────────────────────│                         │
 │ 15. Store tokens        │                         │                         │
 │ 16. Redirect to home    │                         │                         │
 │◀────────────────────────│                         │                         │
```

---

## Frontend Components

### 1. Login Page (`/frontend/src/app/auth/login/page.tsx`)

The login page manages two states: `email` and `otp` input.

**Key State Variables:**
```typescript
const [step, setStep] = useState<Step>("email");  // "email" | "otp"
const [email, setEmail] = useState("");
const [otp, setOtp] = useState("");
const [devMode, setDevMode] = useState(false);     // Toggle for dev testing
const [cooldown, setCooldown] = useState(0);       // 60s resend cooldown
```

**Email Validation:**
```typescript
const validateEmail = useCallback((value: string): boolean => {
  const emailLower = value.toLowerCase();
  if (!emailLower.endsWith("@yorku.ca") && !emailLower.endsWith("@my.yorku.ca")) {
    setEmailError("Please use your @yorku.ca or @my.yorku.ca email");
    return false;
  }
  setEmailError("");
  return true;
}, []);
```

**Email Submission Handler:**
```typescript
const handleEmailSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateEmail(email)) return;

  try {
    const response = await loginMutation.mutateAsync({ email, devMode });
    setStep("otp");           // Move to OTP input screen
    setCooldown(60);          // Start 60 second cooldown for resend

    // In dev mode, OTP is returned in the response message
    const devOtpMatch = response.message.match(/\[DEV MODE\] Your verification code is: (\d{6})/);
    if (devOtpMatch) {
      toast({ title: "Dev Mode", description: `Your OTP code is: ${devOtpMatch[1]}` });
    } else {
      toast({ title: "Code sent", description: "Check your email for the verification code." });
    }
  } catch (error) {
    toast({ title: "Error", description: error.message, variant: "destructive" });
  }
};
```

**Auto-Submit on OTP Complete:**
```typescript
useEffect(() => {
  if (otp.length === 6 && step === "otp") {
    handleOTPSubmit();  // Automatically verify when 6 digits entered
  }
}, [otp]);
```

### 2. Auth Hooks (`/frontend/src/hooks/useAuth.ts`)

React Query mutations for authentication API calls:

```typescript
// Login mutation - sends email to request OTP
export function useLogin() {
  return useMutation({
    mutationFn: ({ email, devMode = false }: { email: string; devMode?: boolean }) =>
      api.auth.login(email, devMode),
  });
}

// Verify OTP mutation - verifies code and returns JWT tokens
export function useVerifyOTP() {
  const { setTokens } = useAuthStore();

  return useMutation({
    mutationFn: ({ email, code, devMode = false }) =>
      api.auth.verifyOTP(email, code, devMode),
    onSuccess: (data) => {
      setTokens(data.access_token, data.refresh_token);  // Store JWT tokens
    },
  });
}

// Resend OTP mutation
export function useResendOTP() {
  return useMutation({
    mutationFn: ({ email, devMode = false }) =>
      api.auth.resendOTP(email, devMode),
  });
}
```

### 3. API Client (`/frontend/src/services/api.ts`)

HTTP client that communicates with the backend:

```typescript
auth = {
  login: (email: string, devMode = false) =>
    this.post<SignupResponse>("/auth/login", { email, dev_mode: devMode }),

  verifyOTP: (email: string, code: string, devMode = false) =>
    this.post<VerifyEmailResponse>("/auth/verify-otp", { email, code, dev_mode: devMode }),

  resendOTP: (email: string, devMode = false) =>
    this.post<{ success: boolean; message: string }>("/auth/resend-otp", { email, dev_mode: devMode }),
};
```

---

## Backend Services

### 1. Auth Routes (`/backend/app/api/routes/auth.py`)

FastAPI endpoints that handle authentication requests:

**Login Endpoint:**
```python
@router.post("/login", response_model=SignupResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Request login OTP code."""
    # Check if user is banned
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if user and user.is_banned:
        raise HTTPException(status_code=403, detail="Account is banned")

    # Send OTP via Supabase service (or locally if dev_mode)
    success, message = await supabase_auth_service.send_otp(
        request.email, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(status_code=500, detail=message)

    return SignupResponse(message=message, email=request.email)
```

**Verify OTP Endpoint:**
```python
@router.post("/verify-otp", response_model=VerifyEmailResponse)
async def verify_otp(
    request: VerifyOTPRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Verify email using 6-digit OTP code."""
    # Verify OTP
    success, message, session_data = await supabase_auth_service.verify_otp(
        request.email, request.code, force_dev_mode=request.dev_mode
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Find or create user in database
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user:
        # Create new user
        user = User(
            id=uuid.uuid4(),
            email=request.email,
            name=email_validation_service.suggest_name_from_email(request.email) or "New User",
            email_verified=True,
            name_verified=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Mark email as verified
        if not user.email_verified:
            user.email_verified = True
            await db.commit()

    # Generate JWT tokens for API authentication
    access_token, refresh_token, expires_in = jwt_service.create_token_pair(
        str(user.id), user.email
    )

    return VerifyEmailResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        requires_name_verification=not user.name_verified,
    )
```

### 2. Supabase Auth Service (`/backend/app/services/supabase.py`)

Core OTP logic with in-memory storage:

**OTP Storage:**
```python
# In-memory OTP storage: email -> (otp_code, expiry_datetime)
_otps: dict[str, tuple[str, datetime]] = {}
```

**Generate OTP:**
```python
def _generate_otp(self, email: str) -> str:
    """Generate a 6-digit OTP and store it."""
    otp = ''.join(random.choices(string.digits, k=6))  # e.g., "847291"
    _otps[email.lower()] = (otp, datetime.utcnow() + timedelta(minutes=10))
    return otp
```

**Verify OTP:**
```python
def _verify_stored_otp(self, email: str, code: str) -> bool:
    """Verify OTP against stored value."""
    email_lower = email.lower()
    if email_lower not in _otps:
        return False

    stored_otp, expiry = _otps[email_lower]

    if datetime.utcnow() > expiry:
        del _otps[email_lower]  # Clean up expired OTP
        return False

    if stored_otp == code:
        del _otps[email_lower]  # OTP is single-use
        return True

    return False
```

**Send OTP (Main Logic):**
```python
async def send_otp(self, email: str, force_dev_mode: bool = False) -> tuple[bool, str]:
    """
    Send OTP code to email.

    Priority:
    1. Dev mode: Returns OTP directly (no email)
    2. Resend configured: Sends OTP via Resend email
    3. Fallback: Uses Supabase magic link
    """
    # Development mode - return OTP directly for testing
    if settings.debug or force_dev_mode:
        otp = self._generate_otp(email)
        return True, f"[DEV MODE] Your verification code is: {otp}"

    # Production mode with Resend - send actual email
    if email_service.is_configured():
        otp = self._generate_otp(email)
        success, message = await email_service.send_otp_email(email, otp)
        return success, message

    # Fallback to Supabase (sends magic link, not recommended)
    try:
        self.client.auth.sign_in_with_otp({"email": email, "options": {"should_create_user": True}})
        return True, "Verification code sent to your email"
    except AuthApiError as e:
        return False, str(e.message)
```

### 3. Email Service (`/backend/app/services/email.py`)

Resend integration for sending OTP emails:

```python
import resend
from app.core.config import settings

class EmailService:
    """Service for sending emails via Resend."""

    def __init__(self):
        if settings.resend_api_key:
            resend.api_key = settings.resend_api_key

    def is_configured(self) -> bool:
        """Check if Resend is properly configured."""
        return bool(settings.resend_api_key)

    async def send_otp_email(self, to_email: str, otp_code: str) -> tuple[bool, str]:
        """Send OTP code via email using Resend."""
        if not self.is_configured():
            return False, "Email service not configured"

        try:
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
                <h2>Your YorkPulse verification code</h2>
                <p>Enter this code to verify your email:</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center;">
                    <h1 style="font-size: 36px; letter-spacing: 8px; font-family: monospace;">
                        {otp_code}
                    </h1>
                </div>
                <p>This code expires in 10 minutes.</p>
            </div>
            """

            params = {
                "from": "YorkPulse <onboarding@resend.dev>",
                "to": [to_email],
                "subject": "Your YorkPulse Verification Code",
                "html": html_content,
            }

            email = resend.Emails.send(params)

            if email and email.get("id"):
                return True, "Verification code sent to your email"
            else:
                return False, "Failed to send email"

        except Exception as e:
            return False, f"Failed to send email: {str(e)}"

# Singleton instance
email_service = EmailService()
```

---

## Email Delivery (Resend)

[Resend](https://resend.com) is used for email delivery because:
- Simple API with Python SDK
- Free tier: 3,000 emails/month
- High deliverability
- No domain verification needed for testing (uses `onboarding@resend.dev`)

**Email Template:**

The HTML email template shows:
1. YorkPulse branding
2. Large, monospaced OTP code for easy reading
3. Expiry notice (10 minutes)
4. Security notice for unrecognized requests

---

## Step-by-Step Flow

### Phase 1: Request OTP

1. **User enters email** on login page
2. **Frontend validates** email ends with @yorku.ca or @my.yorku.ca
3. **Frontend calls** `POST /api/v1/auth/login` with `{ email, dev_mode }`
4. **Backend checks** if user is banned
5. **Backend generates** 6-digit OTP: `random.choices(string.digits, k=6)`
6. **Backend stores** OTP with 10-minute expiry in memory dict
7. **Backend sends email** via Resend API
8. **Backend returns** `{ message: "Verification code sent", email }`
9. **Frontend transitions** to OTP input screen
10. **Frontend starts** 60-second cooldown for resend button

### Phase 2: Verify OTP

1. **User receives email** with 6-digit code
2. **User enters code** in OTP input (6 digits)
3. **Frontend auto-submits** when 6 digits entered
4. **Frontend calls** `POST /api/v1/auth/verify-otp` with `{ email, code, dev_mode }`
5. **Backend retrieves** stored OTP for email
6. **Backend checks** if OTP is expired (> 10 minutes)
7. **Backend compares** submitted code with stored OTP
8. **Backend deletes** OTP from storage (single-use)
9. **Backend finds/creates** user in PostgreSQL database
10. **Backend generates** JWT access and refresh tokens
11. **Backend returns** `{ access_token, refresh_token, expires_in, requires_name_verification }`
12. **Frontend stores** tokens in Zustand auth store
13. **Frontend redirects** to home page (or profile setup if new user)

---

## Dev Mode

Dev mode is a testing feature that bypasses email sending:

**How it works:**
1. Toggle "Dev Mode" switch on login page
2. Request includes `dev_mode: true`
3. Backend generates OTP but returns it directly in response message
4. Frontend displays OTP in a toast notification
5. User can immediately enter the code without checking email

**Code flow:**
```python
if settings.debug or force_dev_mode:
    otp = self._generate_otp(email)
    return True, f"[DEV MODE] Your verification code is: {otp}"
```

**Frontend extraction:**
```typescript
const devOtpMatch = response.message.match(/\[DEV MODE\] Your verification code is: (\d{6})/);
if (devOtpMatch) {
  toast({ title: "Dev Mode", description: `Your OTP code is: ${devOtpMatch[1]}` });
}
```

---

## Security Considerations

### OTP Security
- **6-digit numeric** codes provide 1,000,000 possible combinations
- **10-minute expiry** limits brute force window
- **Single-use** - OTP is deleted after successful verification
- **Rate limiting** - 60-second cooldown on resend (client-enforced)

### Email Validation
- **Domain restriction** - Only @yorku.ca and @my.yorku.ca accepted
- **Prevents** non-students from accessing the platform

### Token Security
- **JWT tokens** used for API authentication
- **Access token** - Short-lived (2 hours)
- **Refresh token** - Long-lived (7 days)
- **Stored client-side** in Zustand store (memory)

### In-Memory OTP Storage
- **Note:** Current implementation uses in-memory dict
- **Limitation:** OTPs lost on server restart
- **Improvement:** Consider Redis for production (persistence + TTL)

---

## Environment Configuration

Required environment variables in `/backend/.env`:

```bash
# App
DEBUG=false                    # Set true to enable dev mode globally

# Resend (Email)
RESEND_API_KEY=re_xxxxx       # Get from resend.com/api-keys

# Supabase (Database + Fallback Auth)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db

# JWT
JWT_SECRET_KEY=your-secret-key
```

---

## Request/Response Examples

### Login Request
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "johndoe@my.yorku.ca",
  "dev_mode": false
}
```

### Login Response
```json
{
  "message": "Verification code sent to your email",
  "email": "johndoe@my.yorku.ca"
}
```

### Verify OTP Request
```http
POST /api/v1/auth/verify-otp
Content-Type: application/json

{
  "email": "johndoe@my.yorku.ca",
  "code": "847291",
  "dev_mode": false
}
```

### Verify OTP Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 7200,
  "requires_name_verification": true
}
```

---

## File References

| Component | File Path |
|-----------|-----------|
| Login Page | `/frontend/src/app/auth/login/page.tsx` |
| Auth Hooks | `/frontend/src/hooks/useAuth.ts` |
| API Client | `/frontend/src/services/api.ts` |
| Auth Routes | `/backend/app/api/routes/auth.py` |
| OTP Service | `/backend/app/services/supabase.py` |
| Email Service | `/backend/app/services/email.py` |
| Config | `/backend/app/core/config.py` |
| Schemas | `/backend/app/schemas/auth.py` |

---

## Summary

The YorkPulse OTP system provides secure, passwordless authentication:

1. **Frontend** validates York email and manages UI state
2. **Backend** generates, stores, and verifies OTPs
3. **Resend** delivers styled HTML emails with verification codes
4. **JWT tokens** authenticate subsequent API requests
5. **Dev mode** enables testing without email delivery

This architecture balances security (OTP expiry, single-use, domain restriction) with user experience (auto-submit, clear UI feedback, resend functionality).
