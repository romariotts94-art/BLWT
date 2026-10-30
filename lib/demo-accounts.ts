import { HttpError, one, run, uid } from "./server";

const demoAccounts = {
  client: { email: "developer-client@blackandwhite.local", name: "Демо · Клиент", role: "client" },
  admin: { email: "developer-admin@blackandwhite.local", name: "Демо · Администратор", role: "admin" },
  worker: { email: "developer-worker@blackandwhite.local", name: "Демо · Исполнитель", role: "cleaner" },
} as const;

export async function ensureDemoMember(kind: keyof typeof demoAccounts) {
  const account = demoAccounts[kind];
  await run(
    "INSERT INTO members(id,email,name,role,team_id,active,created) VALUES(?,?,?,?,NULL,1,?) ON CONFLICT(email) DO NOTHING",
    uid(), account.email, account.name, account.role, new Date().toISOString(),
  );
  const member = await one("SELECT * FROM members WHERE email=?", account.email);
  if (!member) throw new HttpError(500, "Не удалось создать демо-аккаунт");
  if (!member.active || member.role !== account.role) throw new HttpError(403, "Доступ к демо-аккаунту отключён");

  if (kind === "worker") {
    await run(
      "INSERT INTO worker_profiles(member_id,city_id,bio,services,extras,capacity,min_payout_cents,travel_minutes,accepts_video,enabled,verified,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO NOTHING",
      member.id, "0c5b2444-70a0-4932-980c-b4dc0d3f02b5", "Профиль для просмотра кабинета исполнителя",
      JSON.stringify(["standard", "deep", "renovation", "office", "custom"]), JSON.stringify(["windows", "oven", "fridge", "sofa", "ironing"]),
      4, 0, 90, 1, 0, 0, new Date().toISOString(),
    );
    await run(
      "INSERT INTO cleaner_cards(member_id,display_name,experience_years,gender,languages,specialties,equipment,fragrance_free,pet_friendly,own_products,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(member_id) DO NOTHING",
      member.id, "Мария Соколова", 6, "female", "Русский, английский", "Кухни, санузлы, деликатные поверхности",
      "Пылесос, парогенератор, микрофибры по зонам", 1, 1, 1, new Date().toISOString(),
    );
  }
  return member;
}
