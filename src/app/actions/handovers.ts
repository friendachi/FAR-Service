"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { staffRole } from "@/lib/admin";
import {
  DOC_BUCKET,
  checkupItems,
  handoverItems,
  photoSlots,
  type CheckupValue,
  type HandoverDetails,
  type PhotoMap,
} from "@/lib/handover";
import { errorText, type ActionResult } from "./result";

const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const clip = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "") || undefined;
const MIGRATION = "ให้รัน migration 20261117000017_handover_checkups.sql ใน Supabase ก่อน";
const needsMigration = (m: string) => /details|photos|deliver_|receive_|trailer_checkups|schema cache|does not exist/i.test(m);

async function staff() {
  const role = await staffRole();
  return role ? { role, sb: await createClient() } : null;
}

/** Keeps only files this record uploaded, per known slot. */
function cleanPhotos(photos: PhotoMap, prefix: string): PhotoMap {
  const out: PhotoMap = {};
  for (const { id } of photoSlots) {
    const list = (photos[id] ?? []).filter((p) => typeof p === "string" && p.startsWith(prefix) && p.length < 300).slice(0, 10);
    if (list.length) out[id] = list;
  }
  return out;
}

const ownFile = (p: string | null | undefined, prefix: string) => (p && p.startsWith(prefix) && p.length < 300 ? p : null);

function cleanDetails(d: HandoverDetails): HandoverDetails {
  const items: Record<string, { spec?: string; qty?: string; of?: string; ok?: boolean }> = {};
  for (const it of handoverItems) {
    const v = d.items?.[it.key];
    if (!v) continue;
    items[it.key] = { spec: clip(v.spec, 60), qty: clip(v.qty, 10), of: clip(v.of, 60), ok: v.ok === true ? true : v.ok === false ? false : undefined };
  }
  return {
    customer: { name: clip(d.customer?.name, 200), address: clip(d.customer?.address, 300), taxId: clip(d.customer?.taxId, 30), phone: clip(d.customer?.phone, 30) },
    tractor: { brand: clip(d.tractor?.brand, 60), chassis: clip(d.tractor?.chassis, 60), plate: clip(d.tractor?.plate, 40), note: clip(d.tractor?.note, 1000) },
    trailer: {
      productType: clip(d.trailer?.productType, 60),
      model: clip(d.trailer?.model, 60),
      chassis: clip(d.trailer?.chassis, 60),
      plate: clip(d.trailer?.plate, 20),
      note: clip(d.trailer?.note, 1000),
    },
    items,
    accepted: d.accepted === true,
    deliverDate: isDate(d.deliverDate) ? d.deliverDate : undefined,
    receiveDate: isDate(d.receiveDate) ? d.receiveDate : undefined,
  };
}

type Terms = { customerKind: "PERSON" | "COMPANY"; trailerKind: string; rent: number; term: number | null; payDay: number | null };
const intIn = (v: number | null | undefined, min: number, max: number) =>
  v != null && Number.isFinite(v) && Math.floor(v) >= min && Math.floor(v) <= max ? Math.floor(v) : null;

/**
 * Hand-over: finds the trailer's current contract or creates one from the form (customer + rental terms), so the
 * customer shows on "ลูกค้าผู้เช่าปัจจุบัน". A plate still out with a different customer must be returned first.
 */
async function contractForHandover(
  sb: Awaited<ReturnType<typeof createClient>>,
  plate: string,
  date: string,
  d: HandoverDetails,
  t: Terms | null,
): Promise<{ id: string } | { error: string }> {
  const name = d.customer?.name;
  if (!plate) return { error: "กรอกทะเบียนหาง" };
  if (!name) return { error: "กรอกชื่อผู้รับ (ลูกค้า)" };
  const kind = t?.customerKind === "COMPANY" ? "COMPANY" : "PERSON";
  const norm = (x: string) => x.replace(/\s+|บริษัท|จำกัด|นาย|นางสาว|นาง|คุณ|\(.*?\)/g, "");
  const { data: open } = await sb.from("rental_contracts").select("id, customer_name, phone, start_date, monthly_rent, term_months, pay_day, trailer_kind").eq("plate_no", plate).eq("status", "ACTIVE");
  if (open?.length) {
    const same = open.find((c) => norm(c.customer_name) === norm(name) || norm(c.customer_name).includes(norm(name)) || norm(name).includes(norm(c.customer_name)));
    if (!same) return { error: `หาง ${plate} ยังอยู่กับ ${open[0].customer_name} · บันทึก “รับคืนหาง” ก่อน แล้วค่อยส่งมอบให้ลูกค้ารายใหม่` };
    // fill what the register is still missing; staff edits the rest on the rentals page
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!same.phone && d.customer?.phone) patch.phone = d.customer.phone;
    if (!same.start_date) patch.start_date = date;
    if (!Number(same.monthly_rent) && t?.rent) patch.monthly_rent = Math.round(t.rent * 100) / 100;
    if (!same.term_months && intIn(t?.term, 1, 120)) patch.term_months = intIn(t?.term, 1, 120);
    if (!same.pay_day && intIn(t?.payDay, 1, 31)) patch.pay_day = intIn(t?.payDay, 1, 31);
    if (!same.trailer_kind && t?.trailerKind) patch.trailer_kind = t.trailerKind.trim().slice(0, 20);
    await sb.from("rental_contracts").update(patch).eq("id", same.id);
    return { id: same.id };
  }
  const { data: last } = await sb.from("rental_contracts").select("seq").eq("status", "ACTIVE").order("seq", { ascending: false, nullsFirst: false }).limit(1);
  const { data: created, error } = await sb
    .from("rental_contracts")
    .insert({
      seq: (last?.[0]?.seq ?? 0) + 1,
      customer_name: name,
      phone: d.customer?.phone ?? null,
      customer_kind: kind,
      trailer_kind: t?.trailerKind?.trim().slice(0, 20) || null,
      plate_no: plate,
      start_date: date,
      term_months: intIn(t?.term, 1, 120),
      pay_day: intIn(t?.payDay, 1, 31) ?? +date.slice(8, 10),
      monthly_rent: t?.rent && t.rent > 0 ? Math.round(t.rent * 100) / 100 : 0,
      vat_rate: kind === "COMPANY" ? 7 : 0,
      wht_rate: kind === "COMPANY" ? 5 : 0,
      note: "สร้างจากใบส่งมอบ",
    })
    .select("id")
    .single();
  if (error || !created) return { error: errorText(error) };
  return { id: created.id };
}

/**
 * Saves a hand-over (full ใบส่งมอบ + photos + both signatures) or a return (photos only). The browser uploads
 * every file to vehicle-docs/handovers/{id}/ first, then calls this with the paths. Hand-over → the customer is on
 * the current-renters list and the trailer "อยู่กับลูกค้า"; return → the contract ends (kept as past renter) and
 * the trailer goes to "รอตรวจหลังคืน".
 */
export async function saveHandover(input: {
  id: string;
  contractId: string | null;
  kind: "HANDOVER" | "RETURN";
  date: string;
  yard: string;
  note: string;
  terms: Terms | null;
  details: HandoverDetails;
  photos: PhotoMap;
  deliverName: string;
  deliverSign: string | null;
  receiveName: string;
  receiveSign: string | null;
}): Promise<ActionResult<{ id: string }>> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  if (!isUuid(input.id)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  if (!isDate(input.date)) return { ok: false, error: "เลือกวันที่" };
  const kind = input.kind === "RETURN" ? "RETURN" : "HANDOVER";
  const prefix = `handovers/${input.id}/`;
  const details = kind === "HANDOVER" ? cleanDetails(input.details) : {};

  let contractId: string;
  if (kind === "HANDOVER") {
    const plate = ((details as HandoverDetails).trailer?.plate ?? "").replace(/\s+/g, "");
    const r = await contractForHandover(s.sb, plate, input.date, details as HandoverDetails, input.terms);
    if ("error" in r) return { ok: false, error: r.error };
    contractId = r.id;
  } else {
    if (!input.contractId || !isUuid(input.contractId)) return { ok: false, error: "เลือกหางที่รับคืน" };
    contractId = input.contractId;
  }
  const { data: c, error: e0 } = await s.sb.from("rental_contracts").select("plate_no, start_date").eq("id", contractId).single();
  if (e0 || !c) return { ok: false, error: errorText(e0) };

  const items = (details as HandoverDetails).items ?? {};
  const row = {
    id: input.id,
    contract_id: contractId,
    kind,
    happened_on: input.date,
    yard_code: clip(input.yard, 10) ?? null,
    driver_name: clip(input.receiveName, 120) ?? null,
    tractor_plate: (kind === "HANDOVER" ? (details as HandoverDetails).tractor?.plate : clip(input.details?.tractor?.plate, 40)) ?? null,
    tyres_ok: kind === "HANDOVER" ? !!items.tyres?.qty : null,
    lights_ok: kind === "HANDOVER" ? items.lights?.ok ?? null : null,
    condition_note: clip(input.note, 1000) ?? null,
    details,
    photos: cleanPhotos(input.photos, prefix),
    deliver_name: clip(input.deliverName, 120) ?? null,
    deliver_sign: kind === "HANDOVER" ? ownFile(input.deliverSign, prefix) : null,
    receive_name: clip(input.receiveName, 120) ?? null,
    receive_sign: kind === "HANDOVER" ? ownFile(input.receiveSign, prefix) : null,
  };
  const { error } = await s.sb.from("rental_handovers").insert(row);
  if (error) return { ok: false, error: needsMigration(error.message) ? `ยังบันทึกไม่ได้ · ${MIGRATION}` : errorText(error) };

  if (kind === "RETURN") {
    await s.sb.from("rental_contracts").update({ status: "ENDED", ended_on: input.date, updated_at: new Date().toISOString() }).eq("id", contractId);
  } else {
    const patch: Record<string, unknown> = { status: "ACTIVE", ended_on: null, updated_at: new Date().toISOString() };
    if (!c.start_date) patch.start_date = input.date;
    await s.sb.from("rental_contracts").update(patch).eq("id", contractId);
  }
  const { data: y } = input.yard ? await s.sb.from("yards").select("id").eq("code", input.yard).maybeSingle() : { data: null };
  const trailerPatch: Record<string, unknown> = { status: kind === "RETURN" ? "INSPECTION" : "RENTED" };
  if (y?.id) trailerPatch.current_yard_id = y.id;
  await s.sb.from("trailers").update(trailerPatch).eq("plate_no", c.plate_no);

  revalidatePath("/admin/handovers");
  revalidatePath("/admin/rentals");
  revalidatePath("/admin", "layout");
  revalidatePath("/trailers");
  return {
    ok: true,
    data: { id: input.id },
    message:
      kind === "RETURN"
        ? "บันทึกรับคืนแล้ว · ย้ายไปข้อมูลผู้เช่าทั้งหมด · หางเป็นสถานะรอตรวจหลังคืน"
        : "บันทึกส่งมอบแล้ว · ลูกค้าขึ้นในลูกค้าผู้เช่าปัจจุบัน · หางเป็นสถานะอยู่กับลูกค้า",
  };
}

async function removeFolder(sb: Awaited<ReturnType<typeof createClient>>, folder: string) {
  const { data } = await sb.storage.from(DOC_BUCKET).list(folder, { limit: 200 });
  if (data?.length) await sb.storage.from(DOC_BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
}

export async function deleteHandover(id: string): Promise<ActionResult> {
  const s = await staff();
  if (!s || s.role !== "SUPER_ADMIN") return { ok: false, error: "ลบได้เฉพาะ Super Admin" };
  if (!isUuid(id)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { error } = await s.sb.from("rental_handovers").delete().eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  await removeFolder(s.sb, `handovers/${id}`);
  revalidatePath("/admin/handovers");
  revalidatePath("/admin/rentals");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "ลบแล้ว" };
}

/* ---------------------------------------------------------------- 6-monthly inspection */

export async function saveCheckup(input: {
  id: string;
  plate: string;
  trailerKind: string;
  date: string;
  items: Record<string, CheckupValue>;
  note: string;
  mechanicName: string;
  mechanicSign: string | null;
  inspectorName: string;
  inspectorSign: string | null;
  signedOn: string;
}): Promise<ActionResult<{ id: string }>> {
  const s = await staff();
  if (!s) return { ok: false, error: "สำหรับพนักงานเท่านั้น" };
  if (!isUuid(input.id)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const plate = input.plate.replace(/\s+/g, "").trim().slice(0, 20);
  if (!plate) return { ok: false, error: "กรอกหมายเลขทะเบียน" };
  if (!isDate(input.date)) return { ok: false, error: "เลือกวันที่ตรวจ" };
  const prefix = `checkups/${input.id}/`;
  const items: Record<string, CheckupValue> = {};
  for (const it of checkupItems) {
    const v = input.items[it.key];
    if (!v) continue;
    items[it.key] = { qty: clip(v.qty, 10), spec: clip(v.spec, 60), r: v.r === "FIX" ? "FIX" : v.r === "OK" ? "OK" : undefined };
  }
  const { error } = await s.sb.from("trailer_checkups").insert({
    id: input.id,
    plate_no: plate,
    trailer_kind: clip(input.trailerKind, 40) ?? null,
    inspected_on: input.date,
    items,
    repair_count: Object.values(items).filter((v) => v.r === "FIX").length,
    note: clip(input.note, 2000) ?? null,
    mechanic_name: clip(input.mechanicName, 120) ?? null,
    mechanic_sign: ownFile(input.mechanicSign, prefix),
    inspector_name: clip(input.inspectorName, 120) ?? null,
    inspector_sign: ownFile(input.inspectorSign, prefix),
    signed_on: isDate(input.signedOn) ? input.signedOn : null,
  });
  if (error) return { ok: false, error: needsMigration(error.message) ? `ยังบันทึกไม่ได้ · ${MIGRATION}` : errorText(error) };
  revalidatePath("/admin/checkups");
  revalidatePath("/admin", "layout");
  return { ok: true, data: { id: input.id }, message: "บันทึกการตรวจเช็คแล้ว · นับรอบ 6 เดือนใหม่จากวันนี้" };
}

export async function deleteCheckup(id: string): Promise<ActionResult> {
  const s = await staff();
  if (!s || s.role !== "SUPER_ADMIN") return { ok: false, error: "ลบได้เฉพาะ Super Admin" };
  if (!isUuid(id)) return { ok: false, error: "ข้อมูลไม่ถูกต้อง" };
  const { error } = await s.sb.from("trailer_checkups").delete().eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  await removeFolder(s.sb, `checkups/${id}`);
  revalidatePath("/admin/checkups");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "ลบแล้ว" };
}
