"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { GigType, GigCategory, GigLocation, GigPriceType, GigStatus } from "@/types";

interface GigFilters {
  gig_type?: GigType;
  category?: GigCategory;
  min_price?: number;
  max_price?: number;
  location?: GigLocation;
  search?: string;
  sort?: "recent" | "price_low" | "price_high" | "highest_rated";
  per_page?: number;
}

export function useGigs(filters?: GigFilters) {
  return useInfiniteQuery({
    queryKey: ["gigs", "list", filters],
    queryFn: ({ pageParam = 1 }) =>
      api.gigs.getGigs({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.page || 1) + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useGig(id: string) {
  return useQuery({
    queryKey: ["gigs", "detail", id],
    queryFn: () => api.gigs.getGig(id),
    enabled: !!id,
  });
}

export function useCreateGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      gig_type: GigType;
      category: GigCategory;
      title: string;
      description: string;
      price_min?: number;
      price_max?: number;
      price_type?: GigPriceType;
      location?: GigLocation;
      location_details?: string;
      deadline?: string;
    }) => api.gigs.createGig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "list"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "my-gigs"] });
    },
  });
}

export function useUpdateGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        title: string;
        description: string;
        price_min: number;
        price_max: number;
        price_type: GigPriceType;
        location: GigLocation;
        location_details: string;
        deadline: string;
        status: GigStatus;
      }>;
    }) => api.gigs.updateGig(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "list"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "my-gigs"] });
    },
  });
}

export function useDeleteGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.gigs.deleteGig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "list"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "my-gigs"] });
    },
  });
}

export function useRespondToGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      gigId,
      message,
      proposed_price,
    }: {
      gigId: string;
      message?: string;
      proposed_price?: number;
    }) => api.gigs.respondToGig(gigId, { message, proposed_price }),
    onSuccess: (_, { gigId }) => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "detail", gigId] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "responses", gigId] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "my-gigs"] });
    },
  });
}

export function useGigResponses(gigId: string) {
  return useQuery({
    queryKey: ["gigs", "responses", gigId],
    queryFn: () => api.gigs.getResponses(gigId),
    enabled: !!gigId,
  });
}

export function useAcceptResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gigId, responseId }: { gigId: string; responseId: string }) =>
      api.gigs.acceptResponse(gigId, responseId),
    onSuccess: (_, { gigId }) => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "list"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "detail", gigId] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "responses", gigId] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "my-gigs"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "transactions"] });
    },
  });
}

export function useRejectResponse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ gigId, responseId }: { gigId: string; responseId: string }) =>
      api.gigs.rejectResponse(gigId, responseId),
    onSuccess: (_, { gigId }) => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "responses", gigId] });
    },
  });
}

export function useCompleteGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gigId: string) => api.gigs.completeGig(gigId),
    onSuccess: (_, gigId) => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "list"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "detail", gigId] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "my-gigs"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "transactions"] });
    },
  });
}

export function useRateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      data,
    }: {
      transactionId: string;
      data: {
        rating: number;
        reliability: number;
        communication: number;
        quality: number;
        review_text?: string;
      };
    }) => api.gigs.rateTransaction(transactionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gigs", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["gigs", "profile"] });
    },
  });
}

export function useMyGigs(type?: "posted" | "responded" | "all") {
  return useQuery({
    queryKey: ["gigs", "my-gigs", type],
    queryFn: () => api.gigs.getMyGigs(type),
  });
}

export function useGigProfile(userId: string) {
  return useQuery({
    queryKey: ["gigs", "profile", userId],
    queryFn: () => api.gigs.getUserGigProfile(userId),
    enabled: !!userId,
  });
}

export function useGigTransactions(status?: "pending" | "completed" | "disputed") {
  return useInfiniteQuery({
    queryKey: ["gigs", "transactions", status],
    queryFn: ({ pageParam = 1 }) =>
      api.gigs.getTransactions({ status, page: pageParam }),
    getNextPageParam: (lastPage) => {
      return lastPage.has_more ? (lastPage.page || 1) + 1 : undefined;
    },
    initialPageParam: 1,
  });
}
