"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const isSignup = searchParams.get("signup") === "true";
  const devToken = searchParams.get("token");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-center"
    >
      <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center">
        <Mail className="w-8 h-8 text-purple-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-zinc-400">
          We sent a magic link to{" "}
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>

      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400">
        <p>
          Click the link in the email to {isSignup ? "complete your signup" : "sign in"}.
          The link will expire in 15 minutes.
        </p>
      </div>

      {/* Dev mode: Direct verification link */}
      {devToken && (
        <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-sm text-yellow-400 font-medium mb-2">Development Mode</p>
          <p className="text-xs text-zinc-400 mb-3">
            Email sending is not configured. Use the link below to verify:
          </p>
          <Button asChild className="w-full bg-yellow-600 hover:bg-yellow-700">
            <Link href={`/auth/verify?token=${encodeURIComponent(devToken)}`}>
              Verify Email (Dev)
            </Link>
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm text-zinc-500">
          Did not receive the email? Check your spam folder or try again.
        </p>
        <Button variant="outline" asChild>
          <Link href={isSignup ? "/auth/signup" : "/auth/login"}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go back
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
