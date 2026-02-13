"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, ShoppingBag, Users, MessageCircle, GraduationCap } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/vault", label: "Vault", icon: Shield },
  { href: "/marketplace", label: "Market", icon: ShoppingBag },
  { href: "/quests", label: "Quests", icon: Users },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/messages", label: "DMs", icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  // Don't show on auth pages or when not authenticated
  if (!isAuthenticated || pathname.startsWith("/auth")) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden glass border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive ? "text-purple-400" : "text-zinc-500"
              )}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {isActive && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-purple-400"
                  />
                )}
              </div>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
