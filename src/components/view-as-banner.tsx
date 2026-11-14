import { stopViewAs } from "@/app/actions/view-as";

/** Shown on customer / driver pages while a Super Admin is viewing them as someone else. */
export function ViewAsBanner({ who }: { who: string }) {
  return (
    <div className="bg-reflect text-white" role="status">
      <form action={stopViewAs} className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-[14px] sm:px-6 lg:px-8">
        <span>
          Super Admin กำลังดูหน้าในฐานะ <strong>{who}</strong> · ทุกรายการที่ทำจะบันทึกในชื่อบัญชีของคุณ
        </span>
        <button type="submit" className="rounded-md bg-white px-3 py-1 font-semibold text-reflect hover:bg-white/90">
          ออกจากโหมดนี้
        </button>
      </form>
    </div>
  );
}
