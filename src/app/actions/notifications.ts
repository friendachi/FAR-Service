"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";

export async function markAllNotificationsRead(): Promise<ActionResult> {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return { ok: false, error: "กรุณาเข้าสู่ระบบ" };
  const { error } = await sb
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", u.user.id)
    .is("read_at", null);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/notifications");
  return { ok: true, message: "อ่านทั้งหมดแล้ว" };
}
