import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Create a singleton supabase client, but only on the client side
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") {
    // Server-side: don't create the client
    return null;
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    // Missing configuration: return null
    console.warn("Supabase URL or key not configured. Real-time features will be disabled.");
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseInstance;
}

// For backwards compatibility
export const supabase = {
  get client() {
    return getSupabase();
  },
  channel(name: string) {
    const client = getSupabase();
    if (!client) {
      // Return a no-op channel that does nothing
      return {
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      };
    }
    return client.channel(name);
  },
  removeChannel(channel: ReturnType<SupabaseClient["channel"]>) {
    const client = getSupabase();
    if (client && channel) {
      return client.removeChannel(channel);
    }
    return Promise.resolve();
  },
};

export type RealtimeMessagePayload = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  is_deleted: boolean;
  created_at: string;
};

export type RealtimeConversationPayload = {
  id: string;
  user1_id: string;
  user2_id: string;
  status: string;
  initiated_by: string;
  blocked_by: string | null;
  updated_at: string;
};
