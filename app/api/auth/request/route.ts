import { env } from "cloudflare:workers";
import nodemailer from "nodemailer";
import { z } from "zod";
import { guardOrigin, HttpError, fail } from "../../../../lib/server";
import { hashAuthValue } from "../../../../lib/email-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const inputSchema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(req: Request) {
  try {
    guardOrigin(req);
    const { email } = inputSchema.parse(await req.json());
    const normalizedEmail = email.toLowerCase();
    const secret = (env as any).AUTH_SECRET;
    if (!secret) throw new HttpError(503, "Вход по email ещё не настроен на сервере");

    const db = env.DB;
    if (!db) throw new HttpError(503, "База данных пока недоступна");
    const now = Date.now();
    const previous = await db.prepare("SELECT requested_at FROM auth_codes WHERE email=?")
      .bind(normalizedEmail).first<any>();
    if (previous && now - Number(previous.requested_at) < 60_000) {
      throw new HttpError(429, "Подождите минуту перед повторным запросом кода");
    }

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const expiresAt = now + 10 * 60_000;
    const codeHash = await hashAuthValue(`${secret}:${normalizedEmail}:${code}`);
    await db.prepare(
      "INSERT INTO auth_codes(email,code_hash,expires_at,attempts,requested_at) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,requested_at=excluded.requested_at",
    ).bind(normalizedEmail, codeHash, expiresAt, now).run();

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
        ignoreTLS: smtpPort === 25 && !smtpUser,
        ...(smtpUser && smtpPassword ? { auth: { user: smtpUser, pass: smtpPassword } } : {}),
      });
      await transporter.sendMail({
        from: (env as any).AUTH_FROM || smtpUser,
        to: normalizedEmail,
        subject: "Код входа — Black to White",
        text: `Ваш код входа: ${code}. Он действует 10 минут. Если вы не запрашивали код, проигнорируйте письмо.`,
      });
    } catch (error) {
      await db.prepare("DELETE FROM auth_codes WHERE email=? AND requested_at=?").bind(normalizedEmail, now).run();
      console.error("Could not send sign-in email", error);
      throw new HttpError(503, "Не удалось отправить письмо. Проверьте почту и попробуйте позже.");
    }

    return Response.json({ ok: true, message: "Код отправлен на почту. Он действует 10 минут." }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return fail(error);
  }
}
