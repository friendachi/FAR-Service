import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { AddRegistration, DocCell, TaxActions } from "@/components/tax-admin";
import { Badge, PageHeader, cx } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { TAX_ALERT_DAYS, bangkokToday, docKinds, provinceShort, taxState, type DocKind, type TaxState } from "@/lib/fleet-admin";
import { thDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "ภาษี / พ.ร.บ. / เล่มทะเบียน" };

type Reg = {
  id: string;
  plate_no: string;
  province: string;
  tax_expires_on: string | null;
  tax_renewed_at: string | null;
  note: string | null;
  vehicle_documents: { id: string; kind: DocKind; storage_path: string; file_name: string | null; created_at: string }[];
};

const stateBadge: Record<TaxState, { tone: "danger" | "warn" | "ok" | "muted"; label: (d: number | null) => string }> = {
  EXPIRED: { tone: "danger", label: (d) => `หมดอายุแล้ว ${Math.abs(d ?? 0)} วัน` },
  DUE: { tone: "warn", label: (d) => (d === 0 ? "หมดอายุวันนี้" : `ต้องต่อภายใน ${d} วัน`) },
  OK: { tone: "ok", label: (d) => `เหลือ ${d} วัน` },
  UNKNOWN: { tone: "muted", label: () => "ยังไม่ใส่วันหมดอายุ" },
};
const order: Record<TaxState, number> = { EXPIRED: 0, DUE: 1, UNKNOWN: 2, OK: 3 };

export default async function TaxPage() {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const sb = await createClient();
  const today = bangkokToday();
  const [{ data, error }, { data: trailers }] = await Promise.all([
    sb
      .from("vehicle_registrations")
      .select("id, plate_no, province, tax_expires_on, tax_renewed_at, note, vehicle_documents(id, kind, storage_path, file_name, created_at)")
      .order("tax_expires_on", { ascending: true, nullsFirst: true }),
    sb.from("trailers").select("code, plate_no, type").is("retired_at", null).order("code"),
  ]);

  if (error)
    return (
      <>
        <PageHeader title="ภาษี / พ.ร.บ. / เล่มทะเบียน" />
        <p className="rounded-xl border-2 border-warn/50 bg-paper p-5 text-[15px]">
          ยังใช้หน้านี้ไม่ได้ ({error.message}) · ให้รัน migration <code>20261115000015_tax_rentals.sql</code> ใน Supabase ก่อน
          (ไฟล์นี้ใส่วันหมดอายุภาษีของทุกทะเบียนให้แล้ว)
        </p>
      </>
    );

  const regs = (data ?? []) as Reg[];
  const codeOf = new Map((trailers ?? []).map((t) => [t.plate_no, t.code]));
  const known = new Set(regs.map((r) => r.plate_no));
  const missing = (trailers ?? []).filter((t) => !known.has(t.plate_no));

  // private files: short-lived links
  const paths = regs.flatMap((r) => r.vehicle_documents.map((d) => d.storage_path));
  const signed = paths.length ? (await sb.storage.from("vehicle-docs").createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));

  const rows = regs
    .map((r) => ({ r, ...taxState(r.tax_expires_on, today) }))
    .sort((a, b) => order[a.state] - order[b.state] || (a.r.tax_expires_on ?? "").localeCompare(b.r.tax_expires_on ?? ""));
  const due = rows.filter((x) => x.state === "EXPIRED" || x.state === "DUE");

  return (
    <>
      <PageHeader
        title="ภาษี / พ.ร.บ. / เล่มทะเบียน"
        sub={`${regs.length} ทะเบียน · แจ้งเตือนก่อนภาษีหมดอายุ ${TAX_ALERT_DAYS} วัน · กด “ต่อภาษีแล้ว” เพื่อเลื่อนวันหมดอายุไปปีถัดไป`}
        actions={<AddRegistration />}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="danger">หมดอายุแล้ว {rows.filter((x) => x.state === "EXPIRED").length}</Badge>
        <Badge tone="warn">ต้องต่อภายใน {TAX_ALERT_DAYS} วัน {rows.filter((x) => x.state === "DUE").length}</Badge>
        <Badge tone="ok">ปกติ {rows.filter((x) => x.state === "OK").length}</Badge>
      </div>

      {due.length > 0 && (
        <p className="mb-4 rounded-xl border-2 border-danger bg-danger-tint px-5 py-3 font-semibold text-danger" role="alert">
          ถึงเวลาต่อภาษี {due.length} คัน: {due.map((x) => x.r.plate_no).join(", ")}
        </p>
      )}

      {missing.length > 0 && (
        <p className="mb-4 rounded-xl border-2 border-warn/50 bg-paper px-5 py-3 text-[14px]">
          หางในระบบที่ยังไม่มีข้อมูลภาษี {missing.length} คัน: {missing.map((t) => `${t.code} (${t.plate_no})`).join(", ")} · กด “เพิ่มทะเบียน” เพื่อใส่ข้อมูล
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[1100px] text-left text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-4 py-2.5 font-semibold">ทะเบียน</th>
              <th className="px-4 py-2.5 font-semibold">ภาษีหมดอายุ</th>
              {docKinds.map((k) => (
                <th key={k.id} className="px-3 py-2.5 font-semibold">{k.label}</th>
              ))}
              <th className="px-4 py-2.5 font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {rows.map(({ r, state, days }) => {
              const b = stateBadge[state];
              return (
                <tr key={r.id} className={cx(state === "EXPIRED" && "bg-danger-tint/40", state === "DUE" && "bg-warn-tint/50")}>
                  <td className="px-4 py-3">
                    <span className="block font-route text-[16px] font-extrabold">
                      {r.plate_no} <span className="text-[13px] font-semibold text-ink-2">{provinceShort(r.province)}</span>
                    </span>
                    <span className="block text-[12px] text-ink-3">
                      {codeOf.get(r.plate_no) ?? "ไม่อยู่ในรายการหางของเว็บ"}
                      {r.note && <> · {r.note}</>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{r.tax_expires_on ? thDate(r.tax_expires_on) : "—"}</span>
                    <Badge tone={b.tone} className="mt-1">{b.label(days)}</Badge>
                    {r.tax_renewed_at && (
                      <span className="mt-1 block text-[12px] text-ink-3">ต่อล่าสุด {thDate(r.tax_renewed_at.slice(0, 10))}</span>
                    )}
                  </td>
                  {docKinds.map((k) => (
                    <td key={k.id} className="px-3 py-3">
                      <DocCell
                        registrationId={r.id}
                        kind={k.id}
                        files={r.vehicle_documents
                          .filter((d) => d.kind === k.id)
                          .map((d) => ({ id: d.id, url: urlOf.get(d.storage_path) ?? null, name: d.file_name ?? "ไฟล์" }))}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <TaxActions
                      reg={{ id: r.id, plate: r.plate_no, province: r.province, taxExpiresOn: r.tax_expires_on, note: r.note }}
                      canDelete={role === "SUPER_ADMIN"}
                    />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-3">ยังไม่มีข้อมูลทะเบียน</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
