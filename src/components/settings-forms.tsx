"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { addStaffUser, deleteStaffUser, saveDeposits, saveSettings, setStaffPin } from "@/app/actions/settings";
import type { TrailerType, TrailerTypeId, Yard, YardId } from "@/lib/types";
import { Button, Field, cx, inputClass } from "./ui";

type Msg = { ok: boolean; text: string } | null;
const toNum = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[^\d.]/g, ""));

function useSubmit() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? { ok: true, text: res.message ?? "บันทึกแล้ว" } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  const note = msg && (
    <p className={cx("text-[14px] font-semibold", msg.ok ? "text-grass" : "text-danger")} role={msg.ok ? "status" : "alert"}>
      {msg.text}
    </p>
  );
  return { pending, run, note };
}

export function DepositsForm({ types }: { types: TrailerType[] }) {
  const { pending, run, note } = useSubmit();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() => saveDeposits(Object.fromEntries(types.map((t) => [t.id, toNum(f.get(t.id))])) as Record<TrailerTypeId, number>));
  };
  return (
    <form onSubmit={submit}>
      <ul className="divide-y divide-line">
        {types.map((t) => (
          <li key={t.id} className="grid grid-cols-[1fr_160px] items-center gap-3 px-5 py-3">
            <span>
              <span className="font-semibold">{t.name}</span> <span className="text-[13px] text-ink-3">{t.english}</span>
            </span>
            <input name={t.id} defaultValue={t.deposit} inputMode="numeric" aria-label={`เงินค้ำประกัน ${t.name}`} className={`${inputClass} h-10 text-right tabular`} />
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3 border-t border-line px-5 py-3">
        <Button type="submit" size="sm" variant="sign" disabled={pending}>บันทึกเงินค้ำประกัน</Button>
        {note}
      </div>
    </form>
  );
}

const POLICY: { key: string; label: string; hint?: string; kind?: "interval" }[] = [
  { key: "weekly_tier_min_days", label: "ใช้เรทรายสัปดาห์ตั้งแต่ (วัน)" },
  { key: "monthly_tier_min_days", label: "ใช้เรทรายเดือนตั้งแต่ (วัน)" },
  { key: "payment_window_hours", label: "กำหนดชำระหลังอนุมัติ (ชั่วโมง)" },
  { key: "need_docs_window_hours", label: "ส่งเอกสารเพิ่มภายใน (ชั่วโมง)" },
  { key: "cancellation_fee", label: "ค่าธรรมเนียมยกเลิกก่อนรับหาง (บาท)", hint: "เว้นว่าง = ยังไม่เก็บ" },
  { key: "late_return_multiplier", label: "ค่าปรับคืนช้า (เท่าของเรทรายวัน)" },
  { key: "min_lead_hours", label: "จองล่วงหน้าอย่างน้อย (ชั่วโมง)" },
  { key: "deposit_refund_business_days", label: "คืนเงินค้ำประกันภายใน (วันทำการ)" },
];

export function PolicyForm({ values }: { values: Record<string, unknown> }) {
  const { pending, run, note } = useSubmit();
  const vat = Math.round(Number(values.vat_rate ?? 0.07) * 10000) / 100;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const out: Record<string, unknown> = { vat_rate: toNum(f.get("vat")) / 100 };
    for (const p of POLICY) {
      const raw = String(f.get(p.key) ?? "").trim();
      out[p.key] = raw === "" ? null : toNum(raw);
    }
    run(() => saveSettings(out));
  };
  return (
    <form onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        {POLICY.map((p) => (
          <Field key={p.key} label={p.label} hint={p.hint}>
            <input name={p.key} defaultValue={values[p.key] == null ? "" : String(values[p.key])} inputMode="decimal" className={inputClass} />
          </Field>
        ))}
        <Field label="VAT (%)">
          <input name="vat" defaultValue={vat} inputMode="decimal" className={inputClass} />
        </Field>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" variant="sign" disabled={pending}>บันทึกนโยบาย</Button>
        {note}
      </div>
    </form>
  );
}

export function PaymentAccountsForm({ values }: { values: Record<string, string | null> }) {
  const { pending, run, note } = useSubmit();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pick = (k: string) => String(f.get(k) ?? "").trim() || null;
    run(() =>
      saveSettings({
        payment_accounts: {
          promptpay_id: pick("promptpay_id")?.replace(/\D/g, "") ?? null,
          bank: pick("bank"),
          account_no: pick("account_no"),
          account_name: pick("account_name"),
        },
      }),
    );
  };
  return (
    <form onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="PromptPay ID" hint="เบอร์มือถือ หรือเลขผู้เสียภาษีบริษัท 13 หลัก">
          <input name="promptpay_id" defaultValue={values.promptpay_id ?? ""} inputMode="numeric" className={inputClass} />
        </Field>
        <Field label="ธนาคาร"><input name="bank" defaultValue={values.bank ?? ""} className={inputClass} /></Field>
        <Field label="เลขบัญชี"><input name="account_no" defaultValue={values.account_no ?? ""} className={inputClass} /></Field>
        <Field label="ชื่อบัญชี"><input name="account_name" defaultValue={values.account_name ?? ""} className={inputClass} /></Field>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" variant="sign" disabled={pending}>บันทึก</Button>
        {note}
      </div>
    </form>
  );
}

export function AddStaffForm({ yards }: { yards: Yard[] }) {
  const { pending, run, note } = useSubmit();
  const [role, setRole] = useState<"SALES" | "OPS" | "SUPER_ADMIN">("SALES");
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        เพิ่มผู้ใช้
      </Button>
    );
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    run(() =>
      addStaffUser({
        name: String(f.get("name")),
        phone: String(f.get("phone")),
        pin: String(f.get("pin")),
        role,
        homeYard: (f.get("yard") as YardId) || undefined,
      }),
    );
  };
  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-lg bg-ground p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อ"><input name="name" required className={inputClass} /></Field>
        <Field label="เบอร์มือถือ (ใช้เข้าสู่ระบบ)"><input name="phone" inputMode="tel" required className={inputClass} /></Field>
        <Field label="PIN 6 หลัก" hint="ใช้คู่กับเบอร์มือถือตอนเข้าสู่ระบบ">
          <input name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="off" required className={`${inputClass} tabular`} />
        </Field>
        <Field label="บทบาท">
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={inputClass}>
            <option value="SALES">Sales / CS</option>
            <option value="OPS">Staff (Ops)</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </Field>
        {role === "OPS" && (
          <Field label="ลานประจำ">
            <select name="yard" className={inputClass}>
              {yards.map((y) => (
                <option key={y.id} value={y.id}>ลาน{y.short}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="sign" disabled={pending}>สร้างบัญชี</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>ยกเลิก</Button>
        {note}
      </div>
    </form>
  );
}

/** Super Admin: set a new 6-digit PIN for one staff account. */
export function StaffPinForm({ userId, name }: { userId: string; name: string }) {
  const { pending, run, note } = useSubmit();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold text-grass underline">
        ตั้ง PIN ใหม่
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const pin = String(new FormData(e.currentTarget).get("pin"));
        run(() => setStaffPin(userId, pin));
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        name="pin"
        aria-label={`PIN ใหม่ของ ${name}`}
        placeholder="PIN 6 หลัก"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="off"
        required
        className={`${inputClass} h-10 w-32 tabular`}
      />
      <Button type="submit" size="sm" variant="sign" disabled={pending}>บันทึก</Button>
      {note}
    </form>
  );
}

/** Super Admin: remove a staff account, with an inline confirm step. */
export function DeleteStaffButton({ userId, name }: { userId: string; name: string }) {
  const { pending, run, note } = useSubmit();
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return (
      <span className="flex items-center gap-2">
        <button type="button" onClick={() => setConfirming(true)} className="text-[13px] font-semibold text-danger underline">
          ลบผู้ใช้
        </button>
        {note}
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-2" role="group" aria-label={`ยืนยันการลบ ${name}`}>
      <span className="text-[13px] text-ink-2">ลบ {name}?</span>
      <Button
        type="button"
        size="sm"
        variant="danger"
        disabled={pending}
        onClick={() => run(async () => { const r = await deleteStaffUser(userId); setConfirming(false); return r; })}
      >
        ยืนยันลบ
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>ยกเลิก</Button>
    </span>
  );
}
