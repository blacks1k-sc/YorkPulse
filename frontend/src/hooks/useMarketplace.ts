"use client";

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

interface MarketplaceParams {
  category?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  per_page?: number;
}

export function useMarketplaceListings(params?: MarketplaceParams) {
  return useInfiniteQuery({
    queryKey: ["marketplace", "listings", params],
    queryFn: ({ pageParam = 1 }) =>
      api.marketplace.getListings({ ...params, page: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useMarketplaceListing(id: string) {
  return useQuery({
    queryKey: ["marketplace", "listing", id],
    queryFn: () => api.marketplace.getListing(id),
    enabled: !!id,
  });
}

export function useMyListings() {
  return useInfiniteQuery({
    queryKey: ["marketplace", "my-listings"],
    queryFn: ({ pageParam = 1 }) => api.marketplace.getMyListings(pageParam),
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return totalFetched < lastPage.total ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description: string;
      price: number;
      category: string;
      condition: string;
      images?: string[];
    }) => api.marketplace.createListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "listings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "my-listings"] });
    },
  });
}

export function useUpdateListing() {
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
        price: number;
        category: string;
        condition: string;
        status: string;
      }>;
    }) => api.marketplace.updateListing(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "listings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "listing", id] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "my-listings"] });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.marketplace.deleteListing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace", "listings"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace", "my-listings"] });
    },
  });
}
