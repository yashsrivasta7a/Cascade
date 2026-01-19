"use client";

import { SignIn } from "@clerk/nextjs";
import { motion } from "framer-motion";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect } from "react";

const AuthFlowBackground = dynamic(
  () => import("@/components/auth/auth-flow-background").then((mod) => mod.AuthFlowBackground),
  { ssr: false }
);

export default function SignInPage() {
  // Force dark mode on auth pages
  useEffect(() => {
    const html = document.documentElement;
    const originalTheme = html.classList.contains("light") ? "light" : "dark";
    html.classList.remove("light");
    html.classList.add("dark");
    
    return () => {
      // Restore original theme when leaving
      html.classList.remove("dark");
      html.classList.add(originalTheme);
    };
  }, []);

  return (
    <div className="dark min-h-screen bg-[#101010] relative">
      {/* Cinematic Background */}
      <AuthFlowBackground />

      {/* Fixed Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 p-6"
      >
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Flowsmith" className="w-9 h-9 transition-transform group-hover:scale-105" />
          <span className="text-lg font-bold text-white/90 tracking-wide uppercase" style={{ fontFamily: 'var(--font-orbitron)' }}>Flowsmith</span>
        </Link>
      </motion.header>

      {/* Main Content */}
      <div className="relative min-h-screen flex items-center justify-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-[380px]"
        >
          {/* Header Text */}
          <div className="text-center mb-10">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-[28px] font-semibold text-white tracking-tight mb-3"
            >
              Sign in to Flowsmith
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-[15px] text-zinc-400"
            >
              Welcome back. Enter your credentials to continue.
            </motion.p>
          </div>

          {/* Auth Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className=" backdrop-blur-xl border border-white/[0.06] rounded-2xl pt-3 pl-3 "
          >
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "w-full bg-transparent shadow-none p-0",
                  headerTitle: "hidden",
                  headerSubtitle: "hidden",
                  socialButtonsBlockButton:
                    "bg-zinc-800/60 border border-white/[0.06] hover:bg-zinc-800 hover:border-white/[0.1] text-white rounded-xl h-11 font-medium transition-all",
                  socialButtonsBlockButtonText: "text-zinc-200 text-[14px]",
                  socialButtonsProviderIcon: "brightness-0 invert",
                  dividerLine: "bg-white/[0.06]",
                  dividerText: "text-zinc-500 text-[12px] uppercase tracking-widest font-medium",
                  formFieldLabel: "text-zinc-400 text-[13px] font-medium mb-1.5",
                  formFieldInput:
                    "bg-zinc-800/40 border border-white/[0.06] text-white placeholder:text-zinc-600 focus:border-white/[0.15] focus:ring-0 rounded-xl h-11 text-[14px] px-4 transition-colors",
                  formButtonPrimary:
                    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-2 border-blue-500/50 hover:border-blue-500/70 rounded-xl h-11 text-[14px] font-bold transition-all",
                  footerActionLink: "text-white hover:text-cyan-400 font-medium transition-colors",
                  identityPreviewText: "text-white",
                  identityPreviewEditButton: "text-zinc-400 hover:text-white",
                  formResendCodeLink: "text-white hover:text-cyan-400",
                  otpCodeFieldInput: "bg-zinc-800/40 border-white/[0.06] text-white rounded-xl h-12",
                  alternativeMethodsBlockButton: "text-zinc-400 hover:text-white",
                  alert: "bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[13px]",
                  alertText: "text-red-400",
                  footer: "hidden",
                  formFieldInputShowPasswordButton: "text-zinc-500 hover:text-white",
                },
              }}
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              forceRedirectUrl="/dashboard"
            />
          </motion.div>

          {/* Sign Up Link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center mt-6 text-[14px] text-zinc-500"
          >
            Don't have an account?{" "}
            <Link href="/sign-up" className="text-white hover:text-cyan-400 font-medium transition-colors">
              Sign up
            </Link>
          </motion.p>

          {/* Terms */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-center mt-8 text-[12px] text-zinc-600"
          >
            By continuing, you agree to our{" "}
            <Link href="/terms" className="text-zinc-500 hover:text-zinc-300 transition-colors">Terms</Link>
            {" "}and{" "}
            <Link href="/privacy" className="text-zinc-500 hover:text-zinc-300 transition-colors">Privacy</Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
