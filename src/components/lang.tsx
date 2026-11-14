"use client";

import { useSyncExternalStore } from "react";
import { LANG_KEY, type Lang } from "@/lib/i18n";
import { cx } from "./ui";

const EVENT = "far-lang";
const read = (): Lang => (document.documentElement.dataset.lang === "en" ? "en" : "th");
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export function setLang(lang: Lang) {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "th");
}

/** For attributes and plain strings in client components: t("ไทย", "English"). */
export function useT() {
  const lang = useLang();
  return (th: string, en: string) => (lang === "en" ? en : th);
}

export function LangSwitch({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const lang = useLang();
  return (
    <div role="group" aria-label="ภาษา / Language" className={cx("flex overflow-hidden rounded-lg border-2 text-[13px] font-bold", onDark ? "border-white/80" : "border-on-sign", className)}>
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cx(
            onDark ? "h-7 px-2" : "h-9 px-2.5",
            lang === l
              ? onDark ? "bg-white text-sign-deep" : "bg-on-sign text-white"
              : onDark ? "text-white hover:bg-white/15" : "text-on-sign hover:bg-black/5",
          )}
        >
          {l === "th" ? "ไทย" : "EN"}
        </button>
      ))}
    </div>
  );
}
