"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Press_Start_2P } from "next/font/google";
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
  GraduationCap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "@/components/ui/otp-input";
import { useToast } from "@/hooks/use-toast";
import { useSignup, useVerifyOTP, useResendOTP } from "@/hooks/useAuth";

const pressStart2P = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap" });

// ─── Pixel Cat Mascot ────────────────────────────────────────────────────────
const PX = 6; // px per "pixel"
const CAT_PX_W = 12 * PX; // 72px
const CAT_PX_H = 15 * PX; // 90px
/* eslint-disable @typescript-eslint/no-unused-vars */
const _ = null, D = "#2D1B10", O = "#E8954A", L = "#F5B96E",
      K = "#C47228", pk = "#F9A8A8", Ey = "#1E2952", wh = "#FFFFFF", N = "#E87AA0";
/* eslint-enable @typescript-eslint/no-unused-vars */

const CAT_GRID: (string | null)[][] = [
  [_, _, D, _, _, _, _, D, _, _, _, _],
  [_, D, O, D, _, _, D, O, D, _, _, _],
  [_, D, pk, O, D, _, D, O, pk, D, _, _],
  [_, _, D, O, O, D, O, O, D, _, _, _],
  [_, D, O, O, O, O, O, O, O, D, _, _],
  [_, D, O, K, O, O, O, K, O, D, _, _],
  [_, D, O, Ey, wh, O, Ey, wh, O, D, _, _],
  [_, D, L, O, O, N, O, O, L, D, _, _],
  [_, D, O, O, O, O, O, O, O, D, _, _],
  [_, _, D, O, O, O, O, D, _, _, D, _],
  [_, D, O, O, O, O, O, D, _, D, O, D],
  [_, D, O, O, O, O, O, O, D, O, O, D],
  [_, D, O, O, O, O, O, O, O, D, _, _],
  [_, _, D, O, D, _, D, O, D, _, _, _],
  [_, _, _, D, _, _, _, D, _, _, _, _],
];

const TAIL_KEYS = new Set(["10-9", "9-10", "10-10", "11-10", "9-11", "10-11", "11-11"]);

// Outline-only cat — no fill, just red pixel borders
function PixelCatOutlineSVG() {
  const body: React.ReactElement[] = [];
  const tail: React.ReactElement[] = [];
  CAT_GRID.forEach((row, r) =>
    row.forEach((color, c) => {
      if (!color) return;
      const el = (
        <rect
          key={`${r}-${c}`}
          x={c * PX} y={r * PX}
          width={PX} height={PX}
          fill="none"
          stroke="#E31837"
          strokeWidth="1"
          shapeRendering="crispEdges"
        />
      );
      (TAIL_KEYS.has(`${c}-${r}`) ? tail : body).push(el);
    })
  );
  return (
    <>
      <style>{`
        @keyframes yp-tail-o { 0%,100%{transform:rotate(0deg)}50%{transform:rotate(5deg)} }
        .yp-tail-o { transform-origin: ${9 * PX}px ${9 * PX}px; animation: yp-tail-o 1.4s ease-in-out infinite; }
      `}</style>
      <svg width={CAT_PX_W} height={CAT_PX_H} style={{ imageRendering: "pixelated" }} aria-hidden>
        <g>{body}</g>
        <g className="yp-tail-o">{tail}</g>
      </svg>
    </>
  );
}

// Join YorkPulse card with integrated cat + cloud animation
function JoinYorkPulseCard() {
  const [phase, setPhase] = useState<"entering" | "playing" | "done">("entering");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("playing"), 700);   // entrance done
    const t2 = setTimeout(() => setPhase("done"), 3300);     // playing done → show cloud
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const catAnimate =
    phase === "entering"
      ? { y: 0, rotate: 0 }
      : phase === "playing"
      ? { y: [0, -16, 2, -12, 2, -7, 0], rotate: [0, -5, 5, -3, 3, -1, 0] }
      : { y: 0, rotate: 0 };

  const catTransition =
    phase === "entering"
      ? { type: "spring" as const, stiffness: 260, damping: 20 }
      : phase === "playing"
      ? { duration: 2.6, ease: "easeInOut" as const, times: [0, 0.12, 0.28, 0.45, 0.62, 0.82, 1] }
      : { type: "spring" as const, stiffness: 180, damping: 18 };

  return (
    // mt-28 gives visual breathing room above the card for the cat
    <div className="relative mt-28 rounded-lg bg-white border border-gray-100 shadow-sm">
      {/* Cat + cloud stage — anchored to top-right of card */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          right: 8,
          top: -CAT_PX_H,
          width: CAT_PX_W,
          height: CAT_PX_H,
          // overflow:hidden clips the cat behind the card during entrance;
          // overflow:visible lets it bounce freely + shows cloud after
          overflow: phase === "entering" ? "hidden" : "visible",
          zIndex: 10,
        }}
      >
        {/* Speech bubble — appears only after playing, tail at bottom-left */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              style={{ position: "absolute", top: -52, right: 0 }}
            >
              <div
                className={`${pressStart2P.className} bg-white rounded-xl px-3 py-2.5 text-[7px] text-gray-800 whitespace-nowrap`}
                style={{ border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
              >
                wassup dawg?!
              </div>
              {/* Tail at bottom-left — border layer */}
              <div style={{ position: "absolute", bottom: -9, left: 10, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "9px solid #e5e7eb" }} />
              {/* Tail at bottom-left — fill layer */}
              <div style={{ position: "absolute", bottom: -7, left: 11, width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid white" }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cat sprite — pops up from behind card, then plays */}
        <motion.div
          initial={{ y: CAT_PX_H }}
          animate={catAnimate}
          transition={catTransition}
        >
          <PixelCatOutlineSVG />
        </motion.div>
      </div>

      {/* Card content — right padding so text doesn't overlap cat area */}
      <div className="flex items-center gap-3 p-3 pr-[88px]">
        <div className="w-10 h-10 rounded-lg bg-[#E31837] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">YP</span>
        </div>
        <div>
          <p className="font-semibold text-sm">Join YorkPulse</p>
          <p className="text-xs text-gray-400">The community platform for York University students</p>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

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
  {
    icon: GraduationCap,
    title: "Link Up",
    description: "7706 courses & residence chats",
  },
];

type Step = "email" | "otp";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [emailError, setEmailError] = useState("");
  const [cooldown, setCooldown] = useState(0);

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
    const isYorkEmail = emailLower.endsWith("@yorku.ca") || emailLower.endsWith("@my.yorku.ca") || emailLower === "yorkpulse.app@gmail.com";

    if (!isYorkEmail) {
      setEmailError("YorkPulse is exclusively for York University. Please use your @yorku.ca or @my.yorku.ca email.");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  // Handle email submission
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    // Switch to OTP page immediately — don't block on API round-trip
    setStep("otp");
    setCooldown(60);

    signupMutation.mutate({ email }, {
      onError: (error) => {
        // Revert if the request actually failed
        setStep("email");
        setCooldown(0);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to create account",
          variant: "destructive",
        });
      },
    });
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
      await verifyOTPMutation.mutateAsync({ email, code: otp });

      toast({
        title: "Welcome to YorkPulse!",
        description: "Your account has been created successfully.",
      });

      router.push("/auth/setup");
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
      await resendOTPMutation.mutateAsync({ email });
      setCooldown(60);
      setOtp("");
      toast({
        title: "Code resent",
        description: "A new verification code has been sent to your email.",
      });
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
          {/* Join YorkPulse card with animated pixel cat */}
          <JoinYorkPulseCard />

          {/* Features */}
          <div className="grid gap-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100 shadow-sm"
              >
                <div className="w-10 h-10 rounded-lg bg-[#E31837]/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-[#E31837]" />
                </div>
                <div>
                  <p className="font-medium text-sm">{feature.title}</p>
                  <p className="text-xs text-gray-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">York Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                <p className="text-xs text-gray-400">
                  We&apos;ll send you a 6-digit verification code
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#E31837] hover:bg-[#C41230]"
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

          <p className="text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-[#E31837] hover:underline">
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-gray-400">
            By signing up, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-gray-500">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-gray-500">
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
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E31837]/10 flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[#E31837]" />
            </div>
            <h1 className="text-2xl font-bold">Verify your email</h1>
            <p className="text-gray-500">
              We sent a verification code to
            </p>
            <p className="text-[#E31837] font-medium">{email}</p>
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
              className="w-full bg-[#E31837] hover:bg-[#C41230]"
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
            <p className="text-sm text-gray-400">
              Didn&apos;t receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              disabled={cooldown > 0 || resendOTPMutation.isPending}
              className="text-[#E31837] hover:text-[#E31837]"
            >
              {resendOTPMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </Button>
          </div>

          <p className="text-xs text-center text-gray-400">
            The code expires in 10 minutes
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
