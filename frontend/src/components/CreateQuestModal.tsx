"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Dumbbell,
  BookOpen,
  Utensils,
  Car,
  Gamepad2,
  Plus,
  MapPin,
  Clock,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUIStore } from "@/stores/ui";
import { useCreateQuest } from "@/hooks/useQuests";
import { cn } from "@/lib/utils";
import { LocationPickerWrapper } from "@/components/LocationPickerWrapper";
import type { QuestCategory, VibeLevel } from "@/types";

const categories: { value: QuestCategory; label: string; icon: typeof Dumbbell; color: string }[] = [
  { value: "gym", label: "Gym", icon: Dumbbell, color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "food", label: "Food", icon: Utensils, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { value: "study", label: "Study", icon: BookOpen, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "game", label: "Game", icon: Gamepad2, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { value: "commute", label: "Commute", icon: Car, color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "custom", label: "Custom", icon: Plus, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
];

const vibeLevels: { value: VibeLevel; label: string; emoji: string }[] = [
  { value: "chill", label: "Chill", emoji: "😌" },
  { value: "intermediate", label: "Intermediate", emoji: "👍" },
  { value: "high_energy", label: "High Energy", emoji: "⚡" },
  { value: "intense", label: "Intense", emoji: "🔥" },
];

const timeQuickOptions = [
  { label: "Now", getValue: () => new Date().toISOString() },
  { label: "In 1 hour", getValue: () => new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  { label: "Custom", getValue: () => null },
];

export function CreateQuestModal() {
  const { isCreateModalOpen, createModalType, closeCreateModal } = useUIStore();
  const { toast } = useToast();
  const createMutation = useCreateQuest();

  // Form state
  const [category, setCategory] = useState<QuestCategory>("gym");
  const [customCategory, setCustomCategory] = useState("");
  const [activity, setActivity] = useState("");
  const [description, setDescription] = useState("");
  const [locationData, setLocationData] = useState<{
    lat: number | null;
    lng: number | null;
    name: string;
  }>({ lat: null, lng: null, name: "" });
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [selectedTimeOption, setSelectedTimeOption] = useState<string | null>(null);
  const [vibeLevel, setVibeLevel] = useState<VibeLevel>("chill");
  const [maxParticipants, setMaxParticipants] = useState(2);
  const [requiresApproval, setRequiresApproval] = useState(true);

  const isOpen = isCreateModalOpen && createModalType === "quest";

  const resetForm = () => {
    setCategory("gym");
    setCustomCategory("");
    setActivity("");
    setDescription("");
    setLocationData({ lat: null, lng: null, name: "" });
    setStartTime("");
    setEndTime("");
    setShowCustomTime(false);
    setSelectedTimeOption(null);
    setVibeLevel("chill");
    setMaxParticipants(2);
    setRequiresApproval(true);
  };

  const handleClose = () => {
    closeCreateModal();
    resetForm();
  };

  const handleTimeQuickOption = (option: typeof timeQuickOptions[0]) => {
    const value = option.getValue();
    setSelectedTimeOption(option.label);
    if (value) {
      setStartTime(value);
      setShowCustomTime(false);
    } else {
      setShowCustomTime(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activity.trim()) {
      toast({
        title: "Activity required",
        description: "Please describe what you will be doing",
        variant: "destructive",
      });
      return;
    }

    if (!locationData.name.trim()) {
      toast({
        title: "Location required",
        description: "Please specify where this will take place",
        variant: "destructive",
      });
      return;
    }

    if (!startTime) {
      toast({
        title: "Time required",
        description: "Please select when this quest starts",
        variant: "destructive",
      });
      return;
    }

    if (category === "custom" && !customCategory.trim()) {
      toast({
        title: "Custom category required",
        description: "Please specify your custom category",
        variant: "destructive",
      });
      return;
    }

    try {
      await createMutation.mutateAsync({
        category,
        custom_category: category === "custom" ? customCategory : undefined,
        activity: activity.trim(),
        description: description.trim() || undefined,
        start_time: startTime,
        end_time: endTime || undefined,
        location: locationData.name.trim(),
        latitude: locationData.lat || undefined,
        longitude: locationData.lng || undefined,
        vibe_level: vibeLevel,
        max_participants: maxParticipants,
        requires_approval: requiresApproval,
      });

      toast({
        title: "Quest created!",
        description: "Your side quest has been posted",
      });

      handleClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create quest",
        variant: "destructive",
      });
    }
  };

  // Convert ISO string to datetime-local format
  const formatDateTimeLocal = (isoString: string) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  };

  // Convert datetime-local to ISO string
  const handleDateTimeChange = (value: string, setter: (v: string) => void) => {
    if (value) {
      setter(new Date(value).toISOString());
    } else {
      setter("");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[10000] max-h-[90vh] overflow-y-auto rounded-t-3xl bg-zinc-900 border-t border-white/10 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full md:rounded-2xl md:border"
          >
            {/* Header */}
            <div className="sticky top-0 z-[10001] flex items-center justify-between p-4 bg-zinc-900/95 backdrop-blur border-b border-white/10">
              <h2 className="text-lg font-semibold">Create Side Quest</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="rounded-full"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-4 space-y-6">
              {/* Category Pills */}
              <div className="space-y-2">
                <Label>Category</Label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-sm",
                        category === cat.value
                          ? cat.color
                          : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <cat.icon className="w-4 h-4" />
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Custom Category Input */}
                {category === "custom" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <Input
                      placeholder="Enter custom category..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      maxLength={50}
                    />
                  </motion.div>
                )}
              </div>

              {/* Activity Type */}
              <div className="space-y-2">
                <Label htmlFor="activity">What are you doing?</Label>
                <Textarea
                  id="activity"
                  placeholder="e.g., Heavy Leg Day / Spotter Needed"
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  maxLength={200}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Location with Map Picker */}
              <div className="space-y-2">
                <Label>
                  <MapPin className="w-4 h-4 inline-block mr-1" />
                  Where at York?
                </Label>
                <LocationPickerWrapper value={locationData} onChange={setLocationData} />
              </div>

              {/* Timeframe */}
              <div className="space-y-2">
                <Label>
                  <Clock className="w-4 h-4 inline-block mr-1" />
                  When?
                </Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {timeQuickOptions.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handleTimeQuickOption(option)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-all",
                        selectedTimeOption === option.label
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {showCustomTime && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="startTime" className="text-xs text-zinc-500">Start Time</Label>
                        <Input
                          id="startTime"
                          type="datetime-local"
                          value={formatDateTimeLocal(startTime)}
                          onChange={(e) => handleDateTimeChange(e.target.value, setStartTime)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="endTime" className="text-xs text-zinc-500">End Time (Optional)</Label>
                        <Input
                          id="endTime"
                          type="datetime-local"
                          value={formatDateTimeLocal(endTime)}
                          onChange={(e) => handleDateTimeChange(e.target.value, setEndTime)}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Vibe Level */}
              <div className="space-y-2">
                <Label>
                  <Zap className="w-4 h-4 inline-block mr-1" />
                  Vibe / Level
                </Label>
                <div className="flex flex-wrap gap-2">
                  {vibeLevels.map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setVibeLevel(level.value)}
                      className={cn(
                        "px-3 py-2 rounded-full text-sm border transition-all flex items-center gap-1.5",
                        vibeLevel === level.value
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <span>{level.emoji}</span>
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Peer Limit */}
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">
                  <Users className="w-4 h-4 inline-block mr-1" />
                  How many buddies? ({maxParticipants})
                </Label>
                <input
                  id="maxParticipants"
                  type="range"
                  min={1}
                  max={10}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-green-500"
                />
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>

              {/* Requires Approval */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="font-medium text-sm">
                    {requiresApproval ? "Manually approve participants" : "Auto-accept (first-come-first-served)"}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {requiresApproval
                      ? "Review who joins your quest"
                      : "Anyone can join immediately"}
                  </p>
                </div>
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                />
              </div>

              {/* Description (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="description">Additional Details (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Any other information participants should know..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Post Quest"
                )}
              </Button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
