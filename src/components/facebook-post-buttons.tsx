"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postArticleNow } from "@/app/actions/facebook";
import { Button } from "./ui";

export function FacebookPostButtons({ slug, message, canPost }: { slug: string; message: string; canPost: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(message);
            setNote("คัดลอกข้อความแล้ว นำไปวางในโพสต์เพจได้เลย");
          } catch {
            setNote("คัดลอกไม่สำเร็จ");
          }
        }}
      >
        คัดลอกข้อความโพสต์
      </Button>
      {canPost && (
        <Button
          size="sm"
          variant="sign"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await postArticleNow(slug);
              setNote(r.ok ? r.message ?? "โพสต์แล้ว" : r.error);
              router.refresh();
            })
          }
        >
          โพสต์ลง Facebook ตอนนี้
        </Button>
      )}
      {note && <span className="text-[13px] font-semibold text-ink-2">{note}</span>}
    </div>
  );
}
