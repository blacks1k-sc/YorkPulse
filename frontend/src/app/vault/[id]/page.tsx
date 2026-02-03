"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Shield,
  User,
  Clock,
  MessageCircle,
  Flag,
  Send,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useVaultPost,
  useVaultComments,
  useCreateVaultComment,
  useDeleteVaultPost,
  useFlagVaultPost,
} from "@/hooks/useVault";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const categories = [
  { value: "academics", label: "Academics" },
  { value: "social", label: "Social" },
  { value: "housing", label: "Housing" },
  { value: "safety", label: "Safety" },
  { value: "mental_health", label: "Mental Health" },
  { value: "general", label: "General" },
];

export default function VaultPostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [comment, setComment] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);

  const { data: post, isLoading: postLoading } = useVaultPost(postId);
  const { data: commentsData, isLoading: commentsLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useVaultComments(postId);
  const createCommentMutation = useCreateVaultComment();
  const deletePostMutation = useDeleteVaultPost();
  const flagPostMutation = useFlagVaultPost();

  const comments = commentsData?.pages.flatMap((page) => page.items) || [];

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        postId,
        data: { content: comment, is_anonymous: isAnonymous },
      });
      setComment("");
      toast({ title: "Comment posted" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post comment",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async () => {
    try {
      await deletePostMutation.mutateAsync(postId);
      toast({ title: "Post deleted" });
      router.push("/vault");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const handleFlagPost = async () => {
    try {
      await flagPostMutation.mutateAsync(postId);
      toast({ title: "Post flagged", description: "Thanks for helping keep the community safe" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to flag post",
        variant: "destructive",
      });
    }
  };

  if (postLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="w-24 h-8 mb-6" />
        <Skeleton className="w-full h-40 mb-6" />
        <Skeleton className="w-full h-32" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl text-center">
        <p className="text-zinc-500">Post not found</p>
        <Button variant="link" asChild>
          <Link href="/vault">Back to The Vault</Link>
        </Button>
      </div>
    );
  }

  const isAuthor = user?.id === post.author?.id;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/vault">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Post */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10 mb-6"
      >
        {/* Author & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
              {post.is_anonymous ? (
                <Shield className="w-4 h-4 text-purple-400" />
              ) : (
                <User className="w-4 h-4 text-purple-400" />
              )}
            </div>
            <div>
              <span className="text-sm font-medium">
                {post.is_anonymous ? "Anonymous" : post.author?.name || "Unknown"}
              </span>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                {timeAgo(post.created_at)}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isAuthor && (
                <DropdownMenuItem
                  onClick={handleDeletePost}
                  className="text-red-400"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete post
                </DropdownMenuItem>
              )}
              {!isAuthor && (
                <DropdownMenuItem onClick={handleFlagPost}>
                  <Flag className="w-4 h-4 mr-2" />
                  Report post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Content */}
        <h1 className="text-xl font-bold mb-3">{post.title}</h1>
        <p className="text-zinc-300 whitespace-pre-wrap mb-4">{post.content}</p>

        {/* Footer */}
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {categories.find((c) => c.value === post.category)?.label || post.category}
          </Badge>
          <div className="flex items-center gap-1 text-sm text-zinc-500">
            <MessageCircle className="w-4 h-4" />
            {post.comment_count} comments
          </div>
        </div>
      </motion.div>

      {/* Comment Form */}
      {isAuthenticated && (
        <form onSubmit={handleSubmitComment} className="mb-6">
          <Textarea
            placeholder="Write a comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-3 min-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
              />
              <Label htmlFor="anonymous" className="text-sm text-zinc-400 cursor-pointer">
                Post anonymously
              </Label>
            </div>
            <Button
              type="submit"
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={createCommentMutation.isPending || !comment.trim()}
            >
              {createCommentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Comment
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Comments */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Comments</h2>

        {commentsLoading ? (
          <div className="space-y-3">
            <Skeleton className="w-full h-20" />
            <Skeleton className="w-full h-20" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4">No comments yet. Be the first to comment!</p>
        ) : (
          <>
            {comments.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center">
                    {c.author && !c.is_anonymous ? (
                      <User className="w-3 h-3 text-zinc-500" />
                    ) : (
                      <Shield className="w-3 h-3 text-purple-400" />
                    )}
                  </div>
                  <span className="text-sm text-zinc-400">
                    {c.is_anonymous ? "Anonymous" : c.author?.name || "Unknown"}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">{c.content}</p>
              </motion.div>
            ))}

            {hasNextPage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Load more comments"
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
