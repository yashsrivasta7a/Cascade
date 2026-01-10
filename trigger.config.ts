import { defineConfig } from "@trigger.dev/sdk";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Load env at config time
const envPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

// Parse .env.local for env vars that need to be passed to the worker
function loadEnvVars(): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    console.warn("No .env.local found at", envPath);
    return {};
  }
  
  const content = fs.readFileSync(envPath, "utf-8");
  const vars: Record<string, string> = {};
  
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        vars[key] = value;
        // Also set in process.env for immediate use
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
  
  return vars;
}

// Load and inject env vars
const envVars = loadEnvVars();
console.log(`[trigger.config] Loaded ${Object.keys(envVars).length} env vars from .env.local`);

export default defineConfig({
  // Project ref from Trigger.dev dashboard
  project: process.env.TRIGGER_PROJECT_REF ?? "flowsmith",

  // Directories containing your tasks
  dirs: ["./app/trigger"],

  // Build configuration - don't bundle native binaries
  build: {
    external: [
      "ffmpeg-static",
      "@ffprobe-installer/ffprobe",
    ],
  },

  // Retry configuration
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },

  // Max duration of a task in seconds (1 hour for long AI jobs)
  maxDuration: 3600,
});
