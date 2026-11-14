import type { Metadata } from "next";
import Link from "next/link";
import { MarkAllRead } from "@/components/mark-all-read";
import { NoAccess } from "@/components/no-access";
import { Badge, PageHeader } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { thDateTimeIso } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const instant = false;
export const metadata: Metadata = { title: "แจ้งเตือน" };

type Row = {
  id: string;
  event: string;
  booking_id: string | null;
  payload: {
    booking_no?: string;
    customer?: string;
    trailer?: string;
    pickup_at?: string;
    channel?: string;
    company?: string;
    contact?: string;
    phone?: string;
    items?: { label: string; qty: number }[];
    months?: number;
  } | null;
  read_at: string | null;
  created_at: string;
};

export default async function Notifications() {
  if (!(await staffRole())) return <NoAccess need="พนักงาน" />;
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("notifications")
    .select("id, event, booking_id, payload, read_at, created_at")
    .eq("recipient_id", u.user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as Row[];
  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <>
      <PageHeader title="แจ้งเตือน" sub="การจองใหม่ทุกรายการแจ้งพนักงานทุกคน" actions={unread > 0 ? <MarkAllRead /> : undefined} />
      {error && (
        <p className="mb-4 rounded-xl border-2 border-warn/50 bg-paper p-4 text-[14px]">
          โหลดแจ้งเตือนไม่สำเร็จ ({error.message}) · ถ้ายังไม่ได้รัน migration <code>20261112000012</code> ให้รันก่อน
        </p>
      )}
      <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
        {rows.map((r) => (
          <li key={r.id} className={r.read_at ? "px-5 py-4" : "bg-sign-wash px-5 py-4"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {!r.read_at && <Badge tone="action">ใหม่</Badge>}{" "}
                {r.event === "BOOKING_CREATED" ? "มีการจองใหม่" : r.event === "QUOTE_REQUESTED" ? "มีคำขอใบเสนอราคาใหม่" : r.event}
                {r.payload?.booking_no && <span className="font-route"> · {r.payload.booking_no}</span>}
              </p>
              <span className="text-[13px] text-ink-3">{thDateTimeIso(r.created_at)}</span>
            </div>
            <p className="mt-1 text-[14px] text-ink-2">
              {r.payload?.customer && <>ลูกค้า {r.payload.customer}</>}
              {r.payload?.trailer && <> · หาง {r.payload.trailer}</>}
              {r.payload?.pickup_at && <> · รับหาง {thDateTimeIso(r.payload.pickup_at)}</>}
              {r.event === "QUOTE_REQUESTED" && (
                <>
                  {r.payload?.company ?? r.payload?.contact} · {r.payload?.phone}
                  {r.payload?.items?.length ? <> · {r.payload.items.map((i) => `${i.label} × ${i.qty}`).join(", ")}</> : null}
                  {r.payload?.months ? <> · {r.payload.months} เดือน</> : null}
                </>
              )}
            </p>
            {r.event === "QUOTE_REQUESTED" && (
              <a href="/admin/quotes" className="mt-1 inline-block text-[14px] font-semibold text-grass underline">เปิดคำขอใบเสนอราคา</a>
            )}
            {r.booking_id && (
              <Link href={`/admin/bookings/${r.booking_id}`} className="mt-1 inline-block text-[14px] font-semibold text-grass underline">
                เปิดการจอง
              </Link>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-10 text-center text-ink-3">ยังไม่มีแจ้งเตือน</li>}
      </ul>
    </>
  );
}
