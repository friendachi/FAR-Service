/*
  Back-office rules for road tax and the monthly rental register (pages /admin/tax and /admin/rentals).
  Dates are "YYYY-MM-DD" strings in Bangkok time.
*/

/** Staff are alerted this many days before the road tax expires. */
export const TAX_ALERT_DAYS = 20;

export const docKinds = [
  { id: "BOOK", label: "หน้าเล่มทะเบียน" },
  { id: "TAX", label: "ภาษี (ป้ายวงกลม)" },
  { id: "CMI", label: "พ.ร.บ." },
] as const;
export type DocKind = (typeof docKinds)[number]["id"];

/** Today in Bangkok as YYYY-MM-DD. */
export const bangkokToday = () => new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);

const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 864e5);

/** Same day next year, keeping month ends (30 Jun → 30 Jun, 29 Feb → 28 Feb). */
export function plusYears(d: string, years = 1) {
  const y = +d.slice(0, 4) + years;
  const m = +d.slice(5, 7);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(+d.slice(8, 10), last)).padStart(2, "0")}`;
}

/** Adds whole months, clamping to the month's last day. */
export function plusMonths(d: string, months: number) {
  const total = +d.slice(0, 4) * 12 + (+d.slice(5, 7) - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(+d.slice(8, 10), last)).padStart(2, "0")}`;
}

export type TaxState = "EXPIRED" | "DUE" | "OK" | "UNKNOWN";

export function taxState(expires: string | null, today: string): { state: TaxState; days: number | null } {
  if (!expires) return { state: "UNKNOWN", days: null };
  const days = daysBetween(today, expires);
  return { state: days < 0 ? "EXPIRED" : days <= TAX_ALERT_DAYS ? "DUE" : "OK", days };
}

/** "74-4875 ชบ." style province shorthand used on the sheets. */
export const provinceShort = (p: string) =>
  p === "ชลบุรี" ? "ชบ." : p === "กรุงเทพมหานคร" ? "กทม." : p;

/* ---------------------------------------------------------------- rentals */

export type CustomerKind = "PERSON" | "COMPANY";

/** Company: rent + VAT 7%, minus 5% withholding tax. Person: no VAT, no withholding. */
export const defaultRates = (kind: CustomerKind) => (kind === "COMPANY" ? { vat: 7, wht: 5 } : { vat: 0, wht: 0 });

export function rentLines(rent: number, vatRate: number, whtRate: number) {
  const vat = Math.round(rent * vatRate) / 100;
  const wht = Math.round(rent * whtRate) / 100;
  return { rent, vat, wht, total: rent + vat - wht };
}

/** The current billing month (YYYY-MM) in Bangkok. */
export const billingMonth = (today: string) => today.slice(0, 7);

/**
 * Contract term in force today. A contract past its first term is treated as renewed for the same length
 * (customers keep renting month after month), so this returns the end of the term that contains today.
 */
export function currentTerm(start: string | null, months: number | null, today: string) {
  if (!start || !months) return null;
  let n = 1;
  while (plusMonths(start, months * n) <= today && n < 200) n++;
  const end = plusMonths(start, months * n);
  return { end, renewals: n - 1, firstEnd: plusMonths(start, months), daysLeft: daysBetween(today, end) };
}

/** Next due date for the monthly pay day (pay day 31 in a 30-day month falls on the 30th). */
export function nextPayDate(payDay: number | null, today: string) {
  if (!payDay) return null;
  const at = (ym: string) => {
    const last = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
    return `${ym}-${String(Math.min(payDay, last)).padStart(2, "0")}`;
  };
  const thisMonth = at(today.slice(0, 7));
  return thisMonth >= today ? thisMonth : at(plusMonths(`${today.slice(0, 7)}-01`, 1).slice(0, 7));
}

/* ---------------------------------------------------------------- overdue rent */

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "2026-08" → "ส.ค. 69" */
export const monthLabel = (ym: string) => `${TH_MONTHS[+ym.slice(5, 7) - 1]} ${String(+ym.slice(0, 4) + 543).slice(2)}`;

/** "ส.ค. – พ.ย. 69" for a run of consecutive months, otherwise a list. */
export function monthsText(months: string[]) {
  const m = [...months].sort();
  if (!m.length) return "";
  const consecutive = m.every((x, i) => i === 0 || plusMonths(`${m[i - 1]}-01`, 1).slice(0, 7) === x);
  if (m.length > 2 && consecutive) {
    const a = monthLabel(m[0]);
    const b = monthLabel(m[m.length - 1]);
    return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
  }
  return m.map(monthLabel).join(", ");
}

/** Overdue amount: the staff-entered amount if any, otherwise unpaid months × monthly total (rent + VAT − WHT). */
export function arrearsTotal(months: string[], monthlyTotal: number, override: number | null) {
  return override ?? months.length * monthlyTotal;
}

/** Months a contract can owe, newest first: from its start (at most 24 back) to this month. */
export function owedMonthChoices(start: string | null, today: string, extra: string[] = []) {
  const now = today.slice(0, 7);
  const earliest = plusMonths(`${now}-01`, -23).slice(0, 7);
  const from = start && start.slice(0, 7) > earliest ? start.slice(0, 7) : earliest;
  const out: string[] = [];
  for (let m = now; m >= from; m = plusMonths(`${m}-01`, -1).slice(0, 7)) out.push(m);
  for (const e of extra) if (!out.includes(e)) out.push(e);
  return out.sort().reverse();
}
