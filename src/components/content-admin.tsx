"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  saveCompany,
  saveExtraServices,
  saveFestivalTheme,
  updateDocRequirement,
  updateModel,
  updateTrailer,
  updateYard,
  type ModelInput,
} from "@/app/actions/content";
import type { ActionResult } from "@/app/actions/result";
import type { Company } from "@/lib/company";
import { festivals } from "@/lib/festivals";
import { extraServiceIconLabel, extraServiceIcons, type ExtraService, type ExtraServiceIcon } from "@/lib/extra-services";
import { Button, Field, cx, inputClass } from "./ui";

/* Super Admin inline editors. Each opens from a small "แก้ไข" button and saves through app/actions/content.ts. */

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: res.message ?? "บันทึกแล้ว" } : { ok: false, text: res.error });
      if (res.ok) {
        router.refresh();
        after?.();
      }
    });
  const note = msg && (
    <p className={cx("text-[14px] font-semibold", msg.ok ? "text-grass" : "text-danger")} role={msg.ok ? "status" : "alert"}>
      {msg.text}
    </p>
  );
  return { pending, run, note };
}

function Editor({ label = "แก้ไข", children }: { label?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[13px] font-semibold text-grass underline underline-offset-2"
      >
        <Pencil className="size-3.5" aria-hidden /> {label}
      </button>
    );
  return <div className="mt-3 rounded-lg border-2 border-sign bg-sign-wash p-4">{children(() => setOpen(false))}</div>;
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const n = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").replace(/[^\d.]/g, "");
  return v === "" ? null : Number(v);
};

function Actions({ pending, close, note }: { pending: boolean; close: () => void; note: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" variant="sign" disabled={pending}>บันทึก</Button>
      <Button type="button" size="sm" variant="outline" onClick={close}>ปิด</Button>
      {note}
    </div>
  );
}

// ---------------------------------------------------------------- trailer models (price + spec)

export type ModelRow = ModelInput & { code: string; rate_plan: "MONTHLY_TIERED" | "DAILY_MONTHLY" };

export function ModelEditor({ model: m }: { model: ModelRow }) {
  const { pending, run, note } = useSave();
  const tiered = m.rate_plan === "MONTHLY_TIERED";
  const num = (name: keyof ModelInput, label: string) => (
    <Field label={label}>
      <input name={name} defaultValue={(m[name] as number | null) ?? ""} inputMode="decimal" className={cx(inputClass, "h-10 tabular")} />
    </Field>
  );
  return (
    <Editor label="แก้ไขราคา / สเปก">
      {(close) => (
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() =>
              updateModel(m.code, {
                name: s(f, "name"),
                axles: n(f, "axles") ?? m.axles,
                length_ft: n(f, "length_ft"),
                width_m: n(f, "width_m"),
                length_m: n(f, "length_m"),
                deck_length: s(f, "deck_length") || null,
                deck_height_m: n(f, "deck_height_m"),
                daily_rate: tiered ? null : n(f, "daily_rate"),
                weekly_rate: tiered ? null : n(f, "weekly_rate"),
                monthly_rate: tiered ? null : n(f, "monthly_rate"),
                monthly_rate_1_5: tiered ? n(f, "monthly_rate_1_5") : null,
                monthly_rate_6_11: tiered ? n(f, "monthly_rate_6_11") : null,
                monthly_rate_12: tiered ? n(f, "monthly_rate_12") : null,
                deposit: n(f, "deposit") ?? m.deposit,
                tyre_fee: n(f, "tyre_fee") ?? 0,
                tyre_count: n(f, "tyre_count") ?? 0,
                description: s(f, "description") || null,
              }),
            close,
            );
          }}
        >
          <Field label="ชื่อรุ่น">
            <input name="name" defaultValue={m.name} required className={cx(inputClass, "h-10")} />
          </Field>
          <p className="mb-2 mt-4 text-[13px] font-bold text-ink-2">ราคา (บาท ไม่รวม VAT)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiered ? (
              <>
                {num("monthly_rate_1_5", "สัญญา 1–5 เดือน /เดือน")}
                {num("monthly_rate_6_11", "สัญญา 6–11 เดือน /เดือน")}
                {num("monthly_rate_12", "สัญญา 12 เดือนขึ้นไป /เดือน")}
              </>
            ) : (
              <>
                {num("daily_rate", "รายวัน")}
                {num("weekly_rate", "รายสัปดาห์")}
                {num("monthly_rate", "รายเดือน")}
              </>
            )}
            {num("deposit", "เงินค้ำประกัน /หาง")}
            {num("tyre_fee", "ค่าใส่ยาง /เส้น (0 = ไม่มี)")}
            {num("tyre_count", "จำนวนยาง (เส้น)")}
          </div>
          <p className="mb-2 mt-4 text-[13px] font-bold text-ink-2">สเปก</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {num("axles", "จำนวนเพลา")}
            {num("length_ft", "ความยาว (ฟุต)")}
            {num("width_m", "ความกว้าง (ม.)")}
            {num("length_m", "ความยาวหาง (ม.)")}
            <Field label="พื้นที่ใช้งาน (ม.)">
              <input name="deck_length" defaultValue={m.deck_length ?? ""} className={cx(inputClass, "h-10")} />
            </Field>
            {num("deck_height_m", "ความสูงพื้น (ม.)")}
          </div>
          <Field label="หมายเหตุ" className="mt-3">
            <input name="description" defaultValue={m.description ?? ""} className={cx(inputClass, "h-10")} />
          </Field>
          <Actions pending={pending} close={close} note={note} />
        </form>
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------- one trailer

export function TrailerEditor({
  trailer: t,
  models,
}: {
  trailer: { id: string; code: string; plate: string; model: string; description: string; published: boolean; retired: boolean };
  models: { code: string; name: string }[];
}) {
  const { pending, run, note } = useSave();
  return (
    <Editor>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                updateTrailer(t.id, {
                  code: s(f, "code"),
                  plate: s(f, "plate"),
                  model: s(f, "model"),
                  description: s(f, "description"),
                  published: f.get("published") === "on",
                  retired: f.get("retired") === "on",
                }),
              close,
            );
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="รหัส"><input name="code" defaultValue={t.code} required className={cx(inputClass, "h-10")} /></Field>
            <Field label="ทะเบียน"><input name="plate" defaultValue={t.plate} required className={cx(inputClass, "h-10")} /></Field>
          </div>
          <Field label="รุ่น" className="mt-3">
            <select name="model" defaultValue={t.model} className={cx(inputClass, "h-10")}>
              {models.map((m) => (
                <option key={m.code} value={m.code}>{m.name}</option>
              ))}
            </select>
          </Field>
          <Field label="หมายเหตุ" className="mt-3">
            <input name="description" defaultValue={t.description} className={cx(inputClass, "h-10")} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-5 text-[14px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="published" defaultChecked={t.published} className="size-4 accent-[var(--color-grass)]" />
              แสดงบนเว็บไซต์
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="retired" defaultChecked={t.retired} className="size-4 accent-[var(--color-grass)]" />
              ปลดระวาง (เลิกให้เช่า)
            </label>
          </div>
          <Actions pending={pending} close={close} note={note} />
        </form>
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------- yard

export function YardEditor({
  yard: y,
}: {
  yard: { id: string; name: string; short: string; address: string; hours: string; note: string; mapUrl: string };
}) {
  const { pending, run, note } = useSave();
  return (
    <Editor>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                updateYard(y.id, {
                  name: s(f, "name"),
                  short: s(f, "short"),
                  address: s(f, "address"),
                  hours: s(f, "hours"),
                  note: s(f, "note"),
                  mapUrl: s(f, "mapUrl"),
                }),
              close,
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อลาน"><input name="name" defaultValue={y.name} required className={cx(inputClass, "h-10")} /></Field>
            <Field label="ชื่อสั้น"><input name="short" defaultValue={y.short} required className={cx(inputClass, "h-10")} /></Field>
            <Field label="ที่อยู่" className="sm:col-span-2"><input name="address" defaultValue={y.address} className={cx(inputClass, "h-10")} /></Field>
            <Field label="เวลาเปิด"><input name="hours" defaultValue={y.hours} className={cx(inputClass, "h-10")} /></Field>
            <Field label="ลิงก์ Google Maps"><input name="mapUrl" defaultValue={y.mapUrl} className={cx(inputClass, "h-10")} /></Field>
            <Field label="หมายเหตุ" className="sm:col-span-2"><input name="note" defaultValue={y.note} className={cx(inputClass, "h-10")} /></Field>
          </div>
          <Actions pending={pending} close={close} note={note} />
        </form>
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------- document requirement

export function DocRequirementEditor({ req }: { req: { key: string; label: string; rule?: string; required: boolean } }) {
  const { pending, run, note } = useSave();
  return (
    <Editor>
      {(close) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () => updateDocRequirement(req.key, { label: s(f, "label"), rule: s(f, "rule"), required: f.get("required") === "on" }),
              close,
            );
          }}
        >
          <Field label="ชื่อเอกสาร"><input name="label" defaultValue={req.label} required className={cx(inputClass, "h-10")} /></Field>
          <Field label="ข้อกำหนด" className="mt-3"><input name="rule" defaultValue={req.rule ?? ""} className={cx(inputClass, "h-10")} /></Field>
          <label className="mt-3 flex items-center gap-2 text-[14px]">
            <input type="checkbox" name="required" defaultChecked={req.required} className="size-4 accent-[var(--color-grass)]" />
            ต้องมีก่อนอนุมัติการจอง
          </label>
          <Actions pending={pending} close={close} note={note} />
        </form>
      )}
    </Editor>
  );
}

// ---------------------------------------------------------------- company

const companyFields: [keyof Company, string, boolean?][] = [
  ["nameTh", "ชื่อบริษัท (ไทย)"],
  ["nameEn", "ชื่อบริษัท (อังกฤษ)"],
  ["taxId", "เลขประจำตัวผู้เสียภาษี"],
  ["phone", "เบอร์โทร"],
  ["email", "อีเมล"],
  ["facebook", "ชื่อเพจ Facebook"],
  ["facebookUrl", "ลิงก์ Facebook"],
  ["addressTh", "ที่อยู่ (ไทย)"],
  ["addressEn", "ที่อยู่ (อังกฤษ)"],
  ["profileTh", "Company profile (ไทย)", true],
  ["profileEn", "Company profile (อังกฤษ)", true],
];

export function CompanyForm({ company }: { company: Company }) {
  const { pending, run, note } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => saveCompany(Object.fromEntries(companyFields.map(([k]) => [k, s(f, k)]))));
      }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {companyFields.map(([k, label, long]) => (
        <Field key={k} label={label} className={long || k.startsWith("address") ? "sm:col-span-2" : undefined}>
          {long ? (
            <textarea name={k} defaultValue={company[k]} rows={4} className={cx(inputClass, "h-auto py-3")} />
          ) : (
            <input name={k} defaultValue={company[k]} className={inputClass} />
          )}
        </Field>
      ))}
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="sign" disabled={pending}>บันทึกข้อมูลบริษัท</Button>
        {note}
      </div>
    </form>
  );
}

const blankService = (): ExtraService => ({
  id: `s${Date.now().toString(36)}`,
  icon: "other",
  th: "",
  en: "",
  priceTh: "",
  priceEn: "",
  noteTh: "",
  noteEn: "",
});

/** Super Admin: add, edit and remove the paid extra services, then save the whole list at once. */
export function ExtraServicesEditor({ services }: { services: ExtraService[] }) {
  const { pending, run, note } = useSave();
  const [rows, setRows] = useState<ExtraService[]>(services);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const set = (id: string, patch: Partial<ExtraService>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const field = (row: ExtraService, key: keyof ExtraService, label: string, required = false) => (
    <Field label={label}>
      <input
        value={row[key]}
        required={required}
        onChange={(e) => set(row.id, { [key]: e.target.value })}
        className={cx(inputClass, "h-10")}
      />
    </Field>
  );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveExtraServices(rows));
      }}
    >
      <ul className="divide-y divide-line">
        {rows.map((row, i) => (
          <li key={row.id} className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{row.th || `บริการใหม่ ${i + 1}`}</span>
              {confirmId === row.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-[13px] text-ink-2">ลบบริการนี้?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setRows((r) => r.filter((x) => x.id !== row.id));
                      setConfirmId(null);
                    }}
                  >
                    ลบ
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmId(null)}>ยกเลิก</Button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(row.id)}
                  className="flex items-center gap-1 text-[13px] font-semibold text-danger underline"
                >
                  <Trash2 className="size-4" aria-hidden /> ลบ
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {field(row, "th", "ชื่อบริการ (ไทย)", true)}
              {field(row, "en", "ชื่อบริการ (อังกฤษ)")}
              {field(row, "priceTh", "ราคา (ไทย) เช่น 500 บาท/คัน", true)}
              {field(row, "priceEn", "ราคา (อังกฤษ) เช่น THB 500 per unit")}
              {field(row, "noteTh", "หมายเหตุ (ไทย)")}
              {field(row, "noteEn", "หมายเหตุ (อังกฤษ)")}
              <Field label="ไอคอน">
                <select
                  value={row.icon}
                  onChange={(e) => set(row.id, { icon: e.target.value as ExtraServiceIcon })}
                  className={cx(inputClass, "h-10")}
                >
                  {extraServiceIcons.map((k) => (
                    <option key={k} value={k}>{extraServiceIconLabel[k]}</option>
                  ))}
                </select>
              </Field>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-4 text-[14px] text-ink-3">ยังไม่มีบริการเสริม · หน้าเว็บจะซ่อนหัวข้อนี้</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setRows((r) => [...r, blankService()])}>
          <Plus className="size-4" aria-hidden /> เพิ่มบริการ
        </Button>
        <Button type="submit" size="sm" variant="sign" disabled={pending}>บันทึกบริการเสริม</Button>
        {note}
      </div>
    </form>
  );
}

/** Super Admin: festival theme — automatic by month, off, or one festival forced (e.g. to preview it). */
export function FestivalThemeForm({ value }: { value: string }) {
  const { pending, run, note } = useSave();
  const [v, setV] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveFestivalTheme(v));
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <Field label="ธีมหน้าเว็บ" className="min-w-64 flex-1">
        <select value={v} onChange={(e) => setV(e.target.value)} className={inputClass}>
          <option value="auto">อัตโนมัติ — เปลี่ยนตามเดือน</option>
          <option value="off">ปิดธีมเทศกาล</option>
          {festivals.map((f) => (
            <option key={f.id} value={f.id}>ใช้ธีม {f.th} ตลอด (เดือน {f.month})</option>
          ))}
        </select>
      </Field>
      <Button type="submit" variant="sign" disabled={pending}>บันทึก</Button>
      {note}
    </form>
  );
}
