import { authenticatedUser, guardOrigin, event, HttpError, one, run, uid, fail } from "../../../../lib/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const roles = {
  client: { email: "developer-client@blackandwhite.local", name: "Developer · Клиент", role: "client", destination: "/#orders" },
  admin: { email: "developer-admin@blackandwhite.local", name: "Developer · Администратор", role: "admin", destination: "/#crm" },
  worker: { email: "developer-worker@blackandwhite.local", name: "Developer · Исполнитель", role: "cleaner", destination: "/#work" },
} as const;

export async function POST(request: Request) {
  try {
    guardOrigin(request);
    const actor = await authenticatedUser();
    if (actor.role !== "admin") throw new HttpError(403, "Переключение доступно только администратору");
    const key = (await request.formData()).get("role") as keyof typeof roles;
    const account = Object.hasOwn(roles,key) ? roles[key] : null;
    if (!account) throw new HttpError(400, "Неизвестный режим просмотра");
    await run(
      "INSERT INTO members(id,email,name,role,team_id,active,created) VALUES(?,?,?,?,NULL,1,?) ON CONFLICT(email) DO NOTHING",
      uid(), account.email, account.name, account.role, new Date().toISOString(),
    );
    const member = await one("SELECT * FROM members WHERE email=?", account.email);
    if (!member || !member.active || member.role !== account.role) throw new HttpError(403, "Режим отключён администратором");
    if (key === "worker") {
      await run(
        "INSERT INTO worker_profiles(member_id,city_id,bio,services,extras,capacity,min_payout_cents,travel_minutes,accepts_video,enabled,verified,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO NOTHING",
        member.id, "0c5b2444-70a0-4932-980c-b4dc0d3f02b5", "Профиль разработчика для просмотра кабинета исполнителя",
        JSON.stringify(["standard", "deep", "renovation", "office", "custom"]), JSON.stringify(["windows", "oven", "fridge", "sofa", "ironing"]), 4, 0, 90, 1, 0, 0, new Date().toISOString(),
      );
    }
    await event(null, actor.id, "Переключён режим кабинета: " + key);
    return new Response(null, { status: 303, headers: { Location: account.destination, "Set-Cookie": `bw_view_mode=${key}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) {
    const response = fail(error);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
