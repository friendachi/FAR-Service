"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";

const done = (message: string): ActionResult => ({ ok: true, message });

async function rpc(fn: string, args: Record<string, unknown>, message: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin", "layout");
  revalidatePath("/me", "layout");
  return done(message);
}

export async function reviewDocument(documentId: string, approve: boolean, reason?: string, checks?: Record<string, boolean>) {
  return rpc(
    "review_document",
    { p_document: documentId, p_approve: approve, p_reason: reason ?? null, p_checks: checks ?? null },
    approve ? "เอกสารผ่าน" : "บันทึกว่าเอกสารไม่ผ่าน",
  );
}

export async function approveBooking(bookingId: string) {
  return rpc("approve_booking", { p_booking: bookingId }, "อนุมัติแล้ว · ส่งลิงก์ชำระเงินให้ลูกค้า (ชำระภายใน 24 ชั่วโมง)");
}

export async function requestMoreDocs(bookingId: string, note: string) {
  return rpc("request_more_docs", { p_booking: bookingId, p_note: note }, "ส่งคำขอเอกสารเพิ่มให้ลูกค้าแล้ว · ลูกค้ามีเวลา 48 ชั่วโมง");
}

export async function rejectBooking(bookingId: string, reason: string) {
  return rpc("reject_booking", { p_booking: bookingId, p_reason: reason }, "ปฏิเสธการจองแล้ว · ปลดล็อกหางให้จองต่อได้");
}

export async function verifyPayment(paymentId: string, approve: boolean) {
  return rpc(
    "verify_payment",
    { p_payment: paymentId, p_approve: approve },
    approve ? "ยืนยันการชำระแล้ว · การจองเป็นสถานะยืนยัน" : "ปฏิเสธสลิปแล้ว",
  );
}
