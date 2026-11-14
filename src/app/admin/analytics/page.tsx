import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { PageHeader } from "@/components/ui";
import { can } from "@/lib/admin";
import { num, thDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cx } from "@/components/ui";
import { gaId } from "@/components/google-analytics";

export const instant = false;
export const metadata: Metadata = { title: "สถิติการเข้าชมเว็บไซต์" };

type Summary = {
  all_time_views: number;
  all_time_visitors: number;
  views: number;
  visitors: number;
  today_views: number;
  today_visitors: number;
  by_day: { day: string; views: number; visitors: number }[];
  top_pages: { path: string; views: number; visitors: number }[];
  by_hour?: { hour: number; visitors: number }[];
  breakdown?: Partial<Record<BreakdownKey, Slice[]>>;
};

type Slice = { name: string | null; visitors: number; views: number };
type BreakdownKey = "region" | "city" | "country" | "device" | "os" | "browser" | "source" | "campaign" | "language";

const deviceName: Record<string, string> = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์" };
const countryName = (c: string) => {
  try {
    return new Intl.DisplayNames(["th"], { type: "region" }).of(c) ?? c;
  } catch {
    return c;
  }
};

const pageName: [RegExp, string][] = [
  [/^\/$/, "หน้าแรก"],
  [/^\/trailers$/, "ค้นหาหาง"],
  [/^\/trailers\/.+/, "รายละเอียดหาง"],
  [/^\/yards/, "ลานจอด"],
  [/^\/about/, "เกี่ยวกับเรา"],
  [/^\/quote/, "ขอใบเสนอราคา"],
  [/^\/knowledge$/, "สาระน่ารู้"],
  [/^\/knowledge\/.+/, "บทความสาระน่ารู้"],
  [/^\/services/, "บริการเสริม"],
  [/^\/documents/, "เอกสารที่ต้องใช้"],
  [/^\/contact/, "ติดต่อเรา"],
  [/^\/login/, "เข้าสู่ระบบ"],
  [/^\/register/, "สมัครสมาชิก"],
  [/^\/booking/, "จองหาง"],
  [/^\/me/, "หน้าของลูกค้า"],
  [/^\/terms/, "เงื่อนไขการเช่า"],
  [/^\/privacy/, "นโยบายความเป็นส่วนตัว"],
];
const nameOf = (path: string) => pageName.find(([r]) => r.test(path))?.[1] ?? path;

const RANGES = [7, 30, 90];

export default async function Analytics({ searchParams }: PageProps<"/admin/analytics">) {
  if (!(await can("SUPER_ADMIN"))) return <NoAccess need="Super Admin" />;
  const sp = await searchParams;
  const days = RANGES.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const sb = await createClient();
  const { data, error } = await sb.rpc("analytics_summary", { p_days: days });
  const s = data as Summary | null;

  return (
    <>
      <PageHeader
        title="สถิติการเข้าชมเว็บไซต์"
        sub="นับทุกการเปิดหน้าเว็บฝั่งลูกค้า · ผู้เข้าชมนับจากเบราว์เซอร์ (1 เครื่อง/เบราว์เซอร์ = 1 คน)"
        actions={
          <div className="flex gap-1 rounded-lg border-2 border-sign p-0.5">
            {RANGES.map((d) => (
              <Link
                key={d}
                href={`/admin/analytics?days=${d}`}
                className={cx("rounded-md px-3 py-1.5 text-[14px] font-semibold", d === days ? "bg-sign text-on-sign" : "text-grass hover:bg-sign-wash")}
              >
                {d} วัน
              </Link>
            ))}
          </div>
        }
      />
      {(error || !s) ? (
        <p className="rounded-xl border-2 border-warn/50 bg-paper p-5 text-[15px]">
          ยังไม่มีข้อมูลสถิติ ({error?.message ?? "—"}) · ให้รัน migration <code>20261112000012_payments_notify_analytics.sql</code> ใน Supabase ก่อน แล้วระบบจะเริ่มนับการเข้าชมตั้งแต่นั้น
        </p>
      ) : (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="เข้าชมวันนี้" value={s.today_views} sub={`${num(s.today_visitors)} คน`} />
            <Stat label={`เข้าชม ${days} วันล่าสุด`} value={s.views} sub={`${num(s.visitors)} คน`} />
            <Stat label="เข้าชมทั้งหมด" value={s.all_time_views} sub={`${num(s.all_time_visitors)} คน`} />
            <Stat label="หน้าที่คนดูมากที่สุด" text={s.top_pages[0] ? nameOf(s.top_pages[0].path) : "—"} sub={s.top_pages[0] ? `${num(s.top_pages[0].views)} ครั้ง` : ""} />
          </dl>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
            <section className="overflow-x-auto rounded-xl border border-line bg-paper">
              <h2 className="border-b border-line px-5 py-3 text-[17px] font-bold">หน้าที่เข้าชมมากที่สุด</h2>
              <table className="w-full min-w-[480px] text-left text-[14px]">
                <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
                  <tr>
                    <th className="px-4 py-2 font-semibold">#</th>
                    <th className="px-4 py-2 font-semibold">หน้า</th>
                    <th className="px-4 py-2 text-right font-semibold">ครั้ง</th>
                    <th className="px-4 py-2 text-right font-semibold">คน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {s.top_pages.map((p, i) => (
                    <tr key={p.path}>
                      <td className="px-4 py-2.5 tabular text-ink-3">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <span className="block font-semibold">{nameOf(p.path)}</span>
                        <span className="block text-[12px] text-ink-3">{p.path}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular">{num(p.views)}</td>
                      <td className="px-4 py-2.5 text-right tabular text-ink-2">{num(p.visitors)}</td>
                    </tr>
                  ))}
                  {s.top_pages.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-3">ยังไม่มีการเข้าชมในช่วงนี้</td></tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="overflow-x-auto rounded-xl border border-line bg-paper">
              <h2 className="border-b border-line px-5 py-3 text-[17px] font-bold">รายวัน</h2>
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
                  <tr>
                    <th className="px-4 py-2 font-semibold">วันที่</th>
                    <th className="px-4 py-2 text-right font-semibold">ครั้ง</th>
                    <th className="px-4 py-2 text-right font-semibold">คน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[...s.by_day].reverse().map((d) => (
                    <tr key={d.day}>
                      <td className="px-4 py-2">{thDate(d.day)}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular">{num(d.views)}</td>
                      <td className="px-4 py-2 text-right tabular text-ink-2">{num(d.visitors)}</td>
                    </tr>
                  ))}
                  {s.by_day.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-ink-3">ยังไม่มีข้อมูล</td></tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>

          <h2 className="mb-1 mt-10 text-[20px] font-bold">ข้อมูลผู้เข้าชม (สำหรับวางแผนโฆษณา)</h2>
          <p className="mb-4 text-[14px] text-ink-3">
            นับเป็นจำนวนคนในช่วง {days} วัน · ไม่รวมการเข้าชมของพนักงาน
            {!s.breakdown && <> · ยังไม่มีข้อมูลส่วนนี้: ให้รัน migration <code>20261114000014_visitor_details.sql</code> ใน Supabase ก่อน</>}
          </p>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Demographics />
            <Breakdown title="ที่ตั้ง · จังหวัด / ภูมิภาค" rows={s.breakdown?.region} note="ระบุจาก IP โดยผู้ให้บริการโฮสต์ (Vercel / Cloudflare) · เปิดจากเครื่องในวงแลนจะเป็น “ไม่ทราบ”" />
            <Breakdown title="ที่ตั้ง · เมือง / อำเภอ" rows={s.breakdown?.city} />
            <Breakdown title="ประเทศ" rows={s.breakdown?.country} label={countryName} />
            <Breakdown title="ประเภทอุปกรณ์" rows={s.breakdown?.device} label={(n) => deviceName[n] ?? n} />
            <Breakdown title="ระบบปฏิบัติการ" rows={s.breakdown?.os} />
            <Breakdown title="เบราว์เซอร์ / แอปที่ใช้เปิด" rows={s.breakdown?.browser} note="“ในแอป” คือเปิดลิงก์จากในแอป LINE / Facebook" />
            <Breakdown title="มาจากช่องทางไหน" rows={s.breakdown?.source} note="ติด ?utm_source=…&utm_campaign=… ที่ลิงก์โฆษณาเพื่อแยกแต่ละแคมเปญ" />
            <Breakdown title="แคมเปญโฆษณา (utm_campaign)" rows={s.breakdown?.campaign} empty="ยังไม่มีการเข้าชมจากลิงก์ที่ติดแคมเปญ" />
            <Breakdown title="ภาษาของเครื่อง" rows={s.breakdown?.language} />
            <Hours rows={s.by_hour} />
          </div>
        </>
      )}
    </>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-paper p-5">
      <h3 className="text-[16px] font-bold">{title}</h3>
      {note && <p className="mt-0.5 text-[12px] text-ink-3">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Breakdown({
  title,
  rows,
  note,
  label = (n) => n,
  empty = "ยังไม่มีข้อมูล",
}: {
  title: string;
  rows?: Slice[];
  note?: string;
  label?: (name: string) => string;
  empty?: string;
}) {
  const list = rows ?? [];
  const total = list.reduce((a, r) => a + r.visitors, 0);
  const known = list.filter((r) => r.name);
  return (
    <Card title={title} note={note}>
      {known.length === 0 ? (
        <p className="py-4 text-center text-[14px] text-ink-3">{empty}</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((r) => {
            const pct = total ? Math.round((r.visitors / total) * 100) : 0;
            return (
              <li key={r.name ?? "-"}>
                <div className="flex items-baseline justify-between gap-3 text-[14px]">
                  <span className={cx("truncate font-semibold", !r.name && "font-normal text-ink-3")}>{r.name ? label(r.name) : "ไม่ทราบ"}</span>
                  <span className="shrink-0 tabular text-ink-2">
                    {num(r.visitors)} คน · {pct}%
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-ground">
                  <div className={cx("h-2 rounded-full", r.name ? "bg-sign" : "bg-line-strong")} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function Hours({ rows }: { rows?: { hour: number; visitors: number }[] }) {
  const by = new Map((rows ?? []).map((r) => [r.hour, r.visitors]));
  const max = Math.max(1, ...by.values());
  return (
    <Card title="ช่วงเวลาที่คนเข้าเว็บ" note="ใช้ตั้งเวลายิงโฆษณา (เวลาไทย)">
      {by.size === 0 ? (
        <p className="py-4 text-center text-[14px] text-ink-3">ยังไม่มีข้อมูล</p>
      ) : (
        <>
          <div className="flex h-28 items-end gap-[3px]">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                title={`${h}:00–${h}:59 · ${num(by.get(h) ?? 0)} คน`}
                className="flex-1 rounded-t bg-sign"
                style={{ height: `${((by.get(h) ?? 0) / max) * 100}%`, minHeight: by.get(h) ? 3 : 0 }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] tabular text-ink-3">
            <span>0:00</span><span>6:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
          </div>
        </>
      )}
    </Card>
  );
}

function Demographics() {
  return (
    <Card title="อายุและเพศ" note="ดูได้ใน Google Analytics 4 เท่านั้น">
      <p className="text-[14px] leading-relaxed text-ink-2">
        เว็บไซต์รู้อายุและเพศของผู้เข้าชมเองไม่ได้ Google ประมาณข้อมูลนี้จากบัญชี Google ของผู้เข้าชม แล้วแสดงใน Google Analytics
        (รายงาน → ผู้ใช้ → ข้อมูลประชากร) ต้องเปิด “Google signals” ก่อน และต้องมีผู้เข้าชมมากพอ Google จึงจะแสดงข้อมูล
      </p>
      {gaId ? (
        <a
          href="https://analytics.google.com/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block font-semibold text-grass underline"
        >
          เปิด Google Analytics ({gaId})
        </a>
      ) : (
        <p className="mt-3 rounded-lg bg-warn-tint px-3 py-2 text-[13px] text-warn">
          ยังไม่ได้เชื่อม · สร้าง GA4 property แล้วใส่ <code>NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX</code> ในไฟล์ .env.local / ที่โฮสต์
        </p>
      )}
    </Card>
  );
}

function Stat({ label, value, text, sub }: { label: string; value?: number; text?: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-5">
      <dt className="text-[14px] text-ink-2">{label}</dt>
      <dd className="mt-1 font-route text-[30px] font-extrabold leading-tight tabular text-ink">{text ?? num(value ?? 0)}</dd>
      {sub && <dd className="text-[13px] text-ink-3">{sub}</dd>}
    </div>
  );
}
