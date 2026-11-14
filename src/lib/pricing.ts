import type { Pricing } from "./types";

/*
  Mirrors quote_rental() in supabase/migrations/20261108000007_trailer_models.sql.
  The server always recomputes the price; this is for showing estimates on screen.
*/

export const VAT_RATE = 0.07;
const MONTH_DAYS = 365.25 / 12;

export type RateTier = "DAILY" | "WEEKLY" | "MONTHLY" | "MONTHLY_1_5" | "MONTHLY_6_11" | "MONTHLY_12";

export const tierLabel: Record<string, string> = {
  DAILY: "เรทรายวัน",
  WEEKLY: "เรทรายสัปดาห์",
  MONTHLY: "เรทรายเดือน",
  MONTHLY_1_5: "สัญญา 1–5 เดือน",
  MONTHLY_6_11: "สัญญา 6–11 เดือน",
  MONTHLY_12: "สัญญา 12 เดือนขึ้นไป",
};

export const tierLabelEn: Record<string, string> = {
  DAILY: "daily rate",
  WEEKLY: "weekly rate",
  MONTHLY: "monthly rate",
  MONTHLY_1_5: "1–5 month term",
  MONTHLY_6_11: "6–11 month term",
  MONTHLY_12: "12+ month term",
};

/** PRD BR-01: 24h days, a remainder over 3 hours counts as another day. */
export function rentalDays(pickupAt: string, returnAt: string) {
  const ms = new Date(returnAt).getTime() - new Date(pickupAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const hours = ms / 36e5;
  const full = Math.floor(hours / 24);
  const rem = hours - full * 24;
  return Math.max(1, full + (rem > 3 ? 1 : 0));
}

/** Monthly rate for a contract of `months` on a tiered plan. */
export function monthlyRateFor(p: Pricing, months: number) {
  return months >= 12 ? p.m12 ?? 0 : months >= 6 ? p.m6_11 ?? 0 : p.m1_5 ?? 0;
}

/**
 * Contract length in calendar months for a monthly plan: the fewest whole months from the pickup date that
 * reach the return date (9 Nov → 9 Dec = 1 month even though it is 31 days). Times of day are ignored.
 * Mirrors contract_months() in the database.
 */
export function contractMonths(pickupAt: string, returnAt: string) {
  const from = pickupAt.slice(0, 10);
  const to = returnAt.slice(0, 10);
  let m = 1;
  while (addMonths(`${from}T00:00`, m).slice(0, 10) < to && m < 600) m++;
  return m;
}

/** `months` (calendar months from contractMonths) prices a monthly plan; without it the days are converted. */
export function quote(p: Pricing, days: number, tyres = 0, contract?: number) {
  let tier: RateTier;
  let months: number;
  let rental: number;
  if (p.plan === "MONTHLY_TIERED") {
    months = Math.max(1, contract ?? Math.ceil(days / MONTH_DAYS));
    tier = months >= 12 ? "MONTHLY_12" : months >= 6 ? "MONTHLY_6_11" : "MONTHLY_1_5";
    rental = monthlyRateFor(p, months) * months;
  } else {
    // whole months, then whole weeks, then days — each capped at the next unit up
    const daily = p.daily ?? 0;
    months = p.monthly ? Math.floor(days / 30) : 0;
    const rem = days - months * 30;
    const weeks = p.weekly ? Math.floor(rem / 7) : 0;
    let dayCost = daily * (rem - weeks * 7);
    tier = months > 0 ? "MONTHLY" : weeks > 0 ? "WEEKLY" : "DAILY";
    if (p.weekly && dayCost > p.weekly) {
      dayCost = p.weekly;
      if (tier === "DAILY") tier = "WEEKLY";
    }
    let remCost = (p.weekly ?? 0) * weeks + dayCost;
    if (p.monthly && remCost > p.monthly) {
      remCost = p.monthly;
      tier = "MONTHLY";
    }
    rental = (p.monthly ?? 0) * months + remCost;
  }
  const tyreFee = p.tyreFee > 0 ? p.tyreFee * Math.max(0, tyres) : 0;
  const vat = Math.round((rental + tyreFee) * VAT_RATE);
  const monthlyRate = p.plan === "MONTHLY_TIERED" ? monthlyRateFor(p, months) : p.monthly;
  return { days, tier, months, rental, tyreFee, vat, deposit: p.deposit, total: rental + tyreFee + vat + p.deposit, monthlyRate };
}

export type PaymentSchedule = {
  /** true when the rent is paid month by month (the rental is longer than one month) */
  monthly: boolean;
  /** paid before pickup: deposit + first month's rent + tyre fitting + VAT */
  first: { rent: number; tyreFee: number; vat: number; deposit: number; total: number };
  /** later monthly rent, due on the pickup day of each following month */
  later: { due: string; rent: number; vat: number; total: number }[];
  /** day of the month the rent falls due (the pickup day) */
  dueDay: number;
};

/**
 * How a booking is paid. However long the contract, the first payment before pickup is the deposit, the first
 * month's rent and any tyre fitting (+VAT); the rest of the rent is paid every month on the pickup date until
 * the contract ends. Rentals of a month or less are paid in one go. Mirrors first_payment_amount() in the database.
 */
export function paymentSchedule(
  a: { rental: number; tyreFee: number; vat: number; deposit: number; monthlyRate?: number },
  pickupAt: string,
): PaymentSchedule {
  const base = a.rental + a.tyreFee;
  const rate = base > 0 ? a.vat / base : VAT_RATE;
  const vatOf = (n: number) => Math.round(n * rate);
  const dueDay = Number(pickupAt.slice(8, 10)) || 1;
  const m = a.monthlyRate ?? 0;
  if (!m || a.rental <= m) {
    return { monthly: false, dueDay, later: [], first: { rent: a.rental, tyreFee: a.tyreFee, vat: a.vat, deposit: a.deposit, total: a.rental + a.tyreFee + a.vat + a.deposit } };
  }
  const firstVat = vatOf(m + a.tyreFee);
  const later: PaymentSchedule["later"] = [];
  let left = a.rental - m;
  for (let i = 1; left > 0 && i < 600; i++) {
    const rent = Math.min(m, left);
    left -= rent;
    const v = vatOf(rent);
    later.push({ due: addMonths(pickupAt, i), rent, vat: v, total: rent + v });
  }
  return {
    monthly: true,
    dueDay,
    later,
    first: { rent: m, tyreFee: a.tyreFee, vat: firstVat, deposit: a.deposit, total: m + a.tyreFee + firstVat + a.deposit },
  };
}

/** PRD D16: early return re-prices on the actual duration with the matching rate. */
export function earlyReturn(p: Pricing, bookedDays: number, actualDays: number, tyres = 0) {
  const booked = quote(p, bookedDays, tyres);
  const actual = quote(p, actualDays, tyres);
  const paid = booked.rental + booked.tyreFee + booked.vat;
  const owed = actual.rental + actual.tyreFee + actual.vat;
  return { booked, actual, difference: paid - owed };
}

/** Short price line for cards: "฿8,000/เดือน" or "฿4,000/วัน". */
export function startingPrice(p: Pricing) {
  return p.plan === "MONTHLY_TIERED"
    ? { amount: p.m1_5 ?? Math.min(p.m6_11 ?? Infinity, p.m12 ?? Infinity), unit: "/เดือน" }
    : { amount: p.daily ?? 0, unit: "/วัน" };
}

/** Add calendar months to a "YYYY-MM-DDTHH:mm" string. */
export function addMonths(local: string, months: number) {
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return `${target.toISOString().slice(0, 10)}T${t ?? "08:00"}`;
}

/** Spec facts a trailer actually has on record (model specs from the price list). */
export function specLine(
  t: { axles: number; lengthFt: number; model: { widthM?: number; lengthM?: number; deckLength?: string; deckHeightM?: number } },
  lang: "th" | "en" = "th",
) {
  const m = t.model;
  const en = lang === "en";
  return [
    en ? `${t.axles} axles` : `${t.axles} เพลา`,
    t.lengthFt ? (en ? `${t.lengthFt} ft` : `${t.lengthFt} ฟุต`) : null,
    m.widthM ? (en ? `width ${m.widthM} m` : `กว้าง ${m.widthM} ม.`) : null,
    m.lengthM ? (en ? `length ${m.lengthM} m` : `ยาว ${m.lengthM} ม.`) : null,
    m.deckLength ? (en ? `deck ${m.deckLength} m` : `พื้นที่ใช้งาน ${m.deckLength} ม.`) : null,
    m.deckHeightM ? (en ? `deck height ${m.deckHeightM} m` : `สูง ${m.deckHeightM} ม.`) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Flatbed and chassis: the price shown is the rate for the minimum 1-month contract. */
export const minTermNote = {
  th: "อัตราค่าเช่าสำหรับสัญญาเช่าขั้นต่ำ 1 เดือน",
  en: "Rate for the minimum 1-month contract",
  shortTh: "สัญญาขั้นต่ำ 1 เดือน",
  shortEn: "min. 1-month contract",
};
