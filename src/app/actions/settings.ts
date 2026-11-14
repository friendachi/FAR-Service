"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { normalizePhone, phoneToAuthEmail } from "@/lib/phone-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TrailerTypeId, YardId } from "@/lib/types";
import { errorText, type ActionResult } from "./result";

export async function addTrailer(input: { model: string; yard: YardId; code: string; plate: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const [{ data: yard }, { data: model }] = await Promise.all([
    supabase.from("yards").select("id").eq("code", input.yard).single(),
    supabase.from("trailer_models").select("id, type, axles, length_ft").eq("code", input.model).single(),
  ]);
  if (!yard || !model) return { ok: false, error: "ไม่พบลานจอดหรือรุ่นหาง" };
  if (!input.code.trim() || !input.plate.trim()) return { ok: false, error: "กรอกรหัสและทะเบียน" };
  const { error } = await supabase.from("trailers").insert({
    code: input.code.trim(),
    plate_no: input.plate.trim(),
    type: model.type,
    model_id: model.id,
    axles: model.axles,
    length_ft: model.length_ft,
    current_yard_id: yard.id,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "รหัสหรือทะเบียนนี้มีอยู่แล้ว" : errorText(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/trailers");
  return { ok: true, message: "เพิ่มหางแล้ว" };
}

/** Ops marks a trailer available / rented / under maintenance and where it is parked. */
export async function updateTrailerStatus(trailerId: string, status: string, yard: YardId): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: y } = await supabase.from("yards").select("id").eq("code", yard).single();
  const { error } = await supabase.from("trailers").update({ status, current_yard_id: y?.id }).eq("id", trailerId);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/trailers");
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function saveSettings(values: Record<string, unknown>): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value,
    updated_by: user.user?.id,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from("settings").upsert(rows);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/settings");
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function saveDeposits(deposits: Record<TrailerTypeId, number>): Promise<ActionResult> {
  const supabase = await createClient();
  for (const [code, amount] of Object.entries(deposits)) {
    if (!(amount >= 0)) return { ok: false, error: "เงินค้ำประกันต้องเป็นตัวเลข" };
    const { error } = await supabase.from("trailer_types").update({ default_deposit: amount }).eq("code", code);
    if (error) return { ok: false, error: errorText(error) };
  }
  revalidateTag("reference", "max");
  revalidatePath("/", "layout");
  return { ok: true, message: "บันทึกเงินค้ำประกันแล้ว" };
}

/** Super Admin creates a staff account (Sales / Ops / Super Admin) that signs in with a mobile number. */
export async function addStaffUser(input: {
  name: string;
  phone: string;
  pin: string;
  role: "SUPER_ADMIN" | "SALES" | "OPS";
  homeYard?: YardId;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", me.user?.id ?? "").maybeSingle();
  if (profile?.role !== "SUPER_ADMIN") return { ok: false, error: "เพิ่มผู้ใช้ได้เฉพาะ Super Admin" };
  const phone = normalizePhone(input.phone);
  if (!input.name.trim() || !phone) return { ok: false, error: "กรอกชื่อและเบอร์มือถือ 10 หลัก" };
  if (!/^\d{6}$/.test(input.pin)) return { ok: false, error: "PIN ต้องเป็นตัวเลข 6 หลัก" };

  const admin = createAdminClient();
  const { data: taken } = await admin.from("profiles").select("id").eq("phone", phone).maybeSingle();
  if (taken) return { ok: false, error: "เบอร์นี้มีบัญชีอยู่แล้ว" };
  const { data, error } = await admin.auth.admin.createUser({
    email: phoneToAuthEmail(phone),
    password: input.pin, // staff sign in with mobile number + 6-digit PIN
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: input.name.trim(), phone },
  });
  if (error) return { ok: false, error: errorText(error) };
  let yardId: string | null = null;
  if (input.role === "OPS" && input.homeYard) {
    const { data: y } = await admin.from("yards").select("id").eq("code", input.homeYard).single();
    yardId = y?.id ?? null;
  }
  const { error: pErr } = await admin
    .from("profiles")
    .update({ role: input.role, phone, email: null, home_yard_id: yardId })
    .eq("id", data.user.id);
  if (pErr) return { ok: false, error: errorText(pErr) };
  revalidatePath("/admin/settings");
  return { ok: true, message: `สร้างบัญชีแล้ว · เข้าสู่ระบบด้วยเบอร์ ${input.phone} และ PIN ที่ตั้งไว้` };
}

/** Super Admin sets a new 6-digit sign-in PIN for a staff account (including their own). */
export async function setStaffPin(userId: string, pin: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", me.user?.id ?? "").maybeSingle();
  if (profile?.role !== "SUPER_ADMIN") return { ok: false, error: "ตั้ง PIN ได้เฉพาะ Super Admin" };
  if (!/^\d{6}$/.test(pin)) return { ok: false, error: "PIN ต้องเป็นตัวเลข 6 หลัก" };
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (!target || !["SUPER_ADMIN", "SALES", "OPS"].includes(target.role)) return { ok: false, error: "ตั้ง PIN ได้เฉพาะบัญชีพนักงาน" };
  const { error } = await admin.auth.admin.updateUserById(userId, { password: pin });
  if (error) return { ok: false, error: errorText(error) };
  return { ok: true, message: "ตั้ง PIN ใหม่แล้ว" };
}

/**
 * Super Admin removes a staff account. Accounts with no history are deleted outright; accounts referenced by
 * bookings, inspections, payments etc. are deactivated instead (signed out, banned, phone freed for reuse) so
 * that history keeps its "done by" links.
 */
export async function deleteStaffUser(userId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", me.user?.id ?? "").maybeSingle();
  if (profile?.role !== "SUPER_ADMIN") return { ok: false, error: "ลบผู้ใช้ได้เฉพาะ Super Admin" };
  if (userId === me.user?.id) return { ok: false, error: "ลบบัญชีของตัวเองไม่ได้" };

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, full_name").eq("id", userId).maybeSingle();
  if (!target || !["SUPER_ADMIN", "SALES", "OPS"].includes(target.role)) return { ok: false, error: "ลบได้เฉพาะบัญชีพนักงาน" };
  if (target.role === "SUPER_ADMIN") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "SUPER_ADMIN")
      .eq("is_active", true);
    if ((count ?? 0) <= 1) return { ok: false, error: "ต้องมี Super Admin อย่างน้อย 1 บัญชี" };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (!error) {
    revalidatePath("/admin/settings");
    return { ok: true, message: `ลบบัญชี ${target.full_name} แล้ว` };
  }

  // Referenced by past work: keep the record, but lock the account and free the phone number.
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    email: `removed-${userId}@phone.farservice.app`,
    ban_duration: "876000h",
  });
  if (banErr) return { ok: false, error: errorText(banErr) };
  const { error: pErr } = await admin.from("profiles").update({ is_active: false, phone: null }).eq("id", userId);
  if (pErr) return { ok: false, error: errorText(pErr) };
  revalidatePath("/admin/settings");
  return { ok: true, message: `ปิดบัญชี ${target.full_name} แล้ว (เก็บประวัติงานเดิมไว้)` };
}
