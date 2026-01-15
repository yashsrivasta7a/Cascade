import "@testing-library/jest-dom/vitest";

import { server } from "./tests/msw/server";

// Ensure optional server-side modules can import safely in tests.
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/flowsmith_test?schema=public";

// MSW (Mock Service Worker) for API mocking in unit/integration tests.
// Tests can override handlers via `server.use(...)`.
beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
