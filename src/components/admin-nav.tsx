"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, BookOpen, FileText, CalendarClock, Eye, Gauge, Inbox, Map, Plus, Settings, Truck, Users, Wrench, ClipboardList, FileBadge, ArrowLeftRight, ClipboardCheck } from "lucide-react";
import { cx } from "./ui";

const icons = { gauge: Gauge, inbox: Inbox, plus: Plus, calendar: CalendarClock, map: Map, truck: Truck, users: Users, settings: Settings, eye: Eye, wrench: Wrench, bell: Bell, chart: BarChart3, quote: FileText, book: BookOpen, contract: ClipboardList, stamp: FileBadge, handover: ArrowLeftRight, check: ClipboardCheck };

export function AdminNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  const active = (href: string) =>
    href === "/admin"
      ? path === "/admin"
      : href === "/admin/bookings"
        ? path.startsWith("/admin/bookings") && !path.startsWith("/admin/bookings/new")
        : path.startsWith(href);
  return (
    <ul className="flex gap-1 overflow-x-auto px-3 lg:flex-col lg:overflow-visible">
      {items.map((it) => {
        const Icon = icons[it.icon as keyof typeof icons];
        const on = active(it.href);
        return (
          <li key={it.href} className="shrink-0">
            <Link
              href={it.href}
              aria-current={on ? "page" : undefined}
              className={cx(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold",
                on ? "bg-white text-sign-deep" : "text-sign-ink hover:bg-white/10",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{it.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
