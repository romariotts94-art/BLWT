import {readJsonBody} from '../../../../lib/request-body';
import { env } from "cloudflare:workers";
import nodemailer from "nodemailer";
import { z } from "zod";
import { guardOrigin, HttpError, fail } from "../../../../lib/server";
import { hashAuthValue } from "../../../../lib/email-auth";
import { resolveAuthIntent } from "../../../../lib/auth-flow-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({ email: z.string().trim().email().max(254), intent: z.enum(['login','register']).default('login') });

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    const { email, intent } = inputSchema.parse(await readJsonBody(req));
    const normalizedEmail = email.toLowerCase();
    const secret = (env as any).AUTH_SECRET;
    if (!secret) throw new HttpError(503, "Вход по email ещё не настроен на сервере");

    const db = env.DB;
    if (!db) throw new HttpError(503, "База данных пока недоступна");
    const existing = await db.prepare('SELECT id FROM members WHERE email=?').bind(normalizedEmail).first<any>();
    const invited = await db.prepare('SELECT email FROM invitations WHERE email=?').bind(normalizedEmail).first<any>();
    const admin = String((env as any).ADMIN_EMAILS || '').toLowerCase().split(',').map((value:string)=>value.trim()).includes(normalizedEmail);
    // A registration attempt for an existing address should continue as sign-in
    // immediately. Requiring a second submit caused the first attempt to look
    // like a failed email delivery and left the form in a confusing state.
    const decision=resolveAuthIntent({intent,hasMember:!!existing,hasInvite:!!invited,isAdmin:admin});
    if(decision.error)throw new HttpError(decision.error.status,decision.error.message);
    const resolvedIntent = decision.intent;
    const now = Date.now();
    const previous = await db.prepare("SELECT requested_at FROM auth_codes WHERE email=?")
      .bind(normalizedEmail).first<any>();
    if (previous && now - Number(previous.requested_at) < 60_000) {
      throw new HttpError(429, "Подождите минуту перед повторным запросом кода");
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const expiresAt = now + 10 * 60_000;
    const codeHash = await hashAuthValue(`${secret}:${normalizedEmail}:${code}`);
    const reserved = await db.prepare(
      "INSERT INTO auth_codes(email,code_hash,expires_at,attempts,requested_at) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,requested_at=excluded.requested_at WHERE auth_codes.requested_at<=?",
    ).bind(normalizedEmail, codeHash, expiresAt, now, now - 60_000).run();
    if (!reserved.meta.changes) throw new HttpError(429, "Подождите минуту перед повторным запросом кода");

    try {
      const smtpHost = (env as any).SMTP_HOST;
      const smtpUser = (env as any).SMTP_USER;
      const smtpPassword = (env as any).SMTP_PASSWORD;
      if (!smtpHost) {
        throw new Error("SMTP is not configured");
      }
      const smtpPort = Number((env as any).SMTP_PORT || 465);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        ignoreTLS: smtpPort === 25 && !smtpUser,
        ...(smtpUser && smtpPassword ? { auth: { user: smtpUser, pass: smtpPassword } } : {}),
      });
      const message = {
        from: (env as any).AUTH_FROM || smtpUser,
        to: normalizedEmail,
        subject: "Код подтверждения Black to White",
        text: `Код подтверждения: ${code}. Он действует 10 минут. Если вы не запрашивали код, проигнорируйте письмо.`,
      };
      try {
        await transporter.sendMail(message);
      } catch (error:any) {
        // Postfix may accept a TCP connection before its greeting is ready.
        // Retry only before SMTP has accepted the message, avoiding duplicates.
        if (!/Greeting never received/i.test(String(error?.message||''))) throw error;
        await new Promise(resolve=>setTimeout(resolve,500));
        await transporter.sendMail(message);
      }
    } catch (error) {
      await db.prepare("DELETE FROM auth_codes WHERE email=? AND requested_at=?").bind(normalizedEmail, now).run();
      console.error("Could not send sign-in email", error);
      throw new HttpError(503, "Не удалось отправить письмо. Проверьте почту и попробуйте позже.");
    }

    const accountAlreadyExists = decision.accountExists && intent === 'register';
    return Response.json({ ok: true, intent: resolvedIntent, message: accountAlreadyExists
      ? "Этот email уже зарегистрирован. Отправили код для входа."
      : "Код отправлен на почту. Он действует 10 минут." }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
