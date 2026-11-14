"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/actions/auth";
import { sendContactMessage } from "@/app/actions/customer";
import type { ActionResult } from "@/app/actions/result";
import { T } from "./t";
import { Button, Field, inputClass } from "./ui";

function Message({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return state.ok ? (
    <p className="rounded-lg bg-sign-tint px-4 py-3 text-[15px] font-semibold text-sign-deep" role="status">
      {state.message}
    </p>
  ) : (
    <p className="rounded-lg bg-danger-tint px-4 py-3 text-[15px] font-semibold text-danger" role="alert">
      {state.error}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, null);
  const [phone, setPhone] = useState("");
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const askPin = !!state && !state.ok && state.needPin && pinFor === phone;
  return (
    <form action={action} onSubmit={() => setPinFor(phone)} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={<T th="เบอร์มือถือ" en="Mobile number" />}>
        <input
          name="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="08X-XXX-XXXX"
          required
          className={inputClass}
        />
      </Field>
      {askPin && (
        <Field label={<T th="PIN พนักงาน" en="Staff PIN" />} hint={<T th="ตัวเลข 6 หลัก (หรือรหัสผ่านที่ได้รับ)" en="6 digits (or the password you were given)" />}>
          <input
            name="pin"
            type={showPin ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            required
            className={inputClass}
          />
        </Field>
      )}
      {askPin && (
        <label className="-mt-2 flex w-fit cursor-pointer items-center gap-2 text-[14px] text-ink-2">
          <input
            type="checkbox"
            checked={showPin}
            onChange={(e) => setShowPin(e.target.checked)}
            className="size-4 accent-[var(--color-grass)]"
          />
          <T th="แสดงรหัส" en="Show PIN" />
        </label>
      )}
      <Message state={state} />
      <Button type="submit" variant="sign" size="lg" className="w-full" disabled={pending}>
        {pending ? <T th="กำลังเข้าสู่ระบบ…" en="Signing in…" /> : <T th="เข้าสู่ระบบ" en="Sign in" />}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, null);
  const [kind, setKind] = useState<"COMPANY" | "PERSON" | "DRIVER">("COMPANY");
  if (state?.ok) return <div className="mt-6"><Message state={state} /></div>;
  return (
    <form action={action} className="mt-6 space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-ink-2"><T th="สมัครในฐานะ" en="Register as" /></legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["COMPANY", "นิติบุคคล", "Company"],
              ["PERSON", "บุคคลธรรมดา", "Individual"],
              ["DRIVER", "คนขับ", "Driver"],
            ] as const
          ).map(([v, k, en]) => (
            <label
              key={v}
              className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-line p-3 has-[:checked]:border-sign has-[:checked]:bg-sign-wash"
            >
              <input
                type="radio"
                name="kind"
                value={v}
                checked={kind === v}
                onChange={() => setKind(v)}
                className="size-5 accent-[var(--color-grass)]"
              />
              <span className="font-semibold"><T th={k} en={en} /></span>
            </label>
          ))}
        </div>
        {kind === "DRIVER" && (
          <p className="mt-2 text-[14px] text-ink-2">
            <T th="คนขับสมัครได้เมื่อผู้เช่าเพิ่มเบอร์มือถือของคุณในหน้า คนขับ แล้ว" en="Drivers can register once the renter has added your mobile number on their Drivers page." />
          </p>
        )}
      </fieldset>
      <Field label={kind === "COMPANY" ? <T th="ชื่อบริษัท" en="Company name" /> : <T th="ชื่อ–นามสกุล" en="Full name" />}>
        <input name="name" required className={inputClass} />
      </Field>
      {kind !== "DRIVER" && (
        <Field
          label={kind === "COMPANY" ? <T th="เลขประจำตัวผู้เสียภาษี" en="Tax ID" /> : <T th="เลขบัตรประชาชน" en="National ID number" />}
          hint={<T th="13 หลัก" en="13 digits" />}
        >
          <input name="taxId" inputMode="numeric" required className={inputClass} />
        </Field>
      )}
      <Field label={<T th="เบอร์มือถือ" en="Mobile number" />} hint={<T th="ใช้เข้าสู่ระบบ" en="Used to sign in" />}>
        <input name="phone" inputMode="tel" autoComplete="tel" placeholder="08X-XXX-XXXX" required className={inputClass} />
      </Field>
      {kind !== "DRIVER" && (
        <Field label={<T th="อีเมล (ไม่บังคับ)" en="Email (optional)" />} hint={<T th="สำหรับรับใบเสร็จและการแจ้งเตือน" en="For receipts and notifications" />}>
          <input name="email" type="email" autoComplete="email" className={inputClass} />
        </Field>
      )}
      <label className="flex items-start gap-3 text-[15px]">
        <input name="pdpa" type="checkbox" required className="mt-1 size-5 accent-[var(--color-grass)]" />
        <T th="ยอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว (PDPA)" en="I accept the terms of use and privacy policy (PDPA)" />
      </label>
      {kind !== "DRIVER" && (
        <label className="flex items-start gap-3 text-[15px] text-ink-2">
          <input name="marketing" type="checkbox" className="mt-1 size-5 accent-[var(--color-grass)]" />
          <T th="รับข่าวสารและโปรโมชัน (ไม่บังคับ)" en="Send me news and promotions (optional)" />
        </label>
      )}
      <Message state={state} />
      <Button type="submit" variant="sign" size="lg" className="w-full" disabled={pending}>
        {pending ? <T th="กำลังสร้างบัญชี…" en="Creating account…" /> : <T th="สร้างบัญชี" en="Create account" />}
      </Button>
    </form>
  );
}

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContactMessage, null);
  if (state?.ok) return <div className="rounded-xl border border-line bg-paper p-6"><Message state={state} /></div>;
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line bg-paper p-6">
      <Field label={<T th="ชื่อ" en="Name" />}><input name="name" required className={inputClass} /></Field>
      <Field label={<T th="เบอร์โทร" en="Phone" />}><input name="phone" inputMode="tel" required className={inputClass} /></Field>
      <Field label={<T th="ข้อความ" en="Message" />}><textarea name="message" rows={4} required className={`${inputClass} h-auto py-3`} /></Field>
      <Message state={state} />
      <Button type="submit" variant="sign" className="w-full" disabled={pending}>
        {pending ? <T th="กำลังส่ง…" en="Sending…" /> : <T th="ส่งข้อความ" en="Send message" />}
      </Button>
    </form>
  );
}
