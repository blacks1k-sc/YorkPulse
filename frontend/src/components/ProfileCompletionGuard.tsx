"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { useUser } from "@/hooks/useAuth";

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
}

// Pages that don't require profile completion
const EXEMPT_PATHS = [
  "/auth",
  "/auth/login",
  "/auth/signup",
  "/auth/setup-profile",
  "/auth/complete-profile",
];

// Check if path is exempt from profile completion requirement
function isExemptPath(pathname: string): boolean {
  return EXEMPT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );
}

// Check if profile is complete (has program and bio)
function isProfileComplete(user: { program?: string | null; bio?: string | null } | null): boolean {
  if (!user) return true; // Not logged in, no check needed
  return Boolean(user.program && user.bio);
}

export function ProfileCompletionGuard({ children }: ProfileCompletionGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const { data: user, isLoading } = useUser();

  useEffect(() => {
    // Wait for hydration and user data to load
    if (!isHydrated || isLoading) return;

    // Only check for authenticated users
    if (!isAuthenticated) return;

    // Don't redirect on exempt paths
    if (isExemptPath(pathname)) return;

    // Check if profile is incomplete
    if (user && !isProfileComplete(user)) {
      router.replace("/auth/complete-profile");
    }
  }, [isHydrated, isAuthenticated, isLoading, user, pathname, router]);

  // Show children as normal - redirection happens via effect
  return <>{children}</>;
}
