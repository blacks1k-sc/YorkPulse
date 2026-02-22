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
  Sparkles,
  Lock,
  Zap,
  MapPin,
  ArrowRight,
  CheckCircle2,
  MessageSquarePlus,
  Bug,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  Send,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
    title: "The Vault",
    subtitle: "Anonymous Forum",
    description: "Share thoughts anonymously. Vent, confess, or discuss sensitive topics without judgment.",
    accentColor: "purple",
    statKey: "vault_posts_today" as const,
    statLabel: "posts today",
  },
  {
    href: "/marketplace",
    icon: ShoppingBag,
    title: "Marketplace",
    subtitle: "Buy & Sell",
    description: "Trade textbooks, furniture, and electronics with verified York students.",
    accentColor: "orange",
    statKey: "marketplace_listings" as const,
    statLabel: "active listings",
  },
  {
    href: "/quests",
    icon: Users,
    title: "Side Quests",
    subtitle: "Find Partners",
    description: "Connect for gym sessions, study groups, coffee meetups, or campus events.",
    accentColor: "emerald",
    statKey: "side_quests_active" as const,
    statLabel: "active quests",
  },
  {
    href: "/courses",
    icon: GraduationCap,
    title: "Course Chat",
    subtitle: "Class Discussions",
    description: "Join course-specific rooms to ask questions and form study groups.",
    accentColor: "blue",
    statKey: "total_courses" as const,
    statLabel: "courses",
  },
  {
    href: "/messages",
    icon: MessageCircle,
    title: "Messages",
    subtitle: "Direct Messages",
    description: "Private conversations with other students in your York community.",
    accentColor: "pink",
    statKey: "total_users" as const,
    statLabel: "students",
  },
];

const comingSoonFeatures = [
  {
    icon: Sparkles,
    title: "Events",
    description: "Discover campus happenings",
  },
];

const quickStartSteps = [
  {
    step: 1,
    title: "Complete your profile",
    description: "Add interests and bio",
    href: "/profile",
  },
  {
    step: 2,
    title: "Join your courses",
    description: "Find and join class chats",
    href: "/courses",
  },
  {
    step: 3,
    title: "Browse Marketplace",
    description: "Find deals on textbooks",
    href: "/marketplace",
  },
  {
    step: 4,
    title: "Post in The Vault",
    description: "Share anonymously",
    href: "/vault",
  },
  {
    step: 5,
    title: "Find activity partners",
    description: "Join or create quests",
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

// Color mappings for feature cards
const accentColors = {
  purple: {
    bg: "bg-purple-500/15",
    icon: "text-purple-400",
    gradient: "bg-gradient-to-br from-purple-900/30 via-purple-800/10 to-transparent",
    border: "border-purple-500/20",
  },
  orange: {
    bg: "bg-orange-500/15",
    icon: "text-orange-400",
    gradient: "bg-gradient-to-br from-orange-900/30 via-orange-800/10 to-transparent",
    border: "border-orange-500/20",
  },
  emerald: {
    bg: "bg-emerald-500/15",
    icon: "text-emerald-400",
    gradient: "bg-gradient-to-br from-emerald-900/30 via-emerald-800/10 to-transparent",
    border: "border-emerald-500/20",
  },
  blue: {
    bg: "bg-blue-500/15",
    icon: "text-blue-400",
    gradient: "bg-gradient-to-br from-blue-900/30 via-blue-800/10 to-transparent",
    border: "border-blue-500/20",
  },
  pink: {
    bg: "bg-pink-500/15",
    icon: "text-pink-400",
    gradient: "bg-gradient-to-br from-pink-900/30 via-pink-800/10 to-transparent",
    border: "border-pink-500/20",
  },
};

// Feature Card Component
function FeatureCard({
  feature,
  stats,
  unreadMessages,
}: {
  feature: (typeof dashboardFeatures)[0];
  stats?: {
    marketplace_listings: number;
    side_quests_active: number;
    total_courses: number;
    vault_posts_today: number;
    total_users: number;
  };
  unreadMessages?: number;
}) {
  const statValue = stats?.[feature.statKey];
  const isMessagesFeature = feature.href === "/messages";
  const colors = accentColors[feature.accentColor as keyof typeof accentColors];
  const Icon = feature.icon;

  return (
    <Link href={feature.href}>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "group relative h-full rounded-2xl p-5 cursor-pointer transition-all duration-200 overflow-hidden",
          "bg-zinc-900/90 border",
          colors.border,
          "hover:border-zinc-700"
        )}
      >
        {/* Gradient background */}
        <div className={cn("absolute inset-0", colors.gradient)} />

        {/* Content wrapper */}
        <div className="relative">
          {/* Header with icon and stats */}
          <div className="flex items-start justify-between mb-4">
            <div className={cn("p-2.5 rounded-xl", colors.bg)}>
              <Icon className={cn("w-5 h-5", colors.icon)} />
            </div>
            {statValue !== undefined && (
              <div className="text-right">
                <p className="text-xl font-bold text-white">{statValue.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">{feature.statLabel}</p>
              </div>
            )}
            {/* Unread badge for messages */}
            {isMessagesFeature && unreadMessages && unreadMessages > 0 && (
              <div className="absolute top-0 right-0 min-w-[20px] h-[20px] flex items-center justify-center px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-1 mb-3">
            <h3 className="text-base font-semibold text-white">{feature.title}</h3>
            <p className="text-xs text-zinc-500">{feature.subtitle}</p>
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            {feature.description}
          </p>

          {/* Open link */}
          <div className="flex items-center gap-1.5 text-sm text-zinc-500 group-hover:text-zinc-300 transition-colors">
            <span>Open</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-sm font-medium text-zinc-300">Getting Started Guide</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-zinc-500 transition-transform duration-200",
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
            className="border-t border-zinc-800/50"
          >
            <div className="p-4 space-y-2">
              {quickStartSteps.map((step, index) => (
                <Link key={step.step} href={step.href}>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/40 transition-colors group"
                  >
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-xs font-medium text-zinc-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors truncate">
                        {step.title}
                      </h4>
                      <p className="text-xs text-zinc-600 truncate">{step.description}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
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
    <div className="flex items-center justify-center gap-2 text-xs text-zinc-600 py-6 border-t border-zinc-800/30">
      <Lock className="w-3 h-3" />
      <span>
        Your privacy is protected.{" "}
        <Link href="/privacy" className="text-zinc-500 hover:text-zinc-400 underline-offset-2 hover:underline">
          Learn more
        </Link>
      </span>
    </div>
  );
}

// Feedback types with icons
const feedbackTypes = [
  { value: "suggestion" as const, label: "Suggestion", icon: Lightbulb, color: "text-yellow-400" },
  { value: "bug" as const, label: "Bug Report", icon: Bug, color: "text-red-400" },
  { value: "problem" as const, label: "Problem", icon: AlertCircle, color: "text-orange-400" },
  { value: "other" as const, label: "Other", icon: HelpCircle, color: "text-blue-400" },
];

// Feedback Form Component
function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"suggestion" | "bug" | "problem" | "other">("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const submitMutation = useMutation({
    mutationFn: () => api.feedback.submit({ type, subject, message }),
    onSuccess: (data) => {
      toast({
        title: "Feedback Submitted",
        description: data.message,
      });
      setSubject("");
      setMessage("");
      setType("suggestion");
      setIsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback",
        variant: "destructive",
      });
    },
  });

  const isValid = subject.trim().length >= 5 && message.trim().length >= 20;

  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800/50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <MessageSquarePlus className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-medium text-zinc-300">Send Feedback</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-zinc-500 transition-transform duration-200",
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
            className="border-t border-zinc-800/50"
          >
            <div className="p-4 space-y-4">
              {/* Feedback Type Selection */}
              <div className="space-y-2">
                <Label className="text-xs text-zinc-500">Type</Label>
                <div className="grid grid-cols-4 gap-2">
                  {feedbackTypes.map((ft) => (
                    <button
                      key={ft.value}
                      onClick={() => setType(ft.value)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border transition-all text-xs",
                        type === ft.value
                          ? "border-purple-500/50 bg-purple-500/10 text-white"
                          : "border-zinc-800 hover:border-zinc-700 text-zinc-500"
                      )}
                    >
                      <ft.icon className={cn("w-4 h-4", type === ft.value ? ft.color : "")} />
                      <span>{ft.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-subject" className="text-xs text-zinc-500">Subject</Label>
                <Input
                  id="feedback-subject"
                  placeholder="Brief summary..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  className="h-9 text-sm bg-zinc-800/50 border-zinc-700/50 focus:border-purple-500/50"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message" className="text-xs text-zinc-500">Details</Label>
                <Textarea
                  id="feedback-message"
                  placeholder="Describe in detail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  className="min-h-[100px] text-sm bg-zinc-800/50 border-zinc-700/50 focus:border-purple-500/50 resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-zinc-600">
                  {subject.length >= 5 && message.length >= 20 ? (
                    <span className="text-emerald-500">Ready to submit</span>
                  ) : (
                    `Min: 5 char subject, 20 char message`
                  )}
                </p>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!isValid || submitMutation.isPending}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 h-8 px-3 text-xs"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Submit
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// Dashboard View (for authenticated users)
function DashboardView() {
  const { user } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => api.dashboard.getStats(),
    staleTime: 60000,
  });

  const { data: unreadMessages } = useQuery({
    queryKey: ["messages", "unread-count"],
    queryFn: () => api.messaging.getUnreadCount(),
    staleTime: 30000,
    enabled: !!user,
  });

  const firstName = user?.name?.split(" ")[0] || "there";

  // Split features into rows: first 3, then remaining 2
  const topRowFeatures = dashboardFeatures.slice(0, 3);
  const bottomRowFeatures = dashboardFeatures.slice(3);

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-semibold text-white">{firstName}</h1>
          <div className="w-12 h-1 bg-purple-500 rounded-full mt-2" />
        </motion.div>

        {/* Top Row - 3 cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-4"
        >
          {topRowFeatures.map((feature) => (
            <motion.div key={feature.href} variants={itemVariants}>
              <FeatureCard
                feature={feature}
                stats={stats}
                unreadMessages={unreadMessages?.unread_count}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Row - 2 cards centered */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto mb-12"
        >
          {bottomRowFeatures.map((feature) => (
            <motion.div key={feature.href} variants={itemVariants}>
              <FeatureCard
                feature={feature}
                stats={stats}
                unreadMessages={unreadMessages?.unread_count}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Coming Soon</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>
          <div className="flex justify-center">
            {comingSoonFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl p-6 text-center bg-zinc-900/50 border border-zinc-800/50 max-w-xs"
                >
                  <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-zinc-800/50 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-zinc-500" />
                  </div>
                  <h3 className="font-semibold text-zinc-300 mb-1">{feature.title}</h3>
                  <p className="text-sm text-zinc-500">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Collapsible Sections */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="space-y-3 mb-8"
        >
          <QuickStartGuide />
          <FeedbackForm />
        </motion.div>

        {/* Footer */}
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
