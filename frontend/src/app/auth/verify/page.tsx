"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVerifyEmail } from "@/hooks/useAuth";

const VERIFICATION_TIMEOUT = 15000; // 15 seconds

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const verifyMutation = useVerifyEmail();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "timeout">(token ? "loading" : "error");
  const [requiresNameVerification, setRequiresNameVerification] = useState(false);
  const hasRun = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const verifyToken = async () => {
    if (!token) return;

    setStatus("loading");

    // Set timeout for long-running verification
    timeoutRef.current = setTimeout(() => {
      setStatus("timeout");
    }, VERIFICATION_TIMEOUT);

    try {
      const data = await verifyMutation.mutateAsync(token);

      // Clear timeout on success
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setStatus("success");
      setRequiresNameVerification(data.requires_name_verification);

      // Redirect after a short delay
      setTimeout(() => {
        if (data.requires_name_verification) {
          router.push("/auth/setup-profile");
        } else {
          router.push("/vault");
        }
      }, 1500);
    } catch {
      // Clear timeout on error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!token || hasRun.current) return;
    hasRun.current = true;
    verifyToken();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleRetry = () => {
    hasRun.current = false;
    verifyToken();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-center"
    >
      {status === "loading" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Verifying your email...</h1>
            <p className="text-zinc-400">Please wait while we verify your account.</p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Email verified!</h1>
            <p className="text-zinc-400">
              {requiresNameVerification
                ? "Setting up your profile..."
                : "Redirecting you to YorkPulse..."}
            </p>
          </div>
        </>
      )}

      {status === "timeout" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Taking longer than expected</h1>
            <p className="text-zinc-400">
              The verification is taking too long. Please try again.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleRetry}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/auth/login")}
            >
              Back to Login
            </Button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Verification failed</h1>
            <p className="text-zinc-400">
              The link may have expired or is invalid. Please try signing in again.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleRetry}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/auth/login")}
            >
              Back to Login
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
