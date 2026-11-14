"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function AccountNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="บัญชีของฉัน" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b-2 border-line">
        {items.map((it) => {
          const on = it.href === "/me" ? path === "/me" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "-mb-0.5 block border-b-[3px] px-4 py-3 text-[15px] font-semibold",
                  on ? "border-sign text-grass" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
