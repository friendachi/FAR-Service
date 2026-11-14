"use client";

import { useState, useTransition } from "react";
import { CircleCheckBig, Plus, Trash2 } from "lucide-react";
import { submitQuoteRequest } from "@/app/actions/quotes";
import { T } from "./t";
import { Button, Field, cx, inputClass } from "./ui";

type Option = { id: string; label: string; type: string };
type Item = { key: number; model: string; qty: number };

/** Request-a-quotation form: what trailers, how many, for how long, and how to reach the customer. */
export function QuoteForm({
  options,
  yards,
  initial,
}: {
  options: Option[];
  yards: { id: string; label: string }[];
  initial: { model?: string; months?: number; tyres?: boolean; note?: string };
}) {
  const [kind, setKind] = useState<"COMPANY" | "PERSON">("COMPANY");
  const [items, setItems] = useState<Item[]>([{ key: 1, model: initial.model ?? "", qty: 1 }]);
  const [tyres, setTyres] = useState(!!initial.tyres);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const needsTyres = items.some((i) => ["FLATBED", "SKELETAL"].includes(options.find((o) => o.id === i.model)?.type ?? ""));

  if (msg?.ok)
    return (
      <div className="rounded-xl border-2 border-sign bg-sign-wash p-8 text-center" role="status">
        <CircleCheckBig className="mx-auto size-12 text-grass" aria-hidden />
        <p className="mt-3 text-[20px] font-bold text-ink">{msg.text.split(" · ")[0]}</p>
        <p className="mt-1 text-ink-2">{msg.text.split(" · ")[1]}</p>
      </div>
    );

  const set = (key: number, patch: Partial<Item>) => setItems((r) => r.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "");
        start(async () => {
          const res = await submitQuoteRequest({
            company: kind === "COMPANY" ? s("company") : "",
            contactName: s("contact"),
            phone: s("phone"),
            email: s("email"),
            lineId: s("line"),
            customerKind: kind,
            items: items
              .filter((i) => i.model)
              .map((i) => ({ model: i.model, label: options.find((o) => o.id === i.model)?.label ?? i.model, qty: i.qty })),
            startDate: s("start"),
            months: Number(s("months")),
            yard: s("yard"),
            tyreService: needsTyres && tyres,
            note: s("note"),
          });
          setMsg(res.ok ? { ok: true, text: res.message ?? "ส่งคำขอแล้ว" } : { ok: false, text: res.error });
        });
      }}
    >
      <fieldset className="space-y-4 rounded-xl border border-line bg-paper p-5 sm:p-6">
        <legend className="px-1 text-[18px] font-bold"><T th="1. หางที่ต้องการ" en="1. Trailers you need" /></legend>
        {items.map((it, idx) => (
          <div key={it.key} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
            <Field label={<T th={`รุ่นหาง ${items.length > 1 ? idx + 1 : ""}`} en={`Trailer model ${items.length > 1 ? idx + 1 : ""}`} />}>
              <select value={it.model} required onChange={(e) => set(it.key, { model: e.target.value })} className={inputClass}>
                <option value="">เลือกรุ่นหาง · Choose a model</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label={<T th="จำนวน (คัน)" en="Quantity" />}>
              <input
                type="number"
                min={1}
                max={99}
                value={it.qty}
                onChange={(e) => set(it.key, { qty: Number(e.target.value) })}
                className={cx(inputClass, "tabular")}
              />
            </Field>
            {items.length > 1 ? (
              <button
                type="button"
                onClick={() => setItems((r) => r.filter((i) => i.key !== it.key))}
                aria-label="ลบรายการ · Remove"
                className="flex h-12 items-center justify-center gap-1 rounded-lg px-3 text-[14px] font-semibold text-danger hover:bg-danger-tint"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}
          </div>
        ))}
        {items.length < 6 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setItems((r) => [...r, { key: Date.now(), model: "", qty: 1 }])}>
            <Plus className="size-4" aria-hidden /> <T th="เพิ่มรุ่นหาง" en="Add another model" />
          </Button>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={<T th="วันที่ต้องการเริ่มเช่า" en="Start date" />}>
            <input name="start" type="date" className={inputClass} />
          </Field>
          <Field label={<T th="ระยะเวลาเช่า (เดือน)" en="Rental length (months)" />}>
            <input name="months" type="number" min={1} max={120} defaultValue={initial.months ?? ""} placeholder="เช่น 6" className={cx(inputClass, "tabular")} />
          </Field>
          <Field label={<T th="ลานที่สะดวกรับหาง" en="Preferred yard" />}>
            <select name="yard" defaultValue="" className={inputClass}>
              <option value="">ลานใดก็ได้</option>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>{y.label}</option>
              ))}
            </select>
          </Field>
        </div>
        {needsTyres && (
          <label className="flex items-start gap-3 rounded-lg bg-ground p-3 text-[15px]">
            <input type="checkbox" checked={tyres} onChange={(e) => setTyres(e.target.checked)} className="mt-1 size-5 accent-[var(--color-grass)]" />
            <span>
              <T th="ต้องการบริการใส่/ถอดยาง" en="I need tire fitting and removal" />
              <span className="block text-[13px] text-ink-3">
                <T
                  th="หางพื้นเรียบและหางก้างปลาไม่รวมยาง ผู้เช่านำยางมาเอง บริษัทฯ ใส่ให้วันรับมอบและถอดวันส่งคืน (มีค่าบริการ)"
                  en="Flatbed and chassis trailers come without tires; bring yours and we fit them at handover and remove them at return (service fee)."
                />
              </span>
            </span>
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-line bg-paper p-5 sm:p-6">
        <legend className="px-1 text-[18px] font-bold"><T th="2. ข้อมูลติดต่อ" en="2. Your details" /></legend>
        <div className="grid grid-cols-2 rounded-lg border-2 border-sign p-0.5 sm:max-w-sm" role="radiogroup" aria-label="ประเภทผู้เช่า">
          {(
            [
              ["COMPANY", "นิติบุคคล", "Company"],
              ["PERSON", "บุคคลธรรมดา", "Individual"],
            ] as const
          ).map(([id, th, en]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={kind === id}
              onClick={() => setKind(id)}
              className={cx("h-10 rounded-md text-[15px] font-semibold", kind === id ? "bg-sign text-on-sign" : "text-grass hover:bg-sign-wash")}
            >
              <T th={th} en={en} />
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "COMPANY" && (
            <Field label={<T th="ชื่อบริษัท" en="Company name" />} className="sm:col-span-2">
              <input name="company" required className={inputClass} autoComplete="organization" />
            </Field>
          )}
          <Field label={<T th="ชื่อผู้ติดต่อ" en="Contact name" />}>
            <input name="contact" required className={inputClass} autoComplete="name" />
          </Field>
          <Field label={<T th="เบอร์โทร" en="Phone" />}>
            <input name="phone" required inputMode="tel" className={inputClass} autoComplete="tel" />
          </Field>
          <Field label={<T th="อีเมล (ถ้ามี)" en="Email (optional)" />} hint={<T th="สำหรับรับใบเสนอราคาเป็นไฟล์" en="To receive the quotation as a file" />}>
            <input name="email" type="email" className={inputClass} autoComplete="email" />
          </Field>
          <Field label={<T th="LINE ID (ถ้ามี)" en="LINE ID (optional)" />}>
            <input name="line" className={inputClass} />
          </Field>
          <Field label={<T th="รายละเอียดเพิ่มเติม" en="Anything else" />} className="sm:col-span-2">
            <textarea
              name="note"
              rows={3}
              defaultValue={initial.note}
              placeholder="เช่น ลักษณะสินค้าที่บรรทุก เส้นทาง หรือคำถามอื่น ๆ"
              className={cx(inputClass, "h-auto py-3")}
            />
          </Field>
        </div>
      </fieldset>

      {msg && !msg.ok && <p className="font-semibold text-danger" role="alert">{msg.text}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="w-full sm:w-auto">
          {pending ? <T th="กำลังส่ง…" en="Sending…" /> : <T th="ส่งคำขอใบเสนอราคา" en="Request a quotation" />}
        </Button>
        <p className="text-[14px] text-ink-3">
          <T th="ไม่มีค่าใช้จ่าย · เจ้าหน้าที่ติดต่อกลับโดยเร็ว" en="Free · we reply as soon as we can" />
        </p>
      </div>
    </form>
  );
}
