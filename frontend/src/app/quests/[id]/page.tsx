"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  MapPin,
  Calendar,
  Clock,
  MoreHorizontal,
  Trash2,
  UserPlus,
  UserMinus,
  Check,
  X,
  Loader2,
  Star,
  Zap,
  Edit,
  CheckCircle2,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { QuestLocationMapWrapper } from "@/components/QuestLocationMapWrapper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useQuest,
  useQuestParticipants,
  useJoinQuest,
  useLeaveQuest,
  useDeleteQuest,
  useCompleteQuest,
  useApproveParticipant,
  useRemoveParticipant,
  useMyQuests,
} from "@/hooks/useQuests";
import { useUserRatingSummary } from "@/hooks/useReviews";
import { useStartConversation } from "@/hooks/useMessaging";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { QuestCategory, VibeLevel, ParticipantStatus } from "@/types";

const categoryConfig: Record<QuestCategory, { label: string; icon: typeof Dumbbell; color: string }> = {
  gym: { label: "Gym", icon: Dumbbell, color: "bg-red-500/20 text-red-400" },
  food: { label: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-400" },
  study: { label: "Study", icon: BookOpen, color: "bg-blue-500/20 text-blue-400" },
  game: { label: "Game", icon: Gamepad2, color: "bg-purple-500/20 text-purple-400" },
  commute: { label: "Commute", icon: Car, color: "bg-green-500/20 text-green-400" },
  custom: { label: "Custom", icon: Sparkles, color: "bg-zinc-500/20 text-zinc-400" },
};

const vibeLevelLabels: Record<VibeLevel, { label: string; emoji: string }> = {
  chill: { label: "Chill", emoji: "😌" },
  intermediate: { label: "Intermediate", emoji: "👍" },
  high_energy: { label: "High Energy", emoji: "⚡" },
  intense: { label: "Intense", emoji: "🔥" },
};

export default function QuestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const questId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const { data: quest, isLoading } = useQuest(questId);
  const { data: participantsData } = useQuestParticipants(questId);
  const { data: hostRating } = useUserRatingSummary(quest?.host.id || "");

  // Also check my-quests to reliably determine if user has joined
  const { data: myParticipantQuests } = useMyQuests("participant");
  const { data: myPendingQuests } = useMyQuests("pending");

  const joinMutation = useJoinQuest();
  const leaveMutation = useLeaveQuest();
  const deleteMutation = useDeleteQuest();
  const completeMutation = useCompleteQuest();
  const approveMutation = useApproveParticipant();
  const removeMutation = useRemoveParticipant();
  const startConversationMutation = useStartConversation();

  const participants = participantsData?.items || [];
  const isHost = user?.id === quest?.host.id;

  // Check join status from multiple sources for reliability
  const myParticipation = participants.find((p) => p.user.id === user?.id);
  const myJoinedQuestIds = new Set(
    myParticipantQuests?.pages?.flatMap((page) => page.items.map((q) => q.id)) || []
  );
  const myPendingQuestIds = new Set(
    myPendingQuests?.pages?.flatMap((page) => page.items.map((q) => q.id)) || []
  );

  const isJoined = !!myParticipation || myJoinedQuestIds.has(questId) || myPendingQuestIds.has(questId);
  const isPending = myParticipation?.status === "pending" || myPendingQuestIds.has(questId);
  const isAccepted = myParticipation?.status === "accepted" || myJoinedQuestIds.has(questId);

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleJoin = async () => {
    try {
      const result = await joinMutation.mutateAsync({ id: questId });
      toast({
        title: result.status === "pending" ? "Request sent" : "Joined quest!",
        description:
          result.status === "pending"
            ? "Waiting for host approval"
            : "You have joined this quest!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join",
        variant: "destructive",
      });
    }
  };

  const handleLeave = async () => {
    try {
      await leaveMutation.mutateAsync(questId);
      toast({ title: "Left quest" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to leave",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(questId);
      toast({ title: "Quest cancelled" });
      router.push("/quests");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async () => {
    try {
      await completeMutation.mutateAsync(questId);
      toast({ title: "Quest marked as completed!" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete",
        variant: "destructive",
      });
    }
  };

  const handleParticipantAction = async (
    participantId: string,
    action: "accept" | "reject"
  ) => {
    try {
      await approveMutation.mutateAsync({
        questId,
        participantId,
        action,
      });
      toast({ title: action === "accept" ? "Approved!" : "Rejected" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update",
        variant: "destructive",
      });
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    try {
      await removeMutation.mutateAsync({ questId, userId });
      toast({ title: "Participant removed" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove",
        variant: "destructive",
      });
    }
  };

  const handleMessageHost = async () => {
    if (!quest) return;

    try {
      const conversation = await startConversationMutation.mutateAsync({
        recipient_id: quest.host.id,
        initial_message: `Hi! I'm interested in your quest: "${quest.activity}"`,
        context_type: "buddy",
        context_id: quest.id,
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <Skeleton className="w-24 h-8 mb-6" />
        <Skeleton className="w-full h-48 mb-6" />
        <Skeleton className="w-full h-32" />
      </div>
    );
  }

  if (!quest) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl text-center">
        <p className="text-zinc-500">Quest not found</p>
        <Button variant="link" asChild>
          <Link href="/quests">Back to Side Quests</Link>
        </Button>
      </div>
    );
  }

  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;
  const vibeInfo = vibeLevelLabels[quest.vibe_level];
  const acceptedParticipants = participants.filter((p) => p.status === "accepted");
  const pendingParticipants = participants.filter((p) => p.status === "pending");
  const spotsAvailable = quest.max_participants - quest.current_participants;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/quests">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      {/* Quest Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-xl bg-white/5 border border-white/10 mb-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={cn("text-sm", catConfig.color)}>
                <Icon className="w-4 h-4 mr-1" />
                {quest.category === "custom" && quest.custom_category
                  ? quest.custom_category
                  : catConfig.label}
              </Badge>
              <Badge variant="outline" className="text-sm border-white/10">
                {vibeInfo.emoji} {vibeInfo.label}
              </Badge>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                quest.status === "open" && "bg-green-500/20 text-green-400",
                quest.status === "in_progress" && "bg-blue-500/20 text-blue-400",
                quest.status === "full" && "bg-yellow-500/20 text-yellow-400",
                quest.status === "completed" && "bg-zinc-500/20 text-zinc-400"
              )}
            >
              {quest.status === "open"
                ? `${spotsAvailable} spot${spotsAvailable !== 1 ? "s" : ""} left`
                : quest.status.replace("_", " ")}
            </Badge>
          </div>

          {isHost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/quests/${questId}/edit`}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit quest
                  </Link>
                </DropdownMenuItem>
                {quest.status !== "completed" && (
                  <DropdownMenuItem onClick={handleComplete}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark as completed
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-400">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Cancel quest
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Activity Title */}
        <h1 className="text-2xl font-bold mb-4">{quest.activity}</h1>

        {/* Description */}
        {quest.description && (
          <p className="text-zinc-300 whitespace-pre-wrap mb-4">{quest.description}</p>
        )}

        {/* Location with Map */}
        <div className="mb-4">
          <div className="flex items-center gap-3 text-sm text-zinc-400 mb-3">
            <MapPin className="w-5 h-5 text-green-400" />
            <span>{quest.location}</span>
          </div>
          {quest.latitude && quest.longitude && (
            <QuestLocationMapWrapper
              latitude={quest.latitude}
              longitude={quest.longitude}
              locationName={quest.location}
              category={quest.category}
            />
          )}
        </div>

        {/* Meta */}
        <div className="space-y-3 text-sm text-zinc-400">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-green-400" />
            <span>{formatTime(quest.start_time)}</span>
          </div>
          {quest.end_time && (
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-green-400" />
              <span>Until {formatTime(quest.end_time)}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-green-400" />
            <span>{vibeInfo.emoji} {vibeInfo.label} vibe</span>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-green-400" />
            <span>
              {quest.current_participants}/{quest.max_participants} participants
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-zinc-500" />
            <span>Posted {timeAgo(quest.created_at)}</span>
          </div>
        </div>

        {/* Join/Leave Button */}
        {isAuthenticated && !isHost && quest.status !== "completed" && quest.status !== "cancelled" && (
          <div className="mt-6">
            {isJoined ? (
              <Button
                onClick={handleLeave}
                variant="outline"
                className="w-full"
                disabled={leaveMutation.isPending}
              >
                {leaveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserMinus className="w-4 h-4 mr-2" />
                )}
                {isPending ? "Cancel Request" : "Leave Quest"}
              </Button>
            ) : quest.status === "open" ? (
              <Button
                onClick={handleJoin}
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                {quest.requires_approval ? "Request to Join" : "Join Quest"}
              </Button>
            ) : null}
          </div>
        )}
      </motion.div>

      {/* Host Card */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6">
        <p className="text-xs text-zinc-500 mb-3">Host</p>
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12">
            <AvatarImage src={quest.host.avatar_url || undefined} />
            <AvatarFallback className="bg-green-500/20 text-green-400">
              {quest.host.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{quest.host.name}</p>
            {hostRating?.buddy_rating && (
              <div className="flex items-center gap-1 text-sm text-zinc-400">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                {hostRating.buddy_rating.toFixed(1)}
                <span className="text-zinc-600">({hostRating.buddy_count} reviews)</span>
              </div>
            )}
          </div>
          {isAuthenticated && !isHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMessageHost}
              disabled={startConversationMutation.isPending}
            >
              {startConversationMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Message
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Participants */}
      <div className="space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-green-400" />
          Participants ({acceptedParticipants.length + 1})
        </h2>

        {/* Host as first participant */}
        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarImage src={quest.host.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-green-500/20 text-green-400">
              {quest.host.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 text-sm">{quest.host.name}</span>
          <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs">
            Host
          </Badge>
        </div>

        {acceptedParticipants.length === 0 ? (
          <p className="text-zinc-500 text-sm pl-2">No other participants yet</p>
        ) : (
          <div className="space-y-2">
            {acceptedParticipants.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={p.user.avatar_url || undefined} />
                  <AvatarFallback className="text-xs bg-zinc-800">
                    {p.user.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{p.user.name}</span>
                <span className="text-xs text-zinc-500">
                  Joined {timeAgo(p.created_at)}
                </span>
                {isHost && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    onClick={() => handleRemoveParticipant(p.user.id)}
                    disabled={removeMutation.isPending}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pending Requests (Host only) */}
        {isHost && pendingParticipants.length > 0 && (
          <>
            <h3 className="font-semibold text-yellow-400 mt-6 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Requests ({pendingParticipants.length})
            </h3>
            <div className="space-y-2">
              {pendingParticipants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={p.user.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-yellow-500/20 text-yellow-400">
                      {p.user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="text-sm">{p.user.name}</span>
                    {p.message && (
                      <p className="text-xs text-zinc-500 mt-0.5">{p.message}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                      onClick={() => handleParticipantAction(p.id, "accept")}
                      disabled={approveMutation.isPending}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      onClick={() => handleParticipantAction(p.id, "reject")}
                      disabled={approveMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
