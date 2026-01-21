"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Copy, Check, Loader2, Terminal, RefreshCw, CheckCircle } from "lucide-react";

export default function MCPAuthPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeUsed, setCodeUsed] = useState(false);
  const [autoCloseIn, setAutoCloseIn] = useState<number | null>(null);

  // Generate code when user is signed in
  const generateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/mcp-code", {
        method: "POST",
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate code");
      }
      
      setCode(data.code);
      setExpiresIn(data.expiresIn);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate code on mount if signed in
  useEffect(() => {
    if (isSignedIn && !code && !loading) {
      generateCode();
    }
  }, [isSignedIn]);

  // Countdown timer
  useEffect(() => {
    if (expiresIn <= 0) return;
    
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          setCode(null); // Code expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [expiresIn]);

  // Poll to check if code was used (every 2 seconds)
  const checkCodeUsed = useCallback(async () => {
    if (!code || codeUsed) return;
    
    try {
      // Check if code was used (without consuming it)
      const response = await fetch(`/api/auth/mcp-code?code=${code}&check=true`);
      const data = await response.json();
      
      if (data.used) {
        setCodeUsed(true);
        setAutoCloseIn(5); // Start 5 second countdown to close
      }
    } catch {
      // Ignore errors during polling
    }
  }, [code, codeUsed]);

  useEffect(() => {
    if (!code || codeUsed) return;
    
    const pollInterval = setInterval(checkCodeUsed, 2000);
    return () => clearInterval(pollInterval);
  }, [code, codeUsed, checkCodeUsed]);

  // Auto-close countdown
  useEffect(() => {
    if (autoCloseIn === null) return;
    
    if (autoCloseIn <= 0) {
      window.close();
      // If window.close() doesn't work (some browsers block it), show message
      return;
    }
    
    const timer = setTimeout(() => {
      setAutoCloseIn((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [autoCloseIn]);

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }, []);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-4">
            <Terminal className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect MCP Server</h1>
          <p className="text-zinc-400 text-sm">
            Authenticate your Flowsmith MCP server with Cursor
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          {codeUsed ? (
            // Code was used - show success and auto-close
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-emerald-400 mb-2">
                Authentication Successful!
              </h2>
              <p className="text-zinc-400 mb-4">
                Your MCP server has been authenticated.
              </p>
              {autoCloseIn !== null && autoCloseIn > 0 ? (
                <p className="text-zinc-500 text-sm">
                  This window will close in {autoCloseIn} seconds...
                </p>
              ) : (
                <p className="text-zinc-500 text-sm">
                  You can close this window now.
                </p>
              )}
              <button
                onClick={() => window.close()}
                className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
              >
                Close Window
              </button>
            </div>
          ) : !isSignedIn ? (
            // Not signed in - show sign in button
            <div className="text-center py-8">
              <p className="text-zinc-400 mb-6">
                Sign in to generate an authentication code
              </p>
              <SignInButton mode="modal">
                <button className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-zinc-200 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </div>
          ) : loading ? (
            // Loading state
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-4" />
              <p className="text-zinc-400">Generating your code...</p>
            </div>
          ) : error ? (
            // Error state
            <div className="text-center py-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={generateCode}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : code ? (
            // Code display
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-zinc-400 text-sm mb-4">
                  Your one-time authentication code:
                </p>
                
                {/* Code Display */}
                <div className="relative">
                  <div 
                    onClick={copyCode}
                    className="bg-black border-2 border-emerald-500/50 rounded-xl p-6 cursor-pointer hover:border-emerald-400 transition-colors group"
                  >
                    <div className="font-mono text-4xl tracking-[0.3em] text-emerald-400 font-bold">
                      {code}
                    </div>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      {copied ? (
                        <Check className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Copy className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                  </div>
                  {copied && (
                    <p className="text-emerald-400 text-sm mt-2">Copied!</p>
                  )}
                </div>

                {/* Timer */}
                <div className="mt-4 flex items-center justify-center gap-2 text-zinc-500 text-sm">
                  <span>Expires in</span>
                  <span className={`font-mono ${expiresIn < 60 ? "text-amber-400" : "text-zinc-400"}`}>
                    {formatTime(expiresIn)}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-zinc-800/50 rounded-lg p-4 text-sm">
                <p className="text-zinc-300 font-medium mb-2">Next steps:</p>
                <ol className="text-zinc-400 space-y-2 list-decimal list-inside">
                  <li>Go back to Cursor</li>
                  <li>Tell Claude: <code className="text-emerald-400">&quot;My code is {code}&quot;</code></li>
                  <li>Your MCP server will be authenticated automatically</li>
                </ol>
              </div>

              {/* Refresh button */}
              <button
                onClick={generateCode}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Generate New Code
              </button>
            </div>
          ) : (
            // Code expired
            <div className="text-center py-8">
              <p className="text-zinc-400 mb-4">Code expired</p>
              <button
                onClick={generateCode}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                Generate New Code
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {isSignedIn && (
          <p className="text-center text-zinc-600 text-xs mt-4">
            Signed in as {user?.emailAddresses[0]?.emailAddress}
          </p>
        )}
      </motion.div>
    </div>
  );
}
