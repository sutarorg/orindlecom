import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // PGlite runs a WASM Postgres per test file. Files run in parallel and each
    // gets its own database, which keeps the fixtures isolated.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
