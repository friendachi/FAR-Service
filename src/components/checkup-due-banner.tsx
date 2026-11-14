import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { bangkokToday } from "@/lib/fleet-admin";
import { CHECKUP_MONTHS, checkupBoard, isAlert } from "@/lib/handover";
import { thDate } from "@/lib/format";

/** Shown on every back-office page while a rented trailer's 6-monthly inspection is due (or overdue). */
export async function CheckupDueBanner() {
  const sb = await createClient();
  const today = bangkokToday();
  const [{ data: contracts, error: e1 }, { data: checks, error: e2 }, { data: outs }] = await Promise.all([
    sb.from("rental_contracts").select("plate_no, customer_name, trailer_kind, start_date").eq("status", "ACTIVE"),
    sb.from("trailer_checkups").select("plate_no, inspected_on"),
    sb.from("rental_handovers").select("happened_on, rental_contracts(plate_no)").eq("kind", "HANDOVER"),
  ]);
  if (e1 || e2 || !contracts?.length) return null; // table not created yet → no banner
  const handovers = (outs ?? []).flatMap((h) => {
    const c = h.rental_contracts as unknown as { plate_no: string } | null;
    return c ? [{ plate_no: c.plate_no, happened_on: h.happened_on }] : [];
  });
  const due = checkupBoard(contracts, checks ?? [], handovers, today).filter((b) => isAlert(b.state));
  if (!due.length) return null;
  const late = due.filter((b) => b.state !== "DUE");
  const soon = due.filter((b) => b.state === "DUE");
  return (
    <Link
      href="/admin/checkups"
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border-2 border-warn bg-warn-tint px-5 py-3 text-warn hover:brightness-[0.98] print:hidden"
    >
      <ClipboardCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        <span className="block font-bold">ถึงกำหนดตรวจเช็คสภาพหาง ({CHECKUP_MONTHS} เดือน) {due.length} คัน</span>
        <span className="block text-[14px] text-ink">
          {late.length > 0 && <>เลยกำหนด / ยังไม่เคยตรวจ: {late.map((b) => b.plate_no).join(", ")}</>}
          {late.length > 0 && soon.length > 0 && " · "}
          {soon.length > 0 && (
            <>ใกล้ครบกำหนด: {soon.map((b) => `${b.plate_no} (${b.days === 0 ? "วันนี้" : `อีก ${b.days} วัน`} · ${thDate(b.due!)})`).join(", ")}</>
          )}
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold underline">ไปหน้าตรวจเช็คสภาพหาง แล้วกด “ตรวจเช็ค”</span>
      </span>
    </Link>
  );
}
