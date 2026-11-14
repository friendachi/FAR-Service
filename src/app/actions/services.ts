"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  serviceEstimate,
  serviceSummary,
  PARKING_YARD,
  type ServiceDetails,
  type ServiceKind,
  type ServiceStatus,
} from "@/lib/service-requests";
import { errorText, type ActionResult } from "./result";
import { alertText, sendLineAlert } from "@/lib/line-alert";

export type ServiceRequestInput = {
  kind: ServiceKind;
  name: string;
  phone: string;
  company: string;
  yard: string;
  date: string;
  note: string;
  details: ServiceDetails;
  acceptedTerms: boolean;
};

const int = (v: unknown, min: number, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Anyone (signed in or not) asks for a stand-alone service; staff call back to confirm. */
export async function submitServiceRequest(input: ServiceRequestInput): Promise<ActionResult> {
  const name = input.name.trim();
  const phone = input.phone.replace(/\D/g, "");
  if (!name) return { ok: false, error: "กรอกชื่อผู้ติดต่อ · Enter your name" };
  if (!/^0\d{8,9}$/.test(phone)) return { ok: false, error: "กรอกเบอร์โทรให้ถูกต้อง · Enter a valid phone number" };
  if (!["TYRE", "WASH", "PARKING"].includes(input.kind)) return { ok: false, error: "เลือกบริการ · Choose a service" };

  const d: ServiceDetails = {};
  if (input.kind === "TYRE") {
    d.source = input.details.source === "OUTSIDE" ? "OUTSIDE" : "OWN";
    d.tyres = int(input.details.tyres, 1, 48) ?? 0;
    if (!d.tyres) return { ok: false, error: "ระบุจำนวนยาง 1–48 เส้น · Enter 1–48 tires" };
  } else {
    d.units = int(input.details.units, 1, 50) ?? 0;
    if (!d.units) return { ok: false, error: "ระบุจำนวนคัน 1–50 · Enter 1–50 units" };
  }
  if (input.kind === "PARKING") {
    d.plan = input.details.plan === "MONTHLY" ? "MONTHLY" : "DAILY";
    d.length = int(input.details.length, 1, d.plan === "MONTHLY" ? 36 : 365) ?? 0;
    if (!d.length) return { ok: false, error: d.plan === "MONTHLY" ? "ระบุจำนวนเดือน · Enter the months" : "ระบุจำนวนวัน · Enter the days" };
    if (!input.acceptedTerms) return { ok: false, error: "กรุณายอมรับเงื่อนไขการฝากจอด · Please accept the parking terms" };
    input.yard = PARKING_YARD; // parking only at the Nong Yai yard
  }
  const plate = input.details.plate?.trim();
  if (plate) d.plate = plate.slice(0, 60);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  const estimate = serviceEstimate(input.kind, d);

  const supabase = await createClient();
  const { error } = await supabase.from("service_requests").insert({
    kind: input.kind,
    name: name.slice(0, 120),
    phone,
    company: input.company.trim().slice(0, 160) || null,
    yard_code: input.yard || null,
    preferred_date: date,
    details: d,
    estimate,
    note: input.note.trim().slice(0, 1000) || null,
    accepted_terms: input.acceptedTerms,
  });
  if (error) {
    // Table not created yet (migration 20261111000011 not run): keep the request as a contact message instead.
    if (/service_requests|does not exist|schema cache/i.test(error.message)) {
      const message = [
        `[ขอรับบริการ] ${serviceSummary(input.kind, d)}`,
        `ประมาณ ${estimate.toLocaleString("th-TH")} บาท (ก่อน VAT)`,
        input.company.trim() && `บริษัท: ${input.company.trim()}`,
        input.yard && `ลาน: ${input.yard}`,
        date && `วันที่ต้องการ: ${date}`,
        d.plate && `ทะเบียน: ${d.plate}`,
        input.note.trim() && `หมายเหตุ: ${input.note.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");
      const fb = await supabase.from("contact_messages").insert({ name, phone, message });
      if (fb.error) return { ok: false, error: errorText(fb.error) };
    } else {
      return { ok: false, error: errorText(error) };
    }
  }
  await sendLineAlert(
    alertText("ขอใช้บริการเสริม (หน้าเว็บ)", [
      ["บริการ", serviceSummary(input.kind, d)],
      ["ราคาประมาณ", `${estimate.toLocaleString("th-TH")} บาท (ก่อน VAT)`],
      ["ผู้ติดต่อ", name],
      ["โทร", phone],
      ["บริษัท", input.company.trim()],
      ["ทะเบียน", d.plate],
      ["วันที่ต้องการ", date],
      ["ลาน", input.yard],
      ["หมายเหตุ", input.note.trim()],
    ]),
  );
  revalidatePath("/admin/services");
  return {
    ok: true,
    message: "ได้รับคำขอแล้ว เจ้าหน้าที่จะโทรยืนยันวันเวลาและราคา · Request received — we will call to confirm the time and price",
  };
}

export async function setServiceRequestStatus(id: string, status: ServiceStatus): Promise<ActionResult> {
  if (!["NEW", "CONTACTED", "DONE", "CANCELLED"].includes(status)) return { ok: false, error: "สถานะไม่ถูกต้อง" };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("service_requests")
    .update({ status, handled_by: u.user?.id ?? null, handled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/services");
  return { ok: true, message: "อัปเดตสถานะแล้ว" };
}
