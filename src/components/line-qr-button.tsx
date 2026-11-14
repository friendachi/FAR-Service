"use client";

import { useRef } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { LINE_QR } from "@/lib/company";
import { LineIcon } from "./brand-icons";
import { T } from "./t";

/** Any LINE button on the site: opens the LINE QR code in a popup to scan right away (no page change). */
export function LineQrButton({ className, children, label = "LINE · สแกน QR Code" }: { className?: string; children: React.ReactNode; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" aria-label={label} aria-haspopup="dialog" onClick={() => ref.current?.showModal()} className={className}>
        {children}
      </button>
      <dialog
        ref={ref}
        aria-label="QR Code LINE FAR Service"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close(); // click on the backdrop closes it
        }}
        className="m-auto w-[min(92vw,360px)] rounded-2xl border-0 bg-paper p-0 text-ink shadow-[0_24px_64px_-20px_rgba(0,0,0,0.6)] backdrop:bg-black/55"
      >
        <div className="relative p-6 text-center">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="ปิด · Close"
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-ground"
          >
            <X className="size-5" aria-hidden />
          </button>
          <p className="flex items-center justify-center gap-2 text-[18px] font-bold">
            <LineIcon className="size-8" />
            <T th="แอดไลน์ FAR Service" en="Add FAR Service on LINE" />
          </p>
          <Image src={LINE_QR} alt="QR Code LINE FAR Service" width={280} height={280} className="mx-auto mt-4 rounded-lg border border-line" />
          <p className="mt-3 text-[14px] text-ink-2">
            <T th="เปิดแอป LINE แล้วสแกน QR Code นี้เพื่อเพิ่มเพื่อนและแชทกับเรา" en="Open LINE and scan this code to add us and chat." />
          </p>
        </div>
      </dialog>
    </>
  );
}
