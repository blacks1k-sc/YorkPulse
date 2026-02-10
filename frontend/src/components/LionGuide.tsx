"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ExternalLink,
  Bot,
  User,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ title: string; url: string }>;
  timestamp: Date;
}

export function LionGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm LionGuide, your York University AI assistant. Ask me anything about York - classes, programs, deadlines, campus services, and more!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await api.ask.question(question);

      // Add assistant response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I encountered an error. Please try again or check the York University website at yorku.ca for more information.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const suggestedQuestions = [
    "When do Fall 2025 classes start?",
    "What programs does Lassonde offer?",
    "How do I apply for scholarships?",
  ];

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 md:bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white shadow-lg hover:shadow-xl flex items-center justify-center"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 md:bottom-6 right-4 z-50 w-[calc(100vw-2rem)] max-w-md h-[500px] max-h-[70vh] bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-red-600/20 to-red-700/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">LionGuide</h3>
                  <p className="text-xs text-zinc-400">York University AI Assistant</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        message.role === "user"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      )}
                    >
                      {message.role === "user" ? (
                        <User className="w-4 h-4" />
                      ) : (
                        <Bot className="w-4 h-4" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-green-600 text-white"
                          : "bg-white/10 text-zinc-100"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <p className="text-xs text-zinc-400 mb-2">Sources:</p>
                          <div className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="truncate">{source.title}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-white/10 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Suggested questions (only show if few messages) */}
                {messages.length <= 2 && !isLoading && (
                  <div className="pt-2">
                    <p className="text-xs text-zinc-500 mb-2">Try asking:</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                          }}
                          className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-white/10 bg-zinc-900/50"
            >
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about York University..."
                  className="flex-1 bg-white/5 border-white/10 focus:border-red-500/50"
                  disabled={isLoading}
                  maxLength={500}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
