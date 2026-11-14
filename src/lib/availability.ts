import type { Booking, BookingStatus, Trailer } from "./types";

const LOCKING: BookingStatus[] = [
  "PENDING_REVIEW",
  "NEED_MORE_DOCS",
  "APPROVED_AWAITING_PAYMENT",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "IN_RENTAL",
  "RETURNED_PENDING_SETTLEMENT",
];

const BUFFER_MS = 24 * 36e5; // BR-04: one day after return for inspection/cleaning

export function conflicts(bookings: Booking[], trailerId: string, from: string, to: string) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return bookings.filter((bk) => {
    if (bk.trailerId !== trailerId || !LOCKING.includes(bk.status)) return false;
    const s = new Date(bk.pickupAt).getTime();
    const e = new Date(bk.returnAt).getTime() + BUFFER_MS;
    return a < e && s < b;
  });
}

export type Availability = "FREE" | "BOOKED" | "SERVICE" | "UNKNOWN";

export function availabilityFor(bookings: Booking[], tr: Trailer, from?: string, to?: string): Availability {
  if (tr.status === "MAINTENANCE" || tr.status === "RETIRED") return "SERVICE";
  // rented with no booking on record (rented before the system): return date unknown
  if (tr.status === "RENTED" && !bookings.some((b) => b.trailerId === tr.id && b.status === "IN_RENTAL")) return "BOOKED";
  if (!from || !to) return tr.status === "AVAILABLE" ? "FREE" : "UNKNOWN";
  return conflicts(bookings, tr.id, from, to).length ? "BOOKED" : "FREE";
}

/** Locked ranges for the calendar on a trailer page. */
export function lockedRanges(bookings: Booking[], trailerId: string) {
  return bookings
    .filter((bk) => bk.trailerId === trailerId && LOCKING.includes(bk.status))
    .map((bk) => ({ from: bk.pickupAt.slice(0, 10), to: bk.returnAt.slice(0, 10) }));
}
