/**
 * Stand-in for the `server-only` marker package.
 *
 * In a Next.js build this import is what fails the build when server code is
 * pulled into a client bundle. Under Vitest there is no client bundle, so the
 * import is intentionally a no-op. The real enforcement lives in `next build`.
 */
export {};
