"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Users,
  Hash,
  ArrowLeft,
  Loader2,
  GraduationCap,
  LogOut,
  Vote,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessage } from "@/components/chat/ChatMessage";
import type { Course, CourseChannel, CourseMessage, VoteStatus } from "@/types";

// View modes
type ViewMode = "browse" | "chat";

export default function CoursesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaculties, setExpandedFaculties] = useState<Set<string>>(new Set());
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<CourseChannel | null>(null);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [profNameInput, setProfNameInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Queries
  const { data: hierarchy, isLoading: hierarchyLoading } = useQuery({
    queryKey: ["courses", "hierarchy"],
    queryFn: () => api.courses.getHierarchy(),
  });

  const { data: myCourses, isLoading: myCoursesLoading } = useQuery({
    queryKey: ["courses", "my"],
    queryFn: () => api.courses.getMyCourses(),
    enabled: isAuthenticated,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["courses", "search", searchQuery],
    queryFn: () => api.courses.search(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const { data: channels } = useQuery({
    queryKey: ["courses", selectedCourse?.id, "channels"],
    queryFn: () => api.courses.getChannels(selectedCourse!.id),
    enabled: !!selectedCourse && viewMode === "chat",
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["courses", "channels", selectedChannel?.id, "messages"],
    queryFn: () => api.courses.getMessages(selectedChannel!.id),
    enabled: !!selectedChannel,
    refetchInterval: 5000, // Poll for new messages
  });

  const { data: voteStatus } = useQuery({
    queryKey: ["courses", selectedCourse?.id, "vote-status"],
    queryFn: () => api.courses.getVoteStatus(selectedCourse!.id),
    enabled: !!selectedCourse && viewMode === "chat",
  });

  // Mutations
  const joinCourseMutation = useMutation({
    mutationFn: (courseId: string) => api.courses.joinCourse(courseId),
    onSuccess: (data) => {
      toast({ title: "Joined!", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["courses", "my"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "hierarchy"] });
      setSelectedCourse(data.course);
      setSelectedChannel(data.general_channel);
      setViewMode("chat");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const leaveCourseMutation = useMutation({
    mutationFn: (courseId: string) => api.courses.leaveCourse(courseId),
    onSuccess: () => {
      toast({ title: "Left course" });
      queryClient.invalidateQueries({ queryKey: ["courses", "my"] });
      queryClient.invalidateQueries({ queryKey: ["courses", "hierarchy"] });
      setSelectedCourse(null);
      setSelectedChannel(null);
      setViewMode("browse");
    },
  });

  const joinChannelMutation = useMutation({
    mutationFn: (channelId: string) => api.courses.joinChannel(channelId),
    onSuccess: (data) => {
      toast({ title: "Joined channel", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse?.id, "channels"] });
      setSelectedChannel(data.channel);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: ({
      channelId,
      message,
      imageUrl,
    }: {
      channelId: string;
      message?: string;
      imageUrl?: string;
    }) => api.courses.sendMessage(channelId, message, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", "channels", selectedChannel?.id, "messages"] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({ courseId, profName }: { courseId: string; profName: string }) =>
      api.courses.voteForProfessor(courseId, profName),
    onSuccess: (data) => {
      toast({
        title: data.channel_created ? "Channel created!" : "Vote recorded",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse?.id, "vote-status"] });
      queryClient.invalidateQueries({ queryKey: ["courses", selectedCourse?.id, "channels"] });
      setShowVoteDialog(false);
      setProfNameInput("");
      if (data.channel) {
        setSelectedChannel(data.channel);
      }
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.messages]);

  // Check if user is member of a course
  const isCourseMember = (courseId: string) => {
    return myCourses?.courses.some((m) => m.course.id === courseId);
  };

  // Handle course click
  const handleCourseClick = (course: Course) => {
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join courses",
        variant: "destructive",
      });
      return;
    }

    if (isCourseMember(course.id)) {
      // Already a member, go to chat
      setSelectedCourse(course);
      setViewMode("chat");
    } else {
      // Join the course
      joinCourseMutation.mutate(course.id);
    }
  };

  // Handle channel click
  const handleChannelClick = (channel: CourseChannel) => {
    if (channel.type === "professor") {
      // Check if already a member
      joinChannelMutation.mutate(channel.id);
    } else {
      setSelectedChannel(channel);
    }
  };

  // Handle send message
  const handleSendMessage = async (message: string | null, imageUrl: string | null) => {
    if (!selectedChannel) return;
    await sendMessageMutation.mutateAsync({
      channelId: selectedChannel.id,
      message: message || undefined,
      imageUrl: imageUrl || undefined,
    });
  };

  // Toggle faculty expansion
  const toggleFaculty = (faculty: string) => {
    setExpandedFaculties((prev) => {
      const next = new Set(prev);
      if (next.has(faculty)) {
        next.delete(faculty);
      } else {
        next.add(faculty);
      }
      return next;
    });
  };

  // Toggle program expansion
  const toggleProgram = (key: string) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Render browse view
  const renderBrowseView = () => (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          placeholder="Search courses by code or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10"
        />
      </div>

      {/* Search Results */}
      {searchQuery.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-white/5 border border-white/10"
        >
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Search Results</h3>
          {searchLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : searchResults?.results.length === 0 ? (
            <p className="text-sm text-zinc-500">No courses found</p>
          ) : (
            <div className="space-y-2">
              {searchResults?.results.map((course) => (
                <motion.div
                  key={course.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleCourseClick(course as Course)}
                  className={cn(
                    "p-3 rounded-lg cursor-pointer transition-colors",
                    "bg-white/5 hover:bg-white/10 border border-white/5",
                    isCourseMember(course.id) && "border-[#00ff88]/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[#00ff88]">{course.code}</span>
                        {isCourseMember(course.id) && (
                          <Badge variant="secondary" className="bg-[#00ff88]/20 text-[#00ff88] text-xs">
                            Joined
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 mt-1">{course.name}</p>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">{course.member_count}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* My Courses */}
      {isAuthenticated && myCourses && myCourses.courses.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">My Courses</h3>
          <div className="flex flex-wrap gap-2">
            {myCourses.courses.map((membership) => (
              <motion.div
                key={membership.course.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSelectedCourse(membership.course);
                  setViewMode("chat");
                }}
                className="px-3 py-2 rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/30 cursor-pointer"
              >
                <span className="font-mono text-sm text-[#00ff88]">{membership.course.code}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Mind Map Hierarchy */}
      {hierarchyLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {hierarchy?.faculties.map((faculty) => (
            <motion.div
              key={faculty.name}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
            >
              {/* Faculty Header */}
              <button
                onClick={() => toggleFaculty(faculty.name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-5 h-5 text-purple-400" />
                  <span className="font-medium">{faculty.name}</span>
                </div>
                <ChevronRight
                  className={cn(
                    "w-5 h-5 text-zinc-500 transition-transform",
                    expandedFaculties.has(faculty.name) && "rotate-90"
                  )}
                />
              </button>

              {/* Programs */}
              <AnimatePresence>
                {expandedFaculties.has(faculty.name) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-white/10"
                  >
                    {faculty.programs.map((program) => {
                      const programKey = `${faculty.name}-${program.name}`;
                      return (
                        <div key={program.name} className="border-b border-white/5 last:border-0">
                          {/* Program Header */}
                          <button
                            onClick={() => toggleProgram(programKey)}
                            className="w-full px-6 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                          >
                            <span className="text-sm text-zinc-300">{program.name}</span>
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 text-zinc-500 transition-transform",
                                expandedPrograms.has(programKey) && "rotate-180"
                              )}
                            />
                          </button>

                          {/* Courses by Year */}
                          <AnimatePresence>
                            {expandedPrograms.has(programKey) && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-6 pb-3"
                              >
                                {program.years.map((yearGroup) => (
                                  <div key={yearGroup.year} className="mt-2">
                                    <p className="text-xs text-zinc-500 mb-2">Year {yearGroup.year}</p>
                                    <div className="flex flex-wrap gap-2">
                                      {yearGroup.courses.map((course) => (
                                        <motion.button
                                          key={course.id}
                                          whileHover={{ scale: 1.05 }}
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => handleCourseClick(course as Course)}
                                          className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-mono transition-colors",
                                            "bg-white/5 hover:bg-white/10 border border-white/10",
                                            isCourseMember(course.id) && "border-[#00ff88]/50 bg-[#00ff88]/10"
                                          )}
                                        >
                                          <span className="text-[#00ff88]">{course.code}</span>
                                          <span className="ml-2 text-zinc-500">{course.member_count}</span>
                                        </motion.button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // Render chat view
  const renderChatView = () => (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 p-4 bg-white/5 border-b border-white/10 rounded-t-xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setViewMode("browse");
            setSelectedCourse(null);
            setSelectedChannel(null);
          }}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#00ff88]">{selectedCourse?.code}</span>
            {selectedChannel && (
              <>
                <ChevronRight className="w-4 h-4 text-zinc-500" />
                <Hash className="w-4 h-4 text-zinc-400" />
                <span className="text-sm">{selectedChannel.name}</span>
              </>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{selectedCourse?.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300"
          onClick={() => selectedCourse && leaveCourseMutation.mutate(selectedCourse.id)}
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Channel Sidebar */}
        <div className="w-48 border-r border-white/10 bg-white/[0.02] flex flex-col">
          <div className="p-2 border-b border-white/10">
            <p className="text-xs text-zinc-500 px-2">Channels</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {channels?.channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelClick(channel)}
                  className={cn(
                    "w-full px-2 py-1.5 rounded flex items-center gap-2 text-sm transition-colors",
                    selectedChannel?.id === channel.id
                      ? "bg-[#00ff88]/20 text-[#00ff88]"
                      : "hover:bg-white/5 text-zinc-400"
                  )}
                >
                  <Hash className="w-4 h-4" />
                  <span className="truncate">{channel.name}</span>
                  <span className="text-xs text-zinc-600 ml-auto">{channel.member_count}</span>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Vote Button */}
          <div className="p-2 border-t border-white/10">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={() => setShowVoteDialog(true)}
            >
              <Vote className="w-3 h-3 mr-1" />
              Request Prof Channel
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {/* Vote Status Banner (for general channel) */}
          {selectedChannel?.type === "general" && voteStatus && voteStatus.votes.length > 0 && (
            <div className="p-3 bg-purple-500/10 border-b border-purple-500/20">
              <p className="text-xs text-purple-300 mb-2">Current professor channel votes:</p>
              <div className="flex flex-wrap gap-2">
                {voteStatus.votes.map((vote) => (
                  <Badge
                    key={vote.prof_name_normalized}
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      vote.has_voted ? "bg-purple-500/30" : "bg-white/10"
                    )}
                  >
                    {vote.prof_name}: {vote.vote_count}/{vote.threshold}
                    {vote.has_voted && " (voted)"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            {messagesLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="w-24 h-4" />
                      <Skeleton className="w-48 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages?.messages.length === 0 ? (
              <div className="text-center py-12">
                <Hash className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-500">No messages yet</p>
                <p className="text-zinc-600 text-sm mt-1">Be the first to say something!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages?.messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg.message}
                    imageUrl={msg.image_url}
                    authorName={msg.author.name}
                    authorAvatarUrl={msg.author.avatar_url}
                    authorId={msg.author.id}
                    currentUserId={user?.id}
                    timestamp={msg.created_at}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <div className="p-4 border-t border-white/10">
            <ChatInput
              placeholder={`Message #${selectedChannel?.name || "general"}`}
              maxLength={500}
              onSend={handleSendMessage}
              getUploadUrl={api.courses.getChatImageUploadUrl}
              disabled={sendMessageMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* Vote Dialog */}
      <Dialog open={showVoteDialog} onOpenChange={setShowVoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Professor Channel</DialogTitle>
            <DialogDescription>
              Enter your professor's name. When 5 students vote for the same professor, a channel
              will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Professor name (e.g., John Smith)"
              value={profNameInput}
              onChange={(e) => setProfNameInput(e.target.value)}
            />
            {voteStatus && voteStatus.votes.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-zinc-500 mb-2">Current votes this semester:</p>
                <div className="space-y-1">
                  {voteStatus.votes.map((vote) => (
                    <div
                      key={vote.prof_name_normalized}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-300">{vote.prof_name}</span>
                      <Badge variant="secondary">
                        {vote.vote_count}/{vote.threshold}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVoteDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                selectedCourse &&
                voteMutation.mutate({
                  courseId: selectedCourse.id,
                  profName: profNameInput,
                })
              }
              disabled={!profNameInput.trim() || voteMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {voteMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Vote className="w-4 h-4 mr-2" />
              )}
              Vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold mb-1">Course Chat</h1>
        <p className="text-sm text-zinc-500">
          {viewMode === "browse"
            ? "Browse and join course chat rooms"
            : `Chatting in ${selectedCourse?.code}`}
        </p>
      </motion.div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, x: viewMode === "chat" ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: viewMode === "chat" ? -20 : 20 }}
          transition={{ duration: 0.2 }}
        >
          {viewMode === "browse" ? renderBrowseView() : renderChatView()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
