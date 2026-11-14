"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updateCustomer } from "@/app/actions/customer";
import type { Customer } from "@/lib/types";
import { Button, Field, Panel, inputClass } from "./ui";

type Msg = { ok: boolean; text: string } | null;

function Note({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={`text-[14px] font-semibold ${msg.ok ? "text-grass" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>
      {msg.text}
    </p>
  );
}

export function AccountForm({ customer: c }: { customer: Customer }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateCustomer({
        customerId: c.id,
        name: String(f.get("name")),
        taxId: String(f.get("taxId")),
        address: String(f.get("address")),
        contact: String(f.get("contact")),
        phone: String(f.get("phone")),
        email: String(f.get("email")),
      });
      setMsg(res.ok ? { ok: true, text: res.message ?? "บันทึกแล้ว" } : { ok: false, text: res.error });
    });
  };

  return (
    <div className="max-w-2xl">
      <Panel title="ข้อมูลผู้เช่าและผู้ติดต่อ">
        <form onSubmit={save} className="space-y-4">
          <Field label={c.kind === "COMPANY" ? "ชื่อบริษัท" : "ชื่อ–นามสกุล"}><input name="name" defaultValue={c.name} className={inputClass} /></Field>
          <Field label="เลขประจำตัวผู้เสียภาษี"><input name="taxId" defaultValue={c.taxId} inputMode="numeric" className={`${inputClass} tabular`} /></Field>
          <Field label="ที่อยู่ออกใบกำกับภาษี"><textarea name="address" defaultValue={c.address} rows={3} className={`${inputClass} h-auto py-3`} /></Field>
          <Field label="ผู้ติดต่อ"><input name="contact" defaultValue={c.contact} className={inputClass} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="เบอร์โทร"><input name="phone" defaultValue={c.phone} inputMode="tel" className={inputClass} /></Field>
            <Field label="อีเมล"><input name="email" defaultValue={c.email} type="email" className={inputClass} /></Field>
          </div>
          <Note msg={msg} />
          <Button type="submit" variant="sign" disabled={pending}>บันทึก</Button>
        </form>
      </Panel>
    </div>
  );
}
