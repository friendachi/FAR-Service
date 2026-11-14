import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Check, Minus } from "lucide-react";
import { NoAccess } from "@/components/no-access";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { photoSlots, type PhotoMap } from "@/lib/handover";
import { thDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "ส่งมอบ / รับคืนหาง" };

type Row = {
  id: string;
  kind: "HANDOVER" | "RETURN";
  happened_on: string;
  yard_code: string | null;
  driver_name: string | null;
  tractor_plate: string | null;
  photos?: PhotoMap;
  deliver_sign?: string | null;
  receive_sign?: string | null;
  rental_contracts: { customer_name: string; nickname: string | null; plate_no: string; trailer_kind: string | null } | null;
};

export default async function Handovers() {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const sb = await createClient();
  const BASE = "id, kind, happened_on, yard_code, driver_name, tractor_plate, created_at, rental_contracts(customer_name, nickname, plate_no, trailer_kind)";
  let ready = true;
  let res = await sb.from("rental_handovers").select(`${BASE}, photos, deliver_sign, receive_sign`).order("happened_on", { ascending: false }).order("created_at", { ascending: false }).limit(300);
  if (res.error) {
    ready = false;
    res = (await sb.from("rental_handovers").select(BASE).order("happened_on", { ascending: false }).limit(300)) as typeof res;
  }
  const rows = (res.data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="ส่งมอบ / รับคืนหาง"
        sub="ส่งมอบแล้วลูกค้าขึ้นใน “ลูกค้าผู้เช่าปัจจุบัน” · รับคืนแล้วย้ายไป “ข้อมูลผู้เช่าทั้งหมด” · ถ่ายรูป 14 รูปทั้งตอนส่งมอบและรับคืน เพื่อเทียบสภาพ"
        actions={
          <>
            <LinkButton href="/admin/handovers/new?kind=HANDOVER">
              <ArrowUpFromLine className="size-4" aria-hidden /> ส่งมอบหาง
            </LinkButton>
            <LinkButton href="/admin/handovers/new?kind=RETURN" variant="outline">
              <ArrowDownToLine className="size-4" aria-hidden /> รับคืนหาง
            </LinkButton>
          </>
        }
      />
      {!ready && (
        <p className="mb-4 rounded-xl border-2 border-warn/50 bg-paper px-5 py-3 text-[15px]">
          ยังบันทึกรูปและลายเซ็นไม่ได้ · ให้รัน migration <code>20261117000017_handover_checkups.sql</code> ใน Supabase ก่อน
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-8 text-center text-ink-2">ยังไม่มีบันทึกส่งมอบ / รับคืน · กด “ส่งมอบหาง” เพื่อเริ่ม</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[900px] text-left text-[14px]">
            <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
              <tr>
                <th className="px-4 py-2.5 font-semibold">วันที่</th>
                <th className="px-4 py-2.5 font-semibold">รายการ</th>
                <th className="px-4 py-2.5 font-semibold">ทะเบียนหาง</th>
                <th className="px-4 py-2.5 font-semibold">ลูกค้า</th>
                <th className="px-4 py-2.5 font-semibold">คนรับ / คนขับ · หัวลาก</th>
                <th className="px-4 py-2.5 font-semibold">รูป</th>
                <th className="px-4 py-2.5 font-semibold">ลายเซ็น</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((h) => {
                const n = photoSlots.filter((s) => h.photos?.[s.id]?.length).length;
                const signed = h.deliver_sign && h.receive_sign;
                return (
                  <tr key={h.id} className="hover:bg-sign-wash/50">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">{thDate(h.happened_on)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={h.kind === "RETURN" ? "info" : "ok"}>{h.kind === "RETURN" ? "รับคืน" : "ส่งมอบ"}</Badge>
                    </td>
                    <td className="px-4 py-3 font-route text-[16px] font-extrabold">
                      {h.rental_contracts?.plate_no ?? "—"}
                      {h.rental_contracts?.trailer_kind && <span className="ml-1.5 text-[12px] font-semibold text-ink-3">{h.rental_contracts.trailer_kind}</span>}
                    </td>
                    <td className="px-4 py-3">{h.rental_contracts?.customer_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-2">
                      {[h.driver_name, h.tractor_plate].filter(Boolean).join(" · ") || "—"}
                      {h.yard_code && <span className="block text-[12px] text-ink-3">ลาน {h.yard_code}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={n === photoSlots.length ? "font-semibold text-grass" : n ? "text-warn" : "text-ink-3"}>
                        {n}/{photoSlots.length}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {h.kind === "RETURN" ? (
                        <Minus className="size-4 text-ink-3" aria-label="ไม่ต้องเซ็น" />
                      ) : signed ? (
                        <Check className="size-4 text-grass" aria-label="เซ็นครบ" />
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/handovers/${h.id}`} className="font-semibold text-grass underline">
                        ดู / พิมพ์
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
