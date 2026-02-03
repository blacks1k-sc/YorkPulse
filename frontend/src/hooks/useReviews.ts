"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function useUserReviews(userId: string, reviewType?: string) {
  return useInfiniteQuery({
    queryKey: ["reviews", "user", userId, reviewType],
    queryFn: ({ pageParam = 1 }) =>
      api.reviews.getUserReviews(userId, { review_type: reviewType, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!userId,
  });
}

export function useUserRatingSummary(userId: string) {
  return useQuery({
    queryKey: ["reviews", "summary", userId],
    queryFn: () => api.reviews.getUserRatingSummary(userId),
    enabled: !!userId,
  });
}

export function useMyReviews(direction: "given" | "received") {
  return useInfiniteQuery({
    queryKey: ["reviews", "my-reviews", direction],
    queryFn: ({ pageParam = 1 }) => api.reviews.getMyReviews(direction, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      reviewed_id: string;
      rating: number;
      comment?: string;
      review_type: "marketplace" | "buddy";
      reference_id?: string;
    }) => api.reviews.createReview(data),
    onSuccess: (_, { reviewed_id }) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", "user", reviewed_id] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "summary", reviewed_id] });
      queryClient.invalidateQueries({ queryKey: ["reviews", "my-reviews"] });
    },
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.reviews.deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
