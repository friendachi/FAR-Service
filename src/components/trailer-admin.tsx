"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { addTrailer, updateTrailerStatus } from "@/app/actions/settings";
import type { TrailerStatus, Yard, YardId } from "@/lib/types";
import { Button, Field, cx, inputClass } from "./ui";

export function AddTrailerForm({ models, yards }: { models: { code: string; name: string }[]; yards: Yard[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [key, setKey] = useState(0);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await addTrailer({
        model: String(f.get("model")),
        yard: f.get("yard") as YardId,
        code: String(f.get("code") ?? ""),
        plate: String(f.get("plate") ?? ""),
      });
      setMsg(res.ok ? { ok: true, text: res.message ?? "เพิ่มหางแล้ว" } : { ok: false, text: res.error });
      if (res.ok) {
        setKey((k) => k + 1);
        router.refresh();
      }
    });
  };

  return (
    <form key={key} onSubmit={submit} className="space-y-4">
      <Field label="รุ่น (กำหนดสเปกและราคา)">
        <select name="model" className={inputClass}>
          {models.map((m) => (
            <option key={m.code} value={m.code}>{m.name}</option>
          ))}
        </select>
      </Field>
      <Field label="ลานที่อยู่">
        <select name="yard" className={inputClass}>
          {yards.map((y) => (
            <option key={y.id} value={y.id}>ลาน {y.number} · {y.short}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="รหัสหาง"><input name="code" required placeholder="SK10" className={inputClass} /></Field>
        <Field label="ทะเบียน"><input name="plate" required placeholder="75-0000" className={inputClass} /></Field>
      </div>
      {msg && (
        <p className={cx("text-[14px] font-semibold", msg.ok ? "text-grass" : "text-danger")} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      )}
      <Button type="submit" variant="sign" className="w-full" disabled={pending}>
        {pending ? "กำลังบันทึก…" : "บันทึกหาง"}
      </Button>
    </form>
  );
}

const STATUSES: [TrailerStatus, string][] = [
  ["AVAILABLE", "ว่าง"],
  ["RENTED", "มีผู้เช่า"],
  ["MAINTENANCE", "ซ่อมบำรุง"],
];

export function TrailerStatusControl({
  trailerId,
  status,
  yard,
  yards,
  editable,
}: {
  trailerId: string;
  status: TrailerStatus;
  yard: YardId;
  yards: Yard[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const save = (s: string, y: string) =>
    start(async () => {
      const res = await updateTrailerStatus(trailerId, s, y as YardId);
      setErr(res.ok ? null : res.error);
      if (res.ok) router.refresh();
    });
  if (!editable) {
    return (
      <span className="text-[14px]">
        {STATUSES.find(([s]) => s === status)?.[1] ?? status} · ลาน {yards.find((y) => y.id === yard)?.number}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="สถานะ"
        defaultValue={status}
        disabled={pending}
        onChange={(e) => save(e.target.value, yard)}
        className={cx(inputClass, "h-9 w-auto py-0 text-[14px]")}
      >
        {STATUSES.map(([s, l]) => (
          <option key={s} value={s}>{l}</option>
        ))}
        {!STATUSES.some(([s]) => s === status) && <option value={status}>{status}</option>}
      </select>
      <select
        aria-label="ลาน"
        defaultValue={yard}
        disabled={pending}
        onChange={(e) => save(status, e.target.value)}
        className={cx(inputClass, "h-9 w-auto py-0 text-[14px]")}
      >
        {yards.map((y) => (
          <option key={y.id} value={y.id}>ลาน {y.number}</option>
        ))}
      </select>
      {err && <span className="text-[13px] text-danger">{err}</span>}
    </div>
  );
}

export function ExportCsvButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  const download = () => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="outline" onClick={download}>
      <Download className="size-4" aria-hidden /> Export CSV
    </Button>
  );
}
