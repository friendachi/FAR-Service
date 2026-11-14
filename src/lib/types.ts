export type Role = "SUPER_ADMIN" | "SALES" | "OPS" | "CUSTOMER" | "DRIVER";

export type TrailerTypeId = "FLATBED" | "SKELETAL" | "LOWBED";

export type YardId = "BP" | "NY";

export type Yard = {
  id: YardId;
  number: 1 | 2;
  name: string;
  short: string;
  address: string;
  note: string;
  mapUrl: string;
  hours: string;
};

export type TrailerType = {
  id: TrailerTypeId;
  name: string;
  english: string;
  use: string;
  deposit: number;
};

export type TrailerStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "RENTED"
  | "INSPECTION"
  | "MAINTENANCE"
  | "RETIRED";

export type Trailer = {
  id: string;
  code: string;
  plate: string;
  type: TrailerTypeId;
  brand: string;
  year: number;
  lengthFt: number;
  axles: number;
  payloadTon: number;
  tareTon: number;
  yard: YardId;
  status: TrailerStatus;
  pricing: Pricing;
  model: {
    code: string;
    name: string;
    widthM?: number;
    lengthM?: number;
    deckLength?: string;
    deckHeightM?: number;
    weightTon?: number;
    description?: string;
  };
  /** Deposit for this trailer: its own amount or the trailer type default (D15). */
  deposit: number;
  published: boolean;
  /** photos uploaded by staff (public URLs, main photo first) */
  uploadedPhotos?: { id: string; url: string; path: string }[];
  description: string;
};

export type BookingStatus =
  | "PENDING_REVIEW"
  | "NEED_MORE_DOCS"
  | "APPROVED_AWAITING_PAYMENT"
  | "CONFIRMED"
  | "READY_FOR_PICKUP"
  | "IN_RENTAL"
  | "RETURNED_PENDING_SETTLEMENT"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED";

export type Channel = "WEB" | "PHONE" | "LINE" | "WALK_IN" | "EMAIL";

export type CustomerKind = "COMPANY" | "PERSON";

export type Customer = {
  id: string;
  kind: CustomerKind;
  name: string;
  taxId: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
};

export type Guarantor = {
  id: string;
  customerId: string;
  name: string;
  relation: "DIRECTOR" | "OTHER";
  phone: string;
};

export type Tractor = {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  kind: string;
};

export type Driver = {
  id: string;
  name: string;
  phone: string;
  licenseNo: string;
  licenseClass: string;
  licenseExpires: string;
  customerIds: string[];
  invited: boolean;
  /** An invite was sent and not accepted yet. */
  invitePending?: boolean;
};

export type DocStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "MISSING";

export type DocOwner = "CUSTOMER" | "GUARANTOR" | "TRACTOR" | "DRIVER";

export type DocRequirement = {
  key: string;
  label: string;
  owner: DocOwner;
  rule?: string;
  appliesTo: CustomerKind[] | "ALL";
  required?: boolean;
};

export type CustomerDocument = {
  id?: string;
  path?: string;
  /** Short-lived signed URL for viewing (reviewers only). */
  url?: string;
  mimeType?: string;
  key: string;
  ownerId: string;
  status: DocStatus;
  fileName?: string;
  uploadedAt?: string;
  expiresAt?: string;
  note?: string;
};

export type Booking = {
  id: string;
  no: string;
  customerId: string;
  trailerId: string;
  guarantorId: string;
  tractorId: string;
  driverIds: string[];
  pickupYard: YardId;
  returnYard: YardId;
  pickupAt: string;
  returnAt: string;
  status: BookingStatus;
  channel: Channel;
  createdBy: string;
  createdAt: string;
  paymentDueAt?: string;
  flagged?: string;
  /** Role and display name of whoever created the booking (customer, Sales, Super Admin). */
  createdByRole?: Role;
  createdByName?: string;
  /** Price snapshot stored with the booking (live data). Mock data computes it from the trailer rates. */
  amounts?: BookingAmounts;
  /** A payment waiting for staff verification. */
  pendingPaymentId?: string;
  pendingPaymentRecordedByRole?: Role;
  charges?: ExtraCharge[];
  deposit?: { status: string; amount: number; deducted: number; released: number | null };
};

export type ExtraCharge = {
  kind: "LATE_RETURN" | "DAMAGE" | "EARLY_RETURN_DIFF" | "CANCELLATION_FEE" | "OTHER";
  amount: number;
  status: "PROPOSED" | "APPROVED" | "WAIVED" | "SETTLED";
  description: string;
};

export type InspectionInfo = {
  id: string;
  done: boolean;
  damaged: string[];
  ack?: "AGREE" | "REMARK" | "DISPUTE" | "REFUSED_TO_SIGN";
};

export type Pricing = {
  plan: "MONTHLY_TIERED" | "DAILY_MONTHLY";
  daily?: number;
  weekly?: number;
  monthly?: number;
  /** Monthly rate by contract length (tiered plan). */
  m1_5?: number;
  m6_11?: number;
  m12?: number;
  deposit: number;
  /** Tyre-fitting service per tyre (0 = not offered) and tyre positions. */
  tyreFee: number;
  tyreCount: number;
};

export type BookingAmounts = {
  days: number;
  tier: string;
  months: number;
  rental: number;
  tyreFee: number;
  vat: number;
  deposit: number;
  total: number;
  /** monthly rent for this booking (tier rate, or the lowbed monthly rate) */
  monthlyRate?: number;
};

export type Appointment = {
  id: string;
  booking: Booking;
  kind: "PICKUP" | "RETURN";
  at: string;
  yard: YardId;
  code: string;
  state: "UPCOMING" | "DONE";
  /** Filled for drivers, who cannot read tractors/bookings directly. */
  tractorPlate?: string;
  customerName?: string;
  checkedIn?: boolean;
  identityMatch?: boolean | null;
  inspection?: InspectionInfo;
};

export type ChecklistResult = "OK" | "DAMAGED" | "NA";

export type ChecklistGroup = {
  key: string;
  label: string;
  items: { key: string; label: string }[];
};

export type StaffUser = {
  id: string;
  name: string;
  role: Exclude<Role, "CUSTOMER" | "DRIVER">;
  homeYard?: YardId;
};
