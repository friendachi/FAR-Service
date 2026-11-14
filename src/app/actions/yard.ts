"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/driver", "layout");
  revalidatePath("/me", "layout");
}

export async function checkIn(appointmentId: string, code: string, identityMatch: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("checkin_appointment", {
    p_appointment: appointmentId,
    p_code: code,
    p_identity_match: identityMatch,
  });
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: identityMatch ? "เช็กอินแล้ว" : "บันทึกว่าไม่ตรงกับการจอง · ห้ามส่งมอบ" };
}

export async function saveInspection(input: {
  appointmentId: string;
  items: { key: string; label: string; result: "OK" | "DAMAGED" | "NA" }[];
  notes?: string;
  damageAmount?: number;
}): Promise<ActionResult<{ inspectionId: string; bookingId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("save_inspection", {
      p_appointment: input.appointmentId,
      p_items: input.items,
      p_notes: input.notes ?? null,
      p_damage_amount: input.damageAmount ?? null,
    })
    .single<{ id: string }>();
  if (error) return { ok: false, error: errorText(error) };
  const { data: appt } = await supabase.from("appointments").select("booking_id").eq("id", input.appointmentId).single();
  refresh();
  return { ok: true, data: { inspectionId: data.id, bookingId: appt?.booking_id ?? "" } };
}

/** Photos were uploaded by the browser to inspection-photos/{booking}/{inspection}/...; record them. */
export async function registerInspectionPhotos(
  inspectionId: string,
  photos: { path: string; angle: "FRONT" | "REAR" | "LEFT" | "RIGHT" | "DETAIL" }[],
): Promise<ActionResult> {
  if (!photos.length) return { ok: true };
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("inspection_photos").insert(
    photos.map((p) => ({ inspection_id: inspectionId, angle: p.angle, storage_path: p.path, taken_by: user.user?.id })),
  );
  if (error) return { ok: false, error: errorText(error) };
  return { ok: true };
}

export async function acknowledgeInspection(input: {
  inspectionId: string;
  result: "AGREE" | "REMARK" | "DISPUTE" | "REFUSED_TO_SIGN";
  remark?: string;
  signaturePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_inspection", {
    p_inspection: input.inspectionId,
    p_result: input.result,
    p_remark: input.remark ?? null,
    p_signature_path: input.signaturePath ?? null,
  });
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true };
}

export async function completeHandover(appointmentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_handover", { p_appointment: appointmentId }).single<{ status: string }>();
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return {
    ok: true,
    message: data.status === "IN_RENTAL" ? "ส่งมอบหางแล้ว · สถานะ กำลังเช่า" : "รับคืนแล้ว · ส่งต่อให้ฝ่ายขายสรุปยอด",
  };
}

export async function settleBooking(bookingId: string, waiveDamage: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("settle_booking", { p_booking: bookingId, p_waive_damage: waiveDamage });
  if (error) return { ok: false, error: errorText(error) };
  refresh();
  return { ok: true, message: "ปิดงานแล้ว · บันทึกยอดคืนเงินค้ำประกัน" };
}
