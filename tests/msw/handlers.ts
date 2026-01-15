import { http } from "msw";

// Add handlers as you write tests. Keeping this empty by default avoids
// accidentally masking real network calls.
export const handlers = [
  // Example:
  // http.get("/api/health", () => new Response("ok")),
];

// Re-export http so tests can define handlers locally if desired.
export { http };

