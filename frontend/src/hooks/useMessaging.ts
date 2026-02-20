"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Conversation } from "@/types";

export function useConversations() {
  return useInfiniteQuery({
    queryKey: ["messaging", "conversations"],
    queryFn: ({ pageParam = 1 }) => api.messaging.getConversations(pageParam),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: ["messaging", "conversation", id],
    queryFn: () => api.messaging.getConversation(id),
    enabled: !!id,
  });
}

export function usePendingRequests() {
  return useQuery({
    queryKey: ["messaging", "pending-requests"],
    queryFn: () => api.messaging.getPendingRequests(),
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      recipient_id: string;
      initial_message: string;
      context_type?: "marketplace" | "buddy" | "profile";
      context_id?: string;
    }) => api.messaging.startConversation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
    },
  });
}

export function useAcceptConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.messaging.acceptConversation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", id] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "pending-requests"] });
    },
  });
}

export function useDeclineConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.messaging.declineConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "pending-requests"] });
    },
  });
}

export function useBlockConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.messaging.blockConversation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", id] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "pending-requests"] });
    },
  });
}

export function useUnblockConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.messaging.unblockConversation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", id] });
    },
  });
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: ["messaging", "messages", conversationId],
    queryFn: ({ pageParam }) =>
      api.messaging.getMessages(conversationId, { before: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) =>
      lastPage.has_more && lastPage.messages.length > 0
        ? lastPage.messages[0].id // Get the oldest message ID for cursor
        : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      conversationId,
      content,
      imageUrl,
      replyToId,
    }: {
      conversationId: string;
      content?: string;
      imageUrl?: string;
      replyToId?: string;
    }) => api.messaging.sendMessage(conversationId, content, imageUrl, replyToId),
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", conversationId] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => api.messaging.markAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
    },
  });
}
