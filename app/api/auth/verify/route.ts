import { env } from "cloudflare:workers";
import { z } from "zod";
import { guardOrigin, HttpError, json, fail } from "../../../../lib/server";
import { createSession, hashAuthValue, sessionCookie } from "../../../../lib/email-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    const { email, code } = inputSchema.parse(await req.json());
    const normalizedEmail = email.toLowerCase();
    const secret = (env as any).AUTH_SECRET;
    if (!secret) throw new HttpError(503, "Вход по email ещё не настроен на сервере");

    const authCode = await env.DB?.prepare("SELECT * FROM auth_codes WHERE email=?")
      .bind(normalizedEmail).first<any>();
    if (!authCode || Number(authCode.expires_at) < Date.now() || Number(authCode.attempts) >= 5) {
      throw new HttpError(400, "Код истёк или неверен. Запросите новый код.");
    }
    const expected = String(authCode.code_hash);
    const actual = await hashAuthValue(`${secret}:${normalizedEmail}:${code}`);
    let difference = expected.length ^ actual.length;
    for (let i = 0; i < Math.max(expected.length, actual.length); i += 1) {
      difference |= (expected.charCodeAt(i) || 0) ^ (actual.charCodeAt(i) || 0);
    }
    if (difference !== 0) {
      await env.DB?.prepare("UPDATE auth_codes SET attempts=attempts+1 WHERE email=?").bind(normalizedEmail).run();
      throw new HttpError(400, "Код не подошёл. Проверьте письмо и попробуйте ещё раз.");
    }

    const invite = await env.DB?.prepare("SELECT * FROM invitations WHERE email=?").bind(normalizedEmail).first<any>();
    const adminEmails = String((env as any).ADMIN_EMAILS || "").toLowerCase().split(",").map((value: string) => value.trim());
    const admin = adminEmails.includes(normalizedEmail);
    const fallbackName = normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
    const id = crypto.randomUUID();
    const member = await env.DB?.prepare(
      "INSERT INTO members(id,email,name,role,team_id,active,created) VALUES(?,?,?,?,?,1,?) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING *",
    ).bind(id, normalizedEmail, invite?.name || fallbackName || normalizedEmail, admin ? "admin" : invite?.role || "client", invite?.team_id || null, new Date().toISOString()).first<any>();
    if (!member) throw new HttpError(500, "Не удалось создать учётную запись");
    if (!member.active) throw new HttpError(403, "Доступ к аккаунту приостановлен администратором");
    if (admin && member.role !== "admin") {
      await env.DB?.prepare("UPDATE members SET role='admin' WHERE id=?").bind(member.id).run();
      member.role = "admin";
    }
    await env.DB?.prepare("DELETE FROM auth_codes WHERE email=?").bind(normalizedEmail).run();
    const session = await createSession(member.id);
    return new Response(JSON.stringify({ ok: true, user: { id: member.id, name: member.name, role: member.role } }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": await sessionCookie(session.token) },
    });
  } catch (error) {
    return fail(error);
  }
}
