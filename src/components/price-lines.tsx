import { T } from "./t";

const split = (s: string) => s.split(/\s*·\s*/).filter(Boolean);
const parts = (s: string) => {
  const m = s.match(/^(.*?)\s*((?:THB\s*)?[\d,]+(?:\s*บาท)?\S*.*)$/);
  return m ? { label: m[1].trim(), amount: m[2].trim() } : { label: "", amount: s };
};

/**
 * A price such as "หางที่เช่ากับเรา 100 บาท/เส้น · หางภายนอก 300 บาท/เส้น" laid out one rate per line:
 * the label on the left, the amount in bold route numerals on the right.
 */
export function PriceLines({ th, en, size = "md" }: { th: string; en?: string; size?: "sm" | "md" }) {
  const t = split(th);
  const e = split(en || th);
  const big = size === "md" ? "text-[17px]" : "text-[15px]";
  return (
    <span className="mt-1 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-0.5">
      {t.map((line, i) => {
        const a = parts(line);
        const b = parts(e[i] ?? line);
        return (
          <span key={i} className="contents">
            <span className="text-[13px] text-ink-2">
              <T th={a.label || "ราคา"} en={b.label || "Price"} />
            </span>
            <span className={`font-route ${big} font-extrabold text-grass tabular`}>
              <T th={a.amount} en={b.amount} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
