"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  GraduationCap,
  Star,
  Edit,
  Save,
  X,
  Loader2,
  Shield,
  ShoppingBag,
  Users,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser, useUpdateProfile } from "@/hooks/useAuth";
import { useMyListings } from "@/hooks/useMarketplace";
import { useMyBuddyRequests, useMyParticipation } from "@/hooks/useBuddy";
import { useMyReviews } from "@/hooks/useReviews";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const { isLoading } = useUser();
  const updateProfileMutation = useUpdateProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [program, setProgram] = useState(user?.program || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests?.join(", ") || "");

  const { data: listingsData } = useMyListings();
  const { data: questsData } = useMyBuddyRequests();
  const { data: reviewsData } = useMyReviews("received");

  const listings = listingsData?.pages.flatMap((p) => p.items) || [];
  const quests = questsData?.pages.flatMap((p) => p.items) || [];
  const reviews = reviewsData?.pages.flatMap((p) => p.items) || [];

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync({
        program: program || undefined,
        bio: bio || undefined,
        interests: interests
          ? interests.split(",").map((i) => i.trim()).filter(Boolean)
          : undefined,
      });
      toast({ title: "Profile updated" });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-6 text-center">
        <User className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
        <p className="text-zinc-500">Sign in to view your profile</p>
        <Button variant="link" asChild className="text-purple-400">
          <Link href="/auth/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div>
            <Skeleton className="w-40 h-6 mb-2" />
            <Skeleton className="w-60 h-4" />
          </div>
        </div>
        <Skeleton className="w-full h-48" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10 mb-6"
      >
        <div className="flex items-start gap-4">
          <Avatar className="w-20 h-20">
            <AvatarImage src={user?.avatar_url || undefined} />
            <AvatarFallback className="text-2xl bg-purple-500/20 text-purple-400">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{user?.name}</h1>
              {user?.is_verified && (
                <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
              <Mail className="w-4 h-4" />
              {user?.email}
            </div>

            {user?.program && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <GraduationCap className="w-4 h-4" />
                {user.program}
              </div>
            )}
          </div>

          <Button
            variant={isEditing ? "ghost" : "outline"}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </Button>
        </div>

        {/* Bio & Interests */}
        {isEditing ? (
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="program">Program</Label>
              <Input
                id="program"
                placeholder="e.g., Computer Science"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interests">Interests (comma separated)</Label>
              <Input
                id="interests"
                placeholder="e.g., coding, music, hiking"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            {user?.bio && <p className="text-zinc-300 mb-3">{user.bio}</p>}
            {user?.interests && user.interests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest) => (
                  <Badge key={interest} variant="secondary">
                    {interest}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <ShoppingBag className="w-5 h-5 mx-auto mb-2 text-coral-400" />
          <p className="text-2xl font-bold">{listings.length}</p>
          <p className="text-xs text-zinc-500">Listings</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <Users className="w-5 h-5 mx-auto mb-2 text-green-400" />
          <p className="text-2xl font-bold">{quests.length}</p>
          <p className="text-xs text-zinc-500">Quests</p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
          <Star className="w-5 h-5 mx-auto mb-2 text-yellow-400" />
          <p className="text-2xl font-bold">
            {reviews.length > 0
              ? (
                  reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                ).toFixed(1)
              : "-"}
          </p>
          <p className="text-xs text-zinc-500">Rating</p>
        </div>
      </div>

      {/* Activity Tabs */}
      <Tabs defaultValue="listings">
        <TabsList className="w-full">
          <TabsTrigger value="listings" className="flex-1">
            Listings
          </TabsTrigger>
          <TabsTrigger value="quests" className="flex-1">
            Quests
          </TabsTrigger>
          <TabsTrigger value="reviews" className="flex-1">
            Reviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="mt-4 space-y-3">
          {listings.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No listings yet</p>
          ) : (
            listings.slice(0, 5).map((listing) => (
              <Link key={listing.id} href={`/marketplace/${listing.id}`}>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-zinc-900 flex items-center justify-center">
                      {listing.images?.[0] ? (
                        <img
                          src={listing.images[0]}
                          alt=""
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-zinc-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{listing.title}</p>
                      <p className="text-sm text-coral-400">${Number(listing.price).toFixed(2)}</p>
                    </div>
                    <Badge variant="secondary">{listing.status}</Badge>
                  </div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="quests" className="mt-4 space-y-3">
          {quests.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No quests yet</p>
          ) : (
            quests.slice(0, 5).map((quest) => (
              <Link key={quest.id} href={`/quests/${quest.id}`}>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{quest.activity}</p>
                      <p className="text-sm text-zinc-500">
                        {quest.current_participants}/{quest.max_participants} participants
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        quest.status === "open" && "bg-green-500/20 text-green-400"
                      )}
                    >
                      {quest.status}
                    </Badge>
                  </div>
                </div>
              </Link>
            ))
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">No reviews yet</p>
          ) : (
            reviews.slice(0, 5).map((review) => (
              <div
                key={review.id}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
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
                  <span className="text-sm text-zinc-500">
                    from {review.reviewer.name}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-zinc-400">{review.comment}</p>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
