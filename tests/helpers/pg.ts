// In-process Postgres (PGlite) with a minimal Supabase shim — `auth.uid()`, the
// anon/authenticated roles and Supabase's default grants — so the real migrations
// and their RLS policies can be tested without provisioning a project.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const SUPABASE_SHIM = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

export type Actor = { role: "authenticated"; userId: string } | { role: "anon" };

/** Runs `fn` with the session switched to a Supabase role, then switches back. */
export async function as<T>(db: PGlite, actor: Actor, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    actor.role === "authenticated" ? actor.userId : "",
  ]);
  await db.exec(`set role ${actor.role}`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export async function count(db: PGlite, table: string): Promise<number> {
  const res = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return res.rows[0].n;
}
