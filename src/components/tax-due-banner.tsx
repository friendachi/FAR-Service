import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { TAX_ALERT_DAYS, bangkokToday, taxState } from "@/lib/fleet-admin";
import { thDate } from "@/lib/format";

/** Shown on every back-office page while any plate's road tax expires within 20 days (or has expired). */
export async function TaxDueBanner() {
  const sb = await createClient();
  const today = bangkokToday();
  const limit = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10) + TAX_ALERT_DAYS)).toISOString().slice(0, 10);
  const { data, error } = await sb
    .from("vehicle_registrations")
    .select("plate_no, tax_expires_on")
    .lte("tax_expires_on", limit)
    .order("tax_expires_on");
  if (error || !data?.length) return null;
  return (
    <Link
      href="/admin/tax"
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-xl border-2 border-danger bg-danger-tint px-5 py-3 text-danger hover:brightness-[0.98] print:hidden"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span>
        <span className="block font-bold">ถึงเวลาต่อภาษีหาง {data.length} คัน</span>
        <span className="block text-[14px]">
          {data
            .map((r) => {
              const { state, days } = taxState(r.tax_expires_on, today);
              return `${r.plate_no} (${state === "EXPIRED" ? "หมดอายุแล้ว" : days === 0 ? "หมดวันนี้" : `อีก ${days} วัน`} · ${thDate(r.tax_expires_on!)})`;
            })
            .join(" · ")}
        </span>
        <span className="mt-0.5 block text-[13px] font-semibold underline">ไปหน้าภาษี / พ.ร.บ. แล้วกด “ต่อภาษีแล้ว” เมื่อต่อเสร็จ</span>
      </span>
    </Link>
  );
}
