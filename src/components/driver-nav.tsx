"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, ListTodo } from "lucide-react";
import { cx } from "./ui";

export function DriverNav() {
  const path = usePathname();
  const items = [
    { href: "/driver", label: "นัดของฉัน", icon: ListTodo, on: !path.startsWith("/driver/history") },
    { href: "/driver/history", label: "ประวัติ", icon: History, on: path.startsWith("/driver/history") },
  ];
  return (
    <div className="mx-auto grid max-w-xl grid-cols-2">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          aria-current={it.on ? "page" : undefined}
          className={cx("flex h-16 flex-col items-center justify-center gap-0.5 text-[14px] font-semibold", it.on ? "text-grass" : "text-ink-3")}
        >
          <it.icon className="size-6" aria-hidden /> {it.label}
        </Link>
      ))}
    </div>
  );
}
