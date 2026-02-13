"use client";

import { useState, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Ban,
  Check,
  CheckCheck,
  X,
  Loader2,
  AlertCircle,
  Clock,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useConversation,
  useMessages,
  useSendMessage,
  useAcceptConversation,
  useDeclineConversation,
  useBlockConversation,
  useMarkAsRead,
} from "@/hooks/useMessaging";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useUser } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const { data: user } = useUser();
  const { toast } = useToast();

  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversation, isLoading: conversationLoading } =
    useConversation(conversationId);
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversationId);

  // Real-time subscription
  useRealtimeMessages(conversationId);

  const sendMessageMutation = useSendMessage();
  const acceptMutation = useAcceptConversation();
  const declineMutation = useDeclineConversation();
  const blockMutation = useBlockConversation();
  const markAsReadMutation = useMarkAsRead();

  // Flatten messages from all pages
  const messages = messagesData?.pages.flatMap((page) => page.messages) || [];
  const otherUser = conversation?.participants.find((p) => p.id !== user?.id);
  const isPending = conversation?.status === "pending";
  const isBlocked = conversation?.status === "blocked";
  const isInitiator = conversation?.initiator_id === user?.id;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // Mark as read when viewing conversation
  useEffect(() => {
    if (conversation && conversation.unread_count > 0) {
      markAsReadMutation.mutate(conversationId);
    }
  }, [conversation?.id, conversation?.unread_count]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const processImageFile = (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      toast({
        title: "Invalid file type",
        description: "Please select a JPG, PNG, GIF, or WebP image",
        variant: "destructive",
      });
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return false;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    return true;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const namedFile = new File(
            [file],
            `clipboard-${Date.now()}.png`,
            { type: file.type }
          );
          processImageFile(namedFile);
        }
        break;
      }
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imageFile) || sendMessageMutation.isPending || isUploading) return;

    // Can only send if active, or if pending and user is initiator
    if (isBlocked) return;
    if (isPending && !isInitiator) return;

    let imageUrl: string | undefined;

    try {
      // Upload image first if present
      if (imageFile) {
        setIsUploading(true);
        const { upload_url, file_url } = await api.messaging.getChatImageUploadUrl(
          imageFile.name,
          imageFile.type
        );

        const uploadResponse = await fetch(upload_url, {
          method: "PUT",
          body: imageFile,
          headers: { "Content-Type": imageFile.type },
        });

        if (!uploadResponse.ok) throw new Error("Failed to upload image");
        imageUrl = file_url;
        setIsUploading(false);
      }

      await sendMessageMutation.mutateAsync({
        conversationId,
        content: message.trim() || undefined,
        imageUrl,
      });
      setMessage("");
      removeImage();
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    } catch (error) {
      setIsUploading(false);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleAccept = async () => {
    try {
      await acceptMutation.mutateAsync(conversationId);
      toast({ title: "Conversation accepted" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to accept",
        variant: "destructive",
      });
    }
  };

  const handleDecline = async () => {
    try {
      await declineMutation.mutateAsync(conversationId);
      toast({ title: "Request declined" });
      router.push("/messages");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to decline",
        variant: "destructive",
      });
    }
  };

  const handleBlock = async () => {
    try {
      await blockMutation.mutateAsync(conversationId);
      toast({ title: "User blocked" });
      router.push("/messages");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to block",
        variant: "destructive",
      });
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (conversationLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="w-32 h-5" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="w-48 h-12 rounded-2xl" />
          <Skeleton className="w-48 h-12 rounded-2xl ml-auto" />
          <Skeleton className="w-64 h-12 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-6 text-center">
        <p className="text-zinc-500">Conversation not found</p>
        <Button variant="link" asChild>
          <Link href="/messages">Back to Messages</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-zinc-950 to-zinc-900">
      {/* Header with glassmorphism */}
      <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-white/5 backdrop-blur-xl">
        <Button variant="ghost" size="icon" asChild className="md:hidden">
          <Link href="/messages">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>

        <Avatar className="w-10 h-10 ring-2 ring-purple-500/30">
          <AvatarImage src={otherUser?.avatar_url || undefined} />
          <AvatarFallback className="bg-gradient-to-br from-purple-500/30 to-pink-500/30 text-purple-300 font-semibold">
            {otherUser?.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{otherUser?.name || "Unknown"}</p>
          {isPending && !isInitiator && (
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Wants to message you
            </p>
          )}
          {isPending && isInitiator && (
            <p className="text-xs text-zinc-500">Pending request</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="hover:bg-white/10">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
            <DropdownMenuItem asChild className="hover:bg-white/10">
              <Link href={`/profile/${otherUser?.id}`}>View Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBlock} className="text-red-400 hover:bg-red-500/10">
              <Ban className="w-4 h-4 mr-2" />
              Block User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {/* Load more button */}
        {hasNextPage && (
          <div className="text-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-zinc-500 hover:text-zinc-300"
            >
              {isFetchingNextPage ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Load older messages"
              )}
            </Button>
          </div>
        )}

        {messagesLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="flex">
              <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-bl-md bg-white/5">
                <Skeleton className="w-32 h-4" />
              </div>
            </div>
            <div className="flex justify-end">
              <div className="max-w-[70%] px-4 py-3 rounded-2xl rounded-br-md bg-purple-600/20">
                <Skeleton className="w-40 h-4" />
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Send className="w-8 h-8 text-purple-400" />
            </div>
            <p className="font-medium">No messages yet</p>
            <p className="text-sm mt-1">
              {isPending && isInitiator
                ? `Waiting for ${otherUser?.name} to accept`
                : "Send a message to start the conversation"}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const isOwn = msg.sender_id === user?.id;
              const showDate =
                i === 0 ||
                formatDate(msg.created_at) !==
                  formatDate(messages[i - 1].created_at);
              const showAvatar =
                !isOwn &&
                (i === messages.length - 1 ||
                  messages[i + 1]?.sender_id !== msg.sender_id);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="text-[11px] text-zinc-600 bg-zinc-800/50 px-3 py-1 rounded-full">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-end gap-2",
                      isOwn ? "justify-end" : "justify-start"
                    )}
                  >
                    {!isOwn && (
                      <div className="w-6 flex-shrink-0">
                        {showAvatar && (
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={otherUser?.avatar_url || undefined} />
                            <AvatarFallback className="text-[10px] bg-purple-500/20 text-purple-300">
                              {otherUser?.name?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-2.5 relative group",
                        isOwn
                          ? "bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-2xl rounded-br-md"
                          : "bg-white/10 backdrop-blur-sm text-white rounded-2xl rounded-bl-md border border-white/5"
                      )}
                    >
                      {msg.is_deleted ? (
                        <p className="text-sm italic text-zinc-400">Message deleted</p>
                      ) : (
                        <>
                          {msg.image_url && (
                            <a
                              href={msg.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block mb-2"
                            >
                              <img
                                src={msg.image_url}
                                alt="Shared image"
                                className="max-w-full max-h-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                              />
                            </a>
                          )}
                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                            </p>
                          )}
                        </>
                      )}
                      <div
                        className={cn(
                          "flex items-center gap-1 mt-1",
                          isOwn ? "justify-end" : "justify-start"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px]",
                            isOwn ? "text-purple-200/70" : "text-zinc-500"
                          )}
                        >
                          {formatTime(msg.created_at)}
                        </span>
                        {isOwn && !msg.is_deleted && (
                          <span className="text-purple-200/70">
                            {msg.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </AnimatePresence>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Request Actions */}
      {isPending && !isInitiator && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 border-t border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-200">
                Message Request
              </p>
              <p className="text-xs text-yellow-200/60">
                {otherUser?.name} wants to message you
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAccept}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white border-0"
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Accept
                </>
              )}
            </Button>
            <Button
              onClick={handleDecline}
              variant="outline"
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              disabled={declineMutation.isPending}
            >
              {declineMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Decline
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Pending Message (Initiator) */}
      {isPending && isInitiator && (
        <div className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Waiting for {otherUser?.name} to accept your request</span>
          </div>
        </div>
      )}

      {/* Blocked Message */}
      {isBlocked && (
        <div className="p-4 border-t border-red-500/20 bg-red-500/10">
          <div className="flex items-center justify-center gap-2">
            <Ban className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-300">
              This conversation has been blocked
            </p>
          </div>
        </div>
      )}

      {/* Message Input - Show for active conversations or for initiator in pending */}
      {!isBlocked && (!isPending || isInitiator) && (
        <form
          onSubmit={handleSend}
          className="p-4 border-t border-white/10 bg-white/5 backdrop-blur-xl"
        >
          {/* Image Preview */}
          {imagePreview && (
            <div className="mb-2 relative inline-block">
              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-white/5">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-24 max-w-[150px] object-contain"
                />
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={isUploading || sendMessageMutation.isPending}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              className="hidden"
              disabled={isUploading || sendMessageMutation.isPending}
            />

            {/* Image upload button */}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || sendMessageMutation.isPending}
              className="h-11 w-11 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
            >
              <ImagePlus className="w-5 h-5" />
            </Button>

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                placeholder={imageFile ? "Add a caption..." : "Type a message..."}
                value={message}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                rows={1}
                className="w-full resize-none rounded-2xl bg-white/10 border border-white/10 px-4 py-3 text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                disabled={isUploading || sendMessageMutation.isPending}
                style={{ maxHeight: "120px" }}
              />
            </div>
            <Button
              type="submit"
              size="icon"
              className={cn(
                "h-11 w-11 rounded-xl transition-all duration-200",
                (message.trim() || imageFile)
                  ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/25"
                  : "bg-zinc-800 text-zinc-500"
              )}
              disabled={(!message.trim() && !imageFile) || isUploading || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
