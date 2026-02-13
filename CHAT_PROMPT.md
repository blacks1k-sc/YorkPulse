```
TASK: Create Course Chat Rooms feature with interactive mind-map navigation

CONTEXT:
YorkPulse community platform for York University students. Building a course-specific chat system with hierarchical navigation (Faculty → Program → Year → Course) and direct search functionality. Uses cleaned course data from courses_seed.json with 7,817 courses.

TECH STACK:
- Frontend: Next.js 15 with TypeScript, Tailwind CSS, Framer Motion
- Backend: FastAPI with async SQLAlchemy
- Database: Supabase (PostgreSQL with real-time subscriptions)
- UI Style: Gen Z dark theme, glassmorphism, smooth animations

---

FEATURE REQUIREMENTS:

1. MIND MAP NAVIGATION UI
- Interactive, expandable tree structure with smooth animations
- Hierarchy: Faculty → Program → Year → Course → Channels
- Visual design: Dark theme with neon accents, glassmorphism cards
- Collapsible nodes (click faculty → expand programs → expand years → show courses)
- Show member counts on each course bubble
- Smooth transitions using Framer Motion (scale, fade, slide)
- Mobile responsive (tree becomes accordion on mobile)

2. DUAL NAVIGATION SYSTEM
   A) Hierarchical browse (mind map)
   B) Direct search bar at top:
      - Autocomplete dropdown
      - Search by course code (EECS3101) or name (Data Structures)
      - Fuzzy matching
      - Instant results, click to jump to course

3. COURSE CHAT STRUCTURE (Discord-style channels)
Each course has:
- #general (default, all members auto-join)
- Professor-specific channels (auto-created when 5+ students vote)
- Channels display: emoji icon + name + member count

4. AUTO-CHANNEL CREATION SYSTEM
- When user joins course → lands in #general
- Pinned message in #general:
  ```
  📌 Welcome to [COURSE CODE]!
  Want a prof-specific room? Type your professor's name.
  When 5 students enter the same name, a channel auto-creates.
  
  Current votes:
  • Prof. John Smith: 3/5 ⏳
  • Prof. Sarah Jones: 2/5
  ```
- Input field for professor name (case-insensitive, trimmed)
- Real-time vote counter updates (Supabase subscriptions)
- When 5th vote → instant channel creation + notification
- Voters auto-moved to new channel

5. CHAT INTERFACE
- Real-time messaging (Supabase real-time)
- Message structure: avatar, username, timestamp, message (500 char limit)
- Auto-scroll to latest
- Channel switcher sidebar (shows all channels in current course)
- Leave course button
- @ mentions support
- No file uploads (link to external storage instead)

---

DATABASE SCHEMA:

```sql
-- Import courses from courses_seed.json
courses (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- EECS3101
  name TEXT NOT NULL,
  faculty TEXT NOT NULL,
  programs TEXT[] NOT NULL,
  year INTEGER NOT NULL, -- 1-4
  credits DECIMAL,
  campus TEXT,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Discord-style channels within courses
course_channels (
  id UUID PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- general, prof-john-smith-w2025
  type TEXT NOT NULL, -- 'general' | 'professor'
  metadata JSONB, -- {prof_name, semester, section}
  member_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, name)
)

-- User membership in courses
course_members (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
)

-- Messages in channels
course_messages (
  id UUID PRIMARY KEY,
  channel_id UUID REFERENCES course_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK(LENGTH(message) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
)
CREATE INDEX idx_messages_channel ON course_messages(channel_id, created_at DESC);

-- Professor channel voting
channel_creation_votes (
  id UUID PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  prof_name_normalized TEXT NOT NULL, -- lowercase, trimmed
  voter_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  semester TEXT NOT NULL, -- W2025, F2024
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, voter_user_id, semester) -- one vote per user per course per semester
)
CREATE INDEX idx_votes_course ON channel_creation_votes(course_id, prof_name_normalized, semester);
```

---

BACKEND ENDPOINTS (FastAPI):

```python
# Course discovery
GET /api/courses/hierarchy
  → Returns nested JSON: {faculties: [{name, programs: [{name, courses: [...]}]}]}
  
GET /api/courses/search?q=eecs3101
  → Autocomplete search, returns matching courses

# Course membership
POST /api/courses/{course_id}/join
  → Adds user to course, creates #general membership
  
POST /api/courses/{course_id}/leave
  → Removes user from all channels in course

# Channel management
GET /api/courses/{course_id}/channels
  → Returns all channels with member counts
  
POST /api/channels/{channel_id}/join
  → Joins specific channel (prof-specific rooms)

# Professor voting
POST /api/courses/{course_id}/vote-professor
  Body: {prof_name: "John Smith", semester: "W2025"}
  → Records vote, checks if threshold met (5 votes)
  → If threshold met: auto-creates channel, returns new channel_id
  
GET /api/courses/{course_id}/vote-status
  → Returns current vote counts for all professors

# Messaging
GET /api/channels/{channel_id}/messages?limit=50&before=timestamp
  → Paginated messages (newest first)
  
POST /api/channels/{channel_id}/messages
  Body: {message: "text"}
  → Sends message, broadcasts via Supabase real-time
  
# Admin seeding
POST /api/admin/seed-courses
  → One-time import from courses_seed.json
```

---

FRONTEND PAGES/COMPONENTS:

```
/courses (new page)
├── CourseExplorer.tsx (main page)
│   ├── SearchBar.tsx (autocomplete)
│   ├── MindMapView.tsx (interactive hierarchy)
│   │   ├── FacultyNode.tsx (collapsible)
│   │   ├── ProgramNode.tsx (collapsible)
│   │   └── CourseNode.tsx (clickable bubbles)
│   └── ChatInterface.tsx (opens when course clicked)
│       ├── ChannelSidebar.tsx (list of channels)
│       ├── MessageList.tsx (real-time messages)
│       ├── MessageInput.tsx (500 char limit)
│       └── ProfVotingWidget.tsx (pinned in #general)
```

---

IMPLEMENTATION STEPS:

1. **Database setup:**
   - Create all tables with indexes
   - Enable Supabase real-time on course_messages table
   - Create seed script to import courses_seed.json

2. **Backend:**
   - Implement all FastAPI endpoints with async SQLAlchemy
   - Add vote threshold trigger (when count = 5 → create channel)
   - Set up Supabase client for real-time broadcasts

3. **Frontend - Navigation:**
   - Build mind map with Framer Motion animations
   - Implement search with fuzzy matching (fuse.js or similar)
   - Add mobile accordion fallback

4. **Frontend - Chat:**
   - Real-time message subscription via Supabase
   - Message composer with character counter
   - Professor voting widget with live vote updates
   - Channel auto-creation notification toast

5. **Integration:**
   - Connect to existing auth system (users table)
   - Add "Courses" tab to main navigation
   - Test with 2-3 sample courses before full seed

---

DESIGN SPECS:

Colors:
- Background: #0a0a0a (dark)
- Cards: rgba(255,255,255,0.05) with backdrop-blur
- Accent: #00ff88 (neon green) for active states
- Text: #e0e0e0
- Borders: rgba(255,255,255,0.1)

Animations:
- Node expand: scale(0.95 → 1) + fadeIn, 200ms ease-out
- Channel create: slideIn from right + glow effect
- Message send: gentle bounce + fade

Typography:
- Headers: font-bold text-xl
- Course codes: font-mono text-sm
- Messages: font-normal text-base

---

CRITICAL REQUIREMENTS:

1. Auto-delete messages older than 4 months (cost savings)
2. Rate limiting: 10 messages/minute per user per channel
3. Professor name normalization: lowercase, trim, remove extra spaces
4. Semester auto-detection from current date (W2025, F2025, etc.)
5. Responsive design: tree on desktop, accordion on mobile
6. Error handling: network failures, duplicate votes, empty channels
7. Loading states for all async operations
8. Accessibility: keyboard navigation, ARIA labels

---

DELIVERABLES:

1. Complete database migration SQL
2. All FastAPI routes with error handling
3. SQLAlchemy models with relationships
4. Next.js page with all components
5. Supabase real-time subscription setup
6. Seed script for courses_seed.json import
7. README with setup instructions

Use existing YorkPulse patterns for auth, styling, and API structure. Prioritize smooth UX with optimistic updates and real-time feel.
```