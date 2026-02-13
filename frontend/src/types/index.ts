// User types
export interface User {
  id: string;
  email: string;
  name: string;
  name_verified: boolean;
  email_verified: boolean;
  program?: string;
  bio?: string;
  interests?: string[];
  avatar_url?: string;
  campus_days?: string[];
  created_at?: string;
}

// Vault types
export interface VaultPost {
  id: string;
  author: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  title: string;
  content: string;
  is_anonymous: boolean;
  category: string;
  status: string;
  comment_count: number;
  upvote_count: number;
  flag_count: number;
  created_at: string;
  updated_at: string;
}

export interface VaultComment {
  id: string;
  post_id: string;
  author: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
  content: string;
  is_anonymous: boolean;
  is_hidden: boolean;
  parent_id: string | null;
  created_at: string;
}

// Marketplace types
export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  images: string[];
  status: "active" | "sold" | "reserved" | "deleted";
  seller: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  created_at: string;
}

// Side Quest (Buddy) types
export type QuestCategory = "gym" | "food" | "game" | "commute" | "study" | "custom";
export type VibeLevel = "chill" | "intermediate" | "high_energy" | "intense";
export type QuestStatus = "open" | "in_progress" | "full" | "completed" | "cancelled";
export type ParticipantStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface SideQuest {
  id: string;
  category: QuestCategory;
  custom_category: string | null;
  activity: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  vibe_level: VibeLevel;
  max_participants: number;
  current_participants: number;
  requires_approval: boolean;
  status: QuestStatus;
  host: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  created_at: string;
}

export interface QuestParticipant {
  id: string;
  user: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  status: ParticipantStatus;
  message: string | null;
  created_at: string;
}

export interface QuestMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  created_at: string;
  is_deleted: boolean;
}

// Legacy alias for backwards compatibility
export type BuddyRequest = SideQuest;
export type BuddyParticipant = QuestParticipant;

// Messaging types
export interface Conversation {
  id: string;
  participants: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
  }>;
  initiator_id: string;
  status: "pending" | "active" | "blocked";
  last_message?: Message;
  last_message_at?: string;
  unread_count: number;
  context_type?: "marketplace" | "buddy" | "profile" | null;
  context_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url: string | null;
  is_deleted: boolean;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// Review types
export interface Review {
  id: string;
  reviewer: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  reviewed_id: string;
  rating: number;
  comment?: string;
  review_type: "marketplace" | "buddy";
  reference_id?: string;
  created_at: string;
}

// API Response types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page?: number;
  per_page?: number;
}

export interface ApiError {
  detail: string;
  code?: string;
}

// Course types
export type ChannelType = "general" | "professor";

export interface Course {
  id: string;
  code: string;
  name: string;
  faculty: string;
  programs: string[];
  year: number;
  credits: number | null;
  campus: string | null;
  member_count: number;
  created_at: string;
}

export interface CourseChannel {
  id: string;
  course_id: string;
  name: string;
  type: ChannelType;
  member_count: number;
  is_active: boolean;
  prof_name: string | null;
  semester: string | null;
  created_at: string;
}

export interface CourseMessage {
  id: string;
  channel_id: string;
  message: string | null;
  image_url: string | null;
  author: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
  created_at: string;
}

export interface CourseHierarchy {
  faculties: Array<{
    name: string;
    programs: Array<{
      name: string;
      years: Array<{
        year: number;
        courses: Array<{
          id: string;
          code: string;
          name: string;
          member_count: number;
        }>;
      }>;
    }>;
  }>;
}

export interface VoteStatus {
  prof_name: string;
  prof_name_normalized: string;
  vote_count: number;
  threshold: number;
  has_voted: boolean;
  semester: string;
}

export interface CourseMembership {
  course: Course;
  joined_at: string;
  channel_count: number;
}
