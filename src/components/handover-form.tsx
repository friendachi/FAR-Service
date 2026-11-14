"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, Camera, Check, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { saveHandover } from "@/app/actions/handovers";
import { DOC_BUCKET, handoverItems, photoSlots, type HandoverDetails, type PhotoMap, type PhotoSlot } from "@/lib/handover";
import { shrink } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { SlotGuide } from "./handover-guides";
import { SignaturePad } from "./signature-pad";
import { Button, Field, cx, inputClass } from "./ui";

/** A contract that is out with a customer now (for returns, and to link a hand-over to an existing row). */
export type ActiveRental = {
  id: string;
  plate: string;
  customerName: string;
  phone: string | null;
  trailerKind: string | null;
  customerKind: "PERSON" | "COMPANY";
  rent: number;
  term: number | null;
  payDay: number | null;
};
export type TrailerInfo = { code: string; kindCode: string; type: string; model: string; vin: string | null; axles: number | null };
type Terms = { customerKind: "PERSON" | "COMPANY"; trailerKind: string; rent: string; term: string; payDay: string };

const KIND_OPTIONS = ["SF3", "SF2", "SC3", "SC2", "LB3", "LB2"];

const textarea = cx(inputClass, "h-auto py-2.5");

/* ---------------------------------------------------------------- photos */

type Uploaded = { path: string; preview: string };

/**
 * The 14 guided photos. Each slot shows its example drawing until a photo is added; photos are shrunk in the
 * browser and uploaded straight away to vehicle-docs/{folder}/.
 */
export function PhotoGrid({
  folder,
  value,
  onChange,
}: {
  folder: string;
  value: Partial<Record<PhotoSlot, Uploaded[]>>;
  onChange: (fn: (v: Partial<Record<PhotoSlot, Uploaded[]>>) => Partial<Record<PhotoSlot, Uploaded[]>>) => void;
}) {
  const [busy, setBusy] = useState<PhotoSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<PhotoSlot, HTMLInputElement | null>>>({});
  const done = photoSlots.filter((s) => value[s.id]?.length).length;

  const add = async (slot: PhotoSlot, files: FileList | null) => {
    if (!files?.length) return;
    setBusy(slot);
    setError(null);
    try {
      const sb = createClient();
      const added: Uploaded[] = [];
      for (const f of Array.from(files).slice(0, 6)) {
        const blob = await shrink(f);
        const path = `${folder}/${slot.toLowerCase()}-${crypto.randomUUID()}.jpg`;
        const { error: e } = await sb.storage.from(DOC_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (e) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${e.message}`);
        added.push({ path, preview: URL.createObjectURL(blob) });
      }
      onChange((v) => ({ ...v, [slot]: [...(v[slot] ?? []), ...added] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(null);
      const el = inputs.current[slot];
      if (el) el.value = "";
    }
  };

  const remove = async (slot: PhotoSlot, path: string) => {
    onChange((v) => ({ ...v, [slot]: (v[slot] ?? []).filter((p) => p.path !== path) }));
    await createClient().storage.from(DOC_BUCKET).remove([path]);
  };

  return (
    <div>
      <p className="mb-3 text-[14px] text-ink-2">
        ถ่ายให้ได้มุมเดียวกับภาพตัวอย่างในแต่ละช่อง ·{" "}
        <b className={done === photoSlots.length ? "text-grass" : "text-ink"}>
          ครบ {done}/{photoSlots.length} รูป
        </b>
      </p>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-danger-tint px-4 py-2 text-[14px] font-semibold text-danger">
          {error}
        </p>
      )}
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {photoSlots.map((s, i) => {
          const list = value[s.id] ?? [];
          return (
            <li key={s.id} className={cx("flex flex-col overflow-hidden rounded-xl border-2 bg-paper", list.length ? "border-sign" : "border-line")}>
              <div className="relative aspect-[8/5] bg-ground">
                {list.length ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={list[0].preview} alt={s.label} className="size-full object-cover" />
                ) : (
                  <SlotGuide slot={s.id} className="size-full" />
                )}
                <span className="absolute left-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-sign-deep text-[12px] font-bold text-white">
                  {list.length ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                {list.length > 1 && (
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-ink/75 px-2 text-[12px] font-semibold text-white">+{list.length - 1}</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2">
                <p className="text-[13px] font-bold leading-tight">
                  {i + 1}. {s.label}
                </p>
                {list.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {list.map((p, k) => (
                      <button
                        key={p.path}
                        type="button"
                        onClick={() => confirm(`ลบรูป ${s.label} รูปที่ ${k + 1}?`) && remove(s.id, p.path)}
                        className="group relative size-9 overflow-hidden rounded border border-line"
                        aria-label={`ลบรูป ${s.label} รูปที่ ${k + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.preview} alt="" className="size-full object-cover" />
                        <span className="absolute inset-0 hidden items-center justify-center bg-danger/70 text-white group-hover:flex">
                          <Trash2 className="size-3.5" aria-hidden />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  ref={(el) => {
                    inputs.current[s.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => add(s.id, e.target.files)}
                />
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => inputs.current[s.id]?.click()}
                  className={cx(
                    "mt-auto flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-[13px] font-semibold disabled:opacity-50",
                    list.length ? "border-line text-ink-2 hover:border-sign" : "border-sign bg-sign-wash text-grass hover:bg-sign hover:text-on-sign",
                  )}
                >
                  {busy === s.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : list.length ? (
                    <ImagePlus className="size-4" aria-hidden />
                  ) : (
                    <Camera className="size-4" aria-hidden />
                  )}
                  {busy === s.id ? "กำลังอัปโหลด…" : list.length ? "เพิ่มรูป" : "ถ่าย / เลือกรูป"}
                </button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const toPhotoMap = (v: Partial<Record<PhotoSlot, Uploaded[]>>): PhotoMap =>
  Object.fromEntries(Object.entries(v).map(([k, list]) => [k, list!.map((p) => p.path)]));

/* ---------------------------------------------------------------- signatures */

export type SignHandle = { signed: boolean; export: React.RefObject<(() => Promise<Blob | null>) | null> };

export function SignBox({
  title,
  name,
  onName,
  date,
  onDate,
  onSigned,
  exportRef,
}: {
  title: string;
  name: string;
  onName: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
  onSigned: (v: boolean) => void;
  exportRef: React.RefObject<(() => Promise<Blob | null>) | null>;
}) {
  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="mb-2 text-[16px] font-bold">{title}</p>
      <SignaturePad onChange={onSigned} exportRef={exportRef} label={`ลายเซ็น${title}`} />
      <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label="ชื่อ-นามสกุล (ตัวบรรจง)">
          <input value={name} onChange={(e) => onName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="วันที่">
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}

/** Uploads a signature PNG and returns its path. */
export async function uploadSignature(blob: Blob | null, path: string) {
  if (!blob) return null;
  const { error } = await createClient().storage.from(DOC_BUCKET).upload(path, blob, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`อัปโหลดลายเซ็นไม่สำเร็จ: ${error.message}`);
  return path;
}

/* ---------------------------------------------------------------- the form */

const emptyDetails = (today: string): HandoverDetails => ({
  customer: { name: "", phone: "", address: "", taxId: "" },
  tractor: {},
  trailer: { productType: "", model: "", chassis: "", plate: "" },
  items: {
    brake: { ok: true },
    lights: { ok: true },
    tyres: { of: "ผู้ให้เช่า" },
    rims: { of: "ผู้ให้เช่า" },
    bookCopy: { qty: "1" },
    cmiCopy: { qty: "1" },
    taxDoc: { qty: "1" },
    plates: { qty: "1" },
  },
  accepted: false,
  deliverDate: today,
  receiveDate: today,
});

/** Fills the trailer (and, when the plate is already rented out, the customer) from what the system knows. */
function withPlate(d: HandoverDetails, plate: string, t: TrailerInfo | undefined, r: ActiveRental | undefined): HandoverDetails {
  const n = t?.axles ? String(t.axles) : "";
  const tyres = t?.axles ? String(t.axles * 4) : "";
  return {
    ...d,
    customer: r ? { ...d.customer, name: d.customer?.name || r.customerName, phone: d.customer?.phone || r.phone || "" } : d.customer,
    trailer: {
      ...d.trailer,
      plate,
      productType: d.trailer?.productType || t?.type || r?.trailerKind || "",
      model: d.trailer?.model || t?.model || "",
      chassis: d.trailer?.chassis || t?.vin || "",
    },
    items: {
      ...d.items,
      axle: { ...d.items?.axle, qty: d.items?.axle?.qty || n },
      tyres: { ...d.items?.tyres, qty: d.items?.tyres?.qty || tyres },
      rims: { ...d.items?.rims, qty: d.items?.rims?.qty || tyres },
    },
  };
}

/**
 * Hand-over (ใบส่งมอบ: customer, rental terms, tractor, trailer, items 1–13, 14 photos, both signatures) — saving it
 * puts the customer on "ลูกค้าผู้เช่าปัจจุบัน". Return: pick the rented trailer and take the same 14 photos.
 */
export function HandoverForm({
  rentals,
  trailers,
  yards,
  today,
  initialContract,
  initialKind,
}: {
  rentals: ActiveRental[];
  trailers: Record<string, TrailerInfo>;
  yards: { code: string; name: string }[];
  today: string;
  initialContract?: string;
  initialKind?: "HANDOVER" | "RETURN";
}) {
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const start0 = rentals.find((r) => r.id === initialContract);
  const [kind, setKind] = useState<"HANDOVER" | "RETURN">(initialKind ?? "HANDOVER");
  const [returnId, setReturnId] = useState(start0?.id ?? "");
  const [date, setDate] = useState(today);
  const [yard, setYard] = useState(yards[0]?.code ?? "");
  const [note, setNote] = useState("");
  const [d, setD] = useState<HandoverDetails>(() =>
    start0 ? withPlate(emptyDetails(today), start0.plate, trailers[start0.plate], start0) : emptyDetails(today),
  );
  const [terms, setTerms] = useState<Terms>(() => ({
    customerKind: start0?.customerKind ?? "PERSON",
    trailerKind: start0?.trailerKind ?? "",
    rent: start0?.rent ? String(start0.rent) : "",
    term: start0?.term ? String(start0.term) : "",
    payDay: start0?.payDay ? String(start0.payDay) : String(+today.slice(8, 10)),
  }));
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, Uploaded[]>>>({});
  const [returnDriver, setReturnDriver] = useState("");
  const [returnTractor, setReturnTractor] = useState("");

  const [deliverName, setDeliverName] = useState("");
  const [receiveName, setReceiveName] = useState("");
  const [deliverSigned, setDeliverSigned] = useState(false);
  const [receiveSigned, setReceiveSigned] = useState(false);
  const deliverSig = useRef<(() => Promise<Blob | null>) | null>(null);
  const receiveSig = useRef<(() => Promise<Blob | null>) | null>(null);

  // revoke local previews when leaving the page
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => Object.values(photosRef.current).flat().forEach((p) => p && URL.revokeObjectURL(p.preview)), []);

  const plate = (d.trailer?.plate ?? "").replace(/\s+/g, "");
  const existing = rentals.find((r) => r.plate === plate);
  const returning = rentals.find((r) => r.id === returnId);

  const onPlate = (v: string) => {
    const p = v.replace(/\s+/g, "");
    const r = rentals.find((x) => x.plate === p);
    setD((x) => withPlate(x, v, trailers[p], r));
    const k = trailers[p]?.kindCode;
    if (k && !r) setTerms((t) => ({ ...t, trailerKind: t.trailerKind || k }));
    if (r)
      setTerms((t) => ({
        customerKind: r.customerKind,
        trailerKind: t.trailerKind || r.trailerKind || "",
        rent: t.rent || (r.rent ? String(r.rent) : ""),
        term: t.term || (r.term ? String(r.term) : ""),
        payDay: r.payDay ? String(r.payDay) : t.payDay,
      }));
  };

  const set = <K extends "customer" | "tractor" | "trailer">(group: K, key: string, v: string) =>
    setD((x) => ({ ...x, [group]: { ...x[group], [key]: v } }));
  const setItem = (key: string, patch: Record<string, string | boolean>) =>
    setD((x) => ({ ...x, items: { ...x.items, [key]: { ...x.items?.[key], ...patch } } }));

  const missing = photoSlots.filter((s) => !photos[s.id]?.length);

  const submit = () => {
    setError(null);
    if (kind === "HANDOVER") {
      if (!plate) return setError("กรอกทะเบียนหาง (ในรายละเอียดหางลาก)");
      if (!d.customer?.name?.trim()) return setError("กรอกชื่อผู้รับ (ลูกค้า)");
      if (!deliverSigned || !receiveSigned) return setError("ต้องมีลายเซ็นทั้งผู้ส่งมอบและผู้ตรวจรับ");
      if (!deliverName.trim() || !receiveName.trim()) return setError("กรอกชื่อผู้ส่งมอบและผู้ตรวจรับ");
      if (!d.accepted) return setError("ให้ผู้ตรวจรับติ๊ก “รับรถในสภาพเรียบร้อย พร้อมใช้งาน” ก่อน");
    } else if (!returning) return setError("เลือกหางที่รับคืน");
    if (missing.length && !confirm(`ยังไม่มีรูป ${missing.length} รูป (${missing.map((m) => m.label).join(", ")})\nบันทึกต่อเลยหรือไม่?`)) return;
    if (kind === "RETURN" && !confirm(`ยืนยันรับคืนหาง ${returning!.plate} จาก ${returning!.customerName}?\nลูกค้ารายนี้จะย้ายไปอยู่ใน “ข้อมูลผู้เช่าทั้งหมด”`)) return;
    start(async () => {
      try {
        const folder = `handovers/${id}`;
        const [deliverSign, receiveSign] =
          kind === "HANDOVER"
            ? await Promise.all([
                uploadSignature((await deliverSig.current?.()) ?? null, `${folder}/sign-deliver.png`),
                uploadSignature((await receiveSig.current?.()) ?? null, `${folder}/sign-receive.png`),
              ])
            : [null, null];
        const r = await saveHandover({
          id,
          contractId: kind === "RETURN" ? returnId : existing?.id ?? null,
          kind,
          date,
          yard,
          note,
          terms: kind === "HANDOVER" ? { ...terms, rent: Number(terms.rent) || 0, term: Number(terms.term) || null, payDay: Number(terms.payDay) || null } : null,
          details: kind === "HANDOVER" ? d : { tractor: { plate: returnTractor } },
          photos: toPhotoMap(photos),
          deliverName: kind === "HANDOVER" ? deliverName : "",
          deliverSign,
          receiveName: kind === "HANDOVER" ? receiveName : returnDriver,
          receiveSign,
        });
        if (!r.ok) return setError(r.error);
        router.push(`/admin/handovers/${id}?saved=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      {/* ---- 1. what and when */}
      <section className="rounded-xl border border-line bg-paper p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["HANDOVER", "ส่งมอบหาง (ลูกค้ารับไป)", ArrowUpFromLine],
              ["RETURN", "รับคืนหาง", ArrowDownToLine],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={cx(
                "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-[15px] font-bold",
                kind === k ? "border-sign bg-sign text-on-sign" : "border-line bg-paper hover:border-sign",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <div className={cx("grid gap-3 sm:grid-cols-2", kind === "RETURN" ? "lg:grid-cols-[2fr_1fr_1fr]" : "lg:max-w-[640px]")}>
          {kind === "RETURN" && (
            <Field label="หางที่รับคืน">
              <select value={returnId} onChange={(e) => setReturnId(e.target.value)} required className={inputClass}>
                <option value="">— เลือกหางที่อยู่กับลูกค้า —</option>
                {rentals.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.plate} · {r.customerName}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={kind === "RETURN" ? "วันที่รับคืน" : "วันที่ส่งมอบ"}>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label={kind === "RETURN" ? "ลานที่รับคืน" : "ลานที่ส่งมอบ"}>
            <select value={yard} onChange={(e) => setYard(e.target.value)} className={inputClass}>
              {yards.map((y) => (
                <option key={y.code} value={y.code}>{y.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {kind === "HANDOVER" ? (
        <>
          {/* ---- 2. customer */}
          <section className="rounded-xl border border-line bg-paper p-5">
            <h2 className="mb-3 text-[18px] font-bold">ข้อมูลผู้รับ</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="ชื่อ">
                <input value={d.customer?.name ?? ""} onChange={(e) => set("customer", "name", e.target.value)} className={inputClass} />
              </Field>
              <Field label="ที่อยู่">
                <input value={d.customer?.address ?? ""} onChange={(e) => set("customer", "address", e.target.value)} className={inputClass} />
              </Field>
              <Field label="TAX (เลขประจำตัวผู้เสียภาษี)">
                <input value={d.customer?.taxId ?? ""} inputMode="numeric" onChange={(e) => set("customer", "taxId", e.target.value)} className={inputClass} />
              </Field>
              <Field label="เบอร์โทร">
                <input value={d.customer?.phone ?? ""} inputMode="tel" onChange={(e) => set("customer", "phone", e.target.value)} className={inputClass} />
              </Field>
            </div>
          </section>

          {/* ---- 2b. rental terms → the row on "ลูกค้าผู้เช่าปัจจุบัน" */}
          <section className="rounded-xl border border-line bg-paper p-5">
            <h2 className="text-[18px] font-bold">ข้อมูลสัญญาเช่า</h2>
            <p className="mb-3 text-[13px] text-ink-3">บันทึกแล้วลูกค้าจะขึ้นในหน้า “ลูกค้าผู้เช่าปัจจุบัน” อัตโนมัติ (แก้ไขภายหลังได้ที่หน้านั้น)</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  ["PERSON", "บุคคลธรรมดา (ไม่มี VAT)"],
                  ["COMPANY", "นิติบุคคล (+VAT 7% หัก ณ ที่จ่าย 5%)"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={terms.customerKind === k}
                  onClick={() => setTerms((t) => ({ ...t, customerKind: k }))}
                  className={cx(
                    "rounded-lg border-2 px-3.5 py-2 text-[14px] font-semibold",
                    terms.customerKind === k ? "border-sign bg-sign text-on-sign" : "border-line bg-paper hover:border-sign",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="ประเภทหาง">
                <input list="kind-options" value={terms.trailerKind} onChange={(e) => setTerms((t) => ({ ...t, trailerKind: e.target.value }))} placeholder="SF3" className={inputClass} />
                <datalist id="kind-options">
                  {KIND_OPTIONS.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </Field>
              <Field label="ค่าเช่า / เดือน (ก่อน VAT)">
                <input inputMode="decimal" value={terms.rent} onChange={(e) => setTerms((t) => ({ ...t, rent: e.target.value }))} placeholder="12500" className={inputClass} />
              </Field>
              <Field label="ระยะสัญญา (เดือน)">
                <input inputMode="numeric" value={terms.term} onChange={(e) => setTerms((t) => ({ ...t, term: e.target.value }))} placeholder="6" className={inputClass} />
              </Field>
              <Field label="ชำระทุกวันที่">
                <input inputMode="numeric" value={terms.payDay} onChange={(e) => setTerms((t) => ({ ...t, payDay: e.target.value }))} className={inputClass} />
              </Field>
            </div>
            {existing && (
              <p className="mt-3 rounded-lg bg-info-tint px-4 py-2.5 text-[14px] font-semibold text-info">
                หาง {existing.plate} มีสัญญากับ {existing.customerName} อยู่แล้ว · ใบส่งมอบนี้จะผูกกับสัญญาเดิม (ไม่สร้างแถวซ้ำ)
              </p>
            )}
          </section>

          {/* ---- 3. tractor | trailer, as on the paper form */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-paper p-5">
              <h2 className="mb-3 text-[18px] font-bold">รายละเอียดหัวรถ</h2>
              <div className="grid gap-3">
                <Field label="ยี่ห้อหัวรถ">
                  <input value={d.tractor?.brand ?? ""} onChange={(e) => set("tractor", "brand", e.target.value)} className={inputClass} />
                </Field>
                <Field label="หมายเลขแชสซี">
                  <input value={d.tractor?.chassis ?? ""} onChange={(e) => set("tractor", "chassis", e.target.value)} className={inputClass} />
                </Field>
                <Field label="หมายเลขทะเบียน">
                  <input value={d.tractor?.plate ?? ""} onChange={(e) => set("tractor", "plate", e.target.value)} className={inputClass} />
                </Field>
                <Field label="อื่นๆ">
                  <textarea rows={6} value={d.tractor?.note ?? ""} onChange={(e) => set("tractor", "note", e.target.value)} className={textarea} />
                </Field>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper p-5">
              <h2 className="mb-3 text-[18px] font-bold">รายละเอียดรถบรรทุกกึ่งพ่วง (หางลาก)</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ประเภทสินค้า">
                  <input value={d.trailer?.productType ?? ""} onChange={(e) => set("trailer", "productType", e.target.value)} className={inputClass} />
                </Field>
                <Field label="แบบ">
                  <input value={d.trailer?.model ?? ""} onChange={(e) => set("trailer", "model", e.target.value)} className={inputClass} />
                </Field>
                <Field label="หมายเลขแชสซี">
                  <input value={d.trailer?.chassis ?? ""} onChange={(e) => set("trailer", "chassis", e.target.value)} className={inputClass} />
                </Field>
                <Field label="ทะเบียน">
                  <input list="fleet-plates" required value={d.trailer?.plate ?? ""} onChange={(e) => onPlate(e.target.value)} placeholder="74-8295" className={inputClass} />
                  <datalist id="fleet-plates">
                    {Object.entries(trailers).map(([p, t]) => (
                      <option key={p} value={p}>
                        {t.code} · {t.type}
                      </option>
                    ))}
                  </datalist>
                </Field>
              </div>

              <ol className="mt-4 divide-y divide-line rounded-lg border border-line">
                {handoverItems.map((it, i) => {
                  const v = d.items?.[it.key] ?? {};
                  const small = "h-10 rounded-md border-2 border-line bg-paper px-2 text-[14px] focus:border-sign focus:outline-none";
                  return (
                    <li key={it.key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2 text-[14px]">
                      {it.check ? (
                        <label className="flex items-center gap-2.5 font-semibold">
                          <input
                            type="checkbox"
                            checked={!!v.ok}
                            onChange={(e) => setItem(it.key, { ok: e.target.checked })}
                            className="size-5 accent-[var(--color-grass)]"
                          />
                          {i + 1}. {it.label}
                        </label>
                      ) : (
                        <>
                          <span className="font-semibold">
                            {i + 1}. {it.label}
                          </span>
                          {it.spec && (
                            <input
                              aria-label={`${it.label} รายละเอียด`}
                              placeholder="รายละเอียด / ยี่ห้อ"
                              value={v.spec ?? ""}
                              onChange={(e) => setItem(it.key, { spec: e.target.value })}
                              className={cx(small, "w-36")}
                            />
                          )}
                          <span className="text-ink-3">จำนวน</span>
                          <input
                            aria-label={`${it.label} จำนวน`}
                            inputMode="numeric"
                            value={v.qty ?? ""}
                            onChange={(e) => setItem(it.key, { qty: e.target.value })}
                            className={cx(small, "w-16 text-center")}
                          />
                          <span className="text-ink-3">{it.unit}</span>
                          {it.owner && (
                            <span className="flex items-center gap-1.5" role="group" aria-label={`${it.label} ของ`}>
                              <span className="text-ink-3">ของ</span>
                              {["ผู้เช่า", "ผู้ให้เช่า"].map((o) => (
                                <button
                                  key={o}
                                  type="button"
                                  aria-pressed={v.of === o}
                                  onClick={() => setItem(it.key, { of: o })}
                                  className={cx(
                                    "rounded-md border-2 px-2.5 py-1 text-[13px] font-semibold",
                                    v.of === o ? "border-sign bg-sign text-on-sign" : "border-line bg-paper text-ink-2 hover:border-line-strong",
                                  )}
                                >
                                  {o}
                                </button>
                              ))}
                            </span>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ol>
              <Field label="อื่นๆ" className="mt-3">
                <textarea rows={3} value={d.trailer?.note ?? ""} onChange={(e) => set("trailer", "note", e.target.value)} className={textarea} />
              </Field>
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-line bg-paper p-5">
          <h2 className="mb-3 text-[18px] font-bold">ผู้นำหางมาคืน</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ชื่อคนขับ">
              <input value={returnDriver} onChange={(e) => setReturnDriver(e.target.value)} className={inputClass} />
            </Field>
            <Field label="ทะเบียนหัวลาก">
              <input value={returnTractor} onChange={(e) => setReturnTractor(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </section>
      )}

      {/* ---- 4. photos */}
      <section className="rounded-xl border border-line bg-paper p-5">
        <h2 className="mb-1 text-[18px] font-bold">รูปถ่าย{kind === "RETURN" ? "ตอนรับคืน" : "ก่อนปล่อยหาง"} 14 รูป</h2>
        <PhotoGrid folder={`handovers/${id}`} value={photos} onChange={setPhotos} />
      </section>

      {/* ---- 5. sign-off */}
      {kind === "HANDOVER" && (
        <section className="rounded-xl border border-line bg-paper p-5">
          <label className="mb-4 flex items-center gap-3 rounded-lg bg-sign-wash px-4 py-3 text-[16px] font-bold">
            <input
              type="checkbox"
              checked={!!d.accepted}
              onChange={(e) => setD((x) => ({ ...x, accepted: e.target.checked }))}
              className="size-5 accent-[var(--color-grass)]"
            />
            ***รับรถในสภาพเรียบร้อย พร้อมใช้งาน
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <SignBox
              title="ผู้ส่งมอบ"
              name={deliverName}
              onName={setDeliverName}
              date={d.deliverDate ?? today}
              onDate={(v) => setD((x) => ({ ...x, deliverDate: v }))}
              onSigned={setDeliverSigned}
              exportRef={deliverSig}
            />
            <SignBox
              title="ผู้ตรวจรับ"
              name={receiveName}
              onName={setReceiveName}
              date={d.receiveDate ?? today}
              onDate={(v) => setD((x) => ({ ...x, receiveDate: v }))}
              onSigned={setReceiveSigned}
              exportRef={receiveSig}
            />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-paper p-5">
        <Field label="หมายเหตุ / สภาพหาง">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={textarea} />
        </Field>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-danger-tint px-4 py-2.5 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "กำลังบันทึก…" : kind === "RETURN" ? "บันทึกรับคืนหาง" : "บันทึกส่งมอบหาง"}
          </Button>
          {missing.length > 0 && <span className="text-[14px] text-ink-3">ยังไม่มีรูป {missing.length} รูป</span>}
        </div>
      </section>
    </form>
  );
}
