"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShoppingBag,
  Users,
  MessageCircle,
  GraduationCap,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lock,
  Zap,
  MapPin,
  Lion,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

// Landing page features (for non-authenticated users)
const landingFeatures = [
  {
    href: "/vault",
    icon: Shield,
    title: "The Vault",
    description: "Anonymous discussions. No tracking, no judgment.",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    hoverBorder: "hover:border-purple-500/50",
    hoverGlow: "hover:shadow-purple-500/20",
  },
  {
    href: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy and sell with verified students only.",
    iconBg: "bg-coral/10",
    iconColor: "text-coral",
    hoverBorder: "hover:border-coral/50",
    hoverGlow: "hover:shadow-coral/20",
  },
  {
    href: "/quests",
    icon: Users,
    title: "Side Quests",
    description: "Find gym partners, study buddies, and more.",
    iconBg: "bg-green-500/10",
    iconColor: "text-green-500",
    hoverBorder: "hover:border-green-500/50",
    hoverGlow: "hover:shadow-green-500/20",
  },
  {
    href: "/messages",
    icon: MessageCircle,
    title: "Messaging",
    description: "Request-based DMs. You control who can reach you.",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    hoverBorder: "hover:border-blue-500/50",
    hoverGlow: "hover:shadow-blue-500/20",
  },
];

// Dashboard features (for authenticated users)
const dashboardFeatures = [
  {
    href: "/vault",
    icon: Shield,
    emoji: "🔒",
    title: "The Vault",
    description:
      "Share thoughts anonymously with the York community. Vent, confess, ask questions, or discuss sensitive topics without judgment. Your identity stays protected.",
    gradient: "from-purple-500/20 to-purple-600/10",
    borderColor: "border-purple-500/30",
    hoverBorder: "hover:border-purple-500/60",
    iconColor: "text-purple-400",
    statKey: "vault_posts_today" as const,
    statLabel: "posts today",
  },
  {
    href: "/marketplace",
    icon: ShoppingBag,
    emoji: "🛍️",
    title: "Marketplace",
    description:
      "Buy and sell textbooks, furniture, electronics, and more with fellow students. Find deals on campus essentials and declutter your dorm.",
    gradient: "from-orange-500/20 to-red-500/10",
    borderColor: "border-orange-500/30",
    hoverBorder: "hover:border-orange-500/60",
    iconColor: "text-orange-400",
    statKey: "marketplace_listings" as const,
    statLabel: "active listings",
  },
  {
    href: "/quests",
    icon: Users,
    emoji: "🎯",
    title: "Side Quests",
    description:
      "Find activity buddies for gym sessions, study groups, coffee meetups, or campus events. Never do things alone again.",
    gradient: "from-green-500/20 to-emerald-500/10",
    borderColor: "border-green-500/30",
    hoverBorder: "hover:border-green-500/60",
    iconColor: "text-green-400",
    statKey: "side_quests_active" as const,
    statLabel: "active quests",
  },
  {
    href: "/courses",
    icon: GraduationCap,
    emoji: "💬",
    title: "Course Chat",
    description:
      "Join course-specific chat rooms to ask questions, share notes, form study groups, and connect with classmates. Organized by faculty and program.",
    gradient: "from-blue-500/20 to-cyan-500/10",
    borderColor: "border-blue-500/30",
    hoverBorder: "hover:border-blue-500/60",
    iconColor: "text-blue-400",
    statKey: "total_courses" as const,
    statLabel: "courses available",
  },
  {
    href: "/messages",
    icon: MessageCircle,
    emoji: "✉️",
    title: "Messages",
    description:
      "Direct message other students securely. Stay connected with your York community through private conversations.",
    gradient: "from-pink-500/20 to-rose-500/10",
    borderColor: "border-pink-500/30",
    hoverBorder: "hover:border-pink-500/60",
    iconColor: "text-pink-400",
    statKey: "total_users" as const,
    statLabel: "active users",
  },
];

const comingSoonFeatures = [
  {
    emoji: "💰",
    title: "CashFlow",
    description: "Group buying & quick gigs",
  },
  {
    emoji: "📍",
    title: "Vibe Check",
    description: "Social availability status",
  },
  {
    emoji: "🦁",
    title: "Lion Signals",
    description: "Live campus updates",
  },
];

const quickStartSteps = [
  {
    step: 1,
    title: "Complete your profile",
    description: "Add your interests, program, and a bio to connect with like-minded students",
    href: "/profile",
  },
  {
    step: 2,
    title: "Join your courses",
    description: "Find your classes in Course Chat and join the conversation",
    href: "/courses",
  },
  {
    step: 3,
    title: "Browse the Marketplace",
    description: "Check out textbooks, electronics, and campus essentials for sale",
    href: "/marketplace",
  },
  {
    step: 4,
    title: "Post in The Vault",
    description: "Share thoughts, ask questions, or just vent anonymously",
    href: "/vault",
  },
  {
    step: 5,
    title: "Find activity buddies",
    description: "Create or join Side Quests for gym, study, or hangouts",
    href: "/quests",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

// Feature Card Component
function FeatureCard({
  feature,
  stats,
}: {
  feature: (typeof dashboardFeatures)[0];
  stats?: {
    marketplace_listings: number;
    side_quests_active: number;
    total_courses: number;
    vault_posts_today: number;
    total_users: number;
  };
}) {
  const statValue = stats?.[feature.statKey];

  return (
    <Link href={feature.href}>
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "group relative overflow-hidden rounded-2xl p-6 cursor-pointer transition-all duration-300",
          "bg-white/[0.03] backdrop-blur-sm",
          "border border-white/10",
          feature.hoverBorder,
          "hover:shadow-xl hover:shadow-black/20"
        )}
      >
        {/* Gradient background */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            `bg-gradient-to-br ${feature.gradient}`
          )}
        />

        {/* Content */}
        <div className="relative">
          {/* Icon + Emoji */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center",
                "bg-white/5 group-hover:bg-white/10 transition-colors"
              )}
            >
              <span className="text-2xl">{feature.emoji}</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
              {statValue !== undefined && (
                <p className="text-xs text-zinc-500">
                  {statValue.toLocaleString()} {feature.statLabel}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            {feature.description}
          </p>

          {/* CTA */}
          <div className="flex items-center gap-2 text-sm font-medium text-[#00ff88] group-hover:gap-3 transition-all">
            <span>Explore</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// Quick Start Guide Component
function QuickStartGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <span className="font-medium">New to YorkPulse? Here's how to get started</span>
        </div>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-zinc-500 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10"
          >
            <div className="p-6 space-y-4">
              {quickStartSteps.map((step, index) => (
                <Link key={step.step} href={step.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#00ff88]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-[#00ff88]">{step.step}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-white group-hover:text-[#00ff88] transition-colors">
                        {step.title}
                      </h4>
                      <p className="text-sm text-zinc-500 mt-0.5">{step.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-[#00ff88] transition-colors mt-1" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Safety Banner Component
function SafetyBanner() {
  return (
    <div className="flex items-center justify-center gap-3 text-sm text-zinc-500 py-8">
      <Lock className="w-4 h-4" />
      <span>
        Your privacy matters. Anonymous posts stay anonymous.{" "}
        <Link href="/privacy" className="text-zinc-400 hover:text-white underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
      </span>
    </div>
  );
}

// Dashboard View (for authenticated users)
function DashboardView() {
  const { user } = useAuthStore();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.getStats(),
    staleTime: 60000, // Cache for 1 minute
  });

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-3">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-purple-400 to-[#00ff88] bg-clip-text text-transparent">
              {firstName}
            </span>
          </h1>
          <p className="text-zinc-400 text-lg">
            Your all-in-one York University community platform
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8"
        >
          {dashboardFeatures.map((feature) => (
            <motion.div key={feature.href} variants={itemVariants}>
              <FeatureCard feature={feature} stats={stats} />
            </motion.div>
          ))}
        </motion.div>

        {/* Coming Soon Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-sm font-medium text-zinc-500 mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Coming Soon
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {comingSoonFeatures.map((feature) => (
              <div
                key={feature.title}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center opacity-60"
              >
                <span className="text-2xl">{feature.emoji}</span>
                <h3 className="font-medium text-sm mt-2">{feature.title}</h3>
                <p className="text-xs text-zinc-600 mt-1">{feature.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Start Guide */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <QuickStartGuide />
        </motion.div>

        {/* Safety Banner */}
        <SafetyBanner />
      </div>
    </main>
  );
}

// Landing View (for non-authenticated users)
function LandingView() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 gradient-mesh" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-8 flex justify-center"
            >
              <div className="gradient-purple rounded-2xl p-4">
                <span className="text-4xl font-bold text-white">YP</span>
              </div>
            </motion.div>

            {/* Title */}
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Your Campus.{" "}
              <span className="bg-gradient-to-r from-purple-500 to-coral bg-clip-text text-transparent">
                Your Community.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-lg leading-8 text-muted-foreground">
              YorkPulse is the exclusive platform for York University students.
              Connect, trade, and build lasting friendships in a safe, verified community.
            </p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-10 flex items-center justify-center gap-x-6"
            >
              <Link
                href="/auth/signup"
                className="gradient-purple rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 hover:scale-105"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="glass rounded-xl px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-white/10"
              >
                Sign In
              </Link>
            </motion.div>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto mt-20 max-w-5xl"
          >
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {landingFeatures.map((feature) => (
                <motion.div key={feature.href} variants={itemVariants}>
                  <Link href={feature.href}>
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`glass-card p-6 cursor-pointer transition-all duration-300 border border-white/10 ${feature.hoverBorder} ${feature.hoverGlow} hover:shadow-lg`}
                    >
                      <div className={`mb-4 inline-flex rounded-lg ${feature.iconBg} p-3`}>
                        <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                      </div>
                      <h3 className="font-semibold text-foreground">{feature.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </motion.div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Trust Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mx-auto mt-16 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Verified with{" "}
              <span className="font-semibold text-foreground">@yorku.ca</span> or{" "}
              <span className="font-semibold text-foreground">@my.yorku.ca</span> email
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

// Main Page Component
export default function Home() {
  const { isAuthenticated, isHydrated, setHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted on the client
  useEffect(() => {
    setMounted(true);

    // Fallback: if not hydrated after a short delay, force hydration
    // This handles cases where onRehydrateStorage doesn't fire
    const timeout = setTimeout(() => {
      if (!useAuthStore.getState().isHydrated) {
        setHydrated();
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [setHydrated]);

  // Show loading state until both mounted and hydrated
  if (!mounted || !isHydrated) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-purple-500/20" />
        </div>
      </main>
    );
  }

  return isAuthenticated ? <DashboardView /> : <LandingView />;
}
