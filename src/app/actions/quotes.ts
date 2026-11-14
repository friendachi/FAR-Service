"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { errorText, type ActionResult } from "./result";
import { alertText, sendLineAlert } from "@/lib/line-alert";

export type QuoteStatus = "NEW" | "CONTACTED" | "QUOTED" | "WON" | "LOST";

export type QuoteRequestInput = {
  company: string;
  contactName: string;
  phone: string;
  email: string;
  lineId: string;
  customerKind: "COMPANY" | "PERSON";
  items: { model: string; label: string; qty: number }[];
  startDate: string;
  months: number;
  yard: string;
  tyreService: boolean;
  note: string;
};

const clip = (s: string, n: number) => s.trim().slice(0, n);

/** A customer asks for a quotation. Staff call back with prices and availability. */
export async function submitQuoteRequest(input: QuoteRequestInput): Promise<ActionResult> {
  const contact = clip(input.contactName, 120);
  const phone = input.phone.replace(/\D/g, "");
  if (!contact) return { ok: false, error: "กรอกชื่อผู้ติดต่อ · Enter a contact name" };
  if (!/^0\d{8,9}$/.test(phone)) return { ok: false, error: "กรอกเบอร์โทรให้ถูกต้อง · Enter a valid phone number" };
  const email = clip(input.email, 160);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "อีเมลไม่ถูกต้อง · Invalid email" };
  const items = input.items
    .filter((i) => i.model && Number.isFinite(i.qty) && i.qty >= 1)
    .slice(0, 10)
    .map((i) => ({ model: clip(i.model, 20), label: clip(i.label, 80), qty: Math.min(Math.floor(i.qty), 99) }));
  if (!items.length) return { ok: false, error: "เลือกรุ่นหางอย่างน้อย 1 รายการ · Choose at least one trailer" };
  const months = Math.floor(input.months);
  const row = {
    company: clip(input.company, 160) || null,
    contact_name: contact,
    phone,
    email: email || null,
    line_id: clip(input.lineId, 60) || null,
    customer_kind: input.customerKind === "PERSON" ? "PERSON" : "COMPANY",
    items,
    start_date: /^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ? input.startDate : null,
    months: months >= 1 && months <= 120 ? months : null,
    yard_code: clip(input.yard, 10) || null,
    tyre_service: !!input.tyreService,
    note: clip(input.note, 1500) || null,
  };

  const supabase = await createClient();
  const { error } = await supabase.from("quote_requests").insert(row);
  if (error) {
    // Table not created yet (migration 20261113000013 not run): keep the request as a contact message.
    if (!/quote_requests|does not exist|schema cache/i.test(error.message)) return { ok: false, error: errorText(error) };
    const message = [
      "[ขอใบเสนอราคา]",
      row.company && `บริษัท: ${row.company}`,
      `รายการ: ${items.map((i) => `${i.label} × ${i.qty}`).join(", ")}`,
      row.months && `ระยะเช่า: ${row.months} เดือน`,
      row.start_date && `เริ่มเช่า: ${row.start_date}`,
      row.yard_code && `ลาน: ${row.yard_code}`,
      row.tyre_service && "ต้องการบริการใส่/ถอดยาง",
      row.email && `อีเมล: ${row.email}`,
      row.line_id && `LINE: ${row.line_id}`,
      row.note && `หมายเหตุ: ${row.note}`,
    ]
      .filter(Boolean)
      .join("\n");
    const fb = await supabase.from("contact_messages").insert({ name: contact, phone, message });
    if (fb.error) return { ok: false, error: errorText(fb.error) };
  }
  await sendLineAlert(
    alertText("ขอใบเสนอราคา (หน้าเว็บ)", [
      ["บริษัท", row.company],
      ["ผู้ติดต่อ", contact],
      ["โทร", phone],
      ["อีเมล", row.email],
      ["LINE", row.line_id],
      ["ประเภท", row.customer_kind === "PERSON" ? "บุคคลธรรมดา" : "นิติบุคคล"],
      ["ต้องการ", items.map((i) => `${i.label} × ${i.qty}`).join(", ")],
      ["ระยะเช่า", row.months ? `${row.months} เดือน` : null],
      ["เริ่มเช่า", row.start_date],
      ["ลาน", row.yard_code],
      ["ใส่/ถอดยาง", row.tyre_service ? "ต้องการ" : null],
      ["หมายเหตุ", row.note],
    ]),
  );
  revalidatePath("/admin/quotes");
  return {
    ok: true,
    message: "ได้รับคำขอใบเสนอราคาแล้ว เจ้าหน้าที่จะติดต่อกลับพร้อมราคาและหางที่ว่างโดยเร็ว · Request received — we will contact you with prices and availability soon",
  };
}

export async function setQuoteStatus(id: string, status: QuoteStatus): Promise<ActionResult> {
  if (!["NEW", "CONTACTED", "QUOTED", "WON", "LOST"].includes(status)) return { ok: false, error: "สถานะไม่ถูกต้อง" };
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("quote_requests")
    .update({ status, handled_by: u.user?.id ?? null, handled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: errorText(error) };
  revalidatePath("/admin/quotes");
  return { ok: true, message: "อัปเดตสถานะแล้ว" };
}
