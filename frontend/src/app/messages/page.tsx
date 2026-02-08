"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Check,
  CheckCheck,
  Loader2,
  Inbox,
  Clock,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConversations, usePendingRequests } from "@/hooks/useMessaging";
import { useRealtimeConversations } from "@/hooks/useRealtimeMessages";
import { useUser } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types";

function ConversationCard({ conversation, userId }: { conversation: Conversation; userId?: string }) {
  const otherUser = conversation.participants.find((p) => p.id !== userId);

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const isUnread = conversation.unread_count > 0;
  const isPending = conversation.status === "pending";
  const isInitiator = conversation.initiator_id === userId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link href={`/messages/${conversation.id}`}>
        <div
          className={cn(
            "p-4 rounded-2xl border transition-all duration-200 group",
            isUnread
              ? "bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 shadow-lg shadow-purple-500/5"
              : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className={cn(
                "w-12 h-12 ring-2 transition-all",
                isUnread ? "ring-purple-500/50" : "ring-white/10 group-hover:ring-white/20"
              )}>
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500/30 to-pink-500/30 text-purple-300 font-semibold">
                  {otherUser?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </AvatarFallback>
              </Avatar>
              {isUnread && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold shadow-lg shadow-purple-500/30"
                >
                  {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                </motion.div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-medium truncate",
                    isUnread && "text-white"
                  )}>
                    {otherUser?.name || "Unknown"}
                  </span>
                  {isPending && isInitiator && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-zinc-700 text-zinc-300">
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      Pending
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-zinc-500 flex-shrink-0">
                  {conversation.last_message_at
                    ? timeAgo(conversation.last_message_at)
                    : ""}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {conversation.last_message && (
                  <>
                    {conversation.last_message.sender_id === userId && (
                      <span className="text-zinc-500 flex-shrink-0">
                        {conversation.last_message.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                    <p
                      className={cn(
                        "text-sm truncate",
                        isUnread ? "text-zinc-300 font-medium" : "text-zinc-500"
                      )}
                    >
                      {conversation.last_message.is_deleted
                        ? "Message deleted"
                        : conversation.last_message.content}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function RequestCard({ conversation, userId }: { conversation: Conversation; userId?: string }) {
  const otherUser = conversation.participants.find((p) => p.id !== userId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <Link href={`/messages/${conversation.id}`}>
        <div className="p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-200 shadow-lg shadow-yellow-500/5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="w-12 h-12 ring-2 ring-yellow-500/50">
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-yellow-500/30 to-orange-500/30 text-yellow-300 font-semibold">
                  {otherUser?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-500/30">
                <Sparkles className="w-3 h-3 text-black" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium truncate text-yellow-100">
                  {otherUser?.name || "Unknown"}
                </span>
                <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  New Request
                </Badge>
              </div>
              {conversation.last_message && (
                <p className="text-sm text-yellow-200/60 truncate">
                  {conversation.last_message.content}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="w-1/3 h-5 mb-2" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { isAuthenticated } = useAuthStore();
  const { data: user } = useUser();

  // Real-time subscription for conversations
  useRealtimeConversations(user?.id || null);

  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useConversations();

  const { data: pendingData, isLoading: pendingLoading } = usePendingRequests();

  const conversations = conversationsData?.pages.flatMap((page) => page.items) || [];
  const pendingRequests = pendingData?.requests || [];

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <MessageCircle className="w-10 h-10 text-purple-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign in to view messages</h2>
        <p className="text-zinc-500">Connect with other York students through direct messaging</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <MessageCircle className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-zinc-500">Your private conversations</p>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full mb-4 bg-white/5 border border-white/10 p-1 rounded-xl">
          <TabsTrigger
            value="all"
            className="flex-1 rounded-lg data-[state=active]:bg-white/10 transition-all"
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="requests"
            className="flex-1 rounded-lg data-[state=active]:bg-white/10 transition-all relative"
          >
            Requests
            {pendingRequests.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="ml-2 px-1.5 py-0.5 text-[10px] rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold"
              >
                {pendingRequests.length}
              </motion.span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-0">
          {conversationsLoading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : conversations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10">
                <Inbox className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">No conversations yet</h3>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                Start a conversation from a marketplace listing or side quest to connect with other students
              </p>
            </motion.div>
          ) : (
            <>
              {conversations.map((conversation, i) => (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ConversationCard conversation={conversation} userId={user?.id} />
                </motion.div>
              ))}

              {hasNextPage && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-2"
                  >
                    {isFetchingNextPage ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-3 mt-0">
          {pendingLoading ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : pendingRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center border border-white/10">
                <Sparkles className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-medium mb-2">No pending requests</h3>
              <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                When someone sends you a message request, it will appear here
              </p>
            </motion.div>
          ) : (
            pendingRequests.map((request, i) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <RequestCard conversation={request} userId={user?.id} />
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
