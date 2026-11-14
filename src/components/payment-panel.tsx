"use client";

import { useState, useTransition } from "react";
import { submitPayment } from "@/app/actions/customer";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { promptPayPayload } from "@/lib/promptpay";
import { Clock, Upload } from "lucide-react";
import { money } from "@/lib/format";
import { Button, cx } from "./ui";

export type PaymentAccounts = {
  promptpay_id?: string | null;
  bank?: string | null;
  account_no?: string | null;
  account_name?: string | null;
};

export function PaymentPanel({
  bookingId,
  amount,
  due,
  accounts,
  monthlyNote,
}: {
  bookingId: string;
  amount: number;
  /** for rentals longer than a month: when the following monthly rent is due */
  monthlyNote?: string;
  due: string;
  accounts: PaymentAccounts;
}) {
  const [method, setMethod] = useState<"qr" | "transfer">("qr");
  const [slip, setSlip] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);

  const pay = () => {
    setError(null);
    start(async () => {
      let slipPath: string | undefined;
      if (method === "transfer" && slip) {
        if (slip.size > 10 * 1024 * 1024) return setError("ไฟล์ใหญ่เกิน 10 MB");
        const ext = slip.name.split(".").pop()?.toLowerCase() ?? "jpg";
        slipPath = `${bookingId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await createClient().storage.from("payment-slips").upload(slipPath, slip, { contentType: slip.type });
        if (upErr) return setError("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
      }
      const res = await submitPayment({ bookingId, method: method === "qr" ? "PROMPTPAY" : "TRANSFER", slipPath });
      if (!res.ok) return setError(res.error);
      setSent(true);
    });
  };

  if (sent) {
    return (
      <div className="rounded-xl border-2 border-sign bg-sign-wash p-5">
        <p className="text-[18px] font-bold text-sign-deep">ส่งหลักฐานการชำระแล้ว</p>
        <p className="mt-1 text-[15px] text-ink-2">
          เจ้าหน้าที่จะตรวจสอบการชำระ แล้วติดต่อกลับตามเบอร์โทรและข้อมูลติดต่อที่คุณให้ไว้ เพื่อยืนยันการจองและนัดวันรับหาง
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-reflect bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-reflect-tint px-5 py-3">
        <p className="font-bold text-sign-deep">ชำระเงินเพื่อยืนยันการจอง</p>
        <p className="flex items-center gap-1.5 text-[14px] font-semibold text-warn">
          <Clock className="size-4" aria-hidden /> ภายใน {due}
        </p>
      </div>
      <div className="p-5">
        <p className="text-[14px] text-ink-3">
          ยอดชำระครั้งแรกก่อนรับหาง (เงินค้ำประกัน + ค่าเช่า{monthlyNote ? "เดือนแรก" : ""} + ค่าใส่ยางถ้ามี + VAT)
        </p>
        <p className="font-route text-[34px] font-extrabold tabular text-ink">{money(amount)}</p>
        {monthlyNote && <p className="mt-1 rounded-lg bg-sign-wash px-3 py-2 text-[14px] font-semibold text-ink">{monthlyNote}</p>}

        <div className="mt-4 grid grid-cols-2 rounded-lg border-2 border-sign p-0.5" role="tablist">
          {(
            [
              ["qr", "PromptPay QR"],
              ["transfer", "โอนและแนบสลิป"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={method === id}
              onClick={() => setMethod(id)}
              className={cx(
                "h-10 rounded-md text-[15px] font-semibold",
                method === id ? "bg-sign text-on-sign" : "text-grass hover:bg-sign-wash",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {method === "qr" ? (
          accounts.promptpay_id ? (
            <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div className="rounded-lg border border-line p-3">
                <QRCodeSVG value={promptPayPayload(accounts.promptpay_id, amount)} size={168} fgColor="#003b20" />
              </div>
              <div className="text-[15px] text-ink-2">
                <p className="font-semibold text-ink">สแกนด้วยแอปธนาคาร</p>
                <p className="mt-1">QR นี้ระบุยอด {money(amount)} ไว้แล้ว ชำระแล้วกดแจ้งด้านล่าง</p>
                {accounts.account_name && <p className="mt-2 text-[14px]">ชื่อบัญชี {accounts.account_name}</p>}
              </div>
            </div>
          ) : (
            <p className="mt-5 rounded-lg bg-warn-tint px-4 py-3 text-[15px] text-warn">
              บริษัทยังไม่ได้ตั้งค่า PromptPay กรุณาโอนเงินและแนบสลิป หรือติดต่อเจ้าหน้าที่
            </p>
          )
        ) : (
          <div className="mt-5 space-y-3 text-[15px]">
            <div className="rounded-lg bg-ground p-4">
              <p className="text-ink-3">โอนเข้าบัญชี</p>
              {accounts.account_no ? (
                <>
                  <p className="font-semibold">
                    {accounts.bank ?? "—"} · {accounts.account_name ?? "FAR Service"}
                  </p>
                  <p className="font-route text-[18px] font-extrabold tabular">{accounts.account_no}</p>
                </>
              ) : (
                <p className="font-semibold text-warn">บริษัทยังไม่ได้ตั้งค่าบัญชีธนาคาร กรุณาติดต่อเจ้าหน้าที่</p>
              )}
            </div>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong p-5 font-semibold text-grass hover:border-sign">
              <Upload className="size-4" aria-hidden />
              {slip?.name ?? "แนบสลิปการโอน (JPG, PNG, PDF)"}
              <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => setSlip(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          disabled={(method === "transfer" && !slip) || pending}
          onClick={pay}
        >
          {pending ? "กำลังส่ง…" : method === "qr" ? "ชำระแล้ว แจ้งให้ตรวจสอบ" : "ส่งสลิปให้ตรวจสอบ"}
        </Button>
        {error && (
          <p className="mt-2 text-[14px] font-semibold text-danger" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
