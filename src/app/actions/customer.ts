"use server";
import { alertText, sendLineAlert } from "@/lib/line-alert";

import { revalidatePath } from "next/cache";
import { getStore } from "@/lib/data/store";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Channel, DocOwner, YardId } from "@/lib/types";
import { errorText, type ActionResult } from "./result";

async function yardUuid(code: YardId) {
  const supabase = await createClient();
  const { data } = await supabase.from("yards").select("id").eq("code", code).single();
  return data?.id as string | undefined;
}

// ---------------------------------------------------------------- tractors & drivers

export async function addTractor(input: {
  customerId: string;
  plateNo: string;
  province: string;
  brand: string;
  kind: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tractors")
    .insert({
      customer_id: input.customerId,
      plate_no: input.plateNo,
      province: input.province,
      brand: input.brand,
      kind: input.kind,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "ทะเบียนนี้มีอยู่ในรายการแล้ว" : errorText(error) };
  revalidatePath("/me/tractors");
  return { ok: true, data };
}

export async function addDriver(input: {
  customerId: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseClass: string;
  licenseExpires: string;
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("add_driver", {
      p_customer: input.customerId,
      p_full_name: input.name,
      p_phone: input.phone,
      p_license_no: input.licenseNo,
      p_license_class: input.licenseClass,
      p_license_expires: input.licenseExpires,
    })
    .single<{ id: string }>();
  if (error) return { ok: false, error: errorText(error) };
  // TODO(SMS): send the invite link via the SMS provider once it is chosen.
  revalidatePath("/me/drivers");
  return { ok: true, data: { id: data.id } };
}

export async function resendDriverInvite(driverId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resend_driver_invite", { p_driver: driverId });
  if (error) return { ok: false, error: errorText(error) };
  return { ok: true };
}

// ---------------------------------------------------------------- documents

/** The browser uploads the file to Storage first; this registers it as the current version. */
export async function registerDocument(input: {
  requirementKey: string;
  owner: DocOwner;
  ownerId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_document", {
    p_requirement: input.requirementKey,
    p_owner: input.owner,
    p_owner_id: input.ownerId,
    p_storage_path: input.storagePath,
    p_file_name: input.fileName,
    p_mime: input.mimeType,
    p_size: input.size,
  });
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/me", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- account

export async function updateCustomer(input: {
  customerId: string;
  name: string;
  taxId: string;
  address: string;
  contact: string;
  phone: string;
  email: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: input.name,
      tax_id: input.taxId.replace(/\D/g, ""),
      billing_address: input.address,
      contact_name: input.contact,
      phone: input.phone,
      email: input.email,
    })
    .eq("id", input.customerId);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/me", "layout");
  return { ok: true, message: "บันทึกแล้ว" };
}

// ---------------------------------------------------------------- bookings

export type CreateBookingInput = {
  customerId: string;
  trailerId: string;
  tractorId: string;
  driverIds: string[];
  pickupAt: string; // "YYYY-MM-DDTHH:mm" Bangkok time
  returnAt: string;
  returnYard: YardId;
  channel?: Channel;
  invoiceName?: string;
  tyreCount?: number;
};

export async function createBooking(input: CreateBookingInput): Promise<ActionResult<{ id: string; no: string }>> {
  const store = await getStore();
  const guarantor = store.guarantors.find((g) => g.customerId === input.customerId);
  if (!guarantor) return { ok: false, error: "ลูกค้ารายนี้ยังไม่มีผู้ค้ำประกัน กรุณาเพิ่มในขั้นเอกสารและผู้ค้ำ" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("create_booking", {
      p_customer_id: input.customerId,
      p_trailer_id: input.trailerId,
      p_tractor_id: input.tractorId,
      p_driver_ids: input.driverIds,
      p_guarantor_id: guarantor.id,
      p_pickup_at: `${input.pickupAt}:00+07:00`,
      p_return_at: `${input.returnAt}:00+07:00`,
      p_return_yard: await yardUuid(input.returnYard),
      p_channel: input.channel ?? "WEB",
      p_invoice_name: input.invoiceName ?? null,
      p_tyre_count: input.tyreCount ?? 0,
    })
    .single<{ id: string; booking_no: string }>();
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/me/bookings");
  revalidatePath("/admin/bookings");
  return { ok: true, data: { id: data.id, no: data.booking_no } };
}

/** Saves the guarantor named in the booking form (creates one if the customer has none). */
export async function saveGuarantor(input: {
  customerId: string;
  name: string;
  phone: string;
  relation: "DIRECTOR" | "OTHER";
}): Promise<ActionResult<{ id: string }>> {
  if (!input.name.trim()) return { ok: false, error: "กรอกชื่อผู้ค้ำประกัน" };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("guarantors")
    .select("id")
    .eq("customer_id", input.customerId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const row = { customer_id: input.customerId, full_name: input.name.trim(), phone: input.phone, relation: input.relation };
  const { data, error } = existing
    ? await supabase.from("guarantors").update(row).eq("id", existing.id).select("id").single()
    : await supabase.from("guarantors").insert(row).select("id").single();
  if (error) return { ok: false, error: errorText(error) };
  return { ok: true, data };
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking", { p_booking: bookingId, p_reason: reason ?? null });
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/me/bookings", "layout");
  return { ok: true, message: "ยกเลิกการจองแล้ว" };
}

export async function resubmitDocuments(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_documents", { p_booking: bookingId });
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/me/bookings", "layout");
  return { ok: true, message: "ส่งเอกสารให้ตรวจอีกครั้งแล้ว" };
}

/** Records a PromptPay / transfer payment. The browser uploads the slip to Storage first. */
export async function submitPayment(input: {
  bookingId: string;
  method: "PROMPTPAY" | "TRANSFER";
  slipPath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_payment", {
    p_booking: input.bookingId,
    p_method: input.method,
    p_slip_path: input.slipPath ?? null,
  });
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/me/bookings", "layout");
  revalidatePath("/admin/bookings", "layout");
  return { ok: true };
}

export async function sendContactMessage(_: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").replace(/\D/g, "");
  const message = String(formData.get("message") ?? "").trim();
  if (!name || !message) return { ok: false, error: "กรอกชื่อและข้อความ · Enter your name and message" };
  if (!/^0\d{8,9}$/.test(phone)) return { ok: false, error: "กรอกเบอร์โทรให้ถูกต้อง · Enter a valid phone number" };
  const supabase = await createClient();
  const { error } = await supabase.from("contact_messages").insert({ name, phone, message });
  if (error) return { ok: false, error: errorText(error) };
  await sendLineAlert(alertText("ข้อความจากหน้าติดต่อเรา", [["ชื่อ", name], ["โทร", phone], ["ข้อความ", message]]));
  return { ok: true, message: "ได้รับข้อความแล้ว เจ้าหน้าที่จะติดต่อกลับโดยเร็ว · Message received — we will call you back soon" };
}

/** Who may act for a customer: the customer themself or Sales / Super Admin. */
export async function currentCustomerId() {
  const [session, store] = await Promise.all([getSession(), getStore()]);
  return session.role === "CUSTOMER" ? store.currentCustomerId : null;
}
