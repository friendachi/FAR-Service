// Replaces the sample fleet with the real one from supabase/fleet.json (7 models, 27 trailers).
// Needs migration 20261108000007_trailer_models.sql. Sample bookings that point at old sample trailers are
// removed first. Run: node scripts/load-fleet.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error.message}`); return r.data; };
const fleet = JSON.parse(fs.readFileSync(new URL("../supabase/fleet.json", import.meta.url), "utf8"));

const check = await sb.from("trailer_models").select("id").limit(1);
if (check.error) throw new Error("ยังไม่ได้รัน migration 20261108000007_trailer_models.sql");

const realCodes = new Set(fleet.trailers.map((t) => t.code));
const old = must(await sb.from("trailers").select("id, code"), "trailers").filter((t) => !realCodes.has(t.code));
if (old.length) {
  const ids = old.map((t) => t.id);
  const bookings = must(await sb.from("bookings").select("id").in("trailer_id", ids), "bookings");
  if (bookings.length) must(await sb.from("bookings").delete().in("id", bookings.map((b) => b.id)), "delete bookings");
  must(await sb.from("trailers").delete().in("id", ids), "delete trailers");
  console.log(`ลบหางตัวอย่าง ${old.length} คัน และการจองตัวอย่าง ${bookings.length} รายการ`);
}

for (const m of fleet.models) must(await sb.from("trailer_models").upsert(m, { onConflict: "code" }), `model ${m.code}`);
const models = Object.fromEntries(must(await sb.from("trailer_models").select("*"), "models").map((m) => [m.code, m]));
const yards = Object.fromEntries(must(await sb.from("yards").select("id, code"), "yards").map((y) => [y.code, y.id]));

for (const t of fleet.trailers) {
  const m = models[t.model];
  must(
    await sb.from("trailers").upsert(
      {
        code: t.code, plate_no: t.plate, type: m.type, model_id: m.id, axles: m.axles, length_ft: m.length_ft,
        current_yard_id: yards[t.yard], status: t.status, description: `คันที่ ${t.no}`, is_published: true,
        daily_rate: null, weekly_rate: null, monthly_rate: null,
      },
      { onConflict: "code" },
    ),
    `trailer ${t.code}`,
  );
}
const all = must(await sb.from("trailers").select("status"), "count");
console.log(`หางทั้งหมด ${all.length} คัน · ว่าง ${all.filter((t) => t.status === "AVAILABLE").length} · มีผู้เช่า ${all.filter((t) => t.status === "RENTED").length}`);
