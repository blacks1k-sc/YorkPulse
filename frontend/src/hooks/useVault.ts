"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

interface VaultPostsParams {
  category?: string;
  per_page?: number;
}

export function useVaultPosts(params?: VaultPostsParams) {
  return useInfiniteQuery({
    queryKey: ["vault", "posts", params],
    queryFn: ({ pageParam = 1 }) =>
      api.vault.getPosts({ ...params, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useVaultPost(id: string) {
  return useQuery({
    queryKey: ["vault", "post", id],
    queryFn: () => api.vault.getPost(id),
    enabled: !!id,
  });
}

export function useCreateVaultPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; content: string; category: string; is_anonymous: boolean }) =>
      api.vault.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault", "posts"] });
    },
  });
}

export function useUpdateVaultPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string; category?: string } }) =>
      api.vault.updatePost(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["vault", "posts"] });
      queryClient.invalidateQueries({ queryKey: ["vault", "post", id] });
    },
  });
}

export function useDeleteVaultPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.vault.deletePost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vault", "posts"] });
    },
  });
}

export function useFlagVaultPost() {
  return useMutation({
    mutationFn: (id: string) => api.vault.flagPost(id),
  });
}

export function useVaultComments(postId: string) {
  return useInfiniteQuery({
    queryKey: ["vault", "comments", postId],
    queryFn: ({ pageParam = 1 }) => api.vault.getComments(postId, pageParam),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: !!postId,
  });
}

export function useCreateVaultComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, data }: { postId: string; data: { content: string; is_anonymous: boolean } }) =>
      api.vault.createComment(postId, data),
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["vault", "comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["vault", "post", postId] });
    },
  });
}

export function useDeleteVaultComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, commentId }: { postId: string; commentId: string }) =>
      api.vault.deleteComment(postId, commentId),
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["vault", "comments", postId] });
    },
  });
}
