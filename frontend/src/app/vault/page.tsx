"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Plus,
  Filter,
  MessageCircle,
  Flag,
  User,
  Clock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVaultPosts } from "@/hooks/useVault";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { VaultPost } from "@/types";

const categories = [
  { value: "all", label: "All Posts" },
  { value: "academics", label: "Academics" },
  { value: "social", label: "Social" },
  { value: "housing", label: "Housing" },
  { value: "safety", label: "Safety" },
  { value: "mental_health", label: "Mental Health" },
  { value: "general", label: "General" },
];

function PostCard({ post }: { post: VaultPost }) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/vault/${post.id}`}>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-colors">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Author & Time */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                  {post.is_anonymous ? (
                    <Shield className="w-3 h-3 text-purple-400" />
                  ) : (
                    <User className="w-3 h-3 text-purple-400" />
                  )}
                </div>
                <span className="text-sm text-zinc-400">
                  {post.is_anonymous ? "Anonymous" : post.author?.name || "Unknown"}
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(post.created_at)}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-semibold mb-1 line-clamp-2">{post.title}</h3>

              {/* Content Preview */}
              <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
                {post.content}
              </p>

              {/* Footer */}
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-xs">
                  {categories.find((c) => c.value === post.category)?.label || post.category}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <MessageCircle className="w-3 h-3" />
                  {post.comment_count}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PostSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-24 h-4" />
      </div>
      <Skeleton className="w-3/4 h-5 mb-2" />
      <Skeleton className="w-full h-4 mb-1" />
      <Skeleton className="w-2/3 h-4 mb-3" />
      <Skeleton className="w-20 h-5 rounded-full" />
    </div>
  );
}

export default function VaultPage() {
  const [category, setCategory] = useState<string>("all");
  const { openCreateModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useVaultPosts({
      category: category === "all" ? undefined : category,
      per_page: 20,
    });

  const posts = data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">The Vault</h1>
            <p className="text-sm text-zinc-500">Anonymous community forum</p>
          </div>
        </div>
        {isAuthenticated && (
          <Button
            onClick={() => openCreateModal("vault")}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Post
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Filter className="w-4 h-4 text-zinc-500" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
            <p className="text-zinc-500">No posts yet</p>
            {isAuthenticated && (
              <Button
                onClick={() => openCreateModal("vault")}
                variant="link"
                className="text-purple-400"
              >
                Be the first to post
              </Button>
            )}
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {hasNextPage && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
