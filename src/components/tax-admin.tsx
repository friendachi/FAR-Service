"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, FileText, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import {
  addVehicleDocument,
  deleteRegistration,
  deleteVehicleDocument,
  renewTax,
  saveRegistration,
} from "@/app/actions/fleet-admin";
import { createClient } from "@/lib/supabase/client";
import { plusYears, type DocKind } from "@/lib/fleet-admin";
import { thDate } from "@/lib/format";
import { Button, Field, cx, inputClass } from "./ui";

type Res = { ok: boolean; message?: string; error?: string };

/** Runs a server action, shows its message and refreshes the page on success. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Res>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, msg, setMsg, run };
}

export function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg?.text) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={cx("text-[13px] font-semibold", msg.ok ? "text-grass" : "text-danger")}>
      {msg.text}
    </p>
  );
}

/** Add a plate, or edit one (plate, province, expiry, note). */
export function RegistrationForm({
  reg,
  onDone,
}: {
  reg?: { id: string; plate: string; province: string; taxExpiresOn: string | null; note: string | null };
  onDone?: () => void;
}) {
  const { pending, msg, run } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const s = (k: string) => String(f.get(k) ?? "");
        run(
          () => saveRegistration({ id: reg?.id, plate: s("plate"), province: s("province"), taxExpiresOn: s("tax"), note: s("note") }),
          onDone,
        );
      }}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end"
    >
      <Field label="ทะเบียน">
        <input name="plate" required defaultValue={reg?.plate} placeholder="74-4875" className={inputClass} />
      </Field>
      <Field label="จังหวัด">
        <input name="province" defaultValue={reg?.province ?? "ชลบุรี"} list="provinces" className={inputClass} />
      </Field>
      <Field label="ภาษีหมดอายุ">
        <input name="tax" type="date" defaultValue={reg?.taxExpiresOn ?? ""} className={inputClass} />
      </Field>
      <Field label="หมายเหตุ">
        <input name="note" defaultValue={reg?.note ?? ""} className={inputClass} />
      </Field>
      <div className="flex flex-col gap-1">
        <Button type="submit" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึก"}</Button>
      </div>
      <datalist id="provinces">
        <option value="ชลบุรี" />
        <option value="กรุงเทพมหานคร" />
        <option value="ระยอง" />
        <option value="ฉะเชิงเทรา" />
        <option value="สมุทรปราการ" />
      </datalist>
      <div className="sm:col-span-2 lg:col-span-5"><Msg msg={msg} /></div>
    </form>
  );
}

export function AddRegistration() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> เพิ่มทะเบียน
      </Button>
    );
  return (
    <div className="w-full rounded-xl border-2 border-sign bg-paper p-4">
      <p className="mb-3 font-bold">เพิ่มทะเบียนหาง</p>
      <RegistrationForm onDone={() => setOpen(false)} />
    </div>
  );
}

/** Row actions: "ต่อภาษีแล้ว" (+1 year), edit, delete. */
export function TaxActions({
  reg,
  canDelete,
}: {
  reg: { id: string; plate: string; province: string; taxExpiresOn: string | null; note: string | null };
  canDelete: boolean;
}) {
  const { pending, msg, run } = useAction();
  const [editing, setEditing] = useState(false);
  const next = plusYears(reg.taxExpiresOn ?? new Date().toISOString().slice(0, 10));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`ยืนยันว่าต่อภาษีทะเบียน ${reg.plate} แล้ว?\nวันหมดอายุจะเปลี่ยนเป็น ${thDate(next)}`)) run(() => renewTax(reg.id));
          }}
        >
          <CalendarCheck2 className="size-4" aria-hidden /> ต่อภาษีแล้ว
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((v) => !v)} aria-label={`แก้ไข ${reg.plate}`}>
          <Pencil className="size-4" aria-hidden />
        </Button>
        {canDelete && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-danger"
            aria-label={`ลบ ${reg.plate}`}
            disabled={pending}
            onClick={() => confirm(`ลบทะเบียน ${reg.plate} และไฟล์เอกสารทั้งหมด?`) && run(() => deleteRegistration(reg.id))}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <Msg msg={msg} />
      {editing && (
        <div className="min-w-[280px] rounded-lg border border-line bg-ground p-3">
          <RegistrationForm reg={reg} onDone={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

/** Files of one kind (book / tax / CMI) for one plate: open, delete, attach more (image or PDF). */
export function DocCell({
  registrationId,
  kind,
  files,
}: {
  registrationId: string;
  kind: DocKind;
  files: { id: string; url: string | null; name: string }[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const { pending, msg, run } = useAction();
  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    run(async () => {
      const sb = createClient();
      for (const f of Array.from(list)) {
        if (f.size > 15 * 1024 * 1024) return { ok: false, error: `${f.name} ใหญ่เกิน 15MB` };
        const ext = (f.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
        const path = `${registrationId}/${kind.toLowerCase()}-${crypto.randomUUID()}.${ext}`;
        const up = await sb.storage.from("vehicle-docs").upload(path, f, { contentType: f.type || undefined });
        if (up.error) return { ok: false, error: `อัปโหลดไม่สำเร็จ: ${up.error.message}` };
        const r = await addVehicleDocument(registrationId, kind, path, f.name);
        if (!r.ok) return r;
      }
      return { ok: true, message: "แนบไฟล์แล้ว" };
    });
  };
  return (
    <div className="min-w-[120px] space-y-1">
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-1 text-[13px]">
          <FileText className="size-3.5 shrink-0 text-grass" aria-hidden />
          {f.url ? (
            <a href={f.url} target="_blank" rel="noreferrer" className="max-w-[130px] truncate font-semibold text-grass underline" title={f.name}>
              {f.name}
            </a>
          ) : (
            <span className="truncate">{f.name}</span>
          )}
          <button
            type="button"
            aria-label={`ลบไฟล์ ${f.name}`}
            className="ml-auto rounded p-0.5 text-ink-3 hover:bg-danger-tint hover:text-danger"
            disabled={pending}
            onClick={() => confirm(`ลบไฟล์ ${f.name}?`) && run(() => deleteVehicleDocument(f.id))}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button
        type="button"
        disabled={pending}
        onClick={() => input.current?.click()}
        className="flex items-center gap-1 rounded-md border border-dashed border-line-strong px-2 py-1 text-[12px] font-semibold text-ink-2 hover:border-sign hover:text-grass"
      >
        <Paperclip className="size-3.5" aria-hidden /> {pending ? "กำลังอัปโหลด…" : "แนบไฟล์"}
      </button>
      <Msg msg={msg?.ok ? null : msg} />
    </div>
  );
}
