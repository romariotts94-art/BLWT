import { headers } from "next/headers";
import { env } from "cloudflare:workers";

const COOKIE = "bw_session";
const SESSION_DAYS = 30;

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function hashAuthValue(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

export async function getEmailSessionUser() {
  const secret = (env as any).AUTH_SECRET;
  if (!secret) return null;
  const cookieHeader = (await headers()).get("cookie") || "";
  const raw = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw || !/^[a-f0-9-]{36}$/i.test(raw)) return null;
  const tokenHash = await hashAuthValue(`${secret}:${raw}`);
  const result = await env.DB?.prepare(
    "SELECT m.* FROM auth_sessions s JOIN members m ON m.id=s.member_id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1",
  ).bind(tokenHash, Date.now()).first<any>();
  return result || null;
}

export async function createSession(memberId: string, maxAgeSeconds = SESSION_DAYS * 86400) {
  const secret = (env as any).AUTH_SECRET;
  if (!secret) throw new Error("Email sign-in is not configured");
  const token = crypto.randomUUID();
  const tokenHash = await hashAuthValue(`${secret}:${token}`);
  const now = Date.now();
  const expiresAt = now + Math.min(SESSION_DAYS * 86400, Math.max(1, Math.floor(maxAgeSeconds))) * 1000;
  await env.DB?.prepare("INSERT INTO auth_sessions(token_hash,member_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(tokenHash, memberId, expiresAt, now).run();
  return { token, tokenHash, expiresAt };
}

export async function sessionCookie(token: string, maxAge = SESSION_DAYS * 86400) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
