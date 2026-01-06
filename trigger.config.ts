import { defineConfig } from "@trigger.dev/sdk";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  // Project ref from Trigger.dev dashboard (set via env var or replace directly)
  project: process.env.TRIGGER_PROJECT_REF ?? "flowsmith",

  // Directories containing your tasks
  dirs: ["./app/trigger"],

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