"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ChatMessageProps {
  message: string | null;
  imageUrl: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorId: string;
  currentUserId?: string;
  timestamp: string;
  showAvatar?: boolean;
}

export function ChatMessage({
  message,
  imageUrl,
  authorName,
  authorAvatarUrl,
  authorId,
  currentUserId,
  timestamp,
  showAvatar = true,
}: ChatMessageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isOwn = authorId === currentUserId;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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
        </div>

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
