import type {
  User,
  VaultPost,
  MarketplaceListing,
  SideQuest,
  QuestParticipant,
  QuestCategory,
  VibeLevel,
  QuestStatus,
  QuestMessage,
  Conversation,
  Message,
  Review,
  PaginatedResponse,
  Course,
  CourseChannel,
  CourseMessage,
  CourseHierarchy,
  VoteStatus,
  CourseMembership,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

interface ApiError {
  detail: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface SignupResponse {
  message: string;
  email: string;
}

interface VerifyEmailResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  requires_name_verification: boolean;
}

interface PresignedUrlResponse {
  upload_url: string;
  file_url: string;
}

interface VerifyIdResponse {
  verified: boolean;
  extracted_name: string | null;
  message: string;
}

class ApiClient {
  private baseUrl: string;
  private getToken: (() => string | null) | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setTokenGetter(getter: () => string | null) {
    this.getToken = getter;
  }

  setUnauthorizedHandler(handler: () => void) {
    this.onUnauthorized = handler;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = this.getToken?.();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${API_PREFIX}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: "An unexpected error occurred",
      }));
      throw new Error(error.detail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const headers: HeadersInit = {};
    // Don't set Content-Type for FormData - browser will set it with boundary
    const token = this.getToken?.();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${API_PREFIX}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
      throw new Error("Unauthorized");
    }

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: "An unexpected error occurred",
      }));
      throw new Error(error.detail);
    }

    return response.json();
  }

  // Auth endpoints
  auth = {
    signup: (email: string) =>
      this.post<SignupResponse>("/auth/signup", { email }),

    login: (email: string) =>
      this.post<{ message: string }>("/auth/login", { email }),

    verifyEmail: (token: string) =>
      this.post<VerifyEmailResponse>("/auth/verify-email", { token }),

    verifyName: (name: string) =>
      this.post<{ name_verified: boolean; requires_id_upload: boolean; message: string }>("/auth/verify-name", { name }),

    getPresignedUrl: (fileType: string) =>
      this.post<PresignedUrlResponse>("/auth/upload-id", { file_type: fileType }),

    verifyId: (imageUrl: string, providedName: string) =>
      this.post<VerifyIdResponse>("/auth/verify-id", {
        image_url: imageUrl,
        provided_name: providedName,
      }),

    me: () => this.get<User>("/auth/me"),

    updateProfile: (data: Partial<User>) =>
      this.patch<User>("/auth/me", data),

    refreshToken: (refreshToken: string) =>
      this.post<LoginResponse>("/auth/refresh", { refresh_token: refreshToken }),

    getAvatarUploadUrl: (filename: string, contentType: string) =>
      this.post<{ upload_url: string; file_url: string; expires_in: number }>(
        "/auth/avatar-upload",
        { filename, content_type: contentType }
      ),

    getPublicProfile: (userId: string) =>
      this.get<{
        id: string;
        name: string;
        name_verified: boolean;
        program: string | null;
        bio: string | null;
        avatar_url: string | null;
        interests: string[] | null;
        created_at: string | null;
      }>(`/auth/users/${userId}`),
  };

  // Vault endpoints
  vault = {
    getPosts: (params?: { category?: string; page?: number; per_page?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set("category", params.category);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
      const query = searchParams.toString();
      return this.get<PaginatedResponse<VaultPost>>(`/vault${query ? `?${query}` : ""}`);
    },

    getPost: (id: string) => this.get<VaultPost>(`/vault/${id}`),

    createPost: (data: { title: string; content: string; category: string; is_anonymous: boolean }) =>
      this.post<VaultPost>("/vault", data),

    updatePost: (id: string, data: { title?: string; content?: string; category?: string }) =>
      this.patch<VaultPost>(`/vault/${id}`, data),

    deletePost: (id: string) => this.delete<void>(`/vault/${id}`),

    flagPost: (id: string) => this.post<{ message: string }>(`/vault/${id}/flag`),

    getComments: (postId: string, page?: number) => {
      const query = page ? `?page=${page}` : "";
      return this.get<PaginatedResponse<{
        id: string;
        post_id: string;
        content: string;
        is_anonymous: boolean;
        is_hidden: boolean;
        parent_id: string | null;
        author: { id: string; name: string; avatar_url: string | null } | null;
        created_at: string;
      }>>(`/vault/${postId}/comments${query}`);
    },

    createComment: (postId: string, data: { content: string; is_anonymous: boolean }) =>
      this.post<{ id: string; content: string }>(`/vault/${postId}/comments`, data),

    deleteComment: (postId: string, commentId: string) =>
      this.delete<void>(`/vault/${postId}/comments/${commentId}`),
  };

  // Marketplace endpoints
  marketplace = {
    getListings: (params?: {
      category?: string;
      condition?: string;
      min_price?: number;
      max_price?: number;
      search?: string;
      page?: number;
      per_page?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set("category", params.category);
      if (params?.condition) searchParams.set("condition", params.condition);
      if (params?.min_price) searchParams.set("min_price", params.min_price.toString());
      if (params?.max_price) searchParams.set("max_price", params.max_price.toString());
      if (params?.search) searchParams.set("search", params.search);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
      const query = searchParams.toString();
      return this.get<PaginatedResponse<MarketplaceListing>>(`/marketplace${query ? `?${query}` : ""}`);
    },

    getListing: (id: string) => this.get<MarketplaceListing>(`/marketplace/${id}`),

    createListing: (data: {
      title: string;
      description: string;
      price: number;
      category: string;
      condition: string;
      images?: string[];
    }) => this.post<MarketplaceListing>("/marketplace", data),

    updateListing: (id: string, data: Partial<{
      title: string;
      description: string;
      price: number;
      category: string;
      condition: string;
      status: string;
    }>) => this.patch<MarketplaceListing>(`/marketplace/${id}`, data),

    deleteListing: (id: string) => this.delete<void>(`/marketplace/${id}`),

    getMyListings: (page?: number) => {
      const query = page ? `?page=${page}` : "";
      return this.get<PaginatedResponse<MarketplaceListing>>(`/marketplace/my-listings${query}`);
    },

    getUploadUrl: (filename: string, contentType: string) =>
      this.post<{
        upload_url: string;
        file_key: string;
        public_url: string;
        expires_in: number;
      }>("/marketplace/upload-image", { filename, content_type: contentType }),

    uploadImageDirect: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      // Use the API client's request method to get proper auth headers
      return api.postFormData<{ public_url: string; file_key: string }>(
        "/marketplace/upload-image-direct",
        formData
      );
    },
  };

  // Side Quests endpoints
  quests = {
    getQuests: (params?: {
      category?: QuestCategory;
      status?: QuestStatus;
      vibe_level?: VibeLevel;
      date_from?: string;
      date_to?: string;
      sort_by?: "newest" | "starting_soon" | "most_spots";
      page?: number;
      per_page?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set("category", params.category);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.vibe_level) searchParams.set("vibe_level", params.vibe_level);
      if (params?.date_from) searchParams.set("date_from", params.date_from);
      if (params?.date_to) searchParams.set("date_to", params.date_to);
      if (params?.sort_by) searchParams.set("sort_by", params.sort_by);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
      const query = searchParams.toString();
      return this.get<PaginatedResponse<SideQuest> & { has_more: boolean }>(`/quests${query ? `?${query}` : ""}`);
    },

    getQuest: (id: string) => this.get<SideQuest>(`/quests/${id}`),

    createQuest: (data: {
      category: QuestCategory;
      custom_category?: string;
      activity: string;
      description?: string;
      start_time: string;
      end_time?: string;
      location: string;
      latitude?: number;
      longitude?: number;
      vibe_level?: VibeLevel;
      max_participants?: number;
      requires_approval?: boolean;
    }) => this.post<SideQuest>("/quests", data),

    updateQuest: (id: string, data: Partial<{
      activity: string;
      description: string;
      start_time: string;
      end_time: string;
      location: string;
      latitude: number;
      longitude: number;
      vibe_level: VibeLevel;
      max_participants: number;
      requires_approval: boolean;
      status: QuestStatus;
    }>) => this.patch<SideQuest>(`/quests/${id}`, data),

    deleteQuest: (id: string) => this.delete<void>(`/quests/${id}`),

    completeQuest: (id: string) => this.post<SideQuest>(`/quests/${id}/complete`),

    joinQuest: (id: string, message?: string) =>
      this.post<QuestParticipant>(`/quests/${id}/join`, { message }),

    leaveQuest: (id: string) => this.delete<void>(`/quests/${id}/leave`),

    getParticipants: (id: string) =>
      this.get<{ items: QuestParticipant[]; total: number }>(`/quests/${id}/participants`),

    approveParticipant: (questId: string, participantId: string, action: "accept" | "reject") =>
      this.post<QuestParticipant>(`/quests/${questId}/participants/${participantId}`, { action }),

    removeParticipant: (questId: string, userId: string) =>
      this.delete<void>(`/quests/${questId}/participants/${userId}`),

    getMyQuests: (params?: { role?: "host" | "participant" | "pending" | "all"; page?: number; per_page?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.role) searchParams.set("role", params.role);
      if (params?.page) searchParams.set("page", params.page.toString());
      if (params?.per_page) searchParams.set("per_page", params.per_page.toString());
      const query = searchParams.toString();
      return this.get<PaginatedResponse<SideQuest> & { has_more: boolean }>(`/quests/my-quests${query ? `?${query}` : ""}`);
    },

    // Quest Group Chat
    getQuestMessages: (questId: string, params?: { before?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.before) searchParams.set("before", params.before);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return this.get<{ messages: QuestMessage[]; has_more: boolean }>(`/quests/${questId}/chat${query ? `?${query}` : ""}`);
    },

    sendQuestMessage: (questId: string, content: string) =>
      this.post<QuestMessage>(`/quests/${questId}/chat`, { content }),
  };

  // Legacy alias for backwards compatibility
  get buddy() {
    return this.quests;
  }

  // Messaging endpoints
  messaging = {
    getConversations: (page?: number) => {
      const query = page ? `?page=${page}` : "";
      return this.get<{ items: Conversation[]; total: number }>(`/messages/conversations${query}`);
    },

    getConversation: (id: string) => this.get<Conversation>(`/messages/conversations/${id}`),

    startConversation: (data: {
      recipient_id: string;
      initial_message: string;
      context_type?: "marketplace" | "buddy" | "profile";
      context_id?: string;
    }) => this.post<Conversation>("/messages/conversations", data),

    acceptConversation: (id: string) =>
      this.post<Conversation>(`/messages/conversations/${id}/accept`),

    declineConversation: (id: string) =>
      this.post<void>(`/messages/conversations/${id}/decline`),

    blockConversation: (id: string) =>
      this.post<{ message: string }>(`/messages/conversations/${id}/block`),

    unblockConversation: (id: string) =>
      this.post<Conversation>(`/messages/conversations/${id}/unblock`),

    getMessages: (conversationId: string, params?: { before?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.before) searchParams.set("before", params.before);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return this.get<{ messages: Message[]; has_more: boolean }>(`/messages/conversations/${conversationId}/messages${query ? `?${query}` : ""}`);
    },

    sendMessage: (conversationId: string, content?: string, imageUrl?: string) =>
      this.post<Message>(`/messages/conversations/${conversationId}/messages`, {
        content: content || null,
        image_url: imageUrl || null,
      }),

    getChatImageUploadUrl: (filename: string, contentType: string) =>
      this.post<{ upload_url: string; file_url: string; expires_in: number }>(
        "/messages/upload-image",
        { filename, content_type: contentType }
      ),

    markAsRead: (conversationId: string) =>
      this.post<void>(`/messages/conversations/${conversationId}/read`),

    getPendingRequests: () =>
      this.get<{ requests: Conversation[] }>("/messages/requests"),

    getUnreadCount: () =>
      this.get<{ unread_count: number }>("/messages/unread-count"),
  };

  // Reviews endpoints
  reviews = {
    createReview: (data: {
      reviewed_id: string;
      rating: number;
      comment?: string;
      review_type: "marketplace" | "buddy";
      reference_id?: string;
    }) => this.post<Review>("/reviews", data),

    getUserReviews: (userId: string, params?: { review_type?: string; page?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.review_type) searchParams.set("review_type", params.review_type);
      if (params?.page) searchParams.set("page", params.page.toString());
      const query = searchParams.toString();
      return this.get<{ items: Review[]; total: number; average_rating: number }>(`/reviews/user/${userId}${query ? `?${query}` : ""}`);
    },

    getUserRatingSummary: (userId: string) =>
      this.get<{
        user_id: string;
        marketplace_rating: number | null;
        marketplace_count: number;
        buddy_rating: number | null;
        buddy_count: number;
        overall_rating: number | null;
        total_reviews: number;
      }>(`/reviews/user/${userId}/summary`),

    getMyReviews: (direction: "given" | "received", page?: number) => {
      const searchParams = new URLSearchParams();
      searchParams.set("direction", direction);
      if (page) searchParams.set("page", page.toString());
      return this.get<{ items: Review[]; total: number; average_rating: number }>(`/reviews/my-reviews?${searchParams.toString()}`);
    },

    deleteReview: (id: string) => this.delete<void>(`/reviews/${id}`),
  };

  // Reports endpoints
  reports = {
    submitReport: (data: {
      reported_user_id: string;
      reason: string;
      explanation: string;
    }) => this.post<{
      id: string;
      reported_user_id: string;
      reason: string;
      status: string;
      created_at: string;
    }>("/users/report", data),
  };

  // Course chat endpoints
  courses = {
    // Discovery
    getHierarchy: (campus?: string) => {
      const query = campus ? `?campus=${campus}` : "";
      return this.get<CourseHierarchy>(`/courses/hierarchy${query}`);
    },

    search: (q: string, limit = 20) =>
      this.get<{ results: Array<{ id: string; code: string; name: string; faculty: string; year: number; member_count: number }>; total: number }>(
        `/courses/search?q=${encodeURIComponent(q)}&limit=${limit}`
      ),

    getCourse: (courseId: string) => this.get<Course>(`/courses/${courseId}`),

    // Membership
    getMyCourses: () =>
      this.get<{ courses: CourseMembership[] }>("/courses/my/courses"),

    joinCourse: (courseId: string) =>
      this.post<{
        course: Course;
        general_channel: CourseChannel;
        message: string;
      }>(`/courses/${courseId}/join`),

    leaveCourse: (courseId: string) =>
      this.post<{ message: string }>(`/courses/${courseId}/leave`),

    // Channels
    getChannels: (courseId: string) =>
      this.get<{ channels: CourseChannel[] }>(`/courses/${courseId}/channels`),

    joinChannel: (channelId: string) =>
      this.post<{ channel: CourseChannel; message: string }>(
        `/courses/channels/${channelId}/join`
      ),

    // Voting
    getVoteStatus: (courseId: string) =>
      this.get<{ votes: VoteStatus[]; current_semester: string }>(
        `/courses/${courseId}/vote-status`
      ),

    voteForProfessor: (courseId: string, profName: string, semester?: string) =>
      this.post<{
        vote_count: number;
        threshold: number;
        channel_created: boolean;
        channel: CourseChannel | null;
        message: string;
      }>(`/courses/${courseId}/vote-professor`, {
        prof_name: profName,
        semester,
      }),

    // Messages
    getMessages: (channelId: string, params?: { before?: string; limit?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.before) searchParams.set("before", params.before);
      if (params?.limit) searchParams.set("limit", params.limit.toString());
      const query = searchParams.toString();
      return this.get<{ messages: CourseMessage[]; has_more: boolean }>(
        `/courses/channels/${channelId}/messages${query ? `?${query}` : ""}`
      );
    },

    sendMessage: (channelId: string, message?: string, imageUrl?: string) =>
      this.post<CourseMessage>(`/courses/channels/${channelId}/messages`, {
        message: message || null,
        image_url: imageUrl || null,
      }),

    getChatImageUploadUrl: (filename: string, contentType: string) =>
      this.post<{ upload_url: string; file_url: string; expires_in: number }>(
        "/courses/chat/upload-image",
        { filename, content_type: contentType }
      ),
  };

  // Dashboard endpoints
  dashboard = {
    getStats: () =>
      this.get<{
        marketplace_listings: number;
        side_quests_active: number;
        total_courses: number;
        vault_posts_today: number;
        total_users: number;
      }>("/dashboard/stats"),
  };

  // Feedback endpoints
  feedback = {
    submit: (data: { type: "suggestion" | "bug" | "problem" | "other"; subject: string; message: string }) =>
      this.post<{
        feedback: {
          id: string;
          type: string;
          subject: string;
          message: string;
          status: string;
          created_at: string;
        };
        message: string;
      }>("/feedback", data),

    getMyFeedback: (page = 1, perPage = 20) =>
      this.get<{
        items: Array<{
          id: string;
          type: string;
          subject: string;
          message: string;
          status: string;
          admin_response: string | null;
          responded_at: string | null;
          created_at: string;
        }>;
        total: number;
      }>(`/feedback/my?page=${page}&per_page=${perPage}`),
  };

}

export const api = new ApiClient(API_URL);
