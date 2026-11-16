/**
 * Database test harness.
 *
 * Runs the real migrations against a real PostgreSQL engine (PGlite — PostgreSQL
 * compiled to WASM) and exposes the three roles the security model depends on:
 * an authenticated user, an anonymous visitor, and the service role.
 *
 * The point of a real engine rather than a mock is that RLS policies,
 * `security definer` functions and `FOR UPDATE` locking are exactly what is under
 * test. A mock would only prove that the mock works.
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface TestDb {
  db: PGlite;
  /** Run a statement as the service role (bypasses RLS). */
  asService<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run a statement as a signed-in user. RLS applies. */
  asUser<T = Record<string, unknown>>(
    userId: string,
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
  /** Run a statement as an anonymous visitor. RLS applies. */
  asAnon<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Create a user row; returns the id. */
  createUser(email: string): Promise<string>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create({ extensions: { pgcrypto } });

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await db.exec(sql);
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  async function runAs<T>(
    role: string,
    userId: string | null,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    await db.exec(`set role ${role}`);
    try {
      // Supabase puts the subject in this setting and auth.uid() reads it.
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ""]);
      const result = await db.query<T>(sql, params);
      return result.rows;
    } finally {
      await db.exec(`reset role`);
    }
  }

  return {
    db,
    asService: <T>(sql: string, params?: unknown[]) =>
      runAs<T>("service_role", null, sql, params),
    asUser: <T>(userId: string, sql: string, params?: unknown[]) =>
      runAs<T>("authenticated", userId, sql, params),
    asAnon: <T>(sql: string, params?: unknown[]) => runAs<T>("anon", null, sql, params),
    async createUser(email: string) {
      const rows = await runAs<{ id: string }>(
        "service_role",
        null,
        `insert into auth.users (email) values ($1) returning id`,
        [email],
      );
      return rows[0].id;
    },
    close: () => db.close(),
  };
}

/** Normalise a thrown Postgres error to the message we raised. */
export function pgError(error: unknown): string {
  const e = error as { message?: string };
  const message = e?.message ?? String(error);
  // plpgsql raises surface the message with a prefix; match on our own tokens.
  for (const token of [
    "quota_exceeded",
    "invalid_size",
    "reservation_not_found",
    "reservation_not_reserved",
    "commit_exceeds_reservation",
  ]) {
    if (message.includes(token)) return token;
  }
  return message;
}
