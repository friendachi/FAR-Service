import { connection } from "next/server";
import { CircleAlert, CircleCheck } from "lucide-react";
import { schemaStatus } from "@/lib/schema-version";
import { cx } from "./ui";

/** One line for the footer: database version vs the newest .sql in the code. */
export async function SchemaVersionLine() {
  await connection();
  const s = await schemaStatus();
  return (
    <span className={cx("inline-flex items-center gap-1", !s.upToDate && "font-semibold")}>
      {s.upToDate ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
      ฐานข้อมูลเวอร์ชัน {s.db}
      {!s.upToDate && ` · ล่าสุด ${s.latest} (ยังไม่อัปเดต)`}
    </span>
  );
}

/** Admin panel: which version Supabase is on and which .sql files still need to be run, in order. */
export async function SchemaVersionPanel() {
  await connection();
  const s = await schemaStatus();
  return (
    <div className={cx("rounded-xl border-2 p-5", s.upToDate ? "border-sign bg-sign-wash" : "border-danger bg-danger-tint")}>
      <p className="flex items-center gap-2 text-[17px] font-bold">
        {s.upToDate ? <CircleCheck className="size-5 text-grass" aria-hidden /> : <CircleAlert className="size-5 text-danger" aria-hidden />}
        ฐานข้อมูล Supabase เวอร์ชัน {s.db}
        <span className="text-[14px] font-semibold text-ink-2">· ไฟล์ .sql ล่าสุดในระบบ {s.latest}</span>
      </p>
      {s.upToDate ? (
        <p className="mt-1 text-[14px] text-ink-2">อัปเดตครบแล้ว ไม่มีไฟล์ .sql ที่ต้องรันเพิ่ม</p>
      ) : (
        <>
          <p className="mt-1 text-[14px] text-ink-2">
            ยังไม่ได้รันไฟล์ต่อไปนี้ใน Supabase → SQL Editor (รันตามลำดับ วางเนื้อหาทั้งไฟล์แล้วกด Run):
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-6 text-[14px]">
            {s.pending.map((m) => (
              <li key={m.no}>
                <strong>{m.no}</strong> · <code className="rounded bg-paper px-1.5 py-0.5 text-[13px]">supabase/migrations/{m.file}</code>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[13px] text-ink-3">รันเสร็จแล้วรีเฟรชหน้านี้ เวอร์ชันจะเปลี่ยนเอง</p>
        </>
      )}
    </div>
  );
}
