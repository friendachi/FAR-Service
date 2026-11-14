import Link from "next/link";
import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { AddContract, ContractRow, type ContractRowData } from "@/components/rental-admin";
import { Badge, PageHeader } from "@/components/ui";
import { staffRole } from "@/lib/admin";
import { arrearsTotal, bangkokToday, billingMonth, monthsText, currentTerm, daysBetween, nextPayDate, provinceShort, rentLines, type CustomerKind } from "@/lib/fleet-admin";
import { num, thDate, trailerStatusLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { TrailerStatus } from "@/lib/types";

export const instant = false;
export const metadata: Metadata = { title: "ลูกค้าผู้เช่าปัจจุบัน" };

type Row = {
  id: string;
  seq: number | null;
  customer_name: string;
  nickname: string | null;
  phone: string | null;
  customer_kind: CustomerKind;
  trailer_kind: string | null;
  plate_no: string;
  plate_note: string | null;
  start_date: string | null;
  term_months: number | null;
  pay_day: number | null;
  monthly_rent: number;
  vat_rate: number;
  wht_rate: number;
  billed_month: string | null;
  status: "ACTIVE" | "ENDED";
  ended_on: string | null;
  note: string | null;
  unpaid_months?: string[] | null;
  arrears_amount?: number | null;
  arrears_note?: string | null;
  rental_handovers: {
    id: string;
    kind: "HANDOVER" | "RETURN";
    happened_on: string;
    yard_code: string | null;
    driver_name: string | null;
    tractor_plate: string | null;
    tyres_ok: boolean | null;
    lights_ok: boolean | null;
    condition_note: string | null;
  }[];
};

const MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export default async function Rentals({ searchParams }: PageProps<"/admin/rentals">) {
  const role = await staffRole();
  if (!role) return <NoAccess need="พนักงาน" />;
  const view = (await searchParams).view === "all" ? "all" : "current";
  const sb = await createClient();
  const today = bangkokToday();
  const month = billingMonth(today);

  const BASE =
    "id, seq, customer_name, nickname, phone, customer_kind, trailer_kind, plate_no, plate_note, start_date, term_months, pay_day, monthly_rent, vat_rate, wht_rate, billed_month, status, ended_on, note, rental_handovers(id, kind, happened_on, yard_code, driver_name, tractor_plate, tyres_ok, lights_ok, condition_note)";
  const contracts = (cols: string) =>
    sb.from("rental_contracts").select(cols).order("seq", { ascending: true, nullsFirst: false }).order("start_date", { ascending: true });
  const [first, { data: trailers }, { data: regs }] = await Promise.all([
    contracts(`${BASE}, unpaid_months, arrears_amount, arrears_note`),
    sb.from("trailers").select("code, plate_no, status"),
    sb.from("vehicle_registrations").select("plate_no, province"),
  ]);
  // overdue-rent columns come with migration 0016; until it is run the register still works without them
  const arrearsReady = !first.error;
  const { data, error } = arrearsReady ? first : await contracts(BASE);

  if (error)
    return (
      <>
        <PageHeader title="ลูกค้าผู้เช่าปัจจุบัน" />
        <p className="rounded-xl border-2 border-warn/50 bg-paper p-5 text-[15px]">
          ยังใช้หน้านี้ไม่ได้ ({error.message}) · ให้รัน migration <code>20261115000015_tax_rentals.sql</code> ใน Supabase ก่อน
          (ไฟล์นี้ใส่รายชื่อลูกค้าปัจจุบัน 14 รายการให้แล้ว)
        </p>
      </>
    );

  const trailerOf = new Map((trailers ?? []).map((t) => [t.plate_no, t]));
  const provinceOf = new Map((regs ?? []).map((r) => [r.plate_no, r.province]));

  const rows: ContractRowData[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const term = currentTerm(r.start_date, r.term_months, today);
    const nextPay = nextPayDate(r.pay_day, today);
    const t = trailerOf.get(r.plate_no);
    return {
      id: r.id,
      seq: r.seq,
      customerName: r.customer_name,
      nickname: r.nickname,
      phone: r.phone,
      customerKind: r.customer_kind,
      trailerKind: r.trailer_kind,
      plate: r.plate_no,
      plateNote: r.plate_note,
      province: provinceShort(provinceOf.get(r.plate_no) ?? "ชลบุรี"),
      startDate: r.start_date,
      termMonths: r.term_months,
      payDay: r.pay_day,
      monthlyRent: Number(r.monthly_rent),
      vatRate: Number(r.vat_rate),
      whtRate: Number(r.wht_rate),
      billed: r.billed_month === month,
      unpaidMonths: [...(r.unpaid_months ?? [])].sort(),
      arrearsOverride: r.arrears_amount == null ? null : Number(r.arrears_amount),
      arrearsNote: r.arrears_note ?? null,
      arrears: arrearsTotal(
        r.unpaid_months ?? [],
        rentLines(Number(r.monthly_rent), Number(r.vat_rate), Number(r.wht_rate)).total,
        r.arrears_amount == null ? null : Number(r.arrears_amount),
      ),
      status: r.status,
      endedOn: r.ended_on,
      note: r.note,
      termEnd: term?.end ?? null,
      renewals: term?.renewals ?? 0,
      nextPay,
      payDueSoon: !!nextPay && daysBetween(today, nextPay) <= 3,
      trailerCode: t?.code ?? null,
      trailerStatus: t ? trailerStatusLabel[t.status as TrailerStatus] : null,
      handovers: [...r.rental_handovers]
        .sort((a, b) => b.happened_on.localeCompare(a.happened_on))
        .map((h) => ({
          id: h.id,
          kind: h.kind,
          date: h.happened_on,
          yard: h.yard_code,
          driver: h.driver_name,
          tractor: h.tractor_plate,
          tyresOk: h.tyres_ok,
          lightsOk: h.lights_ok,
          note: h.condition_note,
        })),
    };
  });

  const active = rows.filter((r) => r.status === "ACTIVE");
  const ended = rows.filter((r) => r.status === "ENDED");
  const sum = active.reduce(
    (a, r) => {
      const l = rentLines(r.monthlyRent, r.vatRate, r.whtRate);
      return { rent: a.rent + l.rent, vat: a.vat + l.vat, wht: a.wht + l.wht, total: a.total + l.total };
    },
    { rent: 0, vat: 0, wht: 0, total: 0 },
  );
  const billedCount = active.filter((r) => r.billed).length;
  const owing = rows.filter((r) => r.unpaidMonths.length > 0);
  const arrearsSum = owing.reduce((a, r) => a + r.arrears, 0);
  const dueSoon = active.filter((r) => r.payDueSoon && !r.billed);
  const monthName = `${MONTHS[+month.slice(5, 7) - 1]} ${+month.slice(0, 4) + 543}`;

  // fleet trailers marked "อยู่กับลูกค้า" with no active contract here, to help keep the two in step
  const rentedPlates = new Set(active.map((r) => r.plate));
  const orphan = (trailers ?? []).filter((t) => t.status === "RENTED" && !rentedPlates.has(t.plate_no));

  const tabs = <RentalTabs view={view} current={active.length} all={rows.length} />;

  if (view === "all") {
    const all = [...rows].sort(
      (a, b) => (a.status === b.status ? 0 : a.status === "ACTIVE" ? -1 : 1) || (b.endedOn ?? b.startDate ?? "").localeCompare(a.endedOn ?? a.startDate ?? ""),
    );
    return (
      <>
        <PageHeader title="ข้อมูลผู้เช่าทั้งหมด" sub={`ผู้เช่าทุกราย ทั้งที่กำลังเช่าและคืนหางแล้ว · กำลังเช่า ${active.length} · คืนแล้ว ${ended.length}`} />
        {tabs}
        <div className="overflow-x-auto rounded-xl border border-line bg-paper">
          <table className="w-full min-w-[1080px] text-left text-[14px]">
            <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
              <tr>
                <th className="px-3 py-2.5 font-semibold">ชื่อ / บริษัท</th>
                <th className="px-3 py-2.5 font-semibold">ประเภท</th>
                <th className="px-3 py-2.5 font-semibold">ทะเบียน</th>
                <th className="px-3 py-2.5 font-semibold">วันรับหาง</th>
                <th className="px-3 py-2.5 font-semibold">วันคืนหาง</th>
                <th className="px-3 py-2.5 text-right font-semibold">ค่าเช่า / เดือน</th>
                <th className="px-3 py-2.5 font-semibold">สถานะ</th>
                <th className="px-3 py-2.5 font-semibold">ใบส่งมอบ / รับคืน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line align-top">
              {all.map((c) => (
                <tr key={c.id} className={c.status === "ENDED" ? "text-ink-2" : undefined}>
                  <td className="px-3 py-2.5">
                    <span className="block min-w-[200px] font-semibold text-ink">{c.customerName}</span>
                    <span className="block text-[12px] text-ink-3">
                      {c.nickname && <>{c.nickname} · </>}
                      {c.customerKind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"}
                      {c.phone && <> · {c.phone}</>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{c.trailerKind ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-route font-extrabold">{c.plate}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{c.startDate ? thDate(c.startDate) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{c.endedOn ? thDate(c.endedOn) : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular">{num(rentLines(c.monthlyRent, c.vatRate, c.whtRate).total)}</td>
                  <td className="px-3 py-2.5">
                    {c.status === "ACTIVE" ? <Badge tone="ok">กำลังเช่า</Badge> : <Badge tone="muted">คืนหางแล้ว</Badge>}
                    {c.unpaidMonths.length > 0 && <Badge tone="danger" className="ml-1">ค้าง {num(c.arrears)}</Badge>}
                  </td>
                  <td className="px-3 py-2.5">
                    {c.handovers.length ? (
                      <ul className="space-y-0.5 text-[13px]">
                        {c.handovers.map((h) => (
                          <li key={h.id}>
                            <Link href={`/admin/handovers/${h.id}`} className="font-semibold text-grass underline">
                              {h.kind === "RETURN" ? "รับคืน" : "ส่งมอบ"} {thDate(h.date)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="ลูกค้าผู้เช่าปัจจุบัน"
        sub={`${active.length} สัญญา · ช่อง “วางบิลแล้ว” นับเป็นรายเดือน (เดือน${monthName}) และเริ่มใหม่ทุกต้นเดือน`}
        actions={<AddContract />}
      />
      {tabs}

      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="ค่าเช่ารวม / เดือน (ก่อน VAT)" value={num(sum.rent)} />
        <Stat label="ยอดรับรวม / เดือน (Total)" value={num(sum.total)} />
        <Stat label={`วางบิลแล้ว (${monthName})`} value={`${billedCount} / ${active.length}`} />
        <Stat label="ครบกำหนดชำระใน 3 วัน (ยังไม่วางบิล)" value={String(dueSoon.length)} warn={dueSoon.length > 0} />
      </dl>

      {arrearsReady ? (
        owing.length > 0 && (
          <section className="mb-5 rounded-xl border-2 border-danger bg-paper" aria-labelledby="arrears-h">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-danger/30 bg-danger-tint px-5 py-3">
              <h2 id="arrears-h" className="text-[17px] font-bold text-danger">
                ค่าเช่าค้างชำระ {owing.length} ราย · {owing.reduce((a, r) => a + r.unpaidMonths.length, 0)} เดือน
              </h2>
              <p className="font-route text-[26px] font-extrabold tabular text-danger">{num(arrearsSum)} บาท</p>
            </header>
            <ul className="divide-y divide-line text-[14px]">
              {owing.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-2.5">
                  <span>
                    <span className="font-semibold">{r.customerName}</span>{" "}
                    <span className="font-route font-extrabold">{r.plate}</span>
                    <span className="text-ink-2">
                      {" "}· ค้าง {r.unpaidMonths.length} เดือน ({monthsText(r.unpaidMonths)})
                    </span>
                    {r.arrearsNote && <span className="text-ink-3"> · {r.arrearsNote}</span>}
                  </span>
                  <span className="font-bold tabular text-danger">{num(r.arrears)} บาท</span>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : (
        <p className="mb-5 rounded-xl border-2 border-warn/50 bg-paper px-5 py-3 text-[14px]">
          ยังแสดงค่าเช่าค้างชำระไม่ได้ · ให้รัน migration <code>20261116000016_rental_arrears.sql</code> ใน Supabase
          (ไฟล์นี้ใส่ยอดค้างชำระ 6 รายการที่แจ้งมาให้แล้ว)
        </p>
      )}

      {orphan.length > 0 && (
        <p className="mb-4 rounded-xl border-2 border-warn/50 bg-paper px-5 py-3 text-[14px]">
          หางที่สถานะ “อยู่กับลูกค้า” แต่ยังไม่มีในตารางนี้: {orphan.map((t) => `${t.code} (${t.plate_no})`).join(", ")}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-line bg-paper">
        <table className="w-full min-w-[1280px] text-[14px]">
          <thead className="border-b border-line bg-ground text-[13px] text-ink-3">
            <tr>
              <th className="px-3 py-2.5 font-semibold">ลำดับ</th>
              <th className="px-3 py-2.5 text-left font-semibold">ชื่อ / บริษัท</th>
              <th className="px-3 py-2.5 font-semibold">ประเภท</th>
              <th className="px-3 py-2.5 text-left font-semibold">ทะเบียน</th>
              <th className="px-3 py-2.5 text-left font-semibold">วันรับหาง</th>
              <th className="px-3 py-2.5 font-semibold">ระยะสัญญา</th>
              <th className="px-3 py-2.5 font-semibold">ชำระทุกวันที่</th>
              <th className="whitespace-nowrap px-3 py-2.5 font-semibold">วางบิลแล้ว</th>
              <th className="px-3 py-2.5 text-right font-semibold">ค่าเช่า</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">VAT 7%</th>
              <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold">หัก ณ ที่จ่าย</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-danger">ค้างชำระ</th>
              <th className="sticky right-0 z-10 border-l border-line bg-ground px-3 py-2.5 text-left font-semibold">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {active.map((c, i) => (
              <ContractRow key={c.id} c={c} arrearsReady={arrearsReady} index={i + 1} month={month} today={today} canDelete={role === "SUPER_ADMIN"} />
            ))}
            {active.length === 0 && (
              <tr><td colSpan={14} className="px-4 py-10 text-center text-ink-3">ยังไม่มีลูกค้าผู้เช่า</td></tr>
            )}
          </tbody>
          {active.length > 0 && (
            <tfoot className="border-t-2 border-line-strong bg-ground font-bold">
              <tr>
                <td colSpan={8} className="px-3 py-2.5 text-right">รวมต่อเดือน</td>
                <td className="px-3 py-2.5 text-right tabular">{num(sum.rent)}</td>
                <td className="px-3 py-2.5 text-right tabular">{num(sum.vat)}</td>
                <td className="px-3 py-2.5 text-right tabular">{num(sum.wht)}</td>
                <td className="px-3 py-2.5 text-right tabular text-grass">{num(sum.total)}</td>
                <td className="px-3 py-2.5 text-right tabular text-danger">{arrearsSum ? num(arrearsSum) : "–"}</td>
                <td className="sticky right-0 border-l border-line bg-ground" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-[13px] text-ink-3">
        บุคคลธรรมดา: ไม่มี VAT · นิติบุคคล: ค่าเช่า + VAT 7% และหัก ณ ที่จ่าย 5% (แก้ได้รายสัญญา) · Total = ค่าเช่า + VAT − หัก ณ ที่จ่าย ·
        สัญญาที่เลยระยะแรกแล้วถือว่าต่ออายุรอบละเท่าเดิม · แถวสีเหลือง = ใกล้กำหนดชำระและยังไม่วางบิล
      </p>

    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={warn ? "rounded-xl border-2 border-warn bg-warn-tint p-4" : "rounded-xl border border-line bg-paper p-4"}>
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-route text-[26px] font-extrabold leading-tight tabular">{value}</dd>
    </div>
  );
}

function RentalTabs({ view, current, all }: { view: "current" | "all"; current: number; all: number }) {
  const tab = (on: boolean) =>
    `rounded-lg px-4 py-2 text-[15px] font-semibold ${on ? "bg-sign text-on-sign" : "border-2 border-line bg-paper text-ink-2 hover:border-sign"}`;
  return (
    <nav aria-label="มุมมองผู้เช่า" className="mb-5 flex flex-wrap gap-2">
      <Link href="/admin/rentals" aria-current={view === "current" ? "page" : undefined} className={tab(view === "current")}>
        ลูกค้าผู้เช่าปัจจุบัน ({current})
      </Link>
      <Link href="/admin/rentals?view=all" aria-current={view === "all" ? "page" : undefined} className={tab(view === "all")}>
        ข้อมูลผู้เช่าทั้งหมด ({all})
      </Link>
    </nav>
  );
}
