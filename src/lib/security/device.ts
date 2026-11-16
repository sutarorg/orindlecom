/**
 * The first-party device identifier.
 *
 * A random 128-bit value generated in the browser, stored in a `Secure`,
 * `HttpOnly`, `SameSite=Lax` cookie, and never transmitted anywhere except back
 * to us. It is not a fingerprint: it says "this browser profile has created an
 * account before", and nothing about the person using it.
 *
 * The requirements are specific about its limits, and they are the right limits:
 *
 *   - **One shared device is not one human.** A family tablet, a school laptop
 *     and a cyber-café machine all produce one identifier for many people, so a
 *     device signal is one input among several and can never on its own cause a
 *     permanent restriction.
 *   - **Retention is bounded.** The identifier outlives the session (it has to,
 *     to be useful across signups) but the records derived from it are swept.
 *   - **Disclosure is required.** The privacy policy section added with this
 *     feature says what it is, why it exists, and how long it lives.
 */

import "server-only";

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

export const DEVICE_COOKIE = "orindle_did";

/** One year. Long enough to cover a returning abuser's next attempt, short enough to expire. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Read the device identifier, if the visitor already has one.
 *
 * Does not create one: creating a cookie belongs in a route or action that is
 * allowed to write response headers. Signup does that, because that is the
 * moment the identifier starts to be useful.
 */
export async function readDeviceId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(DEVICE_COOKIE)?.value;
  return isDeviceId(value) ? value : null;
}

/**
 * Ensure a device identifier exists and return it.
 *
 * Safe in a server action or route handler. Returns the existing value when one
 * is present so a visitor is never silently re-identified mid-flow.
 */
export async function ensureDeviceId(): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(DEVICE_COOKIE)?.value;
  if (isDeviceId(existing)) return existing;

  const fresh = randomUUID().replace(/-/g, "");
  try {
    store.set(DEVICE_COOKIE, fresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
    return fresh;
  } catch {
    // A read-only cookie store (server component) cannot set it. The caller
    // proceeds without a device signal rather than failing the request.
    return null;
  }
}

/** The shape we issue: 32 lowercase hex characters. Anything else is ignored. */
function isDeviceId(value: string | undefined): value is string {
  return Boolean(value && /^[a-f0-9]{32}$/.test(value));
}
