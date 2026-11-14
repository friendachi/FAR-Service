"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";
import { parseExtraServices, type ExtraService } from "@/lib/extra-services";

/*
  Super Admin edits of the site's own data: model prices and specs, trailers, yards, document requirements
  and company details. RLS already limits these tables to Super Admin (trailer models: Sales too); the
  check here gives a clear message instead of a silent no-op.
*/

async function superAdmin() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("role").eq("id", u.user?.id ?? "").maybeSingle();
  return p?.role === "SUPER_ADMIN" ? supabase : null;
}

const NO = { ok: false as const, error: "แก้ไขได้เฉพาะ Super Admin · Super Admin only" };

function refresh() {
  revalidateTag("reference", "max");
  revalidatePath("/", "layout");
}

const num = (v: unknown) => (v === "" || v == null ? null : Number(v));

export type ModelInput = {
  name: string;
  axles: number;
  length_ft: number | null;
  width_m: number | null;
  length_m: number | null;
  deck_length: string | null;
  deck_height_m: number | null;
  daily_rate: number | null;
  weekly_rate: number | null;
  monthly_rate: number | null;
  monthly_rate_1_5: number | null;
  monthly_rate_6_11: number | null;
  monthly_rate_12: number | null;
  deposit: number;
  tyre_fee: number;
  tyre_count: number;
  description: string | null;
};

export async function updateModel(code: string, input: ModelInput): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  if (!input.name.trim()) return { ok: false, error: "กรอกชื่อรุ่น" };
  const row = Object.fromEntries(
    Object.entries(input).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : num(v)]),
  );
  row.name = input.name.trim();
  const { error } = await sb.from("trailer_models").update(row).eq("code", code);
  if (error) {
    if (error.message.includes("weekly_rate")) return { ok: false, error: "ต้องรัน migration 20261109000009 ก่อนจึงจะบันทึกเรทรายสัปดาห์ได้" };
    return { ok: false, error: errorText(error) };
  }
  refresh();
  return { ok: true, message: "บันทึกราคาและสเปกแล้ว" };
}

export async function updateTrailer(
  id: string,
  input: { code: string; plate: string; model: string; description: string; published: boolean; retired: boolean },
): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  if (!input.code.trim() || !input.plate.trim()) return { ok: false, error: "กรอกรหัสและทะเบียน" };
  const { data: model } = await sb.from("trailer_models").select("id, type, axles, length_ft").eq("code", input.model).single();
  if (!model) return { ok: false, error: "ไม่พบรุ่นหาง" };
  const { data: cur } = await sb.from("trailers").select("retired_at").eq("id", id).single();
  const { error } = await sb
    .from("trailers")
    .update({
      code: input.code.trim(),
      plate_no: input.plate.trim(),
      model_id: model.id,
      type: model.type,
      axles: model.axles,
      length_ft: model.length_ft,
      description: input.description.trim() || null,
      is_published: input.published,
      retired_at: input.retired ? (cur?.retired_at ?? new Date().toISOString()) : null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.code === "23505" ? "รหัสหรือทะเบียนนี้มีอยู่แล้ว" : errorText(error) };
  refresh();
  return { ok: true, message: "บันทึกข้อมูลหางแล้ว" };
}

export async function updateYard(
  code: string,
  input: { name: string; short: string; address: string; hours: string; note: string; mapUrl: string },
): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  if (!input.name.trim() || !input.short.trim()) return { ok: false, error: "กรอกชื่อลาน" };
  const { error } = await sb
    .from("yards")
    .update({
      name: input.name.trim(),
      short_name: input.short.trim(),
      address: input.address.trim(),
      open_hours: input.hours.trim() || null,
      note: input.note.trim() || null,
      map_url: input.mapUrl.trim() || null,
    })
    .eq("code", code);
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: "บันทึกลานจอดแล้ว" };
}

export async function updateDocRequirement(
  key: string,
  input: { label: string; rule: string; required: boolean },
): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  if (!input.label.trim()) return { ok: false, error: "กรอกชื่อเอกสาร" };
  const { error } = await sb
    .from("doc_requirements")
    .update({ label: input.label.trim(), rule: input.rule.trim() || null, is_required: input.required })
    .eq("key", key);
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: "บันทึกแล้ว" };
}

/** Company details shown in the footer, contact page and home page (stored in settings.company). */
export async function saveCompany(input: Record<string, string>): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  const value = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, String(v ?? "").trim()]));
  const { error } = await sb.from("settings").upsert({ key: "company", value, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: "บันทึกข้อมูลบริษัทแล้ว" };
}

/** Paid extra services shown on the home and terms pages (stored in settings.extra_services). */
export async function saveExtraServices(list: ExtraService[]): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  if (list.some((r) => !r.th.trim())) return { ok: false, error: "กรอกชื่อบริการ (ภาษาไทย) ให้ครบทุกแถว" };
  if (list.some((r) => !r.priceTh.trim())) return { ok: false, error: "กรอกราคา (ภาษาไทย) ให้ครบทุกแถว" };
  const value = parseExtraServices(list) ?? [];
  const { error } = await sb.from("settings").upsert({ key: "extra_services", value, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: "บันทึกบริการเสริมแล้ว" };
}

/** Festival theme: "auto" (by month), "off", or a festival id to force (settings.festival_theme). */
export async function saveFestivalTheme(value: string): Promise<ActionResult> {
  const sb = await superAdmin();
  if (!sb) return NO;
  const { festivals } = await import("@/lib/festivals");
  if (value !== "auto" && value !== "off" && !festivals.some((f) => f.id === value)) return { ok: false, error: "ธีมไม่ถูกต้อง" };
  const { error } = await sb.from("settings").upsert({ key: "festival_theme", value, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: value === "auto" ? "เปลี่ยนธีมอัตโนมัติตามเดือนแล้ว" : value === "off" ? "ปิดธีมเทศกาลแล้ว" : "บันทึกธีมแล้ว" };
}
