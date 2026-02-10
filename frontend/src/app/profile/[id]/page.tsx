"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  GraduationCap,
  Star,
  Shield,
  ShoppingBag,
  Users,
  MessageCircle,
  ArrowLeft,
  Calendar,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useStartConversation } from "@/hooks/useMessaging";
import { useUserReviews, useUserRatingSummary, useCreateReview } from "@/hooks/useReviews";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface PublicUser {
  id: string;
  name: string;
  name_verified: boolean;
  program: string | null;
  bio: string | null;
  avatar_url: string | null;
  interests: string[] | null;
  created_at: string | null;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const { user: currentUser, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const startConversationMutation = useStartConversation();
  const createReviewMutation = useCreateReview();

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewType, setReviewType] = useState<"marketplace" | "buddy">("buddy");
  const [hoverRating, setHoverRating] = useState(0);

  // Check if viewing own profile
  const isOwnProfile = currentUser?.id === userId;

  // Fetch public profile
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["user", "public", userId],
    queryFn: () => api.auth.getPublicProfile(userId),
    enabled: !!userId && !isOwnProfile,
  });

  // Fetch user reviews and rating summary
  const { data: ratingSummary } = useUserRatingSummary(userId);
  const { data: reviewsData } = useUserReviews(userId);
  const reviews = reviewsData?.pages.flatMap((p) => p.items) || [];

  // Redirect to own profile page if viewing self
  if (isOwnProfile) {
    router.replace("/profile");
    return null;
  }

  const handleSubmitReview = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to leave a review",
        variant: "destructive",
      });
      return;
    }

    if (reviewRating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating",
        variant: "destructive",
      });
      return;
    }

    try {
      await createReviewMutation.mutateAsync({
        reviewed_id: userId,
        rating: reviewRating,
        comment: reviewComment || undefined,
        review_type: reviewType,
      });
      toast({ title: "Review submitted!" });
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewComment("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit review",
        variant: "destructive",
      });
    }
  };

  const handleStartConversation = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to send a message",
        variant: "destructive",
      });
      return;
    }

    try {
      const conversation = await startConversationMutation.mutateAsync({
        recipient_id: userId,
        initial_message: `Hi ${profile?.name?.split(" ")[0] || "there"}! I'd like to connect with you.`,
        context_type: "profile",
      });
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  const formatJoinDate = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-24 h-24 rounded-full" />
          <div>
            <Skeleton className="w-48 h-7 mb-2" />
            <Skeleton className="w-32 h-5" />
          </div>
        </div>
        <Skeleton className="w-full h-32" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
          <User className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">User not found</h2>
        <p className="text-zinc-500 mb-6">This profile doesn't exist or has been removed</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.back()}
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10 mb-6"
      >
        <div className="flex items-start gap-4">
          <Avatar className="w-24 h-24 ring-4 ring-purple-500/20">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-3xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 text-purple-300">
              {profile.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              {profile.name_verified && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>

            {profile.program && (
              <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
                <GraduationCap className="w-4 h-4" />
                {profile.program}
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Calendar className="w-4 h-4" />
              Joined {formatJoinDate(profile.created_at)}
            </div>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-4 p-4 rounded-lg bg-white/5">
            <p className="text-zinc-300">{profile.bio}</p>
          </div>
        )}

        {/* Interests */}
        {profile.interests && profile.interests.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-zinc-500 mb-2">Interests</p>
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <Badge
                  key={interest}
                  variant="secondary"
                  className="bg-purple-500/10 text-purple-300 border border-purple-500/20"
                >
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          <Button
            onClick={handleStartConversation}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
            disabled={startConversationMutation.isPending}
          >
            {startConversationMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            Send Message
          </Button>
        </div>
      </motion.div>

      {/* Rating Summary */}
      {ratingSummary && ratingSummary.total_reviews > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Star className="w-6 h-6 fill-yellow-500 text-yellow-500" />
                <span className="text-2xl font-bold">
                  {ratingSummary.overall_rating?.toFixed(1) || "-"}
                </span>
              </div>
              <span className="text-zinc-500">
                ({ratingSummary.total_reviews} review{ratingSummary.total_reviews !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="flex gap-4 text-sm">
              {ratingSummary.buddy_count > 0 && (
                <div className="flex items-center gap-1 text-green-400">
                  <Users className="w-4 h-4" />
                  {ratingSummary.buddy_rating?.toFixed(1)} ({ratingSummary.buddy_count})
                </div>
              )}
              {ratingSummary.marketplace_count > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                  <ShoppingBag className="w-4 h-4" />
                  {ratingSummary.marketplace_rating?.toFixed(1)} ({ratingSummary.marketplace_count})
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Reviews Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Reviews
          </h2>
          {isAuthenticated && !showReviewForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReviewForm(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Leave Review
            </Button>
          )}
        </div>

        {/* Review Form */}
        {showReviewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 p-4 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Write a Review</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setShowReviewForm(false);
                  setReviewRating(0);
                  setReviewComment("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Review Type */}
            <div className="mb-4">
              <Label className="text-sm text-zinc-400 mb-2 block">Review Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={reviewType === "buddy" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewType("buddy")}
                  className={reviewType === "buddy" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <Users className="w-4 h-4 mr-1" />
                  Quest
                </Button>
                <Button
                  variant={reviewType === "marketplace" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setReviewType("marketplace")}
                  className={reviewType === "marketplace" ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  <ShoppingBag className="w-4 h-4 mr-1" />
                  Marketplace
                </Button>
              </div>
            </div>

            {/* Star Rating */}
            <div className="mb-4">
              <Label className="text-sm text-zinc-400 mb-2 block">Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "w-8 h-8 transition-colors",
                        star <= (hoverRating || reviewRating)
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-zinc-600"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="mb-4">
              <Label className="text-sm text-zinc-400 mb-2 block">Comment (optional)</Label>
              <Textarea
                placeholder="Share your experience..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmitReview}
              disabled={createReviewMutation.isPending || reviewRating === 0}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {createReviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Submit Review
            </Button>
          </motion.div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <p className="text-center text-zinc-500 py-8">No reviews yet</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-start gap-3">
                  <Link href={`/profile/${review.reviewer.id}`}>
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={review.reviewer.avatar_url || undefined} />
                      <AvatarFallback className="text-sm bg-zinc-800">
                        {review.reviewer.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <Link
                        href={`/profile/${review.reviewer.id}`}
                        className="font-medium hover:text-purple-400 transition-colors"
                      >
                        {review.reviewer.name}
                      </Link>
                      <span className="text-xs text-zinc-500">
                        {timeAgo(review.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              "w-4 h-4",
                              star <= review.rating
                                ? "fill-yellow-500 text-yellow-500"
                                : "text-zinc-700"
                            )}
                          />
                        ))}
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          review.review_type === "buddy"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-orange-500/20 text-orange-400"
                        )}
                      >
                        {review.review_type === "buddy" ? "Quest" : "Marketplace"}
                      </Badge>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-zinc-300">{review.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
