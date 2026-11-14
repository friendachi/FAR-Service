import type { ReactNode } from "react";

/** Bilingual text: both languages are rendered, CSS shows the one picked in the header (html[data-lang]). */
export function T({ th, en }: { th: ReactNode; en: ReactNode }) {
  return (
    <>
      <span lang="th" className="i18n-th">{th}</span>
      <span lang="en" className="i18n-en">{en}</span>
    </>
  );
}
