"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Reply } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ReplyTo {
  id: string;
  message?: string | null;
  content?: string | null;
  image_url?: string | null;
  author?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
  sender?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

interface ChatMessageProps {
  id?: string;
  message: string | null;
  imageUrl: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorId: string;
  currentUserId?: string;
  timestamp: string;
  showAvatar?: boolean;
  replyTo?: ReplyTo | null;
  onReply?: (messageId: string, authorName: string, content: string | null) => void;
}

export function ChatMessage({
  id,
  message,
  imageUrl,
  authorName,
  authorAvatarUrl,
  authorId,
  currentUserId,
  timestamp,
  showAvatar = true,
  replyTo,
  onReply,
}: ChatMessageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isOwn = authorId === currentUserId;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Get reply author name
  const replyAuthorName = replyTo?.author?.name || replyTo?.sender?.name || "Unknown";
  const replyContent = replyTo?.message || replyTo?.content;

  const handleReply = () => {
    if (id && onReply) {
      onReply(id, authorName, message);
    }
  };

  return (
    <div className={cn("flex gap-3 group", isOwn && "flex-row-reverse")}>
      {/* Avatar */}
      {showAvatar && (
        <Link href={`/profile/${authorId}`} className="flex-shrink-0">
          <Avatar className="w-8 h-8 cursor-pointer hover:ring-2 hover:ring-purple-500/50 transition-all">
            <AvatarImage src={authorAvatarUrl || undefined} />
            <AvatarFallback className="text-xs bg-purple-500/20 text-purple-300">
              {authorName?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      )}
      {!showAvatar && <div className="w-8" />}

      {/* Message Content */}
      <div className={cn("max-w-[70%]", isOwn && "text-right")}>
        {/* Author & Time */}
        <div
          className={cn(
            "flex items-baseline gap-2 mb-1",
            isOwn && "flex-row-reverse"
          )}
        >
          <Link
            href={`/profile/${authorId}`}
            className={cn(
              "text-sm font-medium hover:underline cursor-pointer",
              isOwn ? "text-[#00ff88]" : "text-zinc-300"
            )}
          >
            {authorName}
          </Link>
          <span className="text-xs text-zinc-600">{formattedTime}</span>
          {/* Reply button */}
          {onReply && id && (
            <button
              onClick={handleReply}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
              title="Reply"
            >
              <Reply className="w-3 h-3 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Reply Preview */}
        {replyTo && (
          <div
            className={cn(
              "mb-2 px-2 py-1.5 rounded-lg border-l-2 border-purple-500/50 bg-white/5 text-xs",
              isOwn ? "text-right" : "text-left"
            )}
          >
            <p className="text-purple-400 font-medium mb-0.5">{replyAuthorName}</p>
            <p className="text-zinc-400 line-clamp-1">
              {replyTo.image_url && !replyContent ? "Photo" : replyContent || "Message"}
            </p>
          </div>
        )}

        {/* Image */}
        {imageUrl && !imageError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: imageLoaded ? 1 : 0, scale: 1 }}
            className={cn(
              "mb-2 rounded-lg overflow-hidden inline-block",
              !imageLoaded && "bg-zinc-800 animate-pulse min-h-[100px] min-w-[100px]"
            )}
          >
            <a href={imageUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={imageUrl}
                alt="Chat image"
                className="max-w-full max-h-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </a>
          </motion.div>
        )}

        {/* Text */}
        {message && (
          <p
            className={cn(
              "text-sm text-zinc-300 whitespace-pre-wrap break-words",
              isOwn && "text-right"
            )}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
