"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { CreateModal } from "@/components/modals/CreateModal";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";

function AuthInitializer() {
  const { setLoading, _hasHydrated } = useAuthStore();

  useEffect(() => {
    // Connect auth store to API client
    api.setTokenGetter(() => useAuthStore.getState().accessToken);
    api.setUnauthorizedHandler(() => {
      useAuthStore.getState().logout();
    });
  }, []);

  useEffect(() => {
    // Mark loading as complete only after hydration is done
    if (_hasHydrated) {
      setLoading(false);
    }
  }, [_hasHydrated, setLoading]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 401 or 403
              if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
      <CreateModal />
      <FloatingActionButton />
      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
