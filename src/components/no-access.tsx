import Link from "next/link";

export function NoAccess({ need }: { need: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper p-10 text-center">
      <p className="text-[20px] font-bold">บทบาทของคุณเข้าหน้านี้ไม่ได้</p>
      <p className="mt-2 text-ink-2">หน้านี้สำหรับ {need}</p>
      <Link href="/login" className="mt-4 inline-block font-semibold text-grass underline">สลับบทบาท</Link>
    </div>
  );
}
