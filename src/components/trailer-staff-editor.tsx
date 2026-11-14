"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { addTrailerPhotos, deleteTrailerPhoto, setMainTrailerPhoto } from "@/app/actions/trailer-photos";
import { shrink } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import type { TrailerStatus, Yard, YardId } from "@/lib/types";
import { TrailerStatusControl } from "./trailer-admin";
import { Button, cx } from "./ui";

/** Staff panel on a trailer page: photos (add / main / delete) and availability status + yard. */
export function TrailerStaffEditor({
  trailerId,
  status,
  yard,
  yards,
  photos,
  usingBuiltIn,
}: {
  trailerId: string;
  status: TrailerStatus;
  yard: YardId;
  yards: Yard[];
  photos: { id: string; url: string }[];
  /** true while the trailer still shows the built-in photos (none uploaded yet) */
  usingBuiltIn: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: (r.ok ? r.message : r.error) ?? "" });
      if (r.ok) router.refresh();
    });

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    run(async () => {
      const sb = createClient();
      const paths: string[] = [];
      for (const [i, f] of Array.from(files).entries()) {
        if (!f.type.startsWith("image/")) continue;
        setProgress(`กำลังอัปโหลด ${i + 1}/${files.length}…`);
        const path = `${trailerId}/${crypto.randomUUID()}.jpg`;
        const { error } = await sb.storage.from("trailer-photos").upload(path, await shrink(f), { contentType: "image/jpeg" });
        if (error) {
          setProgress(null);
          return { ok: false, error: `อัปโหลดไม่สำเร็จ: ${error.message}` };
        }
        paths.push(path);
      }
      setProgress(null);
      if (input.current) input.current.value = "";
      return paths.length ? addTrailerPhotos(trailerId, paths) : { ok: false, error: "เลือกไฟล์รูปภาพ" };
    });
  };

  return (
    <section id="staff-edit" className="rounded-xl border-2 border-dashed border-reflect bg-paper p-5">
      <h2 className="text-[19px] font-bold">แก้ไขหางคันนี้ (พนักงาน)</h2>

      <h3 className="mt-4 text-[15px] font-bold">สถานะ / ลาน</h3>
      <p className="mb-2 text-[13px] text-ink-3">เปลี่ยนแล้วหน้าเว็บจะแสดง ว่าง / ไม่ว่าง ตามนี้ทันที</p>
      <TrailerStatusControl trailerId={trailerId} status={status} yard={yard} yards={yards} editable />

      <h3 className="mt-6 text-[15px] font-bold">รูปภาพ</h3>
      <p className="mb-3 text-[13px] text-ink-3">
        {usingBuiltIn
          ? "ตอนนี้หน้าเว็บใช้รูปชุดเดิมของระบบ เมื่ออัปโหลดรูปแรก หน้าเว็บจะเปลี่ยนไปใช้รูปที่อัปโหลดแทน"
          : "รูปแรกคือรูปหลักที่แสดงบนการ์ดและด้านบนสุดของหน้า"}
      </p>
      {photos.length > 0 && (
        <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className={cx("overflow-hidden rounded-lg border-2", i === 0 ? "border-sign" : "border-line")}>
              <div className="relative aspect-[4/3] bg-ground">
                <Image src={p.url} alt={`รูปที่ ${i + 1}`} fill sizes="200px" className="object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded bg-sign px-2 py-0.5 text-[12px] font-bold text-on-sign">รูปหลัก</span>}
              </div>
              <div className="flex divide-x divide-line border-t border-line text-[12px] font-semibold">
                {i > 0 && (
                  <button type="button" disabled={pending} onClick={() => run(() => setMainTrailerPhoto(trailerId, p.id))} className="flex flex-1 items-center justify-center gap-1 py-2 text-grass hover:bg-sign-wash">
                    <Star className="size-3.5" aria-hidden /> ตั้งเป็นรูปหลัก
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => confirm("ลบรูปนี้?") && run(() => deleteTrailerPhoto(trailerId, p.id))}
                  className="flex flex-1 items-center justify-center gap-1 py-2 text-danger hover:bg-danger-tint"
                >
                  <Trash2 className="size-3.5" aria-hidden /> ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="sign" disabled={pending} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> เพิ่มรูป
        </Button>
        {progress && <span className="text-[14px] text-ink-2">{progress}</span>}
        {msg && !progress && <span className={cx("text-[14px] font-semibold", msg.ok ? "text-grass" : "text-danger")}>{msg.text}</span>}
      </div>
      <p className="mt-2 text-[12px] text-ink-3">เลือกได้หลายรูปพร้อมกัน ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด</p>
    </section>
  );
}
