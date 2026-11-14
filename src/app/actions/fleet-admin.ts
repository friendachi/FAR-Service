"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { staffRole } from "@/lib/admin";
import { bangkokToday, plusYears, type CustomerKind, type DocKind } from "@/lib/fleet-admin";
import { errorText, type ActionResult } from "./result";

const DOC_BUCKET = "vehicle-docs";
const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const clip = (s: string | null | undefined, n: number) => (s ?? "").trim().slice(0, n) || null;

async function staff() {
  const role = await staffRole();
  return role ? { role, sb: await createClient() } : null;
}

const refreshTax = () => {
  revalidatePath("/admin/tax");
  revalidatePath("/admin", "layout"); // the tax alert banner
};

/* ---------------------------------------------------------------- road tax */

export async function saveRegistration(input: {
  id?: string;
  plate: string;
  province: string;
  taxExpiresOn: string;
  note: string;
}): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  const plate = input.plate.replace(/\s+/g, "").trim();
  if (!/^[\dก-ฮ]{1,3}-?\d{1,4}$/.test(plate)) return { ok: false, error: "ทะเบียนไม่ถูกต้อง เช่น 74-4875" };
  const row = {
    plate_no: plate,
    province: clip(input.province, 40) ?? "ชลบุรี",
    tax_expires_on: isDate(input.taxExpiresOn) ? input.taxExpiresOn : null,
    note: clip(input.note, 500),
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await s.sb.from("vehicle_registrations").update(row).eq("id", input.id)
    : await s.sb.from("vehicle_registrations").insert(row);
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "มีทะเบียนนี้อยู่แล้ว" : errorText(error) };
  refreshTax();
  return { ok: true, message: "บันทึกแล้ว" };
}

/** "ต่อภาษีแล้ว": moves the expiry date to the same day next year. */
export async function renewTax(id: string): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  const { data: reg, error: e1 } = await s.sb.from("vehicle_registrations").select("tax_expires_on").eq("id", id).single();
  if (e1 || !reg) return { ok: false, error: errorText(e1) };
  const next = plusYears(reg.tax_expires_on ?? bangkokToday());
  const { data: u } = await s.sb.auth.getUser();
  const { error } = await s.sb
    .from("vehicle_registrations")
    .update({ tax_expires_on: next, tax_renewed_at: new Date().toISOString(), tax_renewed_by: u.user?.id ?? null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  refreshTax();
  return { ok: true, message: `ต่อภาษีแล้ว · หมดอายุใหม่ ${next}` };
}

export async function deleteRegistration(id: string): Promise<ActionResult> {
  const s = await staff();
  if (!s || s.role !== "SUPER_ADMIN") return { ok: false, error: "ลบได้เฉพาะ Super Admin" };
  const { data: docs } = await s.sb.from("vehicle_documents").select("storage_path").eq("registration_id", id);
  if (docs?.length) await s.sb.storage.from(DOC_BUCKET).remove(docs.map((d) => d.storage_path));
  const { error } = await s.sb.from("vehicle_registrations").delete().eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  refreshTax();
  return { ok: true, message: "ลบแล้ว" };
}

/** The file is uploaded from the browser to vehicle-docs/{registrationId}/…; this records it. */
export async function addVehicleDocument(registrationId: string, kind: DocKind, path: string, fileName: string): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  if (!["BOOK", "TAX", "CMI"].includes(kind) || !path.startsWith(`${registrationId}/`)) return { ok: false, error: "ไฟล์ไม่ถูกต้อง" };
  const { error } = await s.sb
    .from("vehicle_documents")
    .insert({ registration_id: registrationId, kind, storage_path: path, file_name: fileName.slice(0, 200) });
  if (error) {
    await s.sb.storage.from(DOC_BUCKET).remove([path]);
    return { ok: false, error: errorText(error) };
  }
  revalidatePath("/admin/tax");
  return { ok: true, message: "แนบไฟล์แล้ว" };
}

export async function deleteVehicleDocument(id: string): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  const { data: doc } = await s.sb.from("vehicle_documents").select("storage_path").eq("id", id).single();
  const { error } = await s.sb.from("vehicle_documents").delete().eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  if (doc) await s.sb.storage.from(DOC_BUCKET).remove([doc.storage_path]);
  revalidatePath("/admin/tax");
  return { ok: true, message: "ลบไฟล์แล้ว" };
}

/* ---------------------------------------------------------------- rental register */

export type ContractInput = {
  id?: string;
  seq: number | null;
  customerName: string;
  nickname: string;
  phone: string;
  customerKind: CustomerKind;
  trailerKind: string;
  plate: string;
  plateNote: string;
  startDate: string;
  termMonths: number | null;
  payDay: number | null;
  monthlyRent: number;
  vatRate: number;
  whtRate: number;
  note: string;
};

const intIn = (v: number | null, min: number, max: number) =>
  v !== null && Number.isFinite(v) && Math.floor(v) >= min && Math.floor(v) <= max ? Math.floor(v) : null;

export async function saveContract(input: ContractInput): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  const name = clip(input.customerName, 200);
  const plate = input.plate.replace(/\s+/g, "").trim();
  if (!name) return { ok: false, error: "กรอกชื่อลูกค้า" };
  if (!plate) return { ok: false, error: "กรอกทะเบียนหาง" };
  if (!(input.monthlyRent >= 0)) return { ok: false, error: "ค่าเช่าต้องเป็นตัวเลข" };
  const kind: CustomerKind = input.customerKind === "COMPANY" ? "COMPANY" : "PERSON";
  const row = {
    seq: intIn(input.seq, 0, 9999),
    customer_name: name,
    nickname: clip(input.nickname, 80),
    phone: clip(input.phone, 30),
    customer_kind: kind,
    trailer_kind: clip(input.trailerKind, 20),
    plate_no: plate.slice(0, 20),
    plate_note: clip(input.plateNote, 40),
    start_date: isDate(input.startDate) ? input.startDate : null,
    term_months: intIn(input.termMonths, 1, 120),
    pay_day: intIn(input.payDay, 1, 31),
    monthly_rent: Math.round(input.monthlyRent * 100) / 100,
    vat_rate: input.vatRate === 7 ? 7 : 0,
    wht_rate: [1, 3, 5].includes(input.whtRate) ? input.whtRate : 0,
    note: clip(input.note, 1000),
    updated_at: new Date().toISOString(),
  };
  const { error } = input.id
    ? await s.sb.from("rental_contracts").update(row).eq("id", input.id)
    : await s.sb.from("rental_contracts").insert(row);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/rentals");
  return { ok: true, message: input.id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มลูกค้าผู้เช่าแล้ว" };
}

export async function deleteContract(id: string): Promise<ActionResult> {
  const s = await staff();
  if (!s || s.role !== "SUPER_ADMIN") return { ok: false, error: "ลบได้เฉพาะ Super Admin" };
  const { error } = await s.sb.from("rental_contracts").delete().eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/rentals");
  return { ok: true, message: "ลบแล้ว" };
}

/** Edits overdue rent: unpaid months, an optional amount (part payments) and a note. Empty months = paid up. */
export async function saveArrears(id: string, input: { months: string[]; amount: number | null; note: string }): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  const months = [...new Set(input.months)].filter((m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m)).sort().slice(-120);
  if (input.amount !== null && !(input.amount >= 0)) return { ok: false, error: "ยอดค้างต้องเป็นตัวเลข" };
  const { error } = await s.sb
    .from("rental_contracts")
    .update({
      unpaid_months: months,
      arrears_amount: months.length && input.amount !== null ? Math.round(input.amount * 100) / 100 : null,
      arrears_note: months.length ? clip(input.note, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error)
    return {
      ok: false,
      error: /unpaid_months|arrears|column/i.test(error.message)
        ? "ยังบันทึกค้างชำระไม่ได้ ให้รัน migration 20261116000016_rental_arrears.sql ใน Supabase ก่อน"
        : errorText(error),
    };
  revalidatePath("/admin/rentals");
  return { ok: true, message: months.length ? `บันทึกค้างชำระ ${months.length} เดือนแล้ว` : "บันทึกว่าชำระครบแล้ว" };
}

/** Ticks / unticks "วางบิลแล้ว" for this month. */
export async function setBilled(id: string, month: string | null): Promise<ActionResult> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  if (month !== null && !/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "เดือนไม่ถูกต้อง" };
  const { error } = await s.sb.from("rental_contracts").update({ billed_month: month }).eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/rentals");
  return { ok: true, message: month ? "วางบิลแล้ว" : "ยกเลิกวางบิล" };
}
