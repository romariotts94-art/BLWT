import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { json, fail } from "../../../../lib/server";
import { hashAuthValue, sessionCookie } from "../../../../lib/email-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const cookieHeader = (await headers()).get("cookie") || "";
    const raw = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith("bw_session="))?.slice("bw_session=".length);
    const secret = (env as any).AUTH_SECRET;
    if (raw && secret) {
      const tokenHash = await hashAuthValue(`${secret}:${raw}`);
      await env.DB?.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(tokenHash).run();
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Set-Cookie": await sessionCookie("", 0) },
    });
  } catch (error) {
    return fail(error);
  }
}
