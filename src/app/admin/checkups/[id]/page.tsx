import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { NoAccess } from "@/components/no-access";
import { DeleteRecord, PrintButton } from "@/components/record-actions";
import { cx } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { bangkokToday, plusMonths } from "@/lib/fleet-admin";
import { CHECKUP_MONTHS, DOC_BUCKET, checkupGroups, resultLabel, slashDate, type CheckupValue } from "@/lib/handover";
import { thDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "ใบรายการตรวจเช็คหางรถเช่า" };

type Row = {
  id: string;
  plate_no: string;
  trailer_kind: string | null;
  inspected_on: string;
  items: Record<string, CheckupValue>;
  repair_count: number;
  note: string | null;
  mechanic_name: string | null;
  mechanic_sign: string | null;
  inspector_name: string | null;
  inspector_sign: string | null;
  signed_on: string | null;
};

function Box({ on, label, danger }: { on: boolean; label: string; danger?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap", on ? (danger ? "font-bold text-danger" : "font-semibold text-ink") : "text-ink-3")}>
      <span className={cx("inline-flex size-4 items-center justify-center border text-[11px] leading-none", on ? (danger ? "border-danger" : "border-ink") : "border-ink-3")}>
        {on ? "✓" : ""}
      </span>
      {label}
    </span>
  );
}

export default async function CheckupRecord({ params, searchParams }: PageProps<"/admin/checkups/[id]">) {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data, error } = await sb.from("trailer_checkups").select("*").eq("id", id).maybeSingle();
  if (error)
    return (
      <p className="rounded-xl border-2 border-warn/50 bg-paper p-5">
        เปิดไม่ได้ ({error.message}) · ให้รัน migration <code>20261117000017_handover_checkups.sql</code> ใน Supabase ก่อน
      </p>
    );
  if (!data) notFound();
  const c = data as Row;
  const paths = [c.mechanic_sign, c.inspector_sign].filter((p): p is string => !!p);
  const signed = paths.length ? (await sb.storage.from(DOC_BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  const next = plusMonths(c.inspected_on, CHECKUP_MONTHS);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/checkups" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> ตรวจเช็คสภาพหาง 6 เดือน
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          {role === "SUPER_ADMIN" && <DeleteRecord id={c.id} kind="checkup" back="/admin/checkups" />}
        </div>
      </div>
      {saved && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border-2 border-sign bg-sign-wash px-5 py-3 font-semibold text-sign-deep print:hidden">
          <CheckCircle2 className="size-5" aria-hidden /> บันทึกแล้ว · ครบกำหนดตรวจครั้งถัดไป {thDate(next)}
        </p>
      )}

      <article className="mx-auto mt-5 max-w-[960px] border-2 border-ink bg-paper text-[13.5px] print:mt-0 print:max-w-none">
        <h1 className="border-b-2 border-ink py-2 text-center text-[20px] font-bold">ใบรายการตรวจเช็คหางรถเช่า</h1>
        <div className="space-y-1.5 px-5 pt-3">
          <p className="text-right">วันที่ <b>{slashDate(c.inspected_on)}</b></p>
          <p>ประเภทรถ <b className="ml-1">{c.trailer_kind || "—"}</b></p>
          <p>หมายเลขทะเบียน <b className="ml-1 font-route text-[16px]">{c.plate_no}</b></p>
        </div>
        {checkupGroups.map((g) => (
          <section key={g.title} className="px-5 pt-3">
            <h2 className="mb-1.5 font-bold">{g.title}</h2>
            <ol className="grid gap-x-8 gap-y-1 sm:grid-cols-2 print:grid-cols-2">
              {g.items.map((it, i) => {
                const v = c.items?.[it.key] ?? {};
                return (
                  <li key={it.key} className={cx("flex items-center gap-2 py-0.5", v.r === "FIX" && "bg-danger-tint/50")}>
                    <span className="flex-1">
                      {i + 1}. {it.label}
                      {it.spec && <> {it.spec} <b>{v.spec || "…"}</b></>}
                      {it.unit && <> <b>{v.qty || "…"}</b> {it.unit}</>}
                    </span>
                    <Box on={v.r === "FIX"} label={resultLabel(it.damage, "FIX")} danger />
                    <Box on={v.r === "OK"} label={resultLabel(it.damage, "OK")} />
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        {c.note && (
          <p className="mx-5 mt-3 whitespace-pre-wrap rounded border border-line p-2">
            <b>หมายเหตุ:</b> {c.note}
          </p>
        )}
        <div className="mt-6 grid grid-cols-2 gap-6 border-t-2 border-ink px-5 py-5 text-center">
          {(
            [
              ["ช่างผู้ซ่อม", c.mechanic_name, c.mechanic_sign],
              ["ผู้ตรวจสอบ", c.inspector_name, c.inspector_sign],
            ] as const
          ).map(([title, name, sign]) => (
            <div key={title}>
              <div className="flex h-20 items-end justify-center border-b border-dotted border-ink-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {sign && url.get(sign) ? <img src={url.get(sign)} alt={`ลายเซ็น${title}`} className="max-h-20" /> : <span className="text-ink-3">(ไม่มีลายเซ็น)</span>}
              </div>
              <p className="mt-1">({name || "…………………………"})</p>
              <p className="font-bold">{title}</p>
              <p>{slashDate(c.signed_on ?? c.inspected_on)}</p>
            </div>
          ))}
        </div>
      </article>
      <p className="mx-auto mt-3 max-w-[960px] text-[14px] text-ink-2 print:hidden">
        ครบกำหนดตรวจครั้งถัดไป: <b>{thDate(next)}</b>
        {next < bangkokToday() && <span className="ml-2 font-semibold text-danger">(เลยกำหนดแล้ว)</span>}
      </p>
    </>
  );
}
