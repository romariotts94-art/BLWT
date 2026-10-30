import { env } from "cloudflare:workers";
import { z } from "zod";
import { fail, guardOrigin, HttpError } from "../../../../lib/server";
import { createSession, sessionCookie } from "../../../../lib/email-auth";
import { ensureDemoMember } from "../../../../lib/demo-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const accounts = {
  client: { label: "Клиент", loginKey: "DEMO_CLIENT_LOGIN", hashKey: "DEMO_CLIENT_PASSWORD_HASH" },
  worker: { label: "Исполнитель", loginKey: "DEMO_WORKER_LOGIN", hashKey: "DEMO_WORKER_PASSWORD_HASH" },
  admin: { label: "Администратор", loginKey: "DEMO_ADMIN_LOGIN", hashKey: "DEMO_ADMIN_PASSWORD_HASH" },
} as const;
type Role = keyof typeof accounts;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function demoLoginEnabled() {
  return (env as any).DEMO_LOGIN_ENABLED === "true";
}

function credentials() {
  return Object.entries(accounts).map(([role, account]) => ({
    role,
    label: account.label,
    login: String((env as any)[account.loginKey] || ""),
    passwordHash: String((env as any)[account.hashKey] || ""),
  }));
}

function attemptKey(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || new URL(request.url).hostname;
}

function checkAttemptLimit(key: string) {
  const now = Date.now();
  const attempt = failedAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) throw new HttpError(429, "Слишком много попыток. Попробуйте через 10 минут.");
  if (attempt && attempt.resetAt <= now) failedAttempts.delete(key);
}

function recordFailedAttempt(key: string) {
  const now = Date.now();
  const previous = failedAttempts.get(key);
  failedAttempts.set(key, { count: previous && previous.resetAt > now ? previous.count + 1 : 1, resetAt: previous && previous.resetAt > now ? previous.resetAt : now + 10 * 60_000 });
  if (failedAttempts.size > 10_000) for (const [candidate, attempt] of failedAttempts) if (attempt.resetAt <= now) failedAttempts.delete(candidate);
}

async function verifyPassword(password: string, encoded: string) {
  const [scheme, roundsText, saltText, hashText] = encoded.split(":");
  const rounds = Number(roundsText);
  if (scheme !== "pbkdf2-sha256" || !Number.isSafeInteger(rounds) || rounds < 200_000 || rounds > 1_000_000 || !/^(?:[a-f0-9]{2}){16,64}$/i.test(saltText) || !/^(?:[a-f0-9]{2}){32,128}$/i.test(hashText)) return false;
  try {
    const salt = Uint8Array.from(saltText.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
    const expected = Uint8Array.from(hashText.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: rounds }, key, expected.length * 8));
    if (derived.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < derived.length; i += 1) diff |= derived[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!demoLoginEnabled()) return Response.json({ enabled: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const configured = credentials();
  if (configured.some((account) => !account.login || !account.passwordHash)) {
    return Response.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ enabled: true, accounts: configured.map(({ role, label }) => ({ role, label })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    guardOrigin(request);
    if (!demoLoginEnabled()) throw new HttpError(404, "Страница не найдена");
    const key = attemptKey(request);
    checkAttemptLimit(key);
    const form = await request.formData();
    const input = z.object({ login: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) }).parse({
      login: form.get("login"), password: form.get("password"),
    });
    const matches = credentials().filter((account) => account.login && account.login.toLowerCase() === input.login.toLowerCase());
    // Refuse ambiguous logins instead of guessing a role if server settings overlap.
    const account = matches.length === 1 ? matches[0] : null;
    const passwordMatches = Boolean(account?.passwordHash && await verifyPassword(input.password, account.passwordHash));
    if (!account || !passwordMatches) {
      recordFailedAttempt(key);
      throw new HttpError(401, "Неверный логин или пароль");
    }
    failedAttempts.delete(key);

    const role = account.role as Role;
    const member = await ensureDemoMember(role);
    const session = await createSession(member.id);
    const destination = role === "admin" ? "/#crm" : role === "worker" ? "/#work" : "/#orders";
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination,
        "Set-Cookie": await sessionCookie(session.token),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    const response = fail(error);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}