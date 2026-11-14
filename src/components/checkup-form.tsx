"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCheckup } from "@/app/actions/handovers";
import { checkupGroups, checkupItems, resultLabel, type CheckupValue } from "@/lib/handover";
import { SignBox, uploadSignature } from "./handover-form";
import { Button, Field, cx, inputClass } from "./ui";

/** The 6-monthly inspection sheet: 20 general + 20 undercarriage items, signed by the mechanic and the inspector. */
export function CheckupForm({
  plates,
  today,
  initialPlate,
}: {
  plates: { plate: string; kind: string | null; label: string }[];
  today: string;
  initialPlate?: string;
}) {
  const router = useRouter();
  const [id] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const first = plates.find((p) => p.plate === initialPlate);
  const [plate, setPlate] = useState(initialPlate ?? "");
  const [kind, setKind] = useState(first?.kind ?? "");
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<Record<string, CheckupValue>>({});
  const [note, setNote] = useState("");
  const [mechanic, setMechanic] = useState("");
  const [inspector, setInspector] = useState("");
  const [signedOn, setSignedOn] = useState(today);
  const [mSigned, setMSigned] = useState(false);
  const [iSigned, setISigned] = useState(false);
  const mSig = useRef<(() => Promise<Blob | null>) | null>(null);
  const iSig = useRef<(() => Promise<Blob | null>) | null>(null);

  const setItem = (key: string, patch: CheckupValue) => setItems((x) => ({ ...x, [key]: { ...x[key], ...patch } }));
  const filled = checkupItems.filter((it) => items[it.key]?.r).length;
  const repairs = checkupItems.filter((it) => items[it.key]?.r === "FIX");

  const pickPlate = (v: string) => {
    setPlate(v);
    const p = plates.find((x) => x.plate === v.trim());
    if (p?.kind) setKind(p.kind);
  };

  const submit = () => {
    setError(null);
    if (!plate.trim()) return setError("กรอกหมายเลขทะเบียน");
    if (filled < checkupItems.length) return setError(`ยังไม่ได้เลือกผลตรวจ ${checkupItems.length - filled} รายการ (กด “ที่เหลือ = ไม่ซ่อม” ได้)`);
    if (!mSigned || !iSigned) return setError("ต้องมีลายเซ็นทั้งช่างผู้ซ่อมและผู้ตรวจสอบ");
    if (!mechanic.trim() || !inspector.trim()) return setError("กรอกชื่อช่างผู้ซ่อมและผู้ตรวจสอบ");
    start(async () => {
      try {
        const folder = `checkups/${id}`;
        const [mechanicSign, inspectorSign] = await Promise.all([
          uploadSignature((await mSig.current?.()) ?? null, `${folder}/sign-mechanic.png`),
          uploadSignature((await iSig.current?.()) ?? null, `${folder}/sign-inspector.png`),
        ]);
        const r = await saveCheckup({
          id,
          plate,
          trailerKind: kind,
          date,
          items,
          note,
          mechanicName: mechanic,
          mechanicSign,
          inspectorName: inspector,
          inspectorSign,
          signedOn,
        });
        if (!r.ok) return setError(r.error);
        router.push(`/admin/checkups/${id}?saved=1`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  };

  const small = "h-10 rounded-md border-2 border-line bg-paper px-2 text-[14px] focus:border-sign focus:outline-none";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <section className="grid gap-3 rounded-xl border border-line bg-paper p-5 sm:grid-cols-3">
        <Field label="วันที่">
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </Field>
        <Field label="หมายเลขทะเบียน">
          <input list="checkup-plates" required value={plate} onChange={(e) => pickPlate(e.target.value)} placeholder="74-8296" className={inputClass} />
          <datalist id="checkup-plates">
            {plates.map((p) => (
              <option key={p.plate} value={p.plate}>{p.label}</option>
            ))}
          </datalist>
        </Field>
        <Field label="ประเภทรถ">
          <input value={kind} onChange={(e) => setKind(e.target.value)} placeholder="SF3, SC3 …" className={inputClass} />
        </Field>
      </section>

      {checkupGroups.map((g) => (
        <section key={g.title} className="rounded-xl border border-line bg-paper">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
            <h2 className="text-[18px] font-bold">{g.title}</h2>
            <button
              type="button"
              onClick={() =>
                setItems((x) => {
                  const next = { ...x };
                  for (const it of g.items) if (!next[it.key]?.r) next[it.key] = { ...next[it.key], r: "OK" };
                  return next;
                })
              }
              className="rounded-lg border-2 border-line px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:border-sign"
            >
              ที่เหลือ = {g.items.some((i) => i.damage) ? "ไม่ซ่อม / ไม่เสียหาย" : "ไม่ซ่อม"}
            </button>
          </header>
          <ol className="grid divide-y divide-line lg:grid-cols-2 lg:divide-y-0">
            {g.items.map((it, i) => {
              const v = items[it.key] ?? {};
              return (
                <li
                  key={it.key}
                  className={cx(
                    "flex flex-wrap items-center gap-x-2 gap-y-1.5 px-5 py-2.5 text-[14px] lg:border-b lg:border-line",
                    v.r === "FIX" && "bg-danger-tint/50",
                  )}
                >
                  <span className="min-w-[10.5rem] font-semibold">
                    {i + 1}. {it.label}
                  </span>
                  {it.spec && (
                    <input
                      aria-label={`${it.label} ${it.spec}`}
                      placeholder={it.spec}
                      value={v.spec ?? ""}
                      onChange={(e) => setItem(it.key, { spec: e.target.value })}
                      className={cx(small, "w-24")}
                    />
                  )}
                  {it.unit && (
                    <span className="flex items-center gap-1">
                      <input
                        aria-label={`${it.label} จำนวน`}
                        inputMode="numeric"
                        value={v.qty ?? ""}
                        onChange={(e) => setItem(it.key, { qty: e.target.value })}
                        className={cx(small, "w-14 text-center")}
                      />
                      <span className="text-ink-3">{it.unit}</span>
                    </span>
                  )}
                  <span className="ml-auto flex gap-1.5" role="group" aria-label={`ผลตรวจ ${it.label}`}>
                    {(["FIX", "OK"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={v.r === r}
                        onClick={() => setItem(it.key, { r })}
                        className={cx(
                          "rounded-md border-2 px-2.5 py-1 text-[13px] font-semibold",
                          v.r === r
                            ? r === "FIX"
                              ? "border-danger bg-danger text-white"
                              : "border-sign bg-sign text-on-sign"
                            : "border-line bg-paper text-ink-2 hover:border-line-strong",
                        )}
                      >
                        {resultLabel(it.damage, r)}
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <section className="rounded-xl border border-line bg-paper p-5">
        <p className="mb-3 text-[15px]">
          เลือกผลแล้ว <b>{filled}/{checkupItems.length}</b> รายการ ·{" "}
          {repairs.length ? (
            <b className="text-danger">ต้องซ่อม / เสียหาย {repairs.length} รายการ: {repairs.map((r) => r.label).join(", ")}</b>
          ) : (
            <span className="text-ink-3">ยังไม่มีรายการที่ต้องซ่อม</span>
          )}
        </p>
        <Field label="หมายเหตุ / รายละเอียดการซ่อม">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={cx(inputClass, "h-auto py-2.5")} />
        </Field>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SignBox title="ช่างผู้ซ่อม" name={mechanic} onName={setMechanic} date={signedOn} onDate={setSignedOn} onSigned={setMSigned} exportRef={mSig} />
          <SignBox title="ผู้ตรวจสอบ" name={inspector} onName={setInspector} date={signedOn} onDate={setSignedOn} onSigned={setISigned} exportRef={iSig} />
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger-tint px-4 py-2.5 text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="mt-4">
          {pending ? "กำลังบันทึก…" : "บันทึกการตรวจเช็ค"}
        </Button>
      </section>
    </form>
  );
}
