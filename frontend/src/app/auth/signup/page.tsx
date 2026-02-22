"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  CheckCircle,
  Shield,
  ShoppingBag,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "@/components/ui/otp-input";
import { useToast } from "@/hooks/use-toast";
import { useSignup, useVerifyOTP, useResendOTP } from "@/hooks/useAuth";

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

type Step = "email" | "otp";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devMode, setDevMode] = useState(false);

  const router = useRouter();
  const { toast } = useToast();
  const signupMutation = useSignup();
  const verifyOTPMutation = useVerifyOTP();
  const resendOTPMutation = useResendOTP();

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  // Validate York email
  const validateEmail = useCallback((value: string): boolean => {
    const emailLower = value.toLowerCase();
    if (!emailLower.endsWith("@yorku.ca") && !emailLower.endsWith("@my.yorku.ca")) {
      setEmailError("YorkPulse is exclusively for York University. Please use your @yorku.ca or @my.yorku.ca email.");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    try {
      const response = await signupMutation.mutateAsync({ email, devMode });
      setStep("otp");
      setCooldown(60);

      // Check if dev mode OTP is in the response
      const devOtpMatch = response.message.match(/\[DEV MODE\] Your verification code is: (\d{6})/);
      if (devOtpMatch) {
        toast({
          title: "Dev Mode",
          description: `Your OTP code is: ${devOtpMatch[1]}`,
          duration: 30000, // Show for 30 seconds
        });
      } else {
        toast({
          title: "Code sent",
          description: "Please check your email for the verification code.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create account",
        variant: "destructive",
      });
    }
  };

  // Handle OTP verification
  const handleOTPSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (otp.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the complete 6-digit code",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await verifyOTPMutation.mutateAsync({ email, code: otp, devMode });

      toast({
        title: "Welcome to YorkPulse!",
        description: "Your account has been created successfully.",
      });

      // New users always need name verification
      if (response.requires_name_verification) {
        router.push("/auth/setup-profile");
      } else {
        router.push("/");
      }
    } catch (error) {
      setOtp("");
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Invalid or expired code",
        variant: "destructive",
      });
    }
  };

  // Handle resend OTP
  const handleResend = async () => {
    if (cooldown > 0) return;

    try {
      const response = await resendOTPMutation.mutateAsync({ email, devMode });
      setCooldown(60);
      setOtp("");

      // Check if dev mode OTP is in the response
      const devOtpMatch = response.message.match(/\[DEV MODE\] Your verification code is: (\d{6})/);
      if (devOtpMatch) {
        toast({
          title: "Dev Mode",
          description: `Your new OTP code is: ${devOtpMatch[1]}`,
          duration: 30000,
        });
      } else {
        toast({
          title: "Code resent",
          description: "A new verification code has been sent to your email.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend code",
        variant: "destructive",
      });
    }
  };

  // Auto-submit when OTP is complete
  useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      handleOTPSubmit();
    }
  }, [otp]);

  // Go back to email step
  const handleBack = () => {
    setStep("email");
    setOtp("");
  };

  return (
    <AnimatePresence mode="wait">
      {step === "email" ? (
        <motion.div
          key="email"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
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

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">York Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@my.yorku.ca"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) validateEmail(e.target.value);
                  }}
                  onBlur={() => email && validateEmail(email)}
                  className={`pl-10 ${emailError ? "border-red-500 focus:border-red-500" : ""}`}
                  required
                />
              </div>
              {emailError ? (
                <p className="text-xs text-red-400">{emailError}</p>
              ) : (
                <p className="text-xs text-zinc-500">
                  We&apos;ll send you a 6-digit verification code
                </p>
              )}
            </div>

            {/* Dev Mode Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${devMode ? "text-yellow-400" : "text-zinc-500"}`} />
                <div>
                  <p className="text-sm font-medium">Dev Mode</p>
                  <p className="text-xs text-zinc-500">
                    {devMode ? "OTP shown in toast (no email)" : "OTP sent via email"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDevMode(!devMode)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  devMode ? "bg-yellow-500" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    devMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={signupMutation.isPending || !!emailError}
            >
              {signupMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending code...
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
      ) : (
        <motion.div
          key="otp"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="text-zinc-400">
              We sent a verification code to
            </p>
            <p className="text-purple-400 font-medium">{email}</p>
          </div>

          <form onSubmit={handleOTPSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label className="text-center block">Enter verification code</Label>
              <OTPInput
                value={otp}
                onChange={setOtp}
                disabled={verifyOTPMutation.isPending}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={verifyOTPMutation.isPending || otp.length !== 6}
            >
              {verifyOTPMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          {/* Resend section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-zinc-500">
              Didn&apos;t receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={cooldown > 0 || resendOTPMutation.isPending}
              className="text-purple-400 hover:text-purple-300"
            >
              {resendOTPMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </Button>
          </div>

          <p className="text-xs text-center text-zinc-600">
            The code expires in 10 minutes
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
