import { Search } from "lucide-react";
import { getReference, lookups } from "@/lib/data/reference";
import { yardEn } from "@/lib/i18n";
import { searchOptions } from "@/lib/search-options";
import { SearchTypeAndDates } from "./search-dates";
import { T } from "./t";
import { buttonClass, cx, inputClass } from "./ui";

export async function SearchBar({
  defaults = {},
  compact = false,
  catalog = false,
}: {
  defaults?: { type?: string; yard?: string; from?: string; to?: string };
  compact?: boolean;
  /** company-profile catalogue: filter by model and yard only (no dates) */
  catalog?: boolean;
}) {
  const ref = await getReference();
  const { yards } = { ...ref, ...lookups(ref) };
  const monthlyTypes = [...new Set(ref.models.filter((m) => m.pricing.plan === "MONTHLY_TIERED").map((m) => m.type))];
  return (
    <form
      action="/trailers"
      method="get"
      className={cx(
        catalog ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]",
        compact ? "" : "rounded-xl bg-paper p-3 sm:p-4",
      )}
      role="search"
    >
      <SearchTypeAndDates
        types={[
          ...searchOptions.map((o) => ({ id: o.id, label: o.th, type: o.type })),
          // older links (home page type cards) use the trailer type itself
          ...ref.trailerTypes
            .filter((t) => t.id === defaults.type)
            .map((t) => ({ id: t.id, label: `${t.name} (ทุกรุ่น)`, type: t.id })),
        ]}
        monthlyTypes={monthlyTypes}
        showDates={!catalog}
        defaults={{ type: defaults.type, from: defaults.from, to: defaults.to }}
        yardSelect={
        <label className="block min-w-0">
          <span className="sr-only"><T th="ลานรับหาง" en="Pickup yard" /></span>
          <select name="yard" defaultValue={defaults.yard ?? ""} className={inputClass}>
            <option value="">รับที่ลานใดก็ได้ · Any yard</option>
            {yards.map((y) => (
              <option key={y.id} value={y.id}>
                ลาน {y.number} · {y.short} · {yardEn[y.id]?.short ?? ""}
              </option>
            ))}
          </select>
        </label>
        }
      />
      <button type="submit" className={cx(buttonClass("primary", "lg"), "h-12 sm:col-span-2 lg:col-span-1")}>
        <Search className="size-5" aria-hidden />
        {catalog ? <T th="แสดงหาง" en="Show trailers" /> : <T th="ค้นหาหางว่าง" en="Find available" />}
      </button>
    </form>
  );
}
