"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Clock } from "lucide-react";
import { acknowledgeInspection } from "@/app/actions/yard";
import type { InspectionInfo } from "@/lib/types";
import { uploadTo } from "@/lib/upload";
import { SignaturePad } from "./signature-pad";
import { Button, cx } from "./ui";

/** Driver's quick confirmation of the Ops checklist on their own phone (PRD D7/D8, FR-DRV-04). */
export function DriverAcknowledge({
  kind,
  bookingId,
  checkedIn,
  inspection,
  totalItems,
}: {
  kind: "PICKUP" | "RETURN";
  bookingId: string;
  checkedIn: boolean;
  inspection?: InspectionInfo;
  totalItems: number;
}) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<"AGREE" | "REMARK" | null>(null);
  const [remark, setRemark] = useState("");
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const exportSig = useRef<(() => Promise<Blob | null>) | null>(null);

  if (inspection?.ack) {
    return (
      <div className="sign-panel on-sign px-6 py-8 text-center">
        <CircleCheckBig className="mx-auto size-12" aria-hidden />
        <p className="mt-3 text-[24px] font-bold">เซ็นรับทราบแล้ว</p>
        <p className="mt-1 text-sign-ink">
          {inspection.ack === "AGREE" ? "เจ้าหน้าที่ลานจะยืนยันการส่งมอบ" : "ส่งข้อสังเกตให้หัวหน้าลานและผู้เช่าแล้ว"}
        </p>
      </div>
    );
  }

  if (!checkedIn || !inspection?.done) {
    return (
      <div className="rounded-xl border-2 border-reflect bg-paper p-6 text-center">
        <Clock className="mx-auto size-10 text-warn" aria-hidden />
        <p className="mt-3 text-[20px] font-bold">{!checkedIn ? "รอเจ้าหน้าที่เช็กอิน" : "รอเจ้าหน้าที่ตรวจสภาพ"}</p>
        <p className="mt-1 text-[16px] text-ink-2">ยื่น QR ให้เจ้าหน้าที่ แล้วกดรีเฟรชเมื่อเจ้าหน้าที่ตรวจเสร็จ</p>
        <Button variant="outline" className="mt-4" onClick={() => router.refresh()}>
          รีเฟรช
        </Button>
      </div>
    );
  }

  const submit = () => {
    setError(null);
    start(async () => {
      try {
        const blob = await exportSig.current?.();
        if (!blob) throw new Error("ยังไม่มีลายเซ็น");
        const path = await uploadTo("signatures", `${bookingId}/${inspection.id}.png`, blob, "image/png");
        const res = await acknowledgeInspection({
          inspectionId: inspection.id,
          result: verdict === "REMARK" ? (kind === "PICKUP" ? "REMARK" : "DISPUTE") : "AGREE",
          remark,
          signaturePath: path,
        });
        if (!res.ok) throw new Error(res.error);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-paper p-5">
        <h2 className="text-[19px] font-bold">ผลตรวจของเจ้าหน้าที่ลาน</h2>
        <p className="mt-1 text-[16px] text-ink-2">
          ตรวจแล้ว {totalItems} รายการ · {inspection.damaged.length ? `พบจุดเสียหาย ${inspection.damaged.length} จุด` : "ไม่พบความเสียหาย"}
        </p>
        {inspection.damaged.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-[16px] text-danger">
            {inspection.damaged.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        )}
      </section>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-[19px] font-bold">สภาพหางตรงกับผลตรวจไหม</legend>
        {(
          [
            ["AGREE", kind === "PICKUP" ? "ตรงกับผลตรวจ" : "รับทราบผลตรวจ"],
            ["REMARK", kind === "PICKUP" ? "มีข้อสังเกต" : "โต้แย้งผลตรวจ"],
          ] as const
        ).map(([v, label]) => (
          <label
            key={v}
            className={cx(
              "flex h-16 cursor-pointer items-center gap-4 rounded-xl border-2 px-5 text-[19px] font-bold",
              verdict === v ? (v === "AGREE" ? "border-sign bg-sign-wash text-sign-deep" : "border-danger bg-danger-tint text-danger") : "border-line bg-paper",
            )}
          >
            <input type="radio" name="verdict" className="size-6 accent-[var(--color-sign)]" checked={verdict === v} onChange={() => setVerdict(v)} />
            {label}
          </label>
        ))}
      </fieldset>

      {verdict === "REMARK" && (
        <label className="block rounded-xl border-2 border-danger bg-paper p-5">
          <span className="mb-1.5 block text-[16px] font-semibold">ระบุจุดที่ไม่ตรง</span>
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            placeholder="เช่น รอยบุบที่กันชนท้ายด้านซ้าย มีอยู่ก่อนแล้ว"
            className="w-full rounded-lg border-2 border-line p-3 text-[17px] focus:border-sign focus:outline-none"
          />
        </label>
      )}

      <section>
        <h2 className="mb-2 text-[19px] font-bold">เซ็นรับทราบ</h2>
        <SignaturePad onChange={setSigned} exportRef={exportSig} />
      </section>

      {error && (
        <p className="rounded-lg bg-danger-tint px-4 py-3 text-[16px] font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        className="h-16 w-full text-[19px]"
        disabled={!verdict || !signed || (verdict === "REMARK" && !remark.trim()) || pending}
        onClick={submit}
      >
        {pending ? "กำลังบันทึก…" : "ยืนยันและเซ็นรับทราบ"}
      </Button>
    </div>
  );
}
