"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase, type RealtimeMessagePayload } from "@/lib/supabase";
import type { Message } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleNewMessage = useCallback(
    (payload: { new: RealtimeMessagePayload }) => {
      const newMessage: Message = {
        id: payload.new.id,
        conversation_id: payload.new.conversation_id,
        sender_id: payload.new.sender_id,
        content: payload.new.content,
        is_deleted: payload.new.is_deleted,
        is_read: payload.new.read_at !== null,
        read_at: payload.new.read_at,
        created_at: payload.new.created_at,
      };

      // Optimistically add the message to the cache
      queryClient.setQueryData(
        ["messaging", "messages", conversationId],
        (oldData: { pages: { messages: Message[]; has_more: boolean }[] } | undefined) => {
          if (!oldData) return oldData;

          // Check if message already exists
          const messageExists = oldData.pages.some((page) =>
            page.messages.some((m) => m.id === newMessage.id)
          );

          if (messageExists) return oldData;

          // Add to the first page (most recent messages)
          const newPages = [...oldData.pages];
          if (newPages.length > 0) {
            newPages[0] = {
              ...newPages[0],
              messages: [...newPages[0].messages, newMessage],
            };
          }

          return { ...oldData, pages: newPages };
        }
      );

      // Also invalidate conversations list to update last_message
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", conversationId] });
    },
    [conversationId, queryClient]
  );

  useEffect(() => {
    if (!conversationId) return;

    const supabase = getSupabase();
    if (!supabase) return; // Supabase not configured

    // Subscribe to new messages for this conversation
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleNewMessage
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Refetch to get updated read status
          queryClient.invalidateQueries({ queryKey: ["messaging", "messages", conversationId] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, handleNewMessage, queryClient]);
}

export function useRealtimeConversations(userId: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabase();
    if (!supabase) return; // Supabase not configured

    // Subscribe to conversation updates
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          const conv = payload.new as { user1_id: string; user2_id: string } | undefined;

          // Only process if user is part of this conversation
          if (conv && (conv.user1_id === userId || conv.user2_id === userId)) {
            queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
            queryClient.invalidateQueries({ queryKey: ["messaging", "pending-requests"] });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          // New message arrived, refresh conversation list
          queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
          queryClient.invalidateQueries({ queryKey: ["messaging", "pending-requests"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, queryClient]);
}
