import { Check } from "lucide-react";
import { cx } from "./ui";

/** Steps drawn as a route: done legs filled sign-green, current leg reflective, next legs outlined. */
export function RouteSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex w-full overflow-hidden rounded-lg border-2 border-sign" aria-label="ขั้นตอน">
      {steps.map((s, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <li
            key={s}
            aria-current={on ? "step" : undefined}
            className={cx(
              "relative flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-[14px] font-semibold sm:px-4",
              done && "bg-sign text-on-sign",
              on && "bg-reflect text-white",
              !done && !on && "bg-paper text-ink-3",
              i > 0 && "border-l-2 border-sign",
            )}
          >
            <span
              className={cx(
                "flex size-6 shrink-0 items-center justify-center rounded-full font-route text-[13px] font-extrabold",
                done ? "bg-white text-grass" : on ? "bg-white text-reflect" : "border-2 border-line-strong",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3.5} aria-hidden /> : i + 1}
            </span>
            <span className={cx("truncate", !on && "hidden sm:inline")}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}
