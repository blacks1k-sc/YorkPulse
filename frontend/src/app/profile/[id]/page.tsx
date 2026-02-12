"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  GraduationCap,
  Shield,
  MessageCircle,
  ArrowLeft,
  Calendar,
  Loader2,
  Flag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useStartConversation } from "@/hooks/useMessaging";
import { useToast } from "@/hooks/use-toast";

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

  // Report form state
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportExplanation, setReportExplanation] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Check if viewing own profile
  const isOwnProfile = currentUser?.id === userId;

  // Fetch public profile
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["user", "public", userId],
    queryFn: () => api.auth.getPublicProfile(userId),
    enabled: !!userId && !isOwnProfile,
  });

  // Redirect to own profile page if viewing self
  if (isOwnProfile) {
    router.replace("/profile");
    return null;
  }

  const handleSubmitReport = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to submit a report",
        variant: "destructive",
      });
      return;
    }

    if (!reportReason) {
      toast({
        title: "Reason required",
        description: "Please select a reason for the report",
        variant: "destructive",
      });
      return;
    }

    if (reportExplanation.length < 10) {
      toast({
        title: "Explanation required",
        description: "Please provide more details (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      await api.reports.submitReport({
        reported_user_id: userId,
        reason: reportReason,
        explanation: reportExplanation,
      });
      toast({ title: "Report submitted", description: "Thank you for helping keep our community safe." });
      setShowReportDialog(false);
      setReportReason("");
      setReportExplanation("");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit report",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
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

          {/* Report Button */}
          {isAuthenticated && (
            <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-500/10">
                  <Flag className="w-4 h-4 mr-2" />
                  Report
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Report User</DialogTitle>
                  <DialogDescription>
                    Help keep our community safe by reporting inappropriate behavior.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Reason for report</Label>
                    <Select value={reportReason} onValueChange={setReportReason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="harassment_safety">Harassment / Safety concern</SelectItem>
                        <SelectItem value="scam_fraud">Scam / Fraud</SelectItem>
                        <SelectItem value="no_show_pattern">No-show pattern</SelectItem>
                        <SelectItem value="spam_bot">Spam / Bot account</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Please explain (required)</Label>
                    <Textarea
                      placeholder="Provide details about what happened..."
                      value={reportExplanation}
                      onChange={(e) => setReportExplanation(e.target.value)}
                      className="min-h-[100px]"
                    />
                    <p className="text-xs text-zinc-500">
                      Minimum 10 characters required
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setShowReportDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitReport}
                    disabled={isSubmittingReport || !reportReason || reportExplanation.length < 10}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isSubmittingReport ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Flag className="w-4 h-4 mr-2" />
                    )}
                    Submit Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>
    </div>
  );
}
