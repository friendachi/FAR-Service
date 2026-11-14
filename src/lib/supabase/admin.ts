import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";

/** Service-role client. Server only: account creation and other admin tasks. Never send to the browser. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY");
  return createClient(requireSupabaseEnv().url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
