"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Plus,
  Filter,
  MapPin,
  Calendar,
  Clock,
  Loader2,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  Sparkles,
  SortAsc,
  CheckCircle,
  Map,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuests, useMyQuests, useJoinQuest } from "@/hooks/useQuests";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { QuestMapWrapper } from "@/components/QuestMapWrapper";
import type { SideQuest, QuestCategory, QuestStatus, VibeLevel } from "@/types";

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

const statusLabels: Record<QuestStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-green-500/20 text-green-400" },
  in_progress: { label: "In Progress", color: "bg-blue-500/20 text-blue-400" },
  full: { label: "Full", color: "bg-yellow-500/20 text-yellow-400" },
  completed: { label: "Completed", color: "bg-zinc-500/20 text-zinc-400" },
  cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400" },
};

function QuestCard({ quest, joinedQuestIds, pendingQuestIds }: { quest: SideQuest; joinedQuestIds: Set<string>; pendingQuestIds: Set<string> }) {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const joinMutation = useJoinQuest();
  const catConfig = categoryConfig[quest.category];
  const Icon = catConfig.icon;
  const vibeInfo = vibeLevelLabels[quest.vibe_level];

  const isHost = user?.id === quest.host.id;
  const hasJoined = joinedQuestIds.has(quest.id);
  const hasPending = pendingQuestIds.has(quest.id);

  const handleJoin = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await joinMutation.mutateAsync({ id: quest.id });
      toast({
        title: quest.requires_approval ? "Request sent!" : "Joined!",
        description: quest.requires_approval
          ? "The host will review your request"
          : "You've joined the quest",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join quest",
        variant: "destructive",
      });
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    if (isToday) {
      return `Today at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    if (isTomorrow) {
      return `Tomorrow at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const spotsAvailable = quest.max_participants - quest.current_participants;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/quests/${quest.id}`}>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-green-500/30 transition-all hover:shadow-lg hover:shadow-green-500/5">
          {/* Top Row: Category Badge + Vibe */}
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className={cn("text-xs", catConfig.color)}>
              <Icon className="w-3 h-3 mr-1" />
              {quest.category === "custom" && quest.custom_category
                ? quest.custom_category
                : catConfig.label}
            </Badge>
            <Badge variant="outline" className="text-xs border-white/10">
              {vibeInfo.emoji} {vibeInfo.label}
            </Badge>
          </div>

          {/* Activity Title */}
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{quest.activity}</h3>

          {/* Description if available */}
          {quest.description && (
            <p className="text-sm text-zinc-400 line-clamp-2 mb-3">{quest.description}</p>
          )}

          {/* Meta Info */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <MapPin className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="truncate">{quest.location}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Calendar className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span>{formatTime(quest.start_time)}</span>
            </div>
          </div>

          {/* Bottom Row: Host + Participants */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            {/* Host */}
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src={quest.host.avatar_url || undefined} />
                <AvatarFallback className="text-[10px] bg-green-500/20 text-green-400">
                  {quest.host.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-zinc-500 truncate max-w-[100px]">
                {quest.host.name}
              </span>
              {quest.status === "open" && quest.host.avatar_url && (
                <CheckCircle className="w-3 h-3 text-green-400" />
              )}
            </div>

            {/* Participants / Status */}
            <div className="flex items-center gap-2">
              {quest.status === "open" ? (
                <>
                  <div className="flex -space-x-1">
                    {Array.from({ length: Math.min(quest.current_participants, 3) }).map((_, i) => (
                      <div
                        key={i}
                        className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-800"
                      />
                    ))}
                    {quest.current_participants > 3 && (
                      <div className="w-5 h-5 rounded-full bg-zinc-600 border border-zinc-800 flex items-center justify-center text-[8px]">
                        +{quest.current_participants - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {spotsAvailable > 0 ? `${spotsAvailable} spot${spotsAvailable !== 1 ? "s" : ""} left` : "Full"}
                  </span>
                </>
              ) : (
                <Badge variant="secondary" className={cn("text-xs", statusLabels[quest.status].color)}>
                  {statusLabels[quest.status].label}
                </Badge>
              )}
            </div>
          </div>

          {/* Action Button */}
          {isHost ? (
            <Button
              className="w-full mt-3 bg-purple-600 hover:bg-purple-700"
              size="sm"
              onClick={(e) => e.preventDefault()}
            >
              <Users className="w-4 h-4 mr-2" />
              Your Quest
            </Button>
          ) : hasJoined ? (
            <Button
              className="w-full mt-3 bg-zinc-600 hover:bg-zinc-700"
              size="sm"
              onClick={(e) => e.preventDefault()}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Joined
            </Button>
          ) : hasPending ? (
            <Button
              className="w-full mt-3 bg-amber-600/80 hover:bg-amber-700/80"
              size="sm"
              onClick={(e) => e.preventDefault()}
            >
              <Clock className="w-4 h-4 mr-2" />
              Requested
            </Button>
          ) : quest.status === "open" && spotsAvailable > 0 ? (
            <Button
              className="w-full mt-3 bg-green-600 hover:bg-green-700"
              size="sm"
              onClick={handleJoin}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Users className="w-4 h-4 mr-2" />
              )}
              {joinMutation.isPending
                ? "Joining..."
                : quest.requires_approval
                ? "Request to Join"
                : "Join Quest"}
            </Button>
          ) : null}
        </div>
      </Link>
    </motion.div>
  );
}

function QuestSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-20 h-5 rounded-full" />
      </div>
      <Skeleton className="w-3/4 h-6 mb-2" />
      <Skeleton className="w-full h-4 mb-3" />
      <div className="space-y-2 mb-4">
        <Skeleton className="w-1/2 h-4" />
        <Skeleton className="w-2/3 h-4" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-20 h-4" />
      </div>
    </div>
  );
}

export default function QuestsPage() {
  const [category, setCategory] = useState<QuestCategory | "all">("all");
  const [status, setStatus] = useState<QuestStatus | "all">("open");
  const [sortBy, setSortBy] = useState<"newest" | "starting_soon" | "most_spots">("starting_soon");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const { openCreateModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useQuests({
    category: category === "all" ? undefined : category,
    status: status === "all" ? undefined : status,
    sort_by: sortBy,
    per_page: 20,
  });

  // Get quests the user has joined (accepted)
  const { data: myQuestsData } = useMyQuests("participant");
  const joinedQuestIds = new Set(
    myQuestsData?.pages.flatMap((page) => page.items.map((q) => q.id)) || []
  );

  // Get quests the user has pending requests for
  const { data: pendingQuestsData } = useMyQuests("pending");
  const pendingQuestIds = new Set(
    pendingQuestsData?.pages.flatMap((page) => page.items.map((q) => q.id)) || []
  );

  const quests = data?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Side Quests</h1>
            <p className="text-sm text-zinc-500">Find buddies for any activity</p>
          </div>
        </div>
        <Button
          onClick={() => openCreateModal("quest")}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Quest
        </Button>
      </div>

      {/* View Toggle + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Category Filter */}
          <Select value={category} onValueChange={(v) => setCategory(v as QuestCategory | "all")}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <config.icon className="w-4 h-4" />
                    {config.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={status} onValueChange={(v) => setStatus(v as QuestStatus | "all")}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort - only show in list view */}
          {viewMode === "list" && (
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-36">
                <SortAsc className="w-4 h-4 mr-1" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starting_soon">Starting Soon</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="most_spots">Most Spots</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all",
              viewMode === "list"
                ? "bg-green-500/20 text-green-400"
                : "text-zinc-400 hover:text-zinc-300"
            )}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-all",
              viewMode === "map"
                ? "bg-green-500/20 text-green-400"
                : "text-zinc-400 hover:text-zinc-300"
            )}
          >
            <Map className="w-4 h-4" />
            <span className="hidden sm:inline">Map</span>
          </button>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" && (
        <div className="relative h-[calc(100vh-280px)] min-h-[400px] rounded-xl overflow-hidden border border-white/10">
          {isLoading ? (
            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-400" />
            </div>
          ) : (
            <QuestMapWrapper quests={quests} className="w-full h-full" />
          )}

          {/* Quest count overlay */}
          <div className="absolute top-3 left-3 bg-zinc-900/90 backdrop-blur rounded-lg px-3 py-1.5 border border-white/10">
            <p className="text-sm">
              <span className="text-green-400 font-semibold">
                {quests.filter((q) => q.latitude && q.longitude).length}
              </span>
              <span className="text-zinc-400"> quests on map</span>
              {quests.some((q) => !q.latitude || !q.longitude) && (
                <span className="text-zinc-500 ml-1">
                  ({quests.filter((q) => !q.latitude || !q.longitude).length} without location)
                </span>
              )}
            </p>
          </div>

          {/* Empty state */}
          {quests.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="text-center">
                <MapPin className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
                <p className="text-zinc-400 mb-2">No quests on the map yet</p>
                <Button
                  onClick={() => openCreateModal("quest")}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Quest
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            <>
              <QuestSkeleton />
              <QuestSkeleton />
              <QuestSkeleton />
              <QuestSkeleton />
            </>
          ) : quests.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Users className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
              <p className="text-zinc-500 mb-2">No quests found</p>
              <p className="text-sm text-zinc-600 mb-4">Be the first to start a side quest!</p>
              <Button
                onClick={() => openCreateModal("quest")}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Quest
              </Button>
            </div>
          ) : (
            <>
              {quests.map((quest) => (
                <QuestCard key={quest.id} quest={quest} joinedQuestIds={joinedQuestIds} pendingQuestIds={pendingQuestIds} />
              ))}

              {hasNextPage && (
                <div className="col-span-full text-center pt-4">
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
      )}
    </div>
  );
}
