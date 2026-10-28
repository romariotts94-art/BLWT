import { env } from "cloudflare:workers";
import { z } from "zod";
import { createSession, sessionCookie } from "../../../../lib/email-auth";
import { fail, HttpError, one, run, uid } from "../../../../lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const roles = z.enum(["client", "admin", "worker"]);
const demoAccounts = {
  client: { email: "developer-client@blackandwhite.local", name: "Developer · Клиент", role: "client" },
  admin: { email: "developer-admin@blackandwhite.local", name: "Developer · Администратор", role: "admin" },
  worker: { email: "developer-worker@blackandwhite.local", name: "Developer · Исполнитель", role: "cleaner" },
} as const;

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function ensureDemoMember(kind: z.infer<typeof roles>) {
  const account = demoAccounts[kind];
  await run(
      "INSERT INTO members(id,email,name,role,team_id,active,created) VALUES(?,?,?,?,NULL,1,?) ON CONFLICT(email) DO NOTHING",
      uid(),
      account.email,
      account.name,
      account.role,
      new Date().toISOString(),
    );
  const member = await one("SELECT * FROM members WHERE email=?", account.email);
  if (!member) throw new HttpError(500, "Не удалось создать аккаунт разработчика");
  if (!member.active || member.role !== account.role) throw new HttpError(403, "Доступ отключён администратором");

  if (kind === "worker") {
    await run(
      "INSERT INTO worker_profiles(member_id,city_id,bio,services,extras,capacity,min_payout_cents,travel_minutes,accepts_video,enabled,verified,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO NOTHING",
      member.id,
      "0c5b2444-70a0-4932-980c-b4dc0d3f02b5",
      "Профиль разработчика для просмотра кабинета исполнителя",
      JSON.stringify(["standard", "deep", "renovation", "office", "custom"]),
      JSON.stringify(["windows", "oven", "fridge", "sofa", "ironing"]),
      4,
      0,
      90,
      1,
      0,
      0,
      new Date().toISOString(),
    );
    await run(
      "INSERT INTO cleaner_cards(member_id,display_name,experience_years,gender,languages,specialties,equipment,fragrance_free,pet_friendly,own_products,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO NOTHING",
      member.id,
      "Мария Соколова",
      6,
      "female",
      "Русский, английский",
      "Кухни, санузлы, деликатные поверхности",
      "Пылесос, парогенератор, микрофибры по зонам",
      1,
      1,
      1,
      new Date().toISOString(),
    );
  }
  return member;
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
