/**
 * The API envelope contract.
 *
 * These tests exist because a type assertion hid a break in the contract that every
 * route in the app depends on. `handle()` used to return `AppError.toJSON()` cast to
 * `NextResponse`, so a handled failure returned a plain object. Next throws while
 * serialising that, so the browser received an HTML 500 rather than the JSON
 * envelope — and the only thing the client could report was
 * "The server sent an unexpected response. Nothing was changed."
 *
 * The failure was invisible to the type checker precisely because the cast silenced
 * it, which is why the assertion here is `instanceof Response` rather than a shape
 * check on a value.
 */
import { describe, expect, it } from "vitest";

import { handle } from "@/lib/api";
import { AppError } from "@/domain/auth/errors";

describe("handle()", () => {
  it("returns a real Response when an AppError is thrown", async () => {
    const result = await handle(async () => {
      throw new AppError("validation_failed", "Bad name.");
    });

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(400);

    const body = await result.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("validation_failed");
    expect(body.message).toBe("Bad name.");
  });

  it("gives a conflict its own status so the client can tell it apart", async () => {
    const result = await handle(async () => {
      throw new AppError("conflict", "A folder with that name already exists.");
    });

    expect(result.status).toBe(409);
    expect((await result.json()).code).toBe("conflict");
  });

  it("does not leak an unexpected error's message to the client", async () => {
    const result = await handle(async () => {
      throw new Error("relation \"files_secret\" does not exist");
    });

    expect(result).toBeInstanceOf(Response);
    const body = await result.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain("files_secret");
  });
});
