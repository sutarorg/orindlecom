"use client";

/**
 * Browser-side calls to this app's own API.
 *
 * Every write in the dashboard goes through here rather than calling a repository
 * directly, because the repository is server code: it holds credentials, and
 * importing it from a component would either leak them or fail the build.
 *
 * The envelope is unwrapped here so callers get a value or an error, never a
 * response object they have to remember to check.
 */

export type ApiOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<ApiOutcome<T>> {
  try {
    const response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      // Same-origin, cookie-authenticated. No credentials leak cross-origin.
      credentials: "same-origin",
      signal: init?.signal,
      cache: "no-store",
    });

    // A redirect means the session expired and middleware sent us to the login
    // page. fetch follows it silently, so the JSON parse would fail with a
    // confusing error; name it instead.
    if (response.redirected && response.url.includes("/login")) {
      return {
        ok: false,
        code: "unauthenticated",
        message: "Your session ended. Sign in again to continue.",
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; data?: T; code?: string; message?: string }
      | null;

    /*
     * A non-JSON body means something upstream returned a page rather than an
     * envelope: a 500 from the platform, a 405, a proxy error, or an HTML auth
     * redirect. Previously this collapsed into one message with the status thrown
     * away, which made "unexpected response" impossible to act on — the status is
     * the single most useful fact in that situation, so it is named in the message
     * and logged.
     *
     * The 401/403 case gets its own sentence because it is the one a person can
     * fix: the session expired and signing in again is the actual remedy.
     */
    if (!payload) {
      console.error("[api] non-JSON response", {
        path,
        method: init?.method ?? "GET",
        status: response.status,
      });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: false,
          code: "unauthenticated",
          message: "Your session ended. Sign in again to continue.",
        };
      }

      return {
        ok: false,
        code: "unexpected_response",
        message:
          response.status >= 500
            ? `The server hit an error (${response.status}). Nothing was changed — please try again.`
            : `The server returned an unexpected response (${response.status}). Nothing was changed.`,
      };
    }

    if (payload.ok) return { ok: true, data: payload.data as T };

    return {
      ok: false,
      code: payload.code ?? "unknown",
      message: payload.message ?? "That didn't work. Nothing was changed.",
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, code: "aborted", message: "Cancelled." };
    }
    return {
      ok: false,
      code: "network",
      message: "We couldn't reach the server. Check your connection and try again.",
    };
  }
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body, signal }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  // PUT is used where a call sets a resource to a known state (create-or-replace a
  // share link) rather than partially updating it.
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
};

/**
 * Start a browser download from a signed URL.
 *
 * The anchor is created and removed rather than left in the DOM, and it is not
 * `window.location.assign` — navigating away would lose the dashboard state. The
 * `download` attribute is a hint only: the URL itself carries
 * `Content-Disposition` from the server, which is what actually names the file.
 */
export function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
