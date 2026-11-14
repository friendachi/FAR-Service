import { contractMonths, quote, rentalDays } from "@/lib/pricing";
import { lookups } from "./reference";
import type {
  Appointment,
  Booking,
  BookingAmounts,
  ChecklistGroup,
  Customer,
  CustomerDocument,
  DocRequirement,
  Driver,
  Guarantor,
  Role,
  StaffUser,
  TrailerType,
  Yard,
  Tractor,
  Trailer,
} from "@/lib/types";

export type StoreData = {
  yards: Yard[];
  trailerTypes: TrailerType[];
  today: string;
  role: Role | null;
  userName: string | null;
  currentCustomerId: string | null;
  currentDriverId: string | null;
  trailers: Trailer[];
  customers: Customer[];
  guarantors: Guarantor[];
  tractors: Tractor[];
  drivers: Driver[];
  staff: StaffUser[];
  docRequirements: DocRequirement[];
  customerDocuments: CustomerDocument[];
  bookings: Booking[];
  appointments: Appointment[];
  checklistTemplate: ChecklistGroup[];
  settings: Record<string, unknown>;
};

/** One request's view of the data, with the lookups pages use. Same shape for sample and live data. */
export function buildStore(d: StoreData) {
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const trailerMap = byId(d.trailers);
  const customerMap = byId(d.customers);
  const bookingMap = byId(d.bookings);
  const driverMap = byId(d.drivers);
  const tractorMap = byId(d.tractors);
  const guarantorMap = byId(d.guarantors);
  const appointmentMap = byId(d.appointments);

  const requirementsFor = (kind: Customer["kind"]) =>
    d.docRequirements.filter((r) => r.appliesTo === "ALL" || r.appliesTo.includes(kind));

  const ownerIdFor = (req: DocRequirement, b: Booking) =>
    req.owner === "CUSTOMER"
      ? b.customerId
      : req.owner === "GUARANTOR"
        ? b.guarantorId
        : req.owner === "TRACTOR"
          ? b.tractorId
          : b.driverIds[0];

  const docFor = (key: string, ownerId: string): CustomerDocument =>
    d.customerDocuments.find((x) => x.key === key && x.ownerId === ownerId) ?? { key, ownerId, status: "MISSING" };

  /** Price of a booking: the stored snapshot when live, otherwise computed from the trailer's rates. */
  const amountsFor = (b: Booking): BookingAmounts => {
    if (b.amounts) return b.amounts;
    const tr = trailerMap.get(b.trailerId)!;
    return quote(tr.pricing, rentalDays(b.pickupAt, b.returnAt), 0, contractMonths(b.pickupAt, b.returnAt));
  };

  return {
    ...d,
    ...lookups(d),
    getTrailer: (id: string) => trailerMap.get(id),
    getCustomer: (id: string) => customerMap.get(id),
    getBooking: (id: string) => bookingMap.get(id),
    getDriver: (id: string) => driverMap.get(id),
    getTractor: (id: string) => tractorMap.get(id),
    getGuarantor: (id: string) => guarantorMap.get(id),
    getAppointment: (id: string) => appointmentMap.get(id),
    appointmentsFor: (driverId?: string) =>
      d.appointments
        .filter((a) => !driverId || a.booking.driverIds.includes(driverId))
        .sort((a, b) => a.at.localeCompare(b.at)),
    staffName: (b: Booking) => b.createdByName ?? "—",
    requirementsFor,
    ownerIdFor,
    docFor,
    amountsFor,
    /** Everything the booking form needs on the client. */
    wizardData: () => ({
      today: d.today,
      yards: d.yards,
      trailerTypes: d.trailerTypes,
      trailers: d.trailers.filter((t) => t.status !== "RETIRED"),
      customers: d.customers,
      tractors: d.tractors,
      drivers: d.drivers,
      guarantors: d.guarantors,
      docRequirements: d.docRequirements,
      customerDocuments: d.customerDocuments,
    }),
  };
}

export type Store = ReturnType<typeof buildStore>;
