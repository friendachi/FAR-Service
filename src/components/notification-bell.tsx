"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cx } from "./ui";

/** Unread in-app notifications for the signed-in staff member, checked every 30 seconds. */
export function NotificationBell({ initial = 0 }: { initial?: number }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    const sb = createClient();
    let stop = false;
    const load = async () => {
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const { count: c } = await sb
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", u.user.id)
        .is("read_at", null);
      if (!stop && typeof c === "number") setCount(c);
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  return (
    <Link
      href="/admin/notifications"
      aria-label={count ? `แจ้งเตือนใหม่ ${count} รายการ` : "แจ้งเตือน"}
      className="relative flex size-9 items-center justify-center rounded-lg text-white hover:bg-white/10"
    >
      <Bell className="size-5" aria-hidden />
      {count > 0 && (
        <span
          className={cx(
            "absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-reflect px-1 text-[11px] font-bold text-white",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
