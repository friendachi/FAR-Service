// One-off: switch existing accounts to mobile-number sign-in (internal email = <phone>@phone.farservice.app).
// Staff without a phone get the numbers below. Run: node scripts/phone-accounts.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const staffPhones = { "admin@example.com": "0900000001", "sales@example.com": "0900000002", "ops@example.com": "0900000003" };

const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
for (const u of users) {
  if (u.email?.endsWith("@phone.farservice.app")) continue;
  const { data: p } = await sb.from("profiles").select("phone, email").eq("id", u.id).single();
  const phone = (p?.phone ?? staffPhones[u.email] ?? "").replace(/\D/g, "");
  if (!/^0\d{9}$/.test(phone)) { console.log("skip (no phone)", u.email); continue; }
  const { error } = await sb.auth.admin.updateUserById(u.id, { email: `${phone}@phone.farservice.app`, email_confirm: true });
  if (error) throw new Error(`${u.email}: ${error.message}`);
  await sb.from("profiles").update({ phone, email: p?.email ?? u.email }).eq("id", u.id);
  console.log(u.email, "→", phone);
}
