import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Flat ESLint config.
 *
 * `next lint` was removed in Next 16, and the old `"lint": "next lint"` script now
 * fails with a confusing "no such directory: /lint", because Next parses the word
 * "lint" as a path. So ESLint runs directly against its native flat configs —
 * wrapping them in FlatCompat makes ESLint 9 choke on a circular plugin reference.
 *
 * Two rules are raised from warning to error because each represents a mistake that
 * would otherwise ship silently: a missing hook dependency causes stale UI that
 * looks like a data bug, and an unused import is the kind of thing that hides a
 * half-finished edit.
 */
export default [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".verify/**",
      "google_drive/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react-hooks/exhaustive-deps": "error",

      /*
       * React Compiler guidance, not correctness.
       *
       * These five rules ship as errors in eslint-config-next 16. In this codebase
       * they flag established patterns that work correctly and are deliberately
       * kept: initialising a "mounted" flag in an effect (the standard way to defer
       * hydration-dependent UI), reading a ref to position a popover during render,
       * and reading a form's start time to measure time-to-fill.
       *
       * They are downgraded to warnings rather than switched off, so a genuinely
       * new instance still shows up in the output instead of being silenced. Rules
       * that indicate real bugs — rules-of-hooks, exhaustive-deps, unused vars —
       * stay as errors.
       */
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
];
