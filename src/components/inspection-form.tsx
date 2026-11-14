"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, CircleCheckBig, Minus, ScanLine, X } from "lucide-react";
import { acknowledgeInspection, checkIn, completeHandover, registerInspectionPhotos, saveInspection } from "@/app/actions/yard";
import { money } from "@/lib/format";
import type { ChecklistGroup, ChecklistResult, InspectionInfo } from "@/lib/types";
import { uploadTo } from "@/lib/upload";
import { SignaturePad } from "./signature-pad";
import { Badge, Button, cx, inputClass } from "./ui";

const resultBtn: { v: ChecklistResult; label: string; icon: typeof Check; on: string }[] = [
  { v: "OK", label: "ปกติ", icon: Check, on: "border-sign bg-sign text-on-sign" },
  { v: "DAMAGED", label: "เสียหาย", icon: X, on: "border-danger bg-danger text-white" },
  { v: "NA", label: "ไม่มี", icon: Minus, on: "border-ink-3 bg-ink-3 text-white" },
];

const ANGLES = [
  ["FRONT", "หน้า"],
  ["REAR", "หลัง"],
  ["LEFT", "ซ้าย"],
  ["RIGHT", "ขวา"],
] as const;
type Angle = (typeof ANGLES)[number][0] | "DETAIL";

const ackLabel = { AGREE: "ตรง/รับทราบ", REMARK: "มีข้อสังเกต", DISPUTE: "โต้แย้ง", REFUSED_TO_SIGN: "ปฏิเสธการเซ็น" } as const;

type Result<T> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
function ok<T>(res: Result<T>) {
  if (!res.ok) throw new Error(res.error);
  return res;
}

/**
 * Ops at the yard: check the driver in, record the full checklist (OUT before handover, IN after return),
 * collect the driver's signature on the yard tablet if needed, then complete the handover.
 */
export function InspectionForm({
  appointmentId,
  bookingId,
  kind,
  driverName,
  tractorPlate,
  checkedIn,
  identityMatch,
  inspection,
  completed,
  previousDamage = [],
  checklistTemplate,
}: {
  appointmentId: string;
  bookingId: string;
  kind: "OUT" | "IN";
  driverName: string;
  tractorPlate: string;
  checkedIn: boolean;
  identityMatch: boolean | null | undefined;
  inspection?: InspectionInfo;
  completed: boolean;
  previousDamage?: string[];
  checklistTemplate: ChecklistGroup[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [results, setResults] = useState<Record<string, ChecklistResult>>({});
  const [notes, setNotes] = useState("");
  const [damageAmount, setDamageAmount] = useState("");
  const [photos, setPhotos] = useState<Partial<Record<Angle, File[]>>>({});
  const [redo, setRedo] = useState(false);

  const [tabletSigned, setTabletSigned] = useState(false);
  const [tabletResult, setTabletResult] = useState<"AGREE" | "REMARK" | "DISPUTE" | null>(null);
  const [tabletRemark, setTabletRemark] = useState("");
  const exportSig = useRef<(() => Promise<Blob | null>) | null>(null);

  const items = checklistTemplate.flatMap((g) => g.items);
  const filled = items.filter((i) => results[i.key]).length;
  const damaged = Object.values(results).filter((v) => v === "DAMAGED").length;
  const baseAngles = ANGLES.every(([a]) => (photos[a]?.length ?? 0) > 0);

  const run = (fn: () => Promise<string | void>) => {
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        const m = await fn();
        if (m) setMessage(m);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    });
  };

  if (completed) {
    return (
      <div className="rounded-xl border-2 border-sign bg-sign-wash p-6">
        <p className="text-[20px] font-bold text-sign-deep">{kind === "OUT" ? "ส่งมอบหางแล้ว" : "รับหางคืนแล้ว"}</p>
        <p className="mt-1 text-ink-2">บันทึกเวลา ผลตรวจ และลายเซ็นคนขับเรียบร้อย</p>
      </div>
    );
  }

  const showForm = !inspection?.done || redo;
  const canSave = filled === items.length && (kind === "OUT" || checkedIn) && baseAngles;
  const ready = checkedIn && identityMatch && inspection?.done && inspection.ack;

  return (
    <div className="space-y-6">
      {(error || message) && (
        <p
          className={cx("rounded-lg px-4 py-3 text-[15px] font-semibold", error ? "bg-danger-tint text-danger" : "bg-sign-tint text-sign-deep")}
          role={error ? "alert" : "status"}
        >
          {error ?? message}
        </p>
      )}

      {/* 1. Check-in (BR-23) */}
      <section className={cx("rounded-xl border-2 bg-paper p-5", checkedIn ? (identityMatch ? "border-sign" : "border-danger") : "border-reflect")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[18px] font-bold">
            <ScanLine className="size-5 text-grass" aria-hidden /> เช็กอินคนขับ
          </h2>
          {checkedIn && <Badge tone={identityMatch ? "ok" : "danger"}>{identityMatch ? "ตรงกับการจอง" : "ไม่ตรง · ห้ามส่งมอบ"}</Badge>}
        </div>
        {!checkedIn ? (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink-2" htmlFor="code">
                สแกน QR หรือกรอกรหัส 6 หลักจากมือถือคนขับ
              </label>
              <input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={cx(inputClass, "font-route text-[20px] tracking-[0.2em]")}
              />
            </div>
            <div className="rounded-lg bg-ground p-3 text-[15px]">
              <p className="text-[13px] text-ink-3">เทียบกับตัวจริง</p>
              <p>
                คนขับ <strong>{driverName}</strong> · ใบขับขี่ตัวจริง
              </p>
              <p>
                หัวลาก <strong className="font-route">{tractorPlate}</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button variant="sign" disabled={code.length !== 6 || pending} onClick={() => run(async () => ok(await checkIn(appointmentId, code, true)).message)}>
                ตรงกัน
              </Button>
              <Button variant="danger" disabled={code.length !== 6 || pending} onClick={() => run(async () => ok(await checkIn(appointmentId, code, false)).message)}>
                ไม่ตรง ห้ามส่งมอบ
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[15px] text-ink-2">
            {driverName} · <span className="font-route">{tractorPlate}</span>
          </p>
        )}
      </section>

      {/* 2. Full checklist */}
      {!showForm && inspection ? (
        <section className="rounded-xl border border-line bg-paper p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[18px] font-bold">ผลตรวจ {kind === "OUT" ? "ก่อนส่งมอบ (OUT)" : "หลังรับคืน (IN)"}</h2>
            <Badge tone={inspection.damaged.length ? "danger" : "ok"}>
              {inspection.damaged.length ? `เสียหาย ${inspection.damaged.length} จุด` : "ไม่พบความเสียหาย"}
            </Badge>
          </div>
          {inspection.damaged.length > 0 && <p className="mt-2 text-[15px] text-danger">{inspection.damaged.join(", ")}</p>}
          {!inspection.ack && (
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => setRedo(true)}>
              ตรวจใหม่
            </Button>
          )}
        </section>
      ) : (
        <section className={cx("rounded-xl border border-line bg-paper", kind === "IN" && !checkedIn && "pointer-events-none opacity-50")}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-[18px] font-bold">Checklist {kind === "OUT" ? "ก่อนส่งมอบ (OUT)" : "หลังรับคืน (IN)"}</h2>
            <div className="flex items-center gap-3 text-[14px]">
              <span className="tabular text-ink-2">
                {filled}/{items.length} รายการ
              </span>
              {damaged > 0 && <Badge tone="danger">เสียหาย {damaged}</Badge>}
              <Button size="sm" variant="ghost" type="button" onClick={() => setResults(Object.fromEntries(items.map((i) => [i.key, "OK" as ChecklistResult])))}>
                ปกติทั้งหมด
              </Button>
            </div>
          </header>
          {kind === "IN" && previousDamage.length > 0 && (
            <p className="border-b border-line bg-warn-tint px-5 py-2.5 text-[14px] text-warn">ผล OUT บันทึกไว้: {previousDamage.join(", ")}</p>
          )}
          <div className="divide-y divide-line">
            {checklistTemplate.map((g) => (
              <div key={g.key} className="px-5 py-4">
                <h3 className="mb-2 text-[14px] font-bold text-ink-3">{g.label}</h3>
                <ul className="space-y-2">
                  {g.items.map((it) => (
                    <li key={it.key} className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-[16px]">{it.label}</span>
                      <span className="flex gap-1.5" role="radiogroup" aria-label={it.label}>
                        {resultBtn.map((r) => (
                          <button
                            key={r.v}
                            type="button"
                            role="radio"
                            aria-checked={results[it.key] === r.v}
                            onClick={() => setResults({ ...results, [it.key]: r.v })}
                            className={cx(
                              "flex h-11 min-w-[76px] items-center justify-center gap-1 rounded-lg border-2 px-2.5 text-[14px] font-semibold",
                              results[it.key] === r.v ? r.on : "border-line text-ink-2 hover:border-line-strong",
                            )}
                          >
                            <r.icon className="size-4" aria-hidden /> {r.label}
                          </button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-5 py-4">
            <h3 className="mb-2 font-bold">รูปถ่าย (บังคับ 4 มุม + จุดเสียหาย)</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[...ANGLES, ["DETAIL", "จุดเสียหาย"] as const].map(([angle, label]) => {
                const n = photos[angle]?.length ?? 0;
                return (
                  <label
                    key={angle}
                    className={cx(
                      "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-[14px] font-semibold",
                      n ? "border-sign bg-sign-wash text-sign-deep" : "border-line-strong text-ink-2 hover:border-sign",
                    )}
                  >
                    <Camera className="size-6" aria-hidden />
                    {label} {n > 0 && `(${n})`}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple={angle === "DETAIL"}
                      className="sr-only"
                      onChange={(e) => setPhotos({ ...photos, [angle]: Array.from(e.target.files ?? []) })}
                    />
                  </label>
                );
              })}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="หมายเหตุ เช่น ตำแหน่งและลักษณะความเสียหาย"
              className="mt-3 w-full rounded-lg border-2 border-line p-3 text-[15px] focus:border-sign focus:outline-none"
            />
            {kind === "IN" && damaged > 0 && (
              <label className="mt-3 block max-w-xs">
                <span className="mb-1.5 block text-sm font-semibold text-ink-2">ประเมินค่าเสียหาย (บาท) · ส่งให้ฝ่ายขายอนุมัติ</span>
                <input inputMode="numeric" value={damageAmount} onChange={(e) => setDamageAmount(e.target.value.replace(/\D/g, ""))} className={inputClass} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
            <Button
              variant="sign"
              size="lg"
              disabled={!canSave || pending}
              onClick={() =>
                run(async () => {
                  const res = ok(
                    await saveInspection({
                      appointmentId,
                      items: items.map((i) => ({ key: i.key, label: i.label, result: results[i.key] })),
                      notes: notes || undefined,
                      damageAmount: damageAmount ? Number(damageAmount) : undefined,
                    }),
                  );
                  const { inspectionId } = res.data!;
                  const uploaded: { path: string; angle: Angle }[] = [];
                  for (const [angle, files] of Object.entries(photos) as [Angle, File[]][]) {
                    for (const f of files) {
                      const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
                      const path = `${bookingId}/${inspectionId}/${crypto.randomUUID()}.${ext}`;
                      await uploadTo("inspection-photos", path, f, f.type || "image/jpeg");
                      uploaded.push({ path, angle });
                    }
                  }
                  ok(await registerInspectionPhotos(inspectionId, uploaded));
                  setRedo(false);
                  return "บันทึกผลตรวจแล้ว";
                })
              }
            >
              {pending ? "กำลังบันทึก…" : "บันทึกผลตรวจ"}
            </Button>
            {!canSave && (
              <span className="text-[14px] text-ink-3">
                {kind === "IN" && !checkedIn ? "เช็กอินคนขับก่อน" : filled < items.length ? "ตรวจให้ครบทุกรายการ" : "ถ่ายรูปให้ครบ 4 มุม"}
              </span>
            )}
          </div>
        </section>
      )}

      {/* 3. Driver acknowledgement */}
      {inspection?.done && !redo && (
        <section className={cx("rounded-xl border-2 bg-paper p-5", inspection.ack ? "border-sign" : "border-reflect")}>
          <h2 className="text-[18px] font-bold">คนขับยืนยันผลตรวจ</h2>
          {inspection.ack ? (
            <p className="mt-2 flex items-center gap-2 text-[15px]">
              <CircleCheckBig className="size-5 text-grass" aria-hidden /> {ackLabel[inspection.ack]}
            </p>
          ) : !checkedIn ? (
            <p className="mt-1 text-[15px] text-ink-2">หางพร้อมแล้ว · เมื่อคนขับมาถึง ให้เช็กอินด้านบน แล้วให้คนขับเซ็นบนมือถือหรือบนแท็บเล็ตนี้</p>
          ) : (
            <div className="mt-3 space-y-4">
              <p className="text-[15px] text-ink-2">คนขับเซ็นบนมือถือของตัวเองได้ หรือเซ็นบนแท็บเล็ตนี้ (รีเฟรชหน้าเพื่อดูผลจากมือถือคนขับ)</p>
              <div className="flex flex-wrap gap-2">
                {(["AGREE", "REMARK", "DISPUTE"] as const).map((r) => (
                  <Button key={r} size="sm" variant={tabletResult === r ? "sign" : "outline"} onClick={() => setTabletResult(r)}>
                    {ackLabel[r]}
                  </Button>
                ))}
              </div>
              {tabletResult && tabletResult !== "AGREE" && (
                <textarea
                  value={tabletRemark}
                  onChange={(e) => setTabletRemark(e.target.value)}
                  rows={2}
                  placeholder="สิ่งที่คนขับแจ้ง"
                  className="w-full rounded-lg border-2 border-line p-3 text-[15px] focus:border-sign focus:outline-none"
                />
              )}
              <SignaturePad onChange={setTabletSigned} exportRef={exportSig} label="คนขับเซ็นชื่อที่นี่" />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="sign"
                  disabled={!tabletResult || !tabletSigned || (tabletResult !== "AGREE" && !tabletRemark.trim()) || pending}
                  onClick={() =>
                    run(async () => {
                      const blob = await exportSig.current?.();
                      if (!blob) throw new Error("ยังไม่มีลายเซ็น");
                      const path = await uploadTo("signatures", `${bookingId}/${inspection.id}.png`, blob, "image/png");
                      ok(await acknowledgeInspection({ inspectionId: inspection.id, result: tabletResult!, remark: tabletRemark, signaturePath: path }));
                      return "บันทึกลายเซ็นคนขับแล้ว";
                    })
                  }
                >
                  บันทึกลายเซ็นคนขับ
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      ok(await acknowledgeInspection({ inspectionId: inspection.id, result: "REFUSED_TO_SIGN", remark: "คนขับปฏิเสธการเซ็น" }));
                      return "บันทึกว่าคนขับปฏิเสธการเซ็น";
                    })
                  }
                >
                  คนขับปฏิเสธการเซ็น
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. Complete */}
      {inspection?.done && !redo && (
        <section className="rounded-xl border border-line bg-paper p-5">
          <Button variant="primary" size="lg" disabled={!ready || pending} onClick={() => run(async () => ok(await completeHandover(appointmentId)).message)}>
            {kind === "OUT" ? "ส่งมอบหาง" : "ปิดการรับคืน"}
          </Button>
          {!ready && (
            <p className="mt-2 text-[14px] text-ink-3">
              {!checkedIn ? "รอเช็กอินคนขับ" : !identityMatch ? "คนขับหรือหัวลากไม่ตรงกับการจอง ส่งมอบไม่ได้" : "รอคนขับยืนยันผลตรวจ"}
            </p>
          )}
          {kind === "IN" && damageAmount && (
            <p className="mt-2 text-[13px] text-ink-3">ค่าเสียหายที่ประเมิน {money(Number(damageAmount))} ส่งให้ฝ่ายขายอนุมัติตอนปิดยอด</p>
          )}
        </section>
      )}
    </div>
  );
}
