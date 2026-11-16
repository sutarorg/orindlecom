/**
 * Shared form validation.
 *
 * Used by both the client components (for instant feedback) and the server
 * actions (for the authoritative check). Keeping one implementation means the
 * two can never disagree about what "valid" means.
 */

import type { AuthField } from "./types";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Matches the provider's minimum; deliberately not stricter than the backend. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt's input ceiling
export const NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;

export type FieldErrors = Partial<Record<AuthField, string>>;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (email.length > EMAIL_MAX_LENGTH) return "That email address is too long.";
  if (!EMAIL_RE.test(email)) return "Enter an email address we can reply to.";
  return undefined;
}

export function validatePassword(value: string, { required = true }: { required?: boolean } = {}) {
  if (!value) return required ? "Enter a password." : undefined;
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Keep passwords under ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return undefined;
}

/**
 * New-password rules. Length is the only hard floor — the rest are advisory
 * signals in the strength meter, because arbitrary character-class rules push
 * people toward predictable substitutions without adding real entropy.
 */
export function validateNewPassword(value: string): string | undefined {
  if (!value) return "Choose a password.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    return `Keep passwords under ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (value.trim().length === 0) return "A password of only spaces won't work.";
  return undefined;
}

export function validateConfirmPassword(password: string, confirm: string): string | undefined {
  if (!confirm) return "Re-enter your password.";
  if (password !== confirm) return "Those passwords don't match yet.";
  return undefined;
}

export function validateFullName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return "Enter your name.";
  if (name.length < 2) return "Enter your full name.";
  if (name.length > NAME_MAX_LENGTH) return "That name is longer than we can accept.";
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Password strength                                                  */
/* ------------------------------------------------------------------ */

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export interface StrengthResult {
  /** 0–4, for the four segment fills. */
  score: 0 | 1 | 2 | 3 | 4;
  level: StrengthLevel;
  label: string;
  /** Concrete, actionable advice — never "add a symbol to pass". */
  suggestions: string[];
  /** True once the value clears the hard minimum. */
  acceptable: boolean;
}

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "letmein1",
  "welcome1",
  "admin123",
  "abc12345",
  "orindle",
  "orindle1",
  "orindle123",
]);

/**
 * Estimates strength from length and variety, with penalties for the patterns
 * that make a long password worthless (repeats, sequences, the site's own name).
 * This is a frontend hint, not a security boundary — the provider enforces its
 * own policy on the server.
 */
export function scorePassword(password: string): StrengthResult {
  if (!password) {
    return { score: 0, level: "empty", label: "Password strength", suggestions: [], acceptable: false };
  }

  const length = password.length;
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const digit = /\d/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  const variety = [lower, upper, digit, symbol].filter(Boolean).length;

  // Penalties
  const isCommon = COMMON.has(password.toLowerCase());
  const isRepeated = /^(.)\1+$/.test(password);
  const isSequence = isSequential(password);
  const containsName = /orindle/i.test(password);

  let score = 0;
  if (length >= 8) score += 1;
  if (length >= 12) score += 1;
  if (length >= 16) score += 1;
  if (variety >= 3) score += 1;
  if (variety === 4 && length >= 12) score += 1;

  if (isCommon || isRepeated || isSequence) score = Math.min(score, 1);
  else if (containsName) score = Math.min(score, 2);
  if (length < PASSWORD_MIN_LENGTH) score = Math.min(score, 1);

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;

  const suggestions: string[] = [];
  if (length < PASSWORD_MIN_LENGTH) suggestions.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  else if (length < 12) suggestions.push("A few more characters would help.");
  if (!upper || !lower) suggestions.push("Mix upper and lower case.");
  if (!digit) suggestions.push("Add a number.");
  if (!symbol) suggestions.push("A symbol adds a little more.");
  if (isCommon) suggestions.push("This one appears in breach lists — pick something unique.");
  if (isRepeated) suggestions.push("Repeating a single character is easy to guess.");
  if (isSequence) suggestions.push("Sequences like 1234 or abcd are easy to guess.");
  if (containsName) suggestions.push("Avoid the product name in your password.");

  const level: StrengthLevel =
    clamped === 0 ? "empty" : clamped === 1 ? "weak" : clamped === 2 ? "fair" : clamped === 3 ? "good" : "strong";

  return {
    score: clamped,
    level,
    label:
      clamped === 0 ? "Password strength" : STRENGTH_LABEL[level as Exclude<StrengthLevel, "empty">],
    suggestions: suggestions.slice(0, 2),
    acceptable: !validateNewPassword(password),
  };
}

const STRENGTH_LABEL: Record<Exclude<StrengthLevel, "empty">, string> = {
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

function isSequential(value: string) {
  const v = value.toLowerCase();
  if (v.length < 4) return false;
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < v.length; i += 1) {
    const delta = v.charCodeAt(i) - v.charCodeAt(i - 1);
    if (delta === 1) ascending += 1;
    if (delta === -1) descending += 1;
  }
  return ascending === v.length || descending === v.length;
}

/** Validates every field of the signup form. Server and client share this. */
export function validateSignUp(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}): FieldErrors {
  const errors: FieldErrors = {};
  const name = validateFullName(input.fullName);
  if (name) errors.fullName = name;
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  const password = validateNewPassword(input.password);
  if (password) errors.password = password;
  const confirm = validateConfirmPassword(input.password, input.confirmPassword);
  if (confirm) errors.confirmPassword = confirm;
  if (!input.terms) errors.terms = "Accept the terms to create an account.";
  return errors;
}
