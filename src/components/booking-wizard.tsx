"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, CircleCheckBig, Plus } from "lucide-react";
import { createBooking, saveGuarantor } from "@/app/actions/customer";
import { channelLabel, money, thDateTime } from "@/lib/format";
import { addMonths, contractMonths, paymentSchedule, quote, rentalDays, tierLabel } from "@/lib/pricing";
import { PaymentPlan } from "./payment-plan";
import type {
  Channel,
  Customer,
  CustomerDocument,
  DocRequirement,
  Driver,
  Guarantor,
  Role,
  Tractor,
  Trailer,
  TrailerType,
  Yard,
  YardId,
} from "@/lib/types";
import { DocUploadRow } from "./doc-upload-row";
import { RouteSteps } from "./route-steps";
import { Button, Field, LinkButton, YardShield, buttonClass, cx, inputClass } from "./ui";

const STEPS = ["ลานและช่วงเวลา", "หัวลากและคนขับ", "เอกสารและผู้ค้ำ", "สรุปและยืนยัน"];

export type WizardData = {
  today: string;
  yards: Yard[];
  trailerTypes: TrailerType[];
  trailers: Trailer[];
  customers: Customer[];
  tractors: Tractor[];
  drivers: Driver[];
  guarantors: Guarantor[];
  docRequirements: DocRequirement[];
  customerDocuments: CustomerDocument[];
};

export function BookingWizard({
  data,
  trailerId,
  customerId: initialCustomer,
  initialFrom,
  initialTo,
  initialTyres = false,
  staffRole,
}: {
  data: WizardData;
  trailerId?: string;
  customerId?: string;
  initialFrom?: string;
  initialTo?: string;
  initialTyres?: boolean;
  staffRole?: Extract<Role, "SALES" | "SUPER_ADMIN">;
}) {
  const { trailers, customers, guarantors, yards } = data;
  const getYard = (id: YardId) => yards.find((y) => y.id === id) ?? yards[0];
  const allTractors = data.tractors;
  const allDrivers = data.drivers;
  const requirementsFor = (kind: Customer["kind"]) =>
    data.docRequirements.filter((r) => r.appliesTo === "ALL" || r.appliesTo.includes(kind));
  const docFor = (key: string, ownerId: string): CustomerDocument =>
    data.customerDocuments.find((d) => d.key === key && d.ownerId === ownerId) ?? { key, ownerId, status: "MISSING" };

  const staff = !!staffRole;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [customerId, setCustomerId] = useState(initialCustomer ?? "");
  const [channel, setChannel] = useState<Channel>("PHONE");
  const [tId, setTId] = useState(trailerId ?? trailers.find((t) => t.status === "AVAILABLE")?.id ?? trailers[0]?.id);
  const trailer = trailers.find((t) => t.id === tId)!;
  const [returnYard, setReturnYard] = useState<YardId>(trailer.yard);
  const plusDays = (n: number) => new Date(new Date(`${data.today}T00:00:00Z`).getTime() + n * 864e5).toISOString().slice(0, 10);
  const [pickup, setPickup] = useState(`${initialFrom ?? plusDays(3)}T08:00`);
  // monthly contracts return at the same time of day so the month count is exact
  const [ret, setRet] = useState(() =>
    trailer?.pricing.plan === "MONTHLY_TIERED"
      ? `${initialTo ?? addMonths(`${initialFrom ?? plusDays(3)}T08:00`, 1).slice(0, 10)}T08:00`
      : `${initialTo ?? plusDays(10)}T16:00`,
  );

  const customer = customers.find((c) => c.id === customerId);
  const tractors = allTractors.filter((t) => t.customerId === customerId);
  const drivers = allDrivers.filter((d) => d.customerIds.includes(customerId));
  const guarantor = guarantors.find((g) => g.customerId === customerId);
  const [gName, setGName] = useState<string | null>(null);
  const [gPhone, setGPhone] = useState<string | null>(null);
  const [invoiceName, setInvoiceName] = useState<string | null>(null);
  const [tractorId, setTractorId] = useState("");
  const [driverIds, setDriverIds] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);

  const effTractor = tractorId || tractors[0]?.id || "";
  const effDrivers = driverIds.length ? driverIds : drivers[0] ? [drivers[0].id] : [];

  const days = rentalDays(pickup, ret);
  const tiered = trailer.pricing.plan === "MONTHLY_TIERED";
  const [months, setMonths] = useState(() => contractMonths(pickup, ret));
  const [tyres, setTyres] = useState(initialTyres);
  const tyreCount = tyres && trailer.pricing.tyreFee > 0 ? trailer.pricing.tyreCount : 0;
  const q = useMemo(
    () => quote(trailer.pricing, Math.max(days, 1), tyreCount, tiered && days > 0 ? contractMonths(pickup, ret) : undefined),
    [trailer, days, tyreCount, tiered, pickup, ret],
  );
  const pickupYard = getYard(trailer.yard);
  const rangeOk = days > 0;

  const reqs = customer ? requirementsFor(customer.kind) : [];
  const ownerOf = (owner: string) =>
    owner === "CUSTOMER" ? customerId : owner === "GUARANTOR" ? guarantor?.id ?? "" : owner === "TRACTOR" ? effTractor : effDrivers[0] ?? "";

  const canNext =
    step === 0 ? rangeOk && !!customer : step === 1 ? !!effTractor && effDrivers.length > 0 : step === 3 ? agree : true;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const name = (gName ?? guarantor?.name ?? "").trim();
      if (!guarantor || gName !== null || gPhone !== null) {
        const g = await saveGuarantor({
          customerId,
          name,
          phone: gPhone ?? guarantor?.phone ?? "",
          relation: customer?.kind === "COMPANY" ? "DIRECTOR" : "OTHER",
        });
        if (!g.ok) return setError(g.error);
      }
      const res = await createBooking({
        customerId,
        trailerId: tId,
        tractorId: effTractor,
        driverIds: effDrivers,
        pickupAt: pickup,
        returnAt: ret,
        returnYard,
        channel: staff ? channel : "WEB",
        invoiceName: invoiceName ?? undefined,
        tyreCount,
      });
      if (!res.ok) return setError(res.error);
      setDone(res.data?.no ?? "");
    });
  };

  if (done !== null) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="sign-panel on-sign px-8 py-10 text-center">
          <CircleCheckBig className="mx-auto size-12" aria-hidden />
          <h1 className="mt-4 text-[30px] font-bold">ส่งคำขอจองแล้ว</h1>
          <p className="mt-2 font-route text-[22px] font-extrabold">{done}</p>
          <p className="mx-auto mt-3 max-w-md text-sign-ink">
            {staff
              ? staffRole === "SALES"
                ? "การจองนี้ส่งเข้าคิวให้ Super Admin อนุมัติแล้ว ลูกค้าจะได้รับอีเมลสรุปการจอง"
                : "คุณเป็น Super Admin จึงอนุมัติการจองนี้ได้ทันทีจากหน้าตรวจสอบ"
              : "หางคันนี้ถูกล็อกไว้ให้คุณระหว่างรอตรวจเอกสาร เจ้าหน้าที่จะแจ้งผลภายใน 4 ชั่วโมงทำการ แล้วคุณจึงชำระเงินได้"}
          </p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LinkButton href={staff ? "/admin/bookings" : "/me/bookings"} variant="sign">
            {staff ? "ไปคิวตรวจสอบ" : "ดูสถานะการจอง"}
          </LinkButton>
          <LinkButton href="/trailers" variant="outline">
            ค้นหาหางเพิ่ม
          </LinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <RouteSteps steps={STEPS} current={step} />

        <div className="mt-6 rounded-xl border border-line bg-paper p-5 sm:p-7">
          {step === 0 && (
            <div className="space-y-6">
              {staff && (
                <div className="grid gap-4 rounded-lg bg-sign-wash p-4 sm:grid-cols-2">
                  <Field label="ลูกค้า" hint="ค้นจากชื่อ เบอร์โทร หรือเลขผู้เสียภาษี · ไม่พบให้สร้างบัญชีใหม่">
                    <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass}>
                      <option value="">— เลือกลูกค้า —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.phone}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="ช่องทางที่รับจอง">
                    <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className={inputClass}>
                      {(["PHONE", "LINE", "WALK_IN", "EMAIL"] as Channel[]).map((c) => (
                        <option key={c} value={c}>
                          {channelLabel[c]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="หางที่จอง" className="sm:col-span-2">
                    <select
                      value={tId}
                      onChange={(e) => {
                        setTId(e.target.value);
                        const next = trailers.find((t) => t.id === e.target.value)!;
                        setReturnYard(next.yard);
                        if (next.pricing.plan === "MONTHLY_TIERED") setRet(addMonths(pickup, months));
                      }}
                      className={inputClass}
                    >
                      {trailers
                        .filter((t) => t.status !== "RETIRED" && t.status !== "MAINTENANCE")
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} · {t.model.name} · ลาน{getYard(t.yard).short}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
              )}

              <div>
                <h2 className="text-[19px] font-bold">รับหางที่</h2>
                <div className="mt-3 flex items-center gap-3 rounded-lg border-2 border-sign bg-sign-wash p-4">
                  <YardShield n={pickupYard.number} size={36} />
                  <div>
                    <p className="font-bold">{pickupYard.name}</p>
                    <p className="text-[14px] text-ink-2">
                      {pickupYard.address} · {pickupYard.hours}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="วันและเวลารับหาง">
                  <input
                    type="datetime-local"
                    value={pickup}
                    onChange={(e) => {
                      setPickup(e.target.value);
                      if (tiered) setRet(addMonths(e.target.value, months));
                    }}
                    className={inputClass}
                  />
                </Field>
                {tiered ? (
                  <Field label="ระยะสัญญา (คิดรายเดือน)" hint={`คืนหาง ${thDateTime(ret)}`}>
                    <select
                      value={months}
                      onChange={(e) => {
                        const m = Number(e.target.value);
                        setMonths(m);
                        setRet(addMonths(pickup, m));
                      }}
                      className={inputClass}
                    >
                      {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {m} เดือน{m === 6 || m === 12 ? " · เรทถูกลง" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="วันและเวลาคืนหาง">
                    <input type="datetime-local" value={ret} onChange={(e) => setRet(e.target.value)} className={inputClass} />
                  </Field>
                )}
              </div>
              {trailer.pricing.tyreFee > 0 && (
                <label className="flex items-start gap-3 rounded-lg bg-ground p-4 text-[15px]">
                  <input type="checkbox" checked={tyres} onChange={(e) => setTyres(e.target.checked)} className="mt-1 size-5 accent-[var(--color-grass)]" />
                  <span>
                    ใช้บริการใส่ยาง {trailer.pricing.tyreCount} เส้น ({money(trailer.pricing.tyreFee)}/เส้น)
                    <span className="block text-[13px] text-ink-3">ค่าเช่าไม่รวมยาง นำยางมาลงที่ลานให้ช่างเราใส่ก่อนรับหาง แนะนำให้นำมาลงก่อนวันรับหาง 1 วัน</span>
                  </span>
                </label>
              )}
              {!rangeOk && (
                <p className="flex items-center gap-2 text-[15px] text-danger" role="alert">
                  <AlertTriangle className="size-4" aria-hidden /> วันคืนต้องอยู่หลังวันรับ
                </p>
              )}

              <fieldset>
                <legend className="text-[19px] font-bold">คืนหางที่</legend>
                <p className="text-[14px] text-ink-3">คืนต่างลานได้ ไม่มีค่าใช้จ่ายเพิ่ม</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {yards.map((y) => (
                    <label
                      key={y.id}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4",
                        returnYard === y.id ? "border-sign bg-sign-wash" : "border-line hover:border-line-strong",
                      )}
                    >
                      <input
                        type="radio"
                        name="returnYard"
                        value={y.id}
                        checked={returnYard === y.id}
                        onChange={() => setReturnYard(y.id)}
                        className="size-5 accent-[var(--color-sign)]"
                      />
                      <YardShield n={y.number} size={30} />
                      <span>
                        <span className="block font-bold">ลาน{y.short}</span>
                        <span className="text-[13px] text-ink-3">{y.id === trailer.yard ? "ลานเดียวกับที่รับ" : "คืนต่างลาน ฟรี"}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-7">
              <fieldset>
                <legend className="text-[19px] font-bold">หัวลากที่จะใช้ลาก</legend>
                <p className="text-[14px] text-ink-3">ทะเบียนต้องตรงกับหัวลากที่มารับหางที่ลาน</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {tractors.map((t) => (
                    <label
                      key={t.id}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4",
                        effTractor === t.id ? "border-sign bg-sign-wash" : "border-line hover:border-line-strong",
                      )}
                    >
                      <input type="radio" name="tractor" checked={effTractor === t.id} onChange={() => setTractorId(t.id)} className="size-5 accent-[var(--color-sign)]" />
                      <span>
                        <span className="block font-route text-[17px] font-extrabold">{t.plate}</span>
                        <span className="text-[14px] text-ink-2">{t.brand} · {t.kind}</span>
                      </span>
                    </label>
                  ))}
                  <Link href="/me/tractors" className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong p-4 font-semibold text-grass hover:border-sign">
                    <Plus className="size-4" aria-hidden /> เพิ่มหัวลาก
                  </Link>
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-[19px] font-bold">คนขับที่จะมารับ–คืนหาง</legend>
                <p className="text-[14px] text-ink-3">เลือกได้มากกว่า 1 คน คนขับจะได้รับ QR สำหรับเช็กอินที่ลาน</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {drivers.map((d) => {
                    const on = effDrivers.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={cx("flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4", on ? "border-sign bg-sign-wash" : "border-line hover:border-line-strong")}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setDriverIds(on ? effDrivers.filter((x) => x !== d.id) : [...effDrivers, d.id])}
                          className="size-5 accent-[var(--color-sign)]"
                        />
                        <span>
                          <span className="block font-bold">{d.name}</span>
                          <span className="text-[14px] text-ink-2">ใบขับขี่ {d.licenseClass} · {d.phone}</span>
                        </span>
                      </label>
                    );
                  })}
                  <Link href="/me/drivers" className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong p-4 font-semibold text-grass hover:border-sign">
                    <Plus className="size-4" aria-hidden /> เพิ่มคนขับ
                  </Link>
                </div>
              </fieldset>
            </div>
          )}

          {step === 2 && customer && (
            <div className="space-y-7">
              <section>
                <h2 className="text-[19px] font-bold">ผู้ค้ำประกัน</h2>
                <p className="text-[14px] text-ink-3">
                  {customer.kind === "COMPANY" ? "นิติบุคคล: กรรมการบริษัทเป็นผู้ค้ำประกัน" : "บุคคลธรรมดา: ผู้ค้ำประกันต้องเป็นบุคคลอื่น"}
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="ชื่อ–นามสกุล">
                    <input value={gName ?? guarantor?.name ?? ""} onChange={(e) => setGName(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="เบอร์โทร">
                    <input value={gPhone ?? guarantor?.phone ?? ""} onChange={(e) => setGPhone(e.target.value)} inputMode="tel" className={inputClass} />
                  </Field>
                </div>
              </section>
              <section>
                <h2 className="text-[19px] font-bold">เอกสารประกอบสัญญา</h2>
                <p className="text-[14px] text-ink-3">ไฟล์ JPG, PNG หรือ PDF ไม่เกิน 10 MB · เอกสารที่ผ่านแล้วใช้ซ้ำได้อัตโนมัติ</p>
                <ul className="mt-2 divide-y divide-line">
                  {reqs.map((r) => (
                    <DocUploadRow key={r.key} req={r} doc={docFor(r.key, ownerOf(r.owner))} customerId={customerId} />
                  ))}
                </ul>
              </section>
            </div>
          )}

          {step === 3 && customer && (
            <div className="space-y-6">
              <h2 className="text-[19px] font-bold">ตรวจสอบก่อนส่งคำขอ</h2>
              <dl className="grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-[max-content_1fr]">
                <dt className="text-ink-3">ผู้เช่า</dt>
                <dd className="font-medium">{customer.name}</dd>
                <dt className="text-ink-3">หาง</dt>
                <dd className="font-medium">{trailer.code} · {trailer.model.name}</dd>
                <dt className="text-ink-3">รับ</dt>
                <dd className="font-medium">{thDateTime(pickup)} · ลาน{pickupYard.short}</dd>
                <dt className="text-ink-3">คืน</dt>
                <dd className="font-medium">{thDateTime(ret)} · ลาน{getYard(returnYard).short}</dd>
                <dt className="text-ink-3">หัวลาก</dt>
                <dd className="font-medium">{allTractors.find((t) => t.id === effTractor)?.plate}</dd>
                <dt className="text-ink-3">คนขับ</dt>
                <dd className="font-medium">{effDrivers.map((id) => allDrivers.find((d) => d.id === id)?.name).join(", ")}</dd>
                {staff && (
                  <>
                    <dt className="text-ink-3">ช่องทาง</dt>
                    <dd className="font-medium">{channelLabel[channel]}</dd>
                  </>
                )}
              </dl>
              <Field label="ออกใบกำกับภาษีในนาม">
                <input value={invoiceName ?? customer.name} onChange={(e) => setInvoiceName(e.target.value)} className={inputClass} />
                <span className="mt-1 block text-[13px] text-ink-3">เลขผู้เสียภาษี {customer.taxId}</span>
              </Field>
              <div className="rounded-lg bg-ground p-4 text-[14px] leading-relaxed text-ink-2">
                <p className="font-semibold text-ink">เงื่อนไขการยกเลิกและคืนก่อนกำหนด</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  <li>ยกเลิกก่อนวันรับหาง: หักค่าธรรมเนียมยกเลิก คืนส่วนที่เหลือและเงินค้ำประกันเต็มจำนวน</li>
                  <li>คืนหางก่อนกำหนด: คิดค่าเช่าใหม่ตามจำนวนวันที่เช่าจริงและเรทที่ตรงกับระยะนั้น</li>
                  <li>ชำระเงินได้หลังเจ้าหน้าที่อนุมัติ ภายใน 24 ชั่วโมง ไม่เช่นนั้นการจองหมดเวลา</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 text-[15px]">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 size-5 accent-[var(--color-sign)]" />
                {staff ? "ลูกค้ารับทราบเงื่อนไขการเช่าทางช่องทางที่ติดต่อแล้ว" : "ฉันอ่านและยอมรับเงื่อนไขการเช่า"}
              </label>
              {staffRole === "SALES" && (
                <p className="rounded-lg bg-reflect-tint px-4 py-3 text-[14px] text-sign-deep">
                  การจองที่ Sales สร้างแทนลูกค้าต้องให้ Super Admin เป็นผู้อนุมัติ
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-6 flex items-start gap-2 rounded-lg bg-danger-tint px-4 py-3 text-[15px] font-semibold text-danger" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
            {step > 0 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="size-4" aria-hidden /> ย้อนกลับ
              </Button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="sign" disabled={!canNext} onClick={() => setStep(step + 1)}>
                ถัดไป: {STEPS[step + 1]} <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <button type="button" disabled={!canNext || pending} onClick={submit} className={buttonClass("primary", "lg")}>
                {pending ? "กำลังส่ง…" : "ส่งคำขอจอง"}
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border-2 border-sign bg-paper p-5">
          <p className="flex items-center gap-2 text-[18px] font-bold">
            <YardShield n={pickupYard.number} size={22} />
            <span className="font-route font-extrabold">{trailer.code}</span>
            {trailer.model.name}
          </p>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-[15px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">
                {rangeOk ? `${tiered ? `${q.months} เดือน` : `${days} วัน`} · ${tierLabel[q.tier]}` : "เลือกช่วงวัน"}
              </dt>
              <dd className="tabular font-semibold">{rangeOk ? money(q.rental) : "—"}</dd>
            </div>
            {q.tyreFee > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2">ค่าบริการใส่ยาง {tyreCount} เส้น</dt>
                <dd className="tabular font-semibold">{money(q.tyreFee)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">VAT 7%</dt>
              <dd className="tabular font-semibold">{rangeOk ? money(q.vat) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-2">เงินค้ำประกัน (ได้คืน)</dt>
              <dd className="tabular font-semibold">{money(q.deposit)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <dt className="font-bold">ค่าใช้จ่ายรวมทั้งสัญญา</dt>
              <dd className="font-route text-[20px] font-extrabold tabular text-ink">{rangeOk ? money(q.total) : "—"}</dd>
            </div>
          </dl>
          {rangeOk && (
            <div className="mt-4 border-t border-line pt-4">
              <PaymentPlan plan={paymentSchedule(q, pickup)} showLater={false} />
            </div>
          )}
          <p className="mt-3 text-[12px] text-ink-3">ราคาคำนวณจากเรทตามระยะเช่า ไม่มีการปรับส่วนลด · ชำระหลังเจ้าหน้าที่อนุมัติการจอง</p>
        </div>
      </aside>
    </div>
  );
}
