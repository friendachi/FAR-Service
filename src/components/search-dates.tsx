"use client";

import { useState } from "react";
import { addMonths } from "@/lib/pricing";
import { T } from "./t";
import { inputClass } from "./ui";

const plusMonth = (date: string) => addMonths(`${date}T08:00`, 1).slice(0, 10);

/**
 * Trailer type + pickup/return dates for the search bar. Types rented by the month (flatbed, chassis)
 * get a return date of at least one month after pickup.
 */
export function SearchTypeAndDates({
  types,
  monthlyTypes,
  defaults,
  yardSelect,
  showDates = true,
}: {
  showDates?: boolean;
  types: { id: string; label: string; type: string }[];
  monthlyTypes: string[];
  defaults: { type?: string; from?: string; to?: string };
  yardSelect: React.ReactNode;
}) {
  const [type, setType] = useState(defaults.type ?? "");
  const [from, setFrom] = useState(defaults.from ?? "");
  const [to, setTo] = useState(defaults.to ?? "");
  const typeOf = (v: string) => types.find((t) => t.id === v)?.type ?? v;
  const monthly = monthlyTypes.includes(typeOf(type));
  const minTo = from ? (monthly ? plusMonth(from) : from) : undefined;

  // keep the return date valid whenever the type or pickup date changes
  const fit = (nextType: string, nextFrom: string, nextTo: string) => {
    if (nextFrom && monthlyTypes.includes(typeOf(nextType))) {
      const min = plusMonth(nextFrom);
      if (!nextTo || nextTo < min) return min;
    }
    return nextTo;
  };

  return (
    <>
      <label className="block min-w-0">
        <span className="sr-only"><T th="ประเภทหาง" en="Trailer type" /></span>
        <select
          name="type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setTo(fit(e.target.value, from, to));
          }}
          className={inputClass}
        >
          <option value="">ทุกประเภทหาง</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
      {yardSelect}
      {showDates && (
      <>
      <label className="block min-w-0">
        <span className="mb-1 block text-[13px] font-semibold text-ink-2 lg:sr-only"><T th="วันรับหาง" en="Pickup date" /></span>
        <input
          type="date"
          name="from"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setTo(fit(type, e.target.value, to));
          }}
          aria-label="วันรับหาง · Pickup date"
          className={inputClass}
        />
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-[13px] font-semibold text-ink-2 lg:sr-only"><T th="วันคืนหาง" en="Return date" /></span>
        <input
          type="date"
          name="to"
          value={to}
          min={minTo}
          onChange={(e) => setTo(e.target.value)}
          aria-label="วันคืนหาง · Return date"
          aria-describedby={monthly ? "search-min-month" : undefined}
          className={inputClass}
        />
      </label>
      </>
      )}
      {showDates && monthly && (
        <p id="search-min-month" className="text-[13px] font-semibold text-ink-2 sm:col-span-2 lg:order-last lg:col-span-5">
          <T th="หางพื้นเรียบและหางก้างปลา เช่าขั้นต่ำ 1 เดือน" en="Flatbed and chassis trailers: minimum rental 1 month" />
        </p>
      )}
    </>
  );
}
