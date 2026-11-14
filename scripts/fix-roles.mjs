// Re-applies roles from auth app_metadata to profiles and links driver accounts by phone.
// Needed only for accounts created before migration 20261107000005_sync_role.sql was run.
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
for (const u of users) {
  const role = u.app_metadata?.role;
  if (!role) continue;
  const { error } = await sb.from("profiles").update({ role }).eq("id", u.id);
  if (error) throw error;
  if (role === "DRIVER") {
    const phone = String(u.user_metadata?.phone ?? u.phone ?? "").replace(/\D/g, "");
    await sb.from("drivers").update({ profile_id: u.id }).eq("phone", phone).is("profile_id", null);
  }
  console.log(u.email, role);
}
