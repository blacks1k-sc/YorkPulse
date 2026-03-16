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
const PX = 5; // px per pixel

// Lounging cat — 26 cols × 15 rows
// Head upper-right, body horizontal, tail forms a closed loop on the left.
// The loop's inner hollow + the head/body interiors are all empty: only the
// silhouette BORDER pixels are rendered, making the cat completely hollow.
const SILHOUETTE: (0 | 1)[][] = [
//   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0], //  0 — ear tips
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], //  1 — ears/head
  [  0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0], //  2 — loop-top + head
  [  0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0], //  3 — loop-sides + head
  [  0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0], //  4 — loop-sides + head
  [  0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0], //  5 — loop-sides + head
  [  0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0], //  6 — loop-sides + body
  [  0, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0], //  7 — loop-bottom + body
  [  0, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0], //  8 — loop inner-stem + body
  [  0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], //  9 — tail-stem + body
  [  0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0], // 10 — body
  [  0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], // 11 — body
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 12 — paws
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 13 — paws-bottom
  [  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 14 — base
];
const SROWS = SILHOUETTE.length;
const SCOLS = SILHOUETTE[0].length;
const CAT_PX_W = SCOLS * PX; // 130px
const CAT_PX_H = SROWS * PX; //  75px

// Compute silhouette border pixels (filled, adjacent to at least one empty cell)
const _BODY_PX: [number, number][] = [];
const _TAIL_PX: [number, number][] = []; // tail loop: cols 2-6, rows 2-9

for (let r = 0; r < SROWS; r++) {
  for (let c = 0; c < SCOLS; c++) {
    if (!SILHOUETTE[r][c]) continue;
    const border =
      r === 0         || !SILHOUETTE[r - 1][c] ||
      r === SROWS - 1 || !SILHOUETTE[r + 1][c] ||
      c === 0         || !SILHOUETTE[r][c - 1] ||
      c === SCOLS - 1 || !SILHOUETTE[r][c + 1];
    if (!border) continue;
    (r >= 2 && r <= 9 && c >= 2 && c <= 6 ? _TAIL_PX : _BODY_PX).push([c, r]);
  }
}

// Eyes — explicit 2×2 red blocks rendered over the hollow interior
const _EYE_PX: [number, number][] = [
  [15, 5], [16, 5], [15, 6], [16, 6],
  [18, 5], [19, 5], [18, 6], [19, 6],
];

function PixelCatSVG() {
  const R = "#E31837";
  const px = (c: number, r: number, k: string) => (
    <rect key={k} x={c * PX} y={r * PX} width={PX} height={PX} fill={R} shapeRendering="crispEdges" />
  );
  return (
    <>
      <style>{`
        @keyframes yp-cat-wag { 0%,100%{transform:rotate(0deg)} 50%{transform:rotate(5deg)} }
        .yp-cat-tail { transform-origin:${7 * PX}px ${9 * PX}px; animation:yp-cat-wag 2s ease-in-out infinite; }
      `}</style>
      <svg width={CAT_PX_W} height={CAT_PX_H} style={{ imageRendering: "pixelated" }} aria-hidden>
        <g>
          {_BODY_PX.map(([c, r]) => px(c, r, `b${r}-${c}`))}
          {_EYE_PX.map(([c, r])  => px(c, r, `e${r}-${c}`))}
        </g>
        <g className="yp-cat-tail">
          {_TAIL_PX.map(([c, r]) => px(c, r, `t${r}-${c}`))}
        </g>
      </svg>
    </>
  );
}

// Join YorkPulse card — cat peeks from top-right, plays 2.6s, bubble appears after
function JoinYorkPulseCard() {
  const [phase, setPhase] = useState<"entering" | "playing" | "done">("entering");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("playing"), 650);
    const t2 = setTimeout(() => setPhase("done"), 3300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const catAnimate =
    phase === "entering" ? { y: 0, rotate: 0 } :
    phase === "playing"  ? { y: [0, -18, 3, -13, 3, -8, 0], rotate: [0, -6, 5, -4, 3, -1, 0] } :
                           { y: 0, rotate: 0 };

  const catTransition =
    phase === "entering" ? { type: "spring" as const, stiffness: 260, damping: 20 } :
    phase === "playing"  ? { duration: 2.65, ease: "easeInOut" as const, times: [0, 0.1, 0.28, 0.46, 0.64, 0.82, 1] } :
                           { type: "spring" as const, stiffness: 180, damping: 18 };

  return (
    <div className="relative mt-24 rounded-lg bg-white border border-gray-100 shadow-sm">
      {/* Cat + bubble container — anchored to top-right of card */}
      <div
        className="absolute pointer-events-none select-none"
        style={{
          right: 2,
          top: -CAT_PX_H,
          width: CAT_PX_W,
          height: CAT_PX_H,
          overflow: phase === "entering" ? "hidden" : "visible",
          zIndex: 10,
        }}
      >
        {/* Speech bubble — only appears after play sequence ends */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 440, damping: 20 }}
              style={{ position: "absolute", top: -46, right: 0 }}
            >
              <div
                className={`${pressStart2P.className} bg-white rounded-xl px-3 py-2.5 text-[7px] text-gray-800 whitespace-nowrap`}
                style={{ border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.08)" }}
              >
                wassup dawg?!
              </div>
              {/* Triangle tail — bottom-left of bubble */}
              <div style={{ position: "absolute", bottom: -9, left: 10, width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "9px solid #e5e7eb" }} />
              <div style={{ position: "absolute", bottom: -7, left: 11, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "7px solid white" }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cat — slides up from behind card bottom edge */}
        <motion.div initial={{ y: CAT_PX_H }} animate={catAnimate} transition={catTransition}>
          <PixelCatSVG />
        </motion.div>
      </div>

      {/* Card text — right padding keeps text clear of cat */}
      <div className="flex items-center gap-3 p-3 pr-[136px]">
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
  }, [otp]); // eslint-disable-line react-hooks/exhaustive-deps

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
