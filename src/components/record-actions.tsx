"use client";

import { useRouter } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { deleteCheckup, deleteHandover } from "@/app/actions/handovers";
import { Msg, useAction } from "./tax-admin";
import { Button } from "./ui";

export function PrintButton({ label = "พิมพ์ / บันทึก PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden /> {label}
    </Button>
  );
}

/** Super Admin only: deletes a hand-over or inspection record with its photos and signatures. */
export function DeleteRecord({ id, kind, back }: { id: string; kind: "handover" | "checkup"; back: string }) {
  const router = useRouter();
  const { pending, msg, run } = useAction();
  return (
    <span className="inline-flex items-center gap-2 print:hidden">
      <Button
        type="button"
        variant="danger"
        disabled={pending}
        onClick={() =>
          confirm("ลบบันทึกนี้พร้อมรูปและลายเซ็นทั้งหมด? กู้คืนไม่ได้") &&
          run(() => (kind === "handover" ? deleteHandover(id) : deleteCheckup(id)), () => router.push(back))
        }
      >
        <Trash2 className="size-4" aria-hidden /> ลบ
      </Button>
      <Msg msg={msg?.ok ? null : msg} />
    </span>
  );
}
