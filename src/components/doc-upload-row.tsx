"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { registerDocument } from "@/app/actions/customer";
import { docStatusLabel, docStatusTone } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { CustomerDocument, DocRequirement } from "@/lib/types";
import { Badge, cx } from "./ui";

const MAX = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "application/pdf"];

/**
 * One required document: rule, current file and status, and an upload control.
 * Live: the file goes straight to the private `documents` bucket under the customer's folder,
 * then the server registers it as the current version (status: รอตรวจ).
 */
export function DocUploadRow({
  req,
  doc,
  customerId,
}: {
  req: DocRequirement;
  doc: CustomerDocument;
  /** Storage folder owner. Required for live uploads. */
  customerId?: string;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = picked ? "PENDING" : doc.status;
  const reuse = !picked && doc.status === "APPROVED";
  const ownerMissing = !doc.ownerId;

  const upload = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError("รองรับเฉพาะ JPG, PNG หรือ PDF");
    if (file.size > MAX) return setError("ไฟล์ใหญ่เกิน 10 MB");
    if (!customerId) return setError("ไม่พบบัญชีลูกค้า");

    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${customerId}/${req.key}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("documents").upload(path, file, { contentType: file.type });
    if (upErr) {
      setBusy(false);
      return setError("อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
    }
    const res = await registerDocument({
      requirementKey: req.key,
      owner: req.owner,
      ownerId: doc.ownerId,
      storagePath: path,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPicked(file.name);
  };

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{req.label}</p>
        {req.rule && <p className="text-[14px] text-warn">ต้อง{req.rule}</p>}
        {(picked || doc.fileName) && (
          <p className="mt-1 flex items-center gap-1.5 text-[14px] text-ink-2">
            <FileText className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{picked ?? doc.fileName}</span>
            {reuse && <span className="text-ink-3">· ใช้ไฟล์เดิมที่ผ่านแล้ว</span>}
          </p>
        )}
        {doc.note && !picked && <p className="mt-1 text-[14px] text-danger">{doc.note}</p>}
        {error && (
          <p className="mt-1 text-[14px] font-semibold text-danger" role="alert">
            {error}
          </p>
        )}
        {ownerMissing && <p className="mt-1 text-[13px] text-ink-3">บันทึกข้อมูลเจ้าของเอกสารก่อน จึงจะอัปโหลดได้</p>}
      </div>
      <div className="flex items-center gap-3">
        <Badge tone={docStatusTone[status]}>{busy ? "กำลังอัปโหลด" : picked ? "ส่งแล้ว รอตรวจ" : docStatusLabel[status]}</Badge>
        <label
          className={cx(
            "inline-flex h-10 items-center gap-2 rounded-lg border-2 px-3.5 text-sm font-semibold",
            busy || ownerMissing ? "pointer-events-none opacity-50" : "cursor-pointer",
            doc.status === "APPROVED" && !picked
              ? "border-line text-ink-2 hover:border-line-strong"
              : "border-sign text-grass hover:bg-sign-wash",
          )}
        >
          <Upload className="size-4" aria-hidden />
          {doc.status === "MISSING" && !picked ? "อัปโหลด" : "เปลี่ยนไฟล์"}
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="sr-only"
            disabled={busy || ownerMissing}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
      </div>
    </li>
  );
}
