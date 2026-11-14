"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackView } from "@/app/actions/track";

const KEY = "far-visitor";

/** Records one page view per page shown (anonymous visitor id kept in this browser) for the traffic report. */
export function PageViewTracker() {
  const path = usePathname();
  useEffect(() => {
    let visitor = "";
    try {
      visitor = localStorage.getItem(KEY) ?? "";
      if (!visitor) {
        visitor = crypto.randomUUID();
        localStorage.setItem(KEY, visitor);
      }
    } catch {
      visitor = "no-storage";
    }
    const referrer = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer.slice(0, 500) : null;
    // fire and forget: a failed record must never affect the page
    trackView({ path, visitor, referrer, search: location.search, language: navigator.language ?? "" }).catch(() => undefined);
  }, [path]);
  return null;
}
