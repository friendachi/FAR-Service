"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markAllNotificationsRead } from "@/app/actions/notifications";
import { Button } from "./ui";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
    >
      อ่านทั้งหมดแล้ว
    </Button>
  );
}
