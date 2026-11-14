import type { Metadata } from "next";
import { connection } from "next/server";
import { FacebookPostButtons } from "@/components/facebook-post-buttons";
import { NoAccess } from "@/components/no-access";
import { Badge, PageHeader } from "@/components/ui";
import { can } from "@/lib/admin";
import { articles, bangkokToday } from "@/lib/articles";
import { facebookConfigured, facebookMessage, postedArticles } from "@/lib/facebook";
import { thDate } from "@/lib/format";

export const instant = false;
export const metadata: Metadata = { title: "สาระน่ารู้ & Facebook" };

export default async function KnowledgeAdmin() {
  if (!(await can("SUPER_ADMIN", "SALES"))) return <NoAccess need="Super Admin และ Sales / CS" />;
  await connection();
  const today = bangkokToday();
  const connected = facebookConfigured();
  const posted = await postedArticles().catch(() => ({}) as Record<string, string>);
  const list = [...articles].sort((a, b) => b.publishOn.localeCompare(a.publishOn));

  return (
    <>
      <PageHeader title="สาระน่ารู้ & Facebook" sub="บทความขึ้นเว็บทุกวันจันทร์ และโพสต์ไปเพจ FAR Trailer Rental Thailand" />
      <div className={connected ? "mb-6 rounded-xl border-2 border-sign bg-sign-wash p-4 text-[14px]" : "mb-6 rounded-xl border-2 border-warn/60 bg-paper p-4 text-[14px]"}>
        {connected ? (
          <p><strong>เชื่อมต่อเพจ Facebook แล้ว</strong> · ระบบโพสต์บทความใหม่อัตโนมัติทุกวันจันทร์ 09:00 น. (เมื่อเว็บขึ้นโฮสติ้งจริง)</p>
        ) : (
          <>
            <p className="font-bold">ยังไม่ได้เชื่อมต่อเพจ Facebook</p>
            <p className="mt-1 text-ink-2">
              ระหว่างนี้กด “คัดลอกข้อความโพสต์” แล้วนำไปโพสต์ที่เพจเองได้ · เมื่อจะเปิดโพสต์อัตโนมัติ ต้องใส่ FACEBOOK_PAGE_ID,
              FACEBOOK_PAGE_ACCESS_TOKEN และที่อยู่เว็บจริง (NEXT_PUBLIC_SITE_URL) ในการตั้งค่าเซิร์ฟเวอร์
            </p>
          </>
        )}
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-paper">
        {list.map((a) => {
          const live = a.publishOn <= today;
          return (
            <li key={a.slug} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-ink-3">{thDate(a.publishOn)}</span>
                {live ? <Badge tone="ok">ขึ้นเว็บแล้ว</Badge> : <Badge tone="muted">ตั้งเวลาไว้</Badge>}
                {posted[a.slug] ? <Badge tone="info">โพสต์ Facebook แล้ว</Badge> : live && <Badge tone="warn">ยังไม่โพสต์ Facebook</Badge>}
              </div>
              <p className="font-semibold">{a.titleTh}</p>
              {live && !posted[a.slug] && <FacebookPostButtons slug={a.slug} message={facebookMessage(a)} canPost={connected} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}
