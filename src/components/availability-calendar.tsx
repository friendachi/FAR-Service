import { T } from "./t";
import { cx } from "./ui";

const WEEK = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const WEEK_EN = ["M", "T", "W", "T", "F", "S", "S"];

/** Two-month availability strip: booked days filled grey, today ringed. */
export function AvailabilityCalendar({
  ranges,
  today,
  months = 2,
}: {
  ranges: { from: string; to: string }[];
  today: string;
  months?: number;
}) {
  const start = new Date(`${today}T00:00:00`);
  const isBooked = (iso: string) => ranges.some((r) => iso >= r.from && iso <= r.to);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {Array.from({ length: months }, (_, m) => {
        const first = new Date(start.getFullYear(), start.getMonth() + m, 1);
        const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        const offset = (first.getDay() + 6) % 7;
        return (
          <div key={m}>
            <p className="mb-2 font-bold">
              <T
                th={first.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
                en={first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              />
            </p>
            <div className="grid grid-cols-7 gap-1 text-center text-[13px]">
              {WEEK.map((w, i) => (
                <span key={w} className="py-1 text-ink-3">
                  <T th={w} en={WEEK_EN[i]} />
                </span>
              ))}
              {Array.from({ length: offset }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: daysIn }, (_, i) => {
                const d = new Date(first.getFullYear(), first.getMonth(), i + 1);
                const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const past = iso < today;
                const booked = isBooked(iso);
                return (
                  <span
                    key={iso}
                    className={cx(
                      "rounded-md py-1.5 tabular",
                      booked && "bg-line-strong/60 text-ink-2 line-through decoration-ink-3",
                      !booked && !past && "bg-sign-tint text-sign-deep",
                      past && !booked && "text-ink-3/60",
                      iso === today && "ring-2 ring-sign",
                    )}
                  >
                    {i + 1}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
