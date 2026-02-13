"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Menu,
  X,
  Shield,
  ShoppingBag,
  Users,
  MessageCircle,
  User,
  LogOut,
  Plus,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/vault", label: "The Vault", icon: Shield },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/quests", label: "Side Quests", icon: Users },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, openCreateModal } = useUIStore();
  const logout = useLogout();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2" onClick={closeMobileMenu}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-coral-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">YP</span>
            </div>
            <span className="font-semibold text-lg hidden sm:block">YorkPulse</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                    isActive
                      ? "bg-purple-500/20 text-purple-400"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* Create Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="hidden sm:flex gap-2 bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4" />
                      Create
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openCreateModal("vault")}>
                      <Shield className="w-4 h-4 mr-2" />
                      Vault Post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openCreateModal("marketplace")}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Listing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openCreateModal("quest")}>
                      <Users className="w-4 h-4 mr-2" />
                      Side Quest
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user?.avatar_url || undefined} />
                        <AvatarFallback className="bg-purple-500/20 text-purple-400 text-xs">
                          {user?.name ? getInitials(user.name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="font-medium">{user?.name || "User"}</p>
                      <p className="text-xs text-zinc-500">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-400">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" asChild>
                  <Link href="/auth/signup">Get Started</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden glass border-t border-white/10"
        >
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                    isActive
                      ? "bg-purple-500/20 text-purple-400"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </motion.div>
      )}
    </header>
  );
}
