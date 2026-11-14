export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Fails loudly when the keys are missing from .env.local. */
export function requireSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า Supabase: ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY ใน .env.local แล้วรีสตาร์ตเซิร์ฟเวอร์",
    );
  }
  return { url: SUPABASE_URL, key: SUPABASE_KEY };
}
