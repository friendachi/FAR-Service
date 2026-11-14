import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HandoverForm, type ActiveRental, type TrailerInfo } from "@/components/handover-form";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { bangkokToday } from "@/lib/fleet-admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "บันทึกส่งมอบ / รับคืนหาง" };

/** Sheet-style code used on the rental register: FLATBED 3 axles → SF3, SKELETAL → SC, LOWBED → LB. */
const kindCode = (type: string, axles: number | null) => {
  const p = ({ FLATBED: "SF", SKELETAL: "SC", LOWBED: "LB" } as Record<string, string>)[type];
  return p && axles ? `${p}${axles}` : "";
};

export default async function NewHandover({ searchParams }: PageProps<"/admin/handovers/new">) {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const q = await searchParams;
  const kindParam = q.kind === "RETURN" || q.kind === "HANDOVER" ? q.kind : undefined;
  const sb = await createClient();
  const [{ data: rows, error }, { data: fleet }, { data: types }, { data: yards }] = await Promise.all([
    sb
      .from("rental_contracts")
      .select("id, customer_name, nickname, phone, plate_no, trailer_kind, customer_kind, monthly_rent, term_months, pay_day")
      .eq("status", "ACTIVE")
      .order("plate_no"),
    sb.from("trailers").select("code, plate_no, type, brand, model, vin, axles").is("retired_at", null).order("code"),
    sb.from("trailer_types").select("code, name_th"),
    sb.from("yards").select("code, short_name, number").order("number"),
  ]);

  if (error)
    return (
      <p className="rounded-xl border-2 border-warn/50 bg-paper p-5">
        ยังใช้หน้านี้ไม่ได้ ({error.message}) · ให้รัน migration ใน Supabase ก่อน
      </p>
    );

  const typeName = new Map((types ?? []).map((t) => [t.code, t.name_th]));
  const trailers: Record<string, TrailerInfo> = Object.fromEntries(
    (fleet ?? []).map((t) => [
      t.plate_no,
      { code: t.code, kindCode: kindCode(t.type, t.axles), type: [t.type, typeName.get(t.type)].filter(Boolean).join(" "), model: [t.brand, t.model].filter(Boolean).join(" "), vin: t.vin, axles: t.axles },
    ]),
  );
  const rentals: ActiveRental[] = (rows ?? []).map((c) => ({
    id: c.id,
    plate: c.plate_no,
    customerName: c.customer_name,
    phone: c.phone,
    trailerKind: c.trailer_kind,
    customerKind: c.customer_kind === "COMPANY" ? "COMPANY" : "PERSON",
    rent: Number(c.monthly_rent) || 0,
    term: c.term_months,
    payDay: c.pay_day,
  }));
  const contract = typeof q.contract === "string" && rentals.some((c) => c.id === q.contract) ? q.contract : undefined;

  return (
    <>
      <Link href="/admin/handovers" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> ส่งมอบ / รับคืนหาง
      </Link>
      <div className="mt-3">
        <PageHeader
          title={kindParam === "RETURN" ? "รับคืนหาง" : kindParam === "HANDOVER" ? "ส่งมอบหาง" : "บันทึกส่งมอบ / รับคืนหาง"}
          sub="ส่งมอบ: กรอกใบส่งมอบ ถ่ายรูป 14 รูป และเซ็นทั้งสองฝ่าย แล้วลูกค้าจะขึ้นใน “ลูกค้าผู้เช่าปัจจุบัน” · รับคืน: เลือกหาง แล้วถ่ายรูป 14 รูปเหมือนตอนส่งมอบ"
        />
      </div>
      <HandoverForm
        rentals={rentals}
        trailers={trailers}
        yards={(yards ?? []).map((y) => ({ code: y.code, name: `ลาน ${y.number} ${y.short_name}` }))}
        today={bangkokToday()}
        initialContract={contract}
        initialKind={kindParam}
      />
    </>
  );
}
