import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CheckupForm } from "@/components/checkup-form";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { bangkokToday } from "@/lib/fleet-admin";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "บันทึกการตรวจเช็คสภาพหาง" };

export default async function NewCheckup({ searchParams }: PageProps<"/admin/checkups/new">) {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const plate = (await searchParams).plate;
  const sb = await createClient();
  const [{ data: contracts }, { data: fleet }] = await Promise.all([
    sb.from("rental_contracts").select("plate_no, trailer_kind, customer_name").eq("status", "ACTIVE").order("seq"),
    sb.from("trailers").select("plate_no, code, type").is("retired_at", null).order("code"),
  ]);
  const plates = new Map<string, { plate: string; kind: string | null; label: string }>();
  for (const c of contracts ?? []) plates.set(c.plate_no, { plate: c.plate_no, kind: c.trailer_kind, label: `${c.customer_name}${c.trailer_kind ? ` · ${c.trailer_kind}` : ""}` });
  for (const t of fleet ?? []) if (!plates.has(t.plate_no)) plates.set(t.plate_no, { plate: t.plate_no, kind: t.type, label: `${t.code} · ${t.type}` });

  return (
    <>
      <Link href="/admin/checkups" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
        <ChevronLeft className="size-4" aria-hidden /> ตรวจเช็คสภาพหาง 6 เดือน
      </Link>
      <div className="mt-3">
        <PageHeader title="ใบรายการตรวจเช็คหางรถเช่า" sub="เลือกผลทุกรายการ (ซ่อม / ไม่ซ่อม) แล้วให้ช่างผู้ซ่อมและผู้ตรวจสอบเซ็น" />
      </div>
      <CheckupForm plates={[...plates.values()]} today={bangkokToday()} initialPlate={typeof plate === "string" ? plate : undefined} />
    </>
  );
}
