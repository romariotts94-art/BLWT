import {readJsonBody} from '../../../../lib/request-body';
import { env } from "cloudflare:workers";
import { z } from "zod";
import { guardOrigin, HttpError, json, fail } from "../../../../lib/server";
import { createSession, hashAuthValue, sessionCookie } from "../../../../lib/email-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  role: z.enum(["client", "cleaner"]).optional(),
  intent: z.enum(["login", "register"]).default("login"),
  remember: z.boolean().default(true),
});

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    const { email, code, role: requestedRole = "client", intent, remember } = inputSchema.parse(await readJsonBody(req));
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
      await env.DB?.prepare("UPDATE auth_codes SET attempts=attempts+1 WHERE email=? AND code_hash=?").bind(normalizedEmail,expected).run();
      throw new HttpError(400, "Код не подошёл. Проверьте письмо и попробуйте ещё раз.");
    }

    // Consume exactly this code atomically: concurrent requests cannot replay it
    // or delete a newer code requested while this verification was in flight.
    const consumed = await env.DB?.prepare("DELETE FROM auth_codes WHERE email=? AND code_hash=? AND expires_at>? AND attempts<5")
      .bind(normalizedEmail, expected, Date.now()).run();
    if (!consumed?.meta.changes) throw new HttpError(400, "Код уже использован или истёк. Запросите новый код.");
    const invite = await env.DB?.prepare("SELECT * FROM invitations WHERE email=?").bind(normalizedEmail).first<any>();
    const adminEmails = String((env as any).ADMIN_EMAILS || "").toLowerCase().split(",").map((value: string) => value.trim());
    const admin = adminEmails.includes(normalizedEmail);
    const existing = await env.DB?.prepare("SELECT * FROM members WHERE email=?").bind(normalizedEmail).first<any>();
    if (intent === "register" && existing) throw new HttpError(409, "Этот email уже зарегистрирован. Войдите в аккаунт.");
    if (intent === "login" && !existing && !invite && !admin) throw new HttpError(404, "Аккаунт с таким email не найден. Зарегистрируйтесь.");
    const fallbackName = normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").trim();
    const id = crypto.randomUUID();
    const member = await env.DB?.prepare(
      "INSERT INTO members(id,email,name,role,team_id,active,created) VALUES(?,?,?,?,?,1,?) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING *",
    ).bind(id, normalizedEmail, invite?.name || fallbackName || normalizedEmail, admin ? "admin" : invite?.role || requestedRole, invite?.team_id || null, new Date().toISOString()).first<any>();
    if (!member) throw new HttpError(500, "Не удалось создать учётную запись");
    if (!member.active) throw new HttpError(403, "Доступ к аккаунту приостановлен администратором");
    if (["cleaner", "leader"].includes(member.role)) {
      await env.DB?.prepare("INSERT INTO worker_profiles(member_id,updated) VALUES(?,?) ON CONFLICT(member_id) DO NOTHING")
        .bind(member.id, new Date().toISOString()).run();
    }
    if (admin && member.role !== "admin") {
      await env.DB?.prepare("UPDATE members SET role='admin' WHERE id=?").bind(member.id).run();
      member.role = "admin";
    }
    const sessionAge = (remember ? 30 : 1) * 86400;
    const session = await createSession(member.id,sessionAge);
    return new Response(JSON.stringify({ ok: true, user: { id: member.id, name: member.name, role: member.role } }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": await sessionCookie(session.token,sessionAge) },
    });
  } catch (error) {
    return fail(error);
  }
}
