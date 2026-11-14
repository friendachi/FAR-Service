import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { NoAccess } from "@/components/no-access";
import { DeleteRecord, PrintButton } from "@/components/record-actions";
import { Badge } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { DOC_BUCKET, handoverItems, photoSlots, slashDate, type HandoverDetails, type PhotoMap } from "@/lib/handover";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "ใบส่งมอบ / รับคืนหาง" };

type Row = {
  id: string;
  kind: "HANDOVER" | "RETURN";
  happened_on: string;
  yard_code: string | null;
  driver_name: string | null;
  tractor_plate: string | null;
  condition_note: string | null;
  details: HandoverDetails;
  photos: PhotoMap;
  deliver_name: string | null;
  deliver_sign: string | null;
  receive_name: string | null;
  receive_sign: string | null;
  rental_contracts: { customer_name: string; plate_no: string; trailer_kind: string | null } | null;
};

/** One label + value line in the paper-form style. */
function Line({ k, v, className }: { k: string; v?: string | null; className?: string }) {
  return (
    <div className={`flex items-end gap-2 ${className ?? ""}`}>
      <span className="shrink-0 text-ink-2">{k}</span>
      <span className="min-h-[1.6em] flex-1 border-b border-dotted border-ink-3 px-1 font-semibold">{v || ""}</span>
    </div>
  );
}

export default async function HandoverRecord({ params, searchParams }: PageProps<"/admin/handovers/[id]">) {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const { id } = await params;
  const saved = (await searchParams).saved === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = await createClient();
  const { data, error } = await sb
    .from("rental_handovers")
    .select(
      "id, kind, happened_on, yard_code, driver_name, tractor_plate, condition_note, details, photos, deliver_name, deliver_sign, receive_name, receive_sign, rental_contracts(customer_name, plate_no, trailer_kind)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error)
    return (
      <p className="rounded-xl border-2 border-warn/50 bg-paper p-5">
        เปิดไม่ได้ ({error.message}) · ให้รัน migration <code>20261117000017_handover_checkups.sql</code> ใน Supabase ก่อน
      </p>
    );
  if (!data) notFound();
  const h = data as unknown as Row;
  const d = h.details ?? {};
  const isOut = h.kind === "HANDOVER";

  const paths = [...Object.values(h.photos ?? {}).flat(), h.deliver_sign, h.receive_sign].filter((p): p is string => !!p);
  const signed = paths.length ? (await sb.storage.from(DOC_BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/handovers" className="inline-flex items-center gap-1 text-[15px] font-semibold text-grass hover:underline">
          <ChevronLeft className="size-4" aria-hidden /> ส่งมอบ / รับคืนหาง
        </Link>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          {role === "SUPER_ADMIN" && <DeleteRecord id={h.id} kind="handover" back="/admin/handovers" />}
        </div>
      </div>
      {saved && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl border-2 border-sign bg-sign-wash px-5 py-3 font-semibold text-sign-deep print:hidden">
          <CheckCircle2 className="size-5" aria-hidden /> บันทึกแล้ว · {isOut ? "หางเป็นสถานะอยู่กับลูกค้า" : "หางเป็นสถานะรอตรวจหลังคืน"}
        </p>
      )}

      {/* ---- the paper form */}
      <article className="mx-auto mt-5 max-w-[900px] rounded-xl border border-line bg-paper p-6 text-[14px] sm:p-8 print:mt-0 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="mb-5 text-center">
          <h1 className="text-[22px] font-bold">{isOut ? "ใบส่งมอบ" : "บันทึกรับคืนหาง"}</h1>
          <p className="mt-1 text-right">วันที่ <b>{slashDate(h.happened_on)}</b></p>
        </header>

        {isOut ? (
          <>
            <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <Line k="ชื่อ :" v={d.customer?.name ?? h.rental_contracts?.customer_name} />
              <Line k="ที่อยู่ :" v={d.customer?.address} />
              <Line k="TAX :" v={d.customer?.taxId} />
              <Line k="เบอร์โทร :" v={d.customer?.phone} />
            </div>
            <p className="mb-1 mt-5">ได้รับสินค้าตามรายการดังต่อไปนี้</p>
            <div className="grid border border-ink sm:grid-cols-2">
              <div className="border-b border-ink sm:border-b-0 sm:border-r">
                <p className="border-b border-ink py-1.5 text-center font-semibold">รายละเอียดหัวรถ</p>
                <div className="space-y-2 p-3">
                  <Line k="ยี่ห้อหัวรถ" v={d.tractor?.brand} />
                  <Line k="หมายเลขแชสซี" v={d.tractor?.chassis} />
                  <Line k="หมายเลขทะเบียน" v={d.tractor?.plate ?? h.tractor_plate} />
                  <p className="pt-2 text-ink-2">อื่นๆ</p>
                  <p className="min-h-[6rem] whitespace-pre-wrap border-b border-dotted border-ink-3 font-semibold">{d.tractor?.note}</p>
                </div>
              </div>
              <div>
                <p className="border-b border-ink py-1.5 text-center font-semibold">รายละเอียดรถบรรทุกกึ่งพ่วง (หางลาก)</p>
                <div className="space-y-2 p-3">
                  <Line k="ประเภทสินค้า" v={d.trailer?.productType} />
                  <Line k="แบบ" v={d.trailer?.model} />
                  <Line k="หมายเลขแชสซี" v={d.trailer?.chassis} />
                  <Line k="ทะเบียน" v={d.trailer?.plate ?? h.rental_contracts?.plate_no} />
                  <ol className="space-y-1 pt-2">
                    {handoverItems.map((it, i) => {
                      const v = d.items?.[it.key] ?? {};
                      return (
                        <li key={it.key} className="flex flex-wrap gap-x-1.5">
                          <span>{i + 1}. {it.label}</span>
                          {it.check ? (
                            <b className={v.ok ? "text-grass" : "text-danger"}>{v.ok ? "✓" : "✗ ไม่สมบูรณ์"}</b>
                          ) : (
                            <>
                              {it.spec && v.spec && <b>{v.spec}</b>}
                              <span>จำนวน <b>{v.qty || "…"}</b> {it.unit}</span>
                              {it.owner && <span>ของ <b>{v.of || "…"}</b></span>}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="pt-2 text-ink-2">อื่นๆ</p>
                  <p className="min-h-[3rem] whitespace-pre-wrap border-b border-dotted border-ink-3 font-semibold">{d.trailer?.note}</p>
                </div>
              </div>
            </div>
            <p className="mt-2 font-semibold">
              ***รับรถในสภาพเรียบร้อย พร้อมใช้งาน {d.accepted ? <span className="text-grass">✓ ยืนยันแล้ว</span> : <span className="text-danger">(ยังไม่ยืนยัน)</span>}
            </p>
            {h.condition_note && <p className="mt-2">หมายเหตุ: {h.condition_note}</p>}

            <div className="mt-8 grid grid-cols-2 gap-8 text-center">
              {(
                [
                  ["ผู้ส่งมอบ", h.deliver_name, h.deliver_sign, d.deliverDate],
                  ["ผู้ตรวจรับ", h.receive_name, h.receive_sign, d.receiveDate],
                ] as const
              ).map(([title, name, sign, date]) => (
                <div key={title}>
                  <div className="flex h-20 items-end justify-center border-b border-dotted border-ink-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {sign && url.get(sign) ? <img src={url.get(sign)} alt={`ลายเซ็น${title}`} className="max-h-20" /> : <span className="text-ink-3">(ไม่มีลายเซ็น)</span>}
                  </div>
                  <p className="mt-1">({name || "…………………………"})</p>
                  <p className="font-semibold">{title}</p>
                  <p>วันที่ {slashDate(date) || slashDate(h.happened_on)}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Line k="ลูกค้า :" v={h.rental_contracts?.customer_name} />
            <Line k="ทะเบียนหาง :" v={h.rental_contracts?.plate_no} />
            <Line k="คนขับที่นำมาคืน :" v={h.driver_name} />
            <Line k="ทะเบียนหัวลาก :" v={h.tractor_plate} />
            <Line k="ลานที่รับคืน :" v={h.yard_code} />
            <Line k="หมายเหตุ :" v={h.condition_note} />
          </div>
        )}
      </article>

      {/* ---- photos */}
      <section className="mx-auto mt-6 max-w-[900px] print:max-w-none print:break-before-page">
        <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold">
          รูปถ่าย{isOut ? "ก่อนปล่อยหาง" : "ตอนรับคืน"}
          <Badge tone={isOut ? "ok" : "info"}>{isOut ? "ส่งมอบ" : "รับคืน"} {slashDate(h.happened_on)}</Badge>
        </h2>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
          {photoSlots.map((s, i) => {
            const list = h.photos?.[s.id] ?? [];
            return (
              <li key={s.id} className="break-inside-avoid overflow-hidden rounded-lg border border-line bg-paper">
                {list.length ? (
                  <a href={url.get(list[0])} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url.get(list[0])} alt={s.label} className="aspect-[4/3] w-full object-cover" />
                  </a>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-ground text-[13px] text-ink-3">ไม่มีรูป</div>
                )}
                <p className="px-2 py-1.5 text-[13px] font-semibold">
                  {i + 1}. {s.label}
                  {list.length > 1 && (
                    <span className="ml-1 font-normal text-ink-3 print:hidden">
                      {list.slice(1).map((p, k) => (
                        <a key={p} href={url.get(p)} target="_blank" rel="noreferrer" className="ml-1 text-grass underline">
                          รูป {k + 2}
                        </a>
                      ))}
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
