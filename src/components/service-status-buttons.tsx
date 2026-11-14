"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setServiceRequestStatus } from "@/app/actions/services";
import { serviceStatusLabel, type ServiceStatus } from "@/lib/service-requests";
import { cx } from "./ui";

const next: ServiceStatus[] = ["NEW", "CONTACTED", "DONE", "CANCELLED"];

/** Staff move a service request through NEW → CONTACTED → DONE (or CANCELLED). */
export function ServiceStatusButtons({ id, status }: { id: string; status: ServiceStatus }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="สถานะคำขอ">
      {next.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === status}
          aria-pressed={s === status}
          onClick={() =>
            start(async () => {
              const r = await setServiceRequestStatus(id, s);
              if (!r.ok) alert(r.error);
              router.refresh();
            })
          }
          className={cx(
            "rounded-md border px-2.5 py-1 text-[12px] font-semibold",
            s === status ? "border-sign bg-sign text-on-sign" : "border-line bg-paper text-ink-2 hover:border-sign",
          )}
        >
          {serviceStatusLabel[s]}
        </button>
      ))}
    </div>
  );
}
