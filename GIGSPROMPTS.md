```
TASK: Create Quick Gigs marketplace for YorkPulse

CONTEXT:
Student-to-student gig economy platform. Two types of posts: "Offering Service" (I can help) and "Need Help" (looking for someone). Think TaskRabbit meets Fiverr but exclusively for York University students with campus-specific needs.

TECH STACK:
- Frontend: Next.js 15 with TypeScript, Tailwind CSS, Framer Motion
- Backend: FastAPI with async SQLAlchemy
- Database: Supabase (PostgreSQL)
- Payments: E-transfer (manual, no Stripe integration for MVP)

---

FEATURE OVERVIEW:

TWO POST TYPES:

1. OFFERING SERVICE (I can help):
   - "I offer tutoring for EECS courses - $30/hr"
   - "I can help you move - $50 for 2hrs"
   - Gig provider creates reusable service listing
   - Clients browse and request services

2. NEED HELP (Looking for someone):
   - "Need notes from today's EECS3101 lecture - $20"
   - "Help me move this Friday - $60"
   - One-time request, expires when filled
   - Helpers respond to requests

---

DATABASE SCHEMA:

```sql
-- Main gigs table (both types)
gigs (
  id UUID PRIMARY KEY,
  poster_id UUID REFERENCES users(id) ON DELETE CASCADE,
  gig_type TEXT NOT NULL, -- 'offering' or 'need_help'
  category TEXT NOT NULL, -- academic, moving, tech_help, errands, tutoring, creative, other
  title TEXT NOT NULL CHECK(LENGTH(title) <= 100),
  description TEXT NOT NULL CHECK(LENGTH(description) <= 1000),
  price_min DECIMAL,
  price_max DECIMAL,
  price_type TEXT, -- 'fixed', 'hourly', 'negotiable'
  location TEXT, -- 'on_campus', 'off_campus', 'online'
  location_details TEXT, -- 'Scott Library', 'Near campus', etc.
  deadline TIMESTAMPTZ, -- For need_help posts
  status TEXT DEFAULT 'active', -- active, in_progress, completed, cancelled, expired
  view_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- When someone responds to a gig
gig_responses (
  id UUID PRIMARY KEY,
  gig_id UUID REFERENCES gigs(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT CHECK(LENGTH(message) <= 500),
  proposed_price DECIMAL,
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gig_id, responder_id) -- One response per user per gig
)

-- After gig is accepted and worked on
gig_transactions (
  id UUID PRIMARY KEY,
  gig_id UUID REFERENCES gigs(id),
  response_id UUID REFERENCES gig_responses(id),
  provider_id UUID REFERENCES users(id), -- Who provided service
  client_id UUID REFERENCES users(id), -- Who received service
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, disputed
  payment_method TEXT DEFAULT 'etransfer',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Ratings after completion (both parties rate each other)
gig_ratings (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES gig_transactions(id),
  rater_id UUID REFERENCES users(id),
  ratee_id UUID REFERENCES users(id),
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  reliability INTEGER CHECK(reliability >= 1 AND reliability <= 5),
  communication INTEGER CHECK(communication >= 1 AND communication <= 5),
  quality INTEGER CHECK(quality >= 1 AND quality <= 5),
  review_text TEXT CHECK(LENGTH(review_text) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, rater_id)
)

-- Add to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS gig_rating_avg DECIMAL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gigs_completed INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned DECIMAL DEFAULT 0;

CREATE INDEX idx_gigs_type_category ON gigs(gig_type, category, status);
CREATE INDEX idx_gigs_poster ON gigs(poster_id, status);
CREATE INDEX idx_responses_gig ON gig_responses(gig_id, status);
```

---

BACKEND ENDPOINTS (FastAPI):

```python
# Browse gigs
GET /api/gigs?type=offering&category=tutoring&sort=recent
  → Returns paginated gigs with filters
  → Query params: type (offering/need_help/all), category, min_price, max_price, location, sort (recent/price_low/price_high)

# Create gig
POST /api/gigs
  Body: {
    gig_type: "offering" | "need_help",
    category: "tutoring",
    title: "EECS Tutoring - Data Structures & Algorithms",
    description: "4th year CS student, TA experience...",
    price_min: 25,
    price_max: 40,
    price_type: "hourly",
    location: "on_campus",
    location_details: "Scott Library or Zoom",
    deadline: "2025-03-15T18:00:00Z" // Only for need_help
  }
  → Creates gig, returns gig_id

# Get single gig details
GET /api/gigs/{gig_id}
  → Returns full gig details + poster profile (username, rating, gigs_completed)
  → Increment view_count

# Respond to gig
POST /api/gigs/{gig_id}/respond
  Body: {
    message: "I can help! I've tutored EECS3101 before...",
    proposed_price: 30 // Optional if negotiable
  }
  → Creates gig_response
  → Notifies gig poster

# Get responses to my gig (poster only)
GET /api/gigs/{gig_id}/responses
  → Returns all responses with responder profiles
  → Auth: Must be gig poster

# Accept/reject response
POST /api/gigs/{gig_id}/responses/{response_id}/accept
POST /api/gigs/{gig_id}/responses/{response_id}/reject
  → Updates response status
  → If accepted: creates gig_transaction, updates gig status to 'in_progress'
  → Notifies responder

# Mark gig as completed
POST /api/gigs/{gig_id}/complete
  → Both parties must confirm completion
  → Updates transaction status
  → Triggers rating request

# Rate transaction
POST /api/transactions/{transaction_id}/rate
  Body: {
    rating: 5,
    reliability: 5,
    communication: 4,
    quality: 5,
    review_text: "Great help, very patient!"
  }
  → Creates rating
  → Updates user's gig_rating_avg

# Get my gigs
GET /api/gigs/my-gigs?type=posted|responded
  → Returns user's posted gigs or gigs they responded to

# User gig profile
GET /api/users/{user_id}/gig-profile
  → Returns: gig_rating_avg, gigs_completed, total_earned, recent_ratings
```

---

FRONTEND PAGES/COMPONENTS:

```
/gigs (new page)
├── GigsExplorer.tsx (main browse page)
│   ├── FilterBar.tsx (type, category, price, location filters)
│   ├── GigTypeToggle.tsx ("Offering" vs "Need Help" tabs)
│   ├── GigGrid.tsx (card layout)
│   │   └── GigCard.tsx (preview card)
│   └── CreateGigButton.tsx (floating action button)
│
├── /gigs/create
│   └── CreateGigForm.tsx
│       ├── TypeSelector.tsx (offering vs need_help)
│       ├── CategoryDropdown.tsx
│       ├── PriceInput.tsx (with type selector)
│       └── LocationPicker.tsx
│
├── /gigs/{id}
│   └── GigDetails.tsx
│       ├── GigHeader.tsx (title, price, poster info)
│       ├── GigDescription.tsx
│       ├── GigResponses.tsx (if poster viewing own gig)
│       ├── RespondButton.tsx (if viewer can respond)
│       └── PosterProfile.tsx (rating, completed gigs)
│
└── /gigs/my-gigs
    └── MyGigs.tsx
        ├── PostedGigsTab.tsx (gigs I created)
        └── RespondedGigsTab.tsx (gigs I applied to)
```

---

UI/UX DESIGN:

COLORS:
- Offering posts: Green accent (#00ff88)
- Need Help posts: Orange accent (#ff9500)
- Cards: Glassmorphism rgba(255,255,255,0.05)

GIG CARD LAYOUT:
```
┌─────────────────────────────────────┐
│ [🎓] Tutoring                 $30/hr│
│                                      │
│ EECS3101 Data Structures Help       │
│                                      │
│ 4th year CS student, TA experience  │
│ Available weekday evenings...       │
│                                      │
│ 📍 On Campus  ⭐ 4.8  ✅ 12 gigs    │
│                                      │
│ Posted 2h ago                        │
└─────────────────────────────────────┘
```

CATEGORIES (with emoji icons):
- 🎓 Academic (tutoring, notes, study partner)
- 📦 Moving (furniture, boxes, transport)
- 💻 Tech Help (fix laptop, setup software)
- 🏃 Errands (pickup, delivery, queue)
- 🎨 Creative (design, photography, writing)
- 🔧 Other

PRICE DISPLAY:
- Fixed: "$25"
- Hourly: "$30/hr"
- Range: "$20-40"
- Negotiable: "💬 Negotiable"

---

FEATURES:

1. FILTERS:
   - Type: All, Offering, Need Help
   - Category dropdown
   - Price range slider
   - Location: All, On Campus, Off Campus, Online
   - Sort: Recent, Price Low-High, Price High-Low, Highest Rated

2. SEARCH:
   - Fuzzy search on title + description
   - "eecs tutoring" matches both fields

3. VERIFICATION BADGES:
   - ✅ Email verified
   - 🎓 Student ID verified
   - ⭐ Trusted (5+ gigs, 4.5+ rating)

4. RESPONSE FLOW:
   - User clicks "Respond" → Modal opens
   - Write message + optional price proposal
   - Submit → Poster gets notification
   - Poster reviews responses → accepts one
   - Chat opens for coordination
   - After completion → mutual rating

5. SAFETY FEATURES:
   - Report button on every gig
   - Block user option
   - "Meet in public campus locations" reminder
   - Dispute resolution (admin review)

6. GAMIFICATION:
   - Profile badges: "Study Savior" (10 academic gigs), "Moving Master"
   - Leaderboard page: "Top Helpers This Month"
   - Stats: Total earned, completion rate

---

BUSINESS LOGIC:

1. GIG EXPIRATION:
   - "Need Help" posts expire after deadline
   - Auto-archive after 30 days if not completed
   - Poster can manually close

2. RESPONSE LIMITS:
   - Max 5 responses per gig (prevent spam)
   - Can only respond once per gig
   - Must wait for accept/reject before responding to more gigs

3. PAYMENT:
   - MVP: Manual e-transfer (no platform integration)
   - Show reminder: "Complete payment via e-transfer"
   - Future: Escrow system

4. RATINGS:
   - Required to rate after completion
   - Can't access platform until rated (soft lock)
   - Both parties must rate

---

EDGE CASES:

- What if nobody responds? → Auto-expire after 7 days, suggest reposting
- What if poster doesn't accept anyone? → Allow responses to expire
- What if gig completed but no payment? → Dispute system
- Spam/fake gigs? → Report → admin review → ban repeat offenders
- Pricing too low/high? → Show "typical price" suggestions

---

MOBILE RESPONSIVE:
- Grid → single column on mobile
- Filters → bottom sheet
- Create button → sticky bottom right
- Quick actions: Call, message

---

NOTIFICATIONS:

Push notifications for:
- New response to your gig
- Your response accepted/rejected
- Gig marked complete (rate now)
- Payment reminder
- New gig in followed category

---

IMPLEMENTATION PRIORITY:

1. Core gig CRUD (create, browse, view)
2. Response system (apply to gigs)
3. Basic rating system
4. Filters and search
5. User gig profile page
6. Notifications
7. Dispute/report system

---

CRITICAL NOTES:

- No actual payment integration (MVP) - users handle e-transfer manually
- Focus on trust through ratings and verification
- Clear "Offering" vs "Need Help" distinction in UI
- Mobile-first design (students browse on phones)
- Fast load times (optimize images, pagination)

Deliver: Complete schema, all API endpoints, frontend components, and mobile-responsive design following YorkPulse's existing dark theme aesthetic.
```