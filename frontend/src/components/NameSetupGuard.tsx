"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useUser } from "@/hooks/useAuth";

const EXEMPT_PATHS = ["/auth/setup", "/auth/login", "/auth/signup", "/terms", "/privacy"];

export function NameSetupGuard() {
  const { user, isAuthenticated } = useAuthStore();
  const { isLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      user?.name === "York User" &&
      !EXEMPT_PATHS.some((p) => pathname.startsWith(p))
    ) {
      router.replace("/auth/setup");
    }
  }, [isLoading, isAuthenticated, user, pathname, router]);

  return null;
}
