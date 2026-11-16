import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Matches tsconfig's "@/*" path so tests import modules exactly as the app
      // does, rather than through relative paths that can diverge.
      "@": path.resolve(process.cwd(), "src"),
      // `server-only` is a marker package Next.js resolves at build time: it
      // throws if a client component imports it. It is not published as a
      // resolvable module, so the test runner needs a stand-in with the same
      // (empty) effect. The real guarantee is still enforced by the Next build.
      "server-only": path.resolve(process.cwd(), "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // PGlite runs a WASM Postgres per test file. Files run in parallel and each
    // gets its own database, which keeps the fixtures isolated.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
