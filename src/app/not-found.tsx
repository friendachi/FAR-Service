import Link from "next/link";
import { Mascot } from "@/components/mascot";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="sign-panel on-sign max-w-md px-8 py-10 text-center">
        <Mascot pose="shrug" className="mx-auto h-40 w-auto" />
        <p className="font-route text-[48px] font-extrabold">404</p>
        <h1 className="mt-2 text-[24px] font-bold">ไม่พบหน้านี้</h1>
        <p className="mt-2 text-sign-ink">ลิงก์อาจเปลี่ยนไปแล้ว หรือข้อมูลนี้ถูกลบ</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-reflect px-5 font-semibold text-sign-deep">กลับหน้าแรก</Link>
      </div>
    </main>
  );
}
