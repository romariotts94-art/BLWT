import { env } from "cloudflare:workers";
import { z } from "zod";
import { createSession, sessionCookie } from "../../../../lib/email-auth";
import { fail, HttpError } from "../../../../lib/server";
import { ensureDemoMember } from "../../../../lib/demo-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const roles = z.enum(["client", "admin", "worker"]);
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

export async function GET(request: Request) {
  try {
    const secret = String((env as any).DEVELOPER_ACCESS_SECRET || "");
    if (secret.length < 32) throw new HttpError(404, "Страница не найдена");
    const url = new URL(request.url);
    const kind = roles.parse(url.searchParams.get("role"));
    const expires = Number(url.searchParams.get("expires"));
    const signature = String(url.searchParams.get("signature") || "");
    if (!Number.isSafeInteger(expires) || expires <= Date.now() + 1000 || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new HttpError(404, "Ссылка разработчика истекла");
    }
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`developer-access:v1:${kind}:${expires}`));
    const expected = [...new Uint8Array(signed)].map(value => value.toString(16).padStart(2, "0")).join("");
    if (!constantTimeEqual(expected, signature.toLowerCase())) throw new HttpError(404, "Недействительная ссылка разработчика");
    const member = await ensureDemoMember(kind);
    const maxAge = Math.min(8 * 3600, Math.floor((expires - Date.now()) / 1000));
    if (maxAge < 1) throw new HttpError(404, "Ссылка разработчика истекла");
    const session = await createSession(member.id, maxAge);
    const destination = kind === "admin" ? "/#crm" : kind === "worker" ? "/#work" : "/#orders";
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination,
        "Set-Cookie": await sessionCookie(session.token, maxAge),
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