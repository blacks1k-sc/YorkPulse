"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Loader2, Shield, ShoppingBag, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSignup } from "@/hooks/useAuth";

const features = [
  {
    icon: Shield,
    title: "The Vault",
    description: "Anonymous forum for real talk",
  },
  {
    icon: ShoppingBag,
    title: "Marketplace",
    description: "Buy & sell with verified students",
  },
  {
    icon: Users,
    title: "Side Quests",
    description: "Find buddies for any activity",
  },
];

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const router = useRouter();
  const { toast } = useToast();
  const signupMutation = useSignup();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.endsWith("@yorku.ca") && !email.endsWith("@my.yorku.ca")) {
      toast({
        title: "Invalid email",
        description: "YorkPulse is exclusively for York University. Please use your @yorku.ca or @my.yorku.ca email.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await signupMutation.mutateAsync(email);
      // Extract dev token from message (development only)
      const devTokenMatch = response.message.match(/\(Dev token: ([^)]+)\)/);
      const devToken = devTokenMatch ? devTokenMatch[1] : null;
      const tokenParam = devToken ? `&token=${encodeURIComponent(devToken)}` : "";
      router.push(`/auth/check-email?email=${encodeURIComponent(email)}&signup=true${tokenParam}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
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
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Join YorkPulse</h1>
        <p className="text-zinc-400">
          The community platform for York University students
        </p>
      </div>

      {/* Features */}
      <div className="grid gap-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <feature.icon className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="font-medium text-sm">{feature.title}</p>
              <p className="text-xs text-zinc-500">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">York Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <Input
              id="email"
              type="email"
              placeholder="your.name@my.yorku.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
          <p className="text-xs text-zinc-500">
            Only @yorku.ca or @my.yorku.ca emails are accepted
          </p>
        </div>

        <Button
          type="submit"
          className="w-full bg-purple-600 hover:bg-purple-700"
          disabled={signupMutation.isPending}
        >
          {signupMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-400">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-purple-400 hover:underline">
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs text-zinc-500">
        By signing up, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-zinc-400">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-zinc-400">
          Privacy Policy
        </Link>
      </p>
    </motion.div>
  );
}
