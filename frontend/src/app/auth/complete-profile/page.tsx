"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  GraduationCap,
  FileText,
  Loader2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUpdateProfile, useUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

// Program suggestions
const PROGRAM_SUGGESTIONS = [
  "Accounting",
  "Biology",
  "Business Administration",
  "Chemistry",
  "Civil Engineering",
  "Commerce",
  "Computer Engineering",
  "Computer Science",
  "Computer Science for Software Development",
  "Dance",
  "Digital Arts",
  "Digital Technologies",
  "Economics",
  "Education",
  "English",
  "Finance",
  "Health Science",
  "Health Studies",
  "History",
  "Information Technology",
  "Kinesiology",
  "Management",
  "Marketing",
  "Mathematics",
  "Mechanical Engineering",
  "Music",
  "Nursing",
  "Philosophy",
  "Physics",
  "Political Science",
  "Psychology",
  "Sociology",
  "Software Engineering",
  "Statistics",
  "Theatre",
  "Visual Arts",
];

export default function CompleteProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: user, refetch } = useUser();
  const updateProfileMutation = useUpdateProfile();

  const [program, setProgram] = useState(user?.program || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests?.join(", ") || "");

  // Validation
  const MIN_PROGRAM_LENGTH = 3;
  const MIN_BIO_LENGTH = 20;

  const programError =
    program.trim().length > 0 && program.trim().length < MIN_PROGRAM_LENGTH
      ? `Program must be at least ${MIN_PROGRAM_LENGTH} characters`
      : "";
  const bioError =
    bio.trim().length > 0 && bio.trim().length < MIN_BIO_LENGTH
      ? `Bio must be at least ${MIN_BIO_LENGTH} characters`
      : "";

  const isFormValid =
    program.trim().length >= MIN_PROGRAM_LENGTH &&
    bio.trim().length >= MIN_BIO_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) {
      toast({
        title: "Please complete all fields",
        description: "Both program and bio are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        program: program.trim(),
        bio: bio.trim(),
        interests: interests
          ? interests
              .split(",")
              .map((i) => i.trim())
              .filter(Boolean)
          : undefined,
      });

      await refetch();

      toast({ title: "Profile completed!", description: "Welcome to YorkPulse" });
      router.push("/");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold">Complete Your Profile</h1>
        <p className="text-zinc-400">
          Tell us a bit about yourself to get started
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Program */}
        <div className="space-y-2">
          <Label htmlFor="program" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-purple-400" />
            Program <span className="text-red-400">*</span>
          </Label>
          <Input
            id="program"
            list="program-suggestions"
            placeholder="e.g., Computer Science"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            className={cn(
              "bg-white/5 border-white/10",
              programError && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          <datalist id="program-suggestions">
            {PROGRAM_SUGGESTIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="flex justify-between text-xs">
            <span className={cn(programError ? "text-red-400" : "text-zinc-500")}>
              {programError || `Min ${MIN_PROGRAM_LENGTH} characters`}
            </span>
            <span className="text-zinc-500">{program.trim().length} chars</span>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <Label htmlFor="bio" className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Bio <span className="text-red-400">*</span>
          </Label>
          <Textarea
            id="bio"
            placeholder="Tell us about yourself - your interests, what you're studying, what you're looking for..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={cn(
              "min-h-[120px] bg-white/5 border-white/10 resize-none",
              bioError && "border-red-500 focus-visible:ring-red-500"
            )}
          />
          <div className="flex justify-between text-xs">
            <span className={cn(bioError ? "text-red-400" : "text-zinc-500")}>
              {bioError || `Min ${MIN_BIO_LENGTH} characters`}
            </span>
            <span className="text-zinc-500">{bio.trim().length} chars</span>
          </div>
        </div>

        {/* Interests */}
        <div className="space-y-2">
          <Label htmlFor="interests" className="text-zinc-400">
            Interests (optional)
          </Label>
          <Input
            id="interests"
            placeholder="e.g., coding, music, basketball"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            className="bg-white/5 border-white/10"
          />
          <p className="text-xs text-zinc-500">Separate with commas</p>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700"
          disabled={updateProfileMutation.isPending || !isFormValid}
        >
          {updateProfileMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      {/* Info */}
      <p className="text-xs text-center text-zinc-500">
        You can update your profile anytime from your profile page
      </p>
    </motion.div>
  );
}
