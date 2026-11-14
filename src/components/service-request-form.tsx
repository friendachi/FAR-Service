"use client";

import { useState, useTransition } from "react";
import { CircleDot, Droplets, ParkingSquare } from "lucide-react";
import { submitServiceRequest } from "@/app/actions/services";
import { money } from "@/lib/format";
import {
  SERVICE_RATES,
  parkingDisclaimer,
  parkingDocuments,
  serviceEstimate,
  serviceKinds,
  PARKING_YARD,
  type ServiceKind,
} from "@/lib/service-requests";
import { PriceLines } from "./price-lines";
import { ParkingInfo } from "./parking-info";
import { T } from "./t";
import { Button, Field, cx, inputClass } from "./ui";

const icon = { TYRE: CircleDot, WASH: Droplets, PARKING: ParkingSquare };

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "rounded-lg border-2 px-4 py-3 text-left text-[15px] font-semibold transition-colors",
        on ? "border-sign bg-sign text-on-sign" : "border-line bg-paper text-ink hover:border-sign",
      )}
    >
      {children}
    </button>
  );
}

/** Pick one stand-alone service (tyres, washing or parking), fill the details and send a request. */
export function ServiceRequestForm({
  initial,
  yards,
}: {
  initial?: ServiceKind;
  yards: { id: string; label: string; mapUrl?: string; hours?: string }[];
}) {
  const parkingYard = yards.find((y) => y.id === PARKING_YARD);
  const [kind, setKind] = useState<ServiceKind | null>(initial ?? null);
  const [source, setSource] = useState<"OWN" | "OUTSIDE">("OWN");
  const [tyres, setTyres] = useState(12);
  const [units, setUnits] = useState(1);
  const [plan, setPlan] = useState<"DAILY" | "MONTHLY">("DAILY");
  const [length, setLength] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const details = { source, tyres, units, plan, length };
  const estimate = kind ? serviceEstimate(kind, details) : 0;

  if (msg?.ok)
    return (
      <div className="rounded-xl border-2 border-sign bg-sign-wash p-6" role="status">
        <p className="text-[18px] font-bold text-grass">{msg.text}</p>
        <button type="button" onClick={() => setMsg(null)} className="mt-3 font-semibold text-grass underline">
          <T th="ขอรับบริการอื่นเพิ่ม" en="Request another service" />
        </button>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!kind) return;
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "");
        start(async () => {
          const res = await submitServiceRequest({
            kind,
            name: s("name"),
            phone: s("phone"),
            company: s("company"),
            yard: s("yard"),
            date: s("date"),
            note: s("note"),
            details: { ...details, plate: s("plate") },
            acceptedTerms: accepted,
          });
          setMsg(res.ok ? { ok: true, text: res.message ?? "ส่งคำขอแล้ว" } : { ok: false, text: res.error });
        });
      }}
      className="space-y-6"
    >
      {/* 1. which service */}
      <fieldset>
        <legend className="mb-3 text-[17px] font-bold"><T th="1. เลือกบริการ" en="1. Choose a service" /></legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {serviceKinds.map((k) => {
            const Icon = icon[k.id];
            const on = kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() => setKind(k.id)}
                className={cx(
                  "flex gap-3 rounded-xl border-2 p-4 text-left transition-colors",
                  on ? "border-sign bg-sign-wash" : "border-line bg-paper hover:border-sign",
                )}
              >
                <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", on ? "bg-sign text-on-sign" : "bg-sign-wash text-grass")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block font-bold"><T th={k.th} en={k.en} /></span>
                  <PriceLines th={k.priceTh} en={k.priceEn} size="sm" />
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {kind && (
        <>
          {/* 2. details for that service */}
          <fieldset className="space-y-4 rounded-xl border border-line bg-paper p-5">
            <legend className="px-1 text-[17px] font-bold"><T th="2. รายละเอียด" en="2. Details" /></legend>

            {kind === "TYRE" && (
              <>
                <div>
                  <p className="mb-2 text-[14px] font-semibold text-ink-2"><T th="ยางของหางคันไหน" en="Which trailer" /></p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Choice on={source === "OWN"} onClick={() => setSource("OWN")}>
                      <T th="หางที่เช่ากับ FAR" en="Trailer rented from FAR" />
                      <span className="block text-[13px] font-normal">{money(SERVICE_RATES.tyreOwn)}/<T th="เส้น" en="tire" /></span>
                    </Choice>
                    <Choice on={source === "OUTSIDE"} onClick={() => setSource("OUTSIDE")}>
                      <T th="หางภายนอก" en="Outside trailer" />
                      <span className="block text-[13px] font-normal">{money(SERVICE_RATES.tyreOutside)}/<T th="เส้น" en="tire" /></span>
                    </Choice>
                  </div>
                </div>
                <Field label={<T th="จำนวนยาง (เส้น)" en="Number of tires" />}>
                  <input type="number" min={1} max={48} value={tyres} onChange={(e) => setTyres(Number(e.target.value))} className={cx(inputClass, "tabular")} />
                </Field>
              </>
            )}

            {kind !== "TYRE" && (
              <Field label={<T th="จำนวนรถ (คัน) · หัวลากหรือหางลาก" en="Number of units (tractors or trailers)" />}>
                <input type="number" min={1} max={50} value={units} onChange={(e) => setUnits(Number(e.target.value))} className={cx(inputClass, "tabular")} />
              </Field>
            )}

            {kind === "PARKING" && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Choice on={plan === "DAILY"} onClick={() => setPlan("DAILY")}>
                    <T th="รายวัน" en="Daily" />
                    <span className="block text-[13px] font-normal">{money(SERVICE_RATES.parkingDay)}/<T th="วัน" en="day" /></span>
                  </Choice>
                  <Choice on={plan === "MONTHLY"} onClick={() => setPlan("MONTHLY")}>
                    <T th="รายเดือน" en="Monthly" />
                    <span className="block text-[13px] font-normal">{money(SERVICE_RATES.parkingMonth)}/<T th="เดือน" en="month" /></span>
                  </Choice>
                </div>
                <Field label={plan === "MONTHLY" ? <T th="จำนวนเดือน" en="Months" /> : <T th="จำนวนวัน" en="Days" />}>
                  <input
                    type="number"
                    min={1}
                    max={plan === "MONTHLY" ? 36 : 365}
                    value={length}
                    onChange={(e) => setLength(Number(e.target.value))}
                    className={cx(inputClass, "tabular")}
                  />
                </Field>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<T th="ทะเบียนรถ (ถ้ามี)" en="Plate number (optional)" />}>
                <input name="plate" className={inputClass} />
              </Field>
              <Field label={kind === "PARKING" ? <T th="วันที่เริ่มจอด" en="Start date" /> : <T th="วันที่ต้องการใช้บริการ" en="Preferred date" />}>
                <input name="date" type="date" className={inputClass} />
              </Field>
              {kind === "PARKING" ? (
                <Field label={<T th="ลาน" en="Yard" />}>
                  <input type="hidden" name="yard" value={PARKING_YARD} />
                  <p className="flex h-12 items-center rounded-lg border-2 border-line bg-ground px-3.5 text-[15px] font-semibold">
                    {parkingYard?.label ?? "ลานหนองใหญ่"}
                  </p>
                </Field>
              ) : (
                <Field label={<T th="ลาน" en="Yard" />}>
                  <select name="yard" className={inputClass} defaultValue="">
                    <option value="">ลานใดก็ได้ · Any yard</option>
                    {yards.map((y) => (
                      <option key={y.id} value={y.id}>{y.label}</option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <div className="flex items-baseline justify-between gap-3 rounded-lg bg-sign-wash px-4 py-3">
              <span className="text-[14px] text-ink-2"><T th="ราคาประมาณ (ยังไม่รวม VAT)" en="Estimate (excl. VAT)" /></span>
              <span className="font-route text-[24px] font-extrabold tabular text-grass">{money(estimate)}</span>
            </div>
          </fieldset>

          {kind === "PARKING" && (
            <div className="space-y-3 rounded-xl border-2 border-warn/40 bg-paper p-5">
              <ParkingInfo mapUrl={parkingYard?.mapUrl} hours={parkingYard?.hours} />
              <p className="font-bold"><T th="เอกสารสำหรับฝากจอด" en="Documents for parking" /></p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] text-ink-2">
                {parkingDocuments.map((d) => (
                  <li key={d.en}><T th={d.th} en={d.en} /></li>
                ))}
              </ul>
              <p className="text-[14px] text-ink-3"><T th="นำมาในวันเข้าจอด หรือส่งทาง LINE ก่อนวันจอด" en="Bring them on the first day, or send them by LINE beforehand." /></p>
              <p className="text-[14px] leading-relaxed text-ink-2">
                <strong><T th="หมายเหตุ: " en="Note: " /></strong>
                <T th={parkingDisclaimer.th} en={parkingDisclaimer.en} />
              </p>
              <label className="flex items-start gap-3 text-[15px] font-semibold">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 size-5 accent-[var(--color-grass)]" />
                <T th="ฉันรับทราบและยอมรับเงื่อนไขการฝากจอด" en="I understand and accept the parking terms" />
              </label>
            </div>
          )}

          {/* 3. contact */}
          <fieldset className="space-y-4 rounded-xl border border-line bg-paper p-5">
            <legend className="px-1 text-[17px] font-bold"><T th="3. ข้อมูลติดต่อ" en="3. Contact" /></legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={<T th="ชื่อผู้ติดต่อ" en="Name" />}><input name="name" required className={inputClass} /></Field>
              <Field label={<T th="เบอร์โทร" en="Phone" />}><input name="phone" inputMode="tel" required className={inputClass} /></Field>
              <Field label={<T th="บริษัท (ถ้ามี)" en="Company (optional)" />} className="sm:col-span-2"><input name="company" className={inputClass} /></Field>
              <Field label={<T th="หมายเหตุเพิ่มเติม" en="Notes" />} className="sm:col-span-2">
                <textarea name="note" rows={3} className={cx(inputClass, "h-auto py-3")} />
              </Field>
            </div>
          </fieldset>

          {msg && !msg.ok && <p className="font-semibold text-danger" role="alert">{msg.text}</p>}
          <Button type="submit" variant="sign" size="lg" className="w-full sm:w-auto" disabled={pending || (kind === "PARKING" && !accepted)}>
            {pending ? <T th="กำลังส่ง…" en="Sending…" /> : <T th="ส่งคำขอใช้บริการ" en="Send request" />}
          </Button>
          <p className="text-[13px] text-ink-3">
            <T th="เจ้าหน้าที่จะโทรยืนยันวันเวลาและราคาก่อนให้บริการ" en="Our staff will call to confirm the time and price before the service." />
          </p>
        </>
      )}
    </form>
  );
}
