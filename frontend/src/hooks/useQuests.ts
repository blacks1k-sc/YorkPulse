"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { QuestCategory, VibeLevel, QuestStatus } from "@/types";

interface QuestParams {
  category?: QuestCategory;
  status?: QuestStatus;
  vibe_level?: VibeLevel;
  date_from?: string;
  date_to?: string;
  sort_by?: "newest" | "starting_soon" | "most_spots";
  per_page?: number;
}

export function useQuests(params?: QuestParams) {
  return useInfiniteQuery({
    queryKey: ["quests", "list", params],
    queryFn: ({ pageParam = 1 }) =>
      api.quests.getQuests({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.page || 1) + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useQuest(id: string) {
  return useQuery({
    queryKey: ["quests", "detail", id],
    queryFn: () => api.quests.getQuest(id),
    enabled: !!id,
  });
}

export function useMyQuests(role?: "host" | "participant" | "pending" | "all") {
  return useInfiniteQuery({
    queryKey: ["quests", "my-quests", role],
    queryFn: ({ pageParam = 1 }) => api.quests.getMyQuests({ role, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.page || 1) + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useCreateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
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
    }) => api.quests.createQuest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "my-quests"] });
    },
  });
}

export function useUpdateQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
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
      }>;
    }) => api.quests.updateQuest(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["quests", "my-quests"] });
    },
  });
}

export function useDeleteQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.quests.deleteQuest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "my-quests"] });
    },
  });
}

export function useCompleteQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.quests.completeQuest(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["quests", "my-quests"] });
    },
  });
}

export function useJoinQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      api.quests.joinQuest(id, message),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["quests", "participants", id] });
      queryClient.invalidateQueries({ queryKey: ["quests", "my-quests"] });
    },
  });
}

export function useLeaveQuest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.quests.leaveQuest(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["quests", "participants", id] });
      queryClient.invalidateQueries({ queryKey: ["quests", "my-quests"] });
    },
  });
}

export function useQuestParticipants(id: string) {
  return useQuery({
    queryKey: ["quests", "participants", id],
    queryFn: () => api.quests.getParticipants(id),
    enabled: !!id,
  });
}

export function useApproveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questId,
      participantId,
      action,
    }: {
      questId: string;
      participantId: string;
      action: "accept" | "reject";
    }) => api.quests.approveParticipant(questId, participantId, action),
    onSuccess: (_, { questId }) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "participants", questId] });
      queryClient.invalidateQueries({ queryKey: ["quests", "detail", questId] });
    },
  });
}

export function useRemoveParticipant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      questId,
      userId,
    }: {
      questId: string;
      userId: string;
    }) => api.quests.removeParticipant(questId, userId),
    onSuccess: (_, { questId }) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "list"] });
      queryClient.invalidateQueries({ queryKey: ["quests", "participants", questId] });
      queryClient.invalidateQueries({ queryKey: ["quests", "detail", questId] });
    },
  });
}

// Quest Group Chat hooks
export function useQuestMessages(questId: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["quests", "messages", questId],
    queryFn: ({ pageParam }) =>
      api.quests.getQuestMessages(questId, { before: pageParam, limit: 50 }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.has_more || lastPage.messages.length === 0) return undefined;
      return lastPage.messages[lastPage.messages.length - 1].id;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!questId && enabled,
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });
}

export function useSendQuestMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questId, content, replyToId }: { questId: string; content: string; replyToId?: string }) =>
      api.quests.sendQuestMessage(questId, content, replyToId),
    onSuccess: (_, { questId }) => {
      queryClient.invalidateQueries({ queryKey: ["quests", "messages", questId] });
    },
  });
}

// Legacy exports for backwards compatibility
export {
  useQuests as useBuddyRequests,
  useQuest as useBuddyRequest,
  useCreateQuest as useCreateBuddyRequest,
  useUpdateQuest as useUpdateBuddyRequest,
  useDeleteQuest as useDeleteBuddyRequest,
  useJoinQuest as useJoinBuddyRequest,
  useLeaveQuest as useLeaveBuddyRequest,
  useQuestParticipants as useBuddyParticipants,
};
