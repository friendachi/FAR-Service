"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, CircleAlert, History, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteContract, saveArrears, saveContract, setBilled } from "@/app/actions/fleet-admin";
import { deleteHandover } from "@/app/actions/handovers";
import { defaultRates, monthLabel, monthsText, owedMonthChoices, rentLines, type CustomerKind } from "@/lib/fleet-admin";
import { num, thDate } from "@/lib/format";
import { Msg, useAction } from "./tax-admin";
import { Badge, Button, Field, LinkButton, cx, inputClass } from "./ui";

export type ContractRowData = {
  id: string;
  seq: number | null;
  customerName: string;
  nickname: string | null;
  phone: string | null;
  customerKind: CustomerKind;
  trailerKind: string | null;
  plate: string;
  plateNote: string | null;
  province: string;
  startDate: string | null;
  termMonths: number | null;
  payDay: number | null;
  monthlyRent: number;
  vatRate: number;
  whtRate: number;
  billed: boolean;
  status: "ACTIVE" | "ENDED";
  endedOn: string | null;
  note: string | null;
  /** computed on the server */
  termEnd: string | null;
  /** overdue rent */
  unpaidMonths: string[];
  arrearsOverride: number | null;
  arrearsNote: string | null;
  arrears: number;
  renewals: number;
  nextPay: string | null;
  payDueSoon: boolean;
  trailerCode: string | null;
  trailerStatus: string | null;
  handovers: { id: string; kind: "HANDOVER" | "RETURN"; date: string; yard: string | null; driver: string | null; tractor: string | null; tyresOk: boolean | null; lightsOk: boolean | null; note: string | null }[];
};

const KIND_OPTIONS = [
  ["SF3", "หางพื้นเรียบ 3 เพลา"],
  ["SF2", "หางพื้นเรียบ 2 เพลา"],
  ["SC3", "หางก้างปลา 3 เพลา"],
  ["SC2", "หางก้างปลา 2 เพลา"],
  ["LB3", "หางโลว์เบด 3 เพลา"],
  ["LB2", "หางโลว์เบด 2 เพลา"],
];

/* ---------------------------------------------------------------- add / edit */

export function ContractForm({ c, onDone }: { c?: ContractRowData; onDone?: () => void }) {
  const { pending, msg, run } = useAction();
  const [kind, setKind] = useState<CustomerKind>(c?.customerKind ?? "PERSON");
  const [vat, setVat] = useState(c ? c.vatRate === 7 : false);
  const [wht, setWht] = useState(c ? c.whtRate : 0);
  const [rent, setRent] = useState(c?.monthlyRent ?? 12000);
  const lines = rentLines(rent || 0, vat ? 7 : 0, wht);

  const pickKind = (k: CustomerKind) => {
    setKind(k);
    const d = defaultRates(k);
    setVat(d.vat === 7);
    setWht(d.wht);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "");
        const n = (k: string) => (s(k) === "" ? null : Number(s(k)));
        run(
          () =>
            saveContract({
              id: c?.id,
              seq: n("seq"),
              customerName: s("name"),
              nickname: s("nickname"),
              phone: s("phone"),
              customerKind: kind,
              trailerKind: s("trailerKind"),
              plate: s("plate"),
              plateNote: s("plateNote"),
              startDate: s("start"),
              termMonths: n("term"),
              payDay: n("payDay"),
              monthlyRent: rent || 0,
              vatRate: vat ? 7 : 0,
              whtRate: wht,
              note: s("note"),
            }),
          onDone,
        );
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="ชื่อลูกค้า / บริษัท" className="lg:col-span-2">
          <input name="name" required defaultValue={c?.customerName} className={inputClass} />
        </Field>
        <Field label="ชื่อเรียก / ผู้ติดต่อ (ถ้ามี)">
          <input name="nickname" defaultValue={c?.nickname ?? ""} placeholder="เช่น K แบงค์" className={inputClass} />
        </Field>
        <Field label="เบอร์โทร (ถ้ามี)">
          <input name="phone" inputMode="tel" defaultValue={c?.phone ?? ""} className={inputClass} />
        </Field>

        <div className="sm:col-span-2 lg:col-span-4">
          <span className="mb-1.5 block text-sm font-semibold text-ink-2">เช่าในนาม</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["PERSON", "บุคคลธรรมดา", "ไม่มี VAT"],
                ["COMPANY", "นิติบุคคล / บริษัท", "ค่าเช่า + VAT 7% · หัก ณ ที่จ่าย 5%"],
              ] as const
            ).map(([k, label, sub]) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => pickKind(k)}
                className={cx(
                  "rounded-lg border-2 px-4 py-2.5 text-left font-semibold",
                  kind === k ? "border-sign bg-sign-wash" : "border-line bg-paper hover:border-sign",
                )}
              >
                {label}
                <span className="block text-[13px] font-normal text-ink-2">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        <Field label="ประเภทหาง">
          <input name="trailerKind" list="trailer-kinds" defaultValue={c?.trailerKind ?? "SF3"} className={inputClass} />
          <datalist id="trailer-kinds">
            {KIND_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </datalist>
        </Field>
        <Field label="ทะเบียนหาง">
          <input name="plate" required defaultValue={c?.plate} placeholder="74-4875" className={inputClass} />
        </Field>
        <Field label="วันรับหาง">
          <input name="start" type="date" defaultValue={c?.startDate ?? ""} className={inputClass} />
        </Field>
        <Field label="ระยะสัญญาเช่า (เดือน)">
          <input name="term" type="number" min={1} max={120} defaultValue={c?.termMonths ?? 12} className={cx(inputClass, "tabular")} />
        </Field>
        <Field label="กำหนดชำระทุกวันที่">
          <input name="payDay" type="number" min={1} max={31} defaultValue={c?.payDay ?? ""} className={cx(inputClass, "tabular")} />
        </Field>
        <Field label="ค่าเช่า / เดือน (ก่อน VAT)">
          <input type="number" min={0} step={50} value={rent} onChange={(e) => setRent(Number(e.target.value))} className={cx(inputClass, "tabular")} />
        </Field>
        <Field label="ลำดับในตาราง (ถ้ามี)">
          <input name="seq" type="number" min={0} defaultValue={c?.seq ?? ""} className={cx(inputClass, "tabular")} />
        </Field>
        <Field label="หมายเหตุทะเบียน (ถ้ามี)">
          <input name="plateNote" defaultValue={c?.plateNote ?? ""} placeholder="เช่น (2)" className={inputClass} />
        </Field>
        <Field label="หมายเหตุ" className="sm:col-span-2 lg:col-span-4">
          <input name="note" defaultValue={c?.note ?? ""} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-sign-wash px-4 py-3 text-[14px]">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="size-4 accent-[var(--color-grass)]" />
          VAT 7%
        </label>
        <label className="flex items-center gap-2 font-semibold">
          หัก ณ ที่จ่าย
          <select value={wht} onChange={(e) => setWht(Number(e.target.value))} className="h-9 rounded-md border-2 border-line bg-paper px-2">
            <option value={0}>ไม่หัก</option>
            <option value={1}>1%</option>
            <option value={3}>3%</option>
            <option value={5}>5%</option>
          </select>
        </label>
        <span className="tabular text-ink-2">
          ค่าเช่า {num(lines.rent)} + VAT {num(lines.vat)} − หัก {num(lines.wht)} =
        </span>
        <span className="font-route text-[20px] font-extrabold tabular text-grass">{num(lines.total)} บาท</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : c ? "บันทึกการแก้ไข" : "เพิ่มลูกค้าผู้เช่า"}</Button>
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>ยกเลิก</Button>
        )}
        <Msg msg={msg} />
      </div>
    </form>
  );
}

export function AddContract() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> เพิ่มลูกค้าผู้เช่า
      </Button>
    );
  return (
    <div className="mb-6 w-full rounded-xl border-2 border-sign bg-paper p-5">
      <p className="mb-4 text-[17px] font-bold">เพิ่มลูกค้าผู้เช่า</p>
      <ContractForm onDone={() => setOpen(false)} />
    </div>
  );
}

/* ---------------------------------------------------------------- hand-over / return history */

export function HandoverHistory({ items, canDelete }: { items: ContractRowData["handovers"]; canDelete: boolean }) {
  const { pending, msg, run } = useAction();
  if (!items.length) return <p className="text-[13px] text-ink-3">ยังไม่มีบันทึกส่งมอบ / รับคืน</p>;
  return (
    <ul className="space-y-1.5 text-[13px]">
      {items.map((h) => (
        <li key={h.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Badge tone={h.kind === "RETURN" ? "info" : "ok"}>{h.kind === "RETURN" ? "รับคืน" : "ส่งมอบ"}</Badge>
          <span className="font-semibold">{thDate(h.date)}</span>
          {h.yard && <span>· ลาน {h.yard}</span>}
          {h.driver && <span>· คนขับ {h.driver}</span>}
          {h.tractor && <span>· หัวลาก {h.tractor}</span>}
          {h.tyresOk !== null && <span className={h.tyresOk ? "text-ink-3" : "text-danger"}>· ยาง{h.tyresOk ? "ครบ" : "ไม่ได้ระบุ"}</span>}
          {h.lightsOk !== null && <span className={h.lightsOk ? "text-ink-3" : "text-danger"}>· ไฟ{h.lightsOk ? "ครบ" : "มีปัญหา"}</span>}
          {h.note && <span className="text-ink-2">· {h.note}</span>}
          <Link href={`/admin/handovers/${h.id}`} className="font-semibold text-grass underline">
            ดูใบส่งมอบ / รูป
          </Link>
          {canDelete && (
            <button
              type="button"
              disabled={pending}
              aria-label="ลบบันทึก"
              onClick={() => confirm("ลบบันทึกนี้?") && run(() => deleteHandover(h.id))}
              className="rounded p-0.5 text-ink-3 hover:bg-danger-tint hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          )}
        </li>
      ))}
      <Msg msg={msg?.ok ? null : msg} />
    </ul>
  );
}

/* ---------------------------------------------------------------- overdue rent */

function ArrearsForm({ c, today, onDone }: { c: ContractRowData; today: string; onDone: () => void }) {
  const { pending, msg, run } = useAction();
  const [months, setMonths] = useState<string[]>(c.unpaidMonths);
  const [custom, setCustom] = useState(c.arrearsOverride !== null);
  const [amount, setAmount] = useState<number>(c.arrearsOverride ?? 0);
  const [note, setNote] = useState(c.arrearsNote ?? "");
  const monthly = rentLines(c.monthlyRent, c.vatRate, c.whtRate).total;
  const choices = owedMonthChoices(c.startDate, today, c.unpaidMonths);
  const flip = (m: string) => setMonths((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m].sort()));
  const total = custom ? amount : months.length * monthly;

  return (
    <div className="space-y-3">
      <p className="font-bold">
        ค่าเช่าค้างชำระ · {c.customerName} <span className="font-route">{c.plate}</span>
        <span className="ml-2 text-[13px] font-normal text-ink-3">กดเลือกเดือนที่ยังไม่ได้ชำระ (เดือนละ {num(monthly)} บาท)</span>
      </p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="เดือนที่ค้างชำระ">
        {choices.map((m) => {
          const on = months.includes(m);
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => flip(m)}
              className={cx(
                "rounded-md border-2 px-2.5 py-1 text-[13px] font-semibold tabular",
                on ? "border-danger bg-danger text-white" : "border-line bg-paper text-ink-2 hover:border-danger",
              )}
            >
              {monthLabel(m)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-lg bg-danger-tint/60 px-4 py-3 text-[14px]">
        <span>
          ค้าง <strong className="tabular">{months.length}</strong> เดือน{months.length > 0 && <> ({monthsText(months)})</>}
        </span>
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="size-4 accent-[var(--color-danger)]" />
          ระบุยอดเอง (เช่น จ่ายมาบางส่วน)
        </label>
        {custom && (
          <input
            type="number"
            min={0}
            step={50}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-label="ยอดค้างชำระ (บาท)"
            className="h-10 w-36 rounded-lg border-2 border-line bg-paper px-3 tabular"
          />
        )}
        <span className="ml-auto font-route text-[22px] font-extrabold tabular text-danger">{num(total)} บาท</span>
      </div>
      <Field label="หมายเหตุ (ถ้ามี)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น นัดจ่ายวันที่ 20" className={inputClass} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={() => run(() => saveArrears(c.id, { months, amount: custom ? amount : null, note }), onDone)}>
          {pending ? "กำลังบันทึก…" : "บันทึกค้างชำระ"}
        </Button>
        {c.unpaidMonths.length > 0 && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => confirm(`ยืนยันว่า ${c.customerName} (${c.plate}) ชำระครบแล้ว?`) && run(() => saveArrears(c.id, { months: [], amount: null, note: "" }), onDone)}
          >
            ชำระครบแล้ว (ล้างยอดค้าง)
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onDone}>ยกเลิก</Button>
        <Msg msg={msg} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- one row of the register */

export function ContractRow({
  c,
  month,
  today,
  arrearsReady,
  canDelete,
  index,
}: {
  c: ContractRowData;
  month: string;
  today: string;
  arrearsReady: boolean;
  canDelete: boolean;
  index: number;
}) {
  const [panel, setPanel] = useState<null | "edit" | "history" | "arrears">(null);
  const { pending, msg, run } = useAction();
  const lines = rentLines(c.monthlyRent, c.vatRate, c.whtRate);
  const toggle = (p: "edit" | "history" | "arrears") => setPanel((x) => (x === p ? null : p));

  return (
    <Fragment>
      <tr className={cx(c.payDueSoon && !c.billed && "bg-warn-tint/50")}>
        <td className="px-3 py-2.5 text-center tabular text-ink-3">{c.seq ?? index}</td>
        <td className="px-3 py-2.5">
          <span className="block min-w-[200px] font-semibold leading-snug">{c.customerName}</span>
          <span className="block text-[12px] text-ink-3">
            {c.nickname && <span className="text-ink-2">{c.nickname} · </span>}
            {c.customerKind === "COMPANY" ? "นิติบุคคล" : "บุคคลธรรมดา"}
            {c.phone && <> · {c.phone}</>}
            {c.note && <> · {c.note}</>}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center font-semibold">{c.trailerKind ?? "—"}</td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <span className="font-route font-extrabold">{c.plate}</span> <span className="text-[12px] text-ink-2">{c.province}{c.plateNote && ` ${c.plateNote}`}</span>
          <span className="block text-[12px] text-ink-3">{c.trailerCode ? `${c.trailerCode} · ${c.trailerStatus ?? ""}` : "ไม่อยู่ในรายการหางของเว็บ"}</span>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">{c.startDate ? thDate(c.startDate) : "—"}</td>
        <td className="px-3 py-2.5 text-center">
          {c.termMonths ? <span className="font-semibold tabular">{c.termMonths} เดือน</span> : "—"}
          {c.termEnd && (
            <span className={cx("block whitespace-nowrap text-[12px]", c.renewals > 0 ? "text-warn" : "text-ink-3")}>
              {c.renewals > 0 ? `ต่ออายุ ${c.renewals} รอบ · ` : ""}ครบ {thDate(c.termEnd)}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          {c.payDay ? <span className="font-semibold tabular">{c.payDay}</span> : "—"}
          {c.nextPay && <span className={cx("block whitespace-nowrap text-[12px]", c.payDueSoon && !c.billed ? "font-semibold text-warn" : "text-ink-3")}>รอบถัดไป {thDate(c.nextPay)}</span>}
        </td>
        <td className="px-3 py-2.5 text-center">
          <input
            type="checkbox"
            checked={c.billed}
            disabled={pending}
            onChange={(e) => run(() => setBilled(c.id, e.target.checked ? month : null))}
            aria-label={`วางบิลเดือนนี้แล้ว · ${c.customerName} ${c.plate}`}
            className="size-5 accent-[var(--color-grass)]"
          />
          <Msg msg={msg?.ok ? null : msg} />
        </td>
        <td className="px-2 py-2.5 text-right tabular">{num(lines.rent)}</td>
        <td className="px-2 py-2.5 text-right tabular">{num(lines.vat)}</td>
        <td className="px-2 py-2.5 text-right tabular">{num(lines.wht)}</td>
        <td className="px-2 py-2.5 text-right font-bold tabular text-grass">{num(lines.total)}</td>
        <td className="px-2 py-2.5 text-right">
          {arrearsReady ? (
            <button
              type="button"
              onClick={() => toggle("arrears")}
              aria-expanded={panel === "arrears"}
              title="แก้ไขค่าเช่าค้างชำระ"
              className={cx(
                "w-full rounded-md px-2 py-1 text-right",
                c.unpaidMonths.length ? "bg-danger-tint text-danger hover:ring-2 hover:ring-danger" : "text-ink-3 hover:bg-ground",
              )}
            >
              {c.unpaidMonths.length ? (
                <>
                  <span className="flex items-center justify-end gap-1 font-bold tabular">
                    <CircleAlert className="size-3.5" aria-hidden /> {num(c.arrears)}
                  </span>
                  <span className="block whitespace-nowrap text-[12px]">
                    {c.unpaidMonths.length} เดือน · {monthsText(c.unpaidMonths)}
                  </span>
                </>
              ) : (
                <span className="text-[13px]">ไม่มี · เพิ่ม</span>
              )}
            </button>
          ) : (
            <span className="text-ink-3">–</span>
          )}
        </td>
        <td className={cx("sticky right-0 z-10 border-l border-line px-2 py-2.5 shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.35)]", c.payDueSoon && !c.billed ? "bg-warn-tint" : "bg-paper")}>
          <div className="flex gap-0.5">
            <Button
              type="button"
              size="sm"
              variant={panel === "edit" ? "sign" : "outline"}
              className="whitespace-nowrap px-2.5"
              onClick={() => toggle("edit")}
              aria-expanded={panel === "edit"}
              title="แก้ไขข้อมูลลูกค้า / สัญญา"
            >
              <Pencil className="size-4" aria-hidden /> แก้ไข
            </Button>
            <LinkButton
              href={`/admin/handovers/new?contract=${c.id}&kind=${c.status === "ACTIVE" && c.handovers[0]?.kind === "HANDOVER" ? "RETURN" : "HANDOVER"}`}
              size="sm"
              variant="outline"
              title="ใบส่งมอบ / รับคืน พร้อมรูป 14 รูป"
              className="whitespace-nowrap px-2.5"
            >
              <ArrowLeftRight className="size-4" aria-hidden /> ส่งมอบ/รับคืน
            </LinkButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => toggle("history")} title="ประวัติส่งมอบ / รับคืน" className="gap-1 px-2" aria-label={`ประวัติส่งมอบ / รับคืน ${c.handovers.length} รายการ`}>
              <History className="size-4" aria-hidden /> {c.handovers.length}
            </Button>
            {canDelete && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger"
                aria-label="ลบ"
                disabled={pending}
                onClick={() => confirm(`ลบสัญญา ${c.customerName} · ${c.plate}?`) && run(() => deleteContract(c.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {panel && (
        <tr className="bg-ground">
          <td colSpan={14} className="px-0 py-4">
            {/* stays in view while the wide table is scrolled sideways */}
            <div className="sticky left-0 w-[calc(100vw-3rem)] px-4 sm:w-[calc(100vw-4rem)] lg:w-[min(1080px,calc(100vw-22rem))]">
              {panel === "edit" && <ContractForm c={c} onDone={() => setPanel(null)} />}
              {panel === "history" && <HandoverHistory items={c.handovers} canDelete={canDelete} />}
              {panel === "arrears" && <ArrearsForm c={c} today={today} onDone={() => setPanel(null)} />}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
