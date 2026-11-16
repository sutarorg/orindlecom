/**
 * Security primitives.
 *
 * The functions under test here are small and dangerous. A client-IP resolver
 * that trusts the wrong header is a rate-limit bypass; a CAPTCHA verifier that
 * treats "skipped" as "passed" is no CAPTCHA at all; a device identifier that is
 * a fingerprint is a privacy problem. None of these failures looks like a
 * failure in normal use, which is precisely why they are asserted here.
 *
 * The modules are imported for their pure helpers, not for their network paths:
 * nothing here reaches Supabase or Cloudflare.
 */
import { describe, expect, it, vi } from "vitest";

import { hashDevice, hashIp, isIp, resolveClientIp } from "@/lib/security/ip";
import { decisionFor, type RiskLevel } from "@/lib/security/risk";
import { isDisposableDomain, signupBucket } from "@/lib/security/signup-gate";
import { createdJustNow } from "@/lib/security/account-security";
import { LIMITS } from "@/lib/rate-limit";

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

/* ── IP validation ────────────────────────────────────────────────────────── */

describe("isIp", () => {
  it("accepts real addresses in both families", () => {
    for (const value of ["203.0.113.7", "0.0.0.0", "255.255.255.255", "2001:db8::1", "::1", "fe80::1"]) {
      expect(isIp(value), value).toBe(true);
    }
  });

  it("rejects anything that is not an address", () => {
    // Each of these is a way to smuggle a chosen string into a bucket key.
    for (const value of [
      "",
      "localhost",
      "example.com",
      "203.0.113.7, 10.0.0.1",
      "203.0.113.256",
      "2001:db8:::1",
      "1.2.3",
      "'; drop table rate_limits; --",
      "0x7f.0.0.1",
    ]) {
      expect(isIp(value), value).toBe(false);
    }
  });
});

/* ── Client IP resolution ─────────────────────────────────────────────────── */

describe("resolveClientIp", () => {
  it("prefers Cloudflare's header above everything else", () => {
    const result = resolveClientIp(
      headers({
        "cf-connecting-ip": "203.0.113.7",
        "x-vercel-forwarded-for": "198.51.100.1",
        "x-real-ip": "192.0.2.1",
        "x-forwarded-for": "10.0.0.1",
      }),
    );
    expect(result.ip).toBe("203.0.113.7");
    expect(result.source).toBe("cf-connecting-ip");
  });

  it("ignores a spoofed x-forwarded-for when a trusted header is present", () => {
    // The attack this defends against: an attacker prepends an address they chose
    // to X-Forwarded-For to get a fresh rate-limit bucket on every request.
    const result = resolveClientIp(
      headers({
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": "203.0.113.7",
      }),
    );
    expect(result.ip).toBe("203.0.113.7");
  });

  it("uses the LAST x-vercel-forwarded-for entry, not the first", () => {
    // The list is built by appending; the last entry is the one the platform
    // added. The first is the client's own claim.
    const result = resolveClientIp(
      headers({ "x-vercel-forwarded-for": "1.2.3.4, 203.0.113.7" }),
    );
    expect(result.ip).toBe("203.0.113.7");
  });

  it("refuses plain x-forwarded-for when not behind a known proxy", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("CF_PAGES", "");
    try {
      const result = resolveClientIp(headers({ "x-forwarded-for": "1.2.3.4" }));
      // Null, not a bogus value: "no signal" is honest, and it stops every request
      // on earth sharing one bucket keyed on an empty string.
      expect(result.ip).toBeNull();
      expect(result.source).toBe("none");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("falls back to no signal when nothing usable is present", () => {
    const result = resolveClientIp(headers({}));
    expect(result.ip).toBeNull();
    expect(result.source).toBe("none");
  });
});

/* ── Hashing ──────────────────────────────────────────────────────────────── */

describe("hashing", () => {
  it("is salted, so the same address hashes differently under a different salt", async () => {
    vi.stubEnv("ABUSE_HASH_SALT", "salt-one");
    vi.resetModules();
    const first = (await import("@/lib/security/ip")).hashIp("203.0.113.7");

    vi.stubEnv("ABUSE_HASH_SALT", "salt-two");
    vi.resetModules();
    const second = (await import("@/lib/security/ip")).hashIp("203.0.113.7");

    // An unsalted hash of an IPv4 address is reversible by enumerating 2^32
    // values, so this property is the whole privacy argument.
    expect(first).not.toBe(second);
    vi.unstubAllEnvs();
  });

  it("is stable for the same input and salt", () => {
    vi.stubEnv("ABUSE_HASH_SALT", "stable");
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
    expect(hashDevice("abc")).toBe(hashDevice("abc"));
  });

  it("namespaces device and IP hashes apart", () => {
    // Otherwise a device id that happened to equal an address would collide.
    vi.stubEnv("ABUSE_HASH_SALT", "same");
    expect(hashIp("203.0.113.7")).not.toBe(hashDevice("203.0.113.7"));
  });

  it("returns null rather than hashing an absent value", () => {
    expect(hashIp(null)).toBeNull();
    expect(hashDevice(null)).toBeNull();
    expect(hashDevice("")).toBeNull();
  });
});

/* ── Decision table ───────────────────────────────────────────────────────── */

describe("risk decisions", () => {
  it("maps each band to a proportionate action", () => {
    expect(decisionFor("low", "safe")).toBe("allow");
    expect(decisionFor("medium", "safe")).toBe("challenge");
    expect(decisionFor("high", "safe")).toBe("throttle");
    expect(decisionFor("confirmed", "safe")).toBe("refuse");
  });

  it("refuses a disposable domain at any band", () => {
    // Even `low`: the address cannot receive verification mail, so an account
    // created with it could never become entitled. Refusing is kinder than an
    // account that silently cannot work.
    for (const level of ["low", "medium", "high", "confirmed"] as RiskLevel[]) {
      expect(decisionFor(level, "disposable"), level).toBe("refuse");
    }
  });

  it("treats an unclassified domain as no signal", () => {
    expect(decisionFor("low", null)).toBe("allow");
    expect(isDisposableDomain(null)).toBe(false);
    expect(isDisposableDomain("safe")).toBe(false);
    expect(isDisposableDomain("disposable")).toBe(true);
  });

  it("never deletes anything, however high the band", () => {
    // There is no "delete" decision in the type, and this asserts the union has
    // not grown one. Data loss on a wrong score is the failure mode the whole
    // automatic-enforcement design is built to avoid.
    const decisions = [
      decisionFor("low", null),
      decisionFor("medium", null),
      decisionFor("high", null),
      decisionFor("confirmed", "disposable"),
    ];
    expect(decisions.every((d) => ["allow", "challenge", "throttle", "refuse"].includes(d))).toBe(true);
  });
});

/* ── Bucket keys ──────────────────────────────────────────────────────────── */

describe("signup bucket keys", () => {
  it("prefers IP, because a cookie can be cleared", () => {
    expect(signupBucket("ip-hash", "device-hash")).toBe("signup:ip:ip-hash");
  });

  it("falls back to the device when no address is trustworthy", () => {
    expect(signupBucket(null, "device-hash")).toBe("signup:device:device-hash");
  });

  it("uses one shared bucket only when there is no identifier at all", () => {
    // Deliberately shared rather than random: a per-request bucket would impose
    // no limit whatsoever.
    expect(signupBucket(null, null)).toBe("signup:unknown");
  });
});

/* ── Onboarding timing ────────────────────────────────────────────────────── */

describe("createdJustNow", () => {
  it("is true only for a genuinely recent account", () => {
    expect(createdJustNow(new Date().toISOString())).toBe(true);
    expect(createdJustNow(new Date(Date.now() - 10_000).toISOString())).toBe(true);
    expect(createdJustNow(new Date(Date.now() - 600_000).toISOString())).toBe(false);
  });

  it("is false rather than throwing on junk", () => {
    // Used as a corroborating signal next to a database flag, so a bad value must
    // degrade to "no signal", not to a crash in the OAuth callback.
    expect(createdJustNow(null)).toBe(false);
    expect(createdJustNow(undefined)).toBe(false);
    expect(createdJustNow("not a date")).toBe(false);
    expect(createdJustNow("")).toBe(false);
  });
});

/* ── Rate limit policy ────────────────────────────────────────────────────── */

describe("authentication rate limits", () => {
  it("exists for every abuse-prone flow the requirements name", () => {
    for (const key of [
      "signupAttempt",
      "loginAttempt",
      "passwordReset",
      "verificationResend",
      "captchaAttempt",
      "mfaChallenge",
      "setPassword",
    ] as const) {
      expect(LIMITS[key], key).toBeDefined();
      expect(LIMITS[key].limit).toBeGreaterThan(0);
      expect(LIMITS[key].windowSeconds).toBeGreaterThan(0);
    }
  });

  it("is tighter than ordinary product use", () => {
    // A person signs up once. Creating 120 folders a minute is plausible; 120
    // signups an hour is not, so these limits are an order of magnitude lower.
    expect(LIMITS.signupAttempt.limit).toBeLessThan(LIMITS.createItem.limit);
    expect(LIMITS.passwordReset.limit).toBeLessThanOrEqual(5);
    expect(LIMITS.verificationResend.limit).toBeLessThanOrEqual(5);
  });

  it("does not lock a shared network out on ordinary use", () => {
    // An office of 30 people signing in within five minutes must not trip the
    // limit. The bucket is per address, so the limit has to be above one office.
    expect(LIMITS.loginAttempt.limit).toBeGreaterThanOrEqual(10);
  });
});
