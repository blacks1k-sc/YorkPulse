# YorkPulse Architecture Documentation

## 1. Project Overview

**YorkPulse** is a comprehensive student engagement platform designed exclusively for York University students. It provides a trusted environment for social interaction, commerce, and community building, verified through York University email addresses.

### Core Features

1.  **The Vault (Anonymous Forum)**
    *   A safe space for students to discuss mental health, academics, and campus life anonymously.
    *   Features PII (Personal Identifiable Information) masking and AI-driven moderation.

2.  **Marketplace**
    *   A dedicated platform for buying and selling student essentials (textbooks, electronics, housing).
    *   Includes image hosting and safety meet-up preferences.

3.  **Side Quests (Buddy System)**
    *   An activity-based matching system to find study partners, gym buddies, or food companions.
    *   Supports "Vibe Levels" (Chill to Intense) and time/location coordination.

4.  **Messaging (Direct Messages)**
    *   A request-based messaging system ensuring privacy and reducing spam.
    *   Users must accept a chat request before specific communication can begin.

*(Supporting feature: **Reviews** system for rating interactions in Marketplace and Side Quests)*

---

## 2. Tech Stack Summary

### Frontend
*   **Framework**: Next.js 15 (App Router)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS, shadcn/ui
*   **State Management**: Zustand
*   **Data Fetching**: TanStack Query
*   **Animations**: Framer Motion
*   **Maps**: Leaflet (react-leaflet)

### Backend
*   **Framework**: FastAPI
*   **Language**: Python 3.10+
*   **ORM**: SQLAlchemy 2.0 (Async)
*   **Validation**: Pydantic
*   **Migrations**: Alembic

### Infrastructure & Services
*   **Database**: PostgreSQL (Supabase)
*   **Caching/Queue**: Redis (Upstash)
*   **Storage**: AWS S3 (Student IDs, listing images)
*   **AI**: Google Gemini 2.0 Flash (moderation, PII detection, ID verification)
*   **Deployment**: AWS Amplify (Frontend), AWS ECS Fargate (Backend)

---

## 3. Project Structure

### Backend (`/backend/app`)
*   **`api/`**: API route definitions grouped by functionality.
    *   `routes/`: Individual feature router modules (`auth.py`, `vault.py`, etc.).
*   **`core/`**: Core configuration, security settings, and database connections.
*   **`models/`**: SQLAlchemy ORM database models.
*   **`schemas/`**: Pydantic models for request/response validation.
*   **`services/`**: Business logic and external service integrations (S3, Gemini, JWT).

### Frontend (`/frontend/src`)
*   **`app/`**: Next.js App Router pages and layouts.
*   **`components/`**: Reusable UI components (shadcn/ui and custom).
*   **`hooks/`**: Custom React hooks.
*   **`lib/`**: Utility functions and configurations.
*   **`services/`**: API client functions.
*   **`stores/`**: Zustand global state stores.
*   **`types/`**: TypeScript interface definitions.

---

## 4. Database Schema

### Users & Auth
| Table | Key Fields | Description |
|-------|------------|-------------|
| `users` | `id`, `email`, `name`, `program`, `is_active` | Core user profile. |

### The Vault
| Table | Key Fields | Description |
|-------|------------|-------------|
| `vault_posts` | `id`, `title`, `content`, `category`, `is_anonymous` | Anonymous posts. |
| `vault_comments` | `id`, `post_id`, `content`, `parent_id` | Comments (threaded). |

### Marketplace
| Table | Key Fields | Description |
|-------|------------|-------------|
| `marketplace_listings` | `id`, `seller_id`, `title`, `price`, `category`, `status` | Items for sale. |

### Side Quests
| Table | Key Fields | Description |
|-------|------------|-------------|
| `buddy_requests` | `id`, `host_id`, `activity`, `start_time`, `status` | Activity listings. |
| `buddy_participants` | `id`, `request_id`, `user_id`, `status` | Join requests/approvals. |

### Communication
| Table | Key Fields | Description |
|-------|------------|-------------|
| `conversations` | `id`, `user1_id`, `user2_id`, `status` | DM channels (pending/active). |
| `messages` | `id`, `conversation_id`, `content`, `read_at` | Chat messages. |
| `reviews` | `id`, `reviewer_id`, `reviewed_id`, `rating`, `type` | User reputation ratings. |

---

## 5. API Endpoints

### Authentication (`/auth`)
*   `POST /auth/signup`: Register with YorkU email.
*   `POST /auth/verify-email`: verify magic link.
*   `POST /auth/login`: Request login link.
*   `POST /auth/verify-id`: AI-based student ID verification.

### The Vault (`/vault`)
*   `GET /vault`: List posts (filters: category, recent).
*   `POST /vault`: Create post (AI moderated).
*   `GET /vault/{id}`: Get post details.
*   `POST /vault/{id}/flag`: Flag content.
*   `GET /vault/{id}/comments`: Get comments.

### Marketplace (`/marketplace`)
*   `GET /marketplace`: List items (filters: category, price).
*   `POST /marketplace`: Create listing.
*   `PATCH /marketplace/{id}`: Update listing.
*   `POST /marketplace/{id}/mark-sold`: Close listing.

### Side Quests (`/quests`)
*   `GET /quests`: Find activities.
*   `POST /quests`: Host an activity.
*   `POST /quests/{id}/join`: Request to join.
*   `POST /quests/{id}/participants/{pid}`: Accept/Reject participant.

### Messaging (`/messages`)
*   `GET /messages/conversations`: List active chats.
*   `POST /messages/conversations`: Request to chat.
*   `GET /messages/conversations/{id}/messages`: Get chat history.

---

## 6. Feature Status

| Feature | Sub-feature | Status |
|---------|-------------|--------|
| **Auth** | Email Magic Links | ✅ Implemented |
| | ID Verification (AI) | ✅ Implemented |
| **Vault** | Posting/Commenting | ✅ Implemented |
| | Anonymity | ✅ Implemented |
| | Moderation | ✅ Implemented |
| **Market** | Listings | ✅ Implemented |
| | Image Upload (S3) | ✅ Implemented |
| **Quests** | Creation/Search | ✅ Implemented |
| | Participant Mgmt | ✅ Implemented |
| **Chat** | DM Requests | ✅ Implemented |
| | Real-time Updates | 🚧 In Progress |

---

## 7. Environment Variables

### Backend (`/backend/.env`)
```bash
# App
DEBUG=true
JWT_SECRET_KEY=...

# Database & Cache
DATABASE_URL=postgresql+asyncpg://...
REDIS_URL=redis://...

# External Services
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=...
GEMINI_API_KEY=...
```

### Frontend (`/frontend/.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

---

## 8. Development Workflow

### Prerequisites
*   Docker & Docker Compose
*   Node.js 18+
*   Python 3.10+

### Local Setup

1.  **Start Infrastructure**
    ```bash
    docker-compose up -d postgres redis
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    alembic upgrade head  # Run migrations
    uvicorn app.main:app --reload
    ```

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

### Testing
*   **Backend**: `pytest`
*   **Frontend**: `npm run test`
