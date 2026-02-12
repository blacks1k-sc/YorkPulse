"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  GraduationCap,
  Edit,
  Save,
  X,
  Loader2,
  Shield,
  ShoppingBag,
  Users,
  Camera,
  Upload,
  ImagePlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const { isLoading, refetch } = useUser();
  const updateProfileMutation = useUpdateProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [program, setProgram] = useState(user?.program || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests?.join(", ") || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: listingsData } = useMyListings();
  const { data: questsData } = useMyBuddyRequests();

  const listings = listingsData?.pages.flatMap((p) => p.items) || [];
  const quests = questsData?.pages.flatMap((p) => p.items) || [];

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a JPEG, PNG, WebP, or GIF image",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Get presigned URL
      const { upload_url, file_url } = await api.auth.getAvatarUploadUrl(
        file.name,
        file.type
      );

      // Upload to S3
      const uploadResponse = await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Update profile with new avatar URL
      await updateProfileMutation.mutateAsync({
        avatar_url: file_url,
      });

      // Refresh user data
      await refetch();

      toast({ title: "Profile picture updated" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file inputs
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = "";
      }
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
          <div className="relative group">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={isUploadingAvatar}>
                <button
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-white" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Camera capture input */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            {/* File upload input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold">{user?.name}</h1>
              {user?.name_verified && (
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
      <div className="grid grid-cols-2 gap-4 mb-6">
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
      </Tabs>
    </div>
  );
}
