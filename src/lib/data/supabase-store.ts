import { cookies } from "next/headers";
import { SUPABASE_URL } from "@/lib/supabase/env";
import { VIEW_AS_CUSTOMER, VIEW_AS_DRIVER } from "@/lib/view-as";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Session } from "@/lib/session";
import type {
  Appointment,
  Booking,
  ChecklistGroup,
  Customer,
  CustomerDocument,
  DocRequirement,
  Driver,
  Guarantor,
  Role,
  StaffUser,
  Tractor,
  Trailer,
  YardId,
} from "@/lib/types";
import type { StoreData } from "./build-store";
import type { Reference } from "./reference";

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are mapped field by field below */

const num = (v: unknown) => (v == null ? 0 : Number(v));
const local = (iso: string) => {
  // timestamptz → "YYYY-MM-DDTHH:mm" in Asia/Bangkok, the format the UI works with
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return p.replace(" ", "T");
};

function mapTrailer(r: any, ref: Reference): Trailer {
  const m = r.model;
  const deposit =
    r.deposit_amount != null
      ? num(r.deposit_amount)
      : m?.deposit != null
        ? num(m.deposit)
        : ref.trailerTypes.find((t) => t.id === r.type)?.deposit ?? 0;
  const t: Trailer = {
    id: r.id,
    code: r.code,
    plate: r.plate_no,
    type: r.type,
    brand: r.brand ?? "",
    year: r.year ?? 0,
    lengthFt: r.length_ft ?? m?.length_ft ?? 0,
    axles: r.axles ?? m?.axles ?? 0,
    payloadTon: num(r.payload_ton),
    tareTon: num(r.tare_ton),
    yard: r.yard?.code as YardId,
    status: r.retired_at ? "RETIRED" : r.status,
    pricing: {
      plan: m?.rate_plan ?? "DAILY_MONTHLY",
      daily: m?.daily_rate != null ? num(m.daily_rate) : undefined,
      weekly: m?.weekly_rate != null ? num(m.weekly_rate) : undefined,
      monthly: m?.monthly_rate != null ? num(m.monthly_rate) : undefined,
      m1_5: m?.monthly_rate_1_5 != null ? num(m.monthly_rate_1_5) : undefined,
      m6_11: m?.monthly_rate_6_11 != null ? num(m.monthly_rate_6_11) : undefined,
      m12: m?.monthly_rate_12 != null ? num(m.monthly_rate_12) : undefined,
      deposit: 0,
      tyreFee: num(m?.tyre_fee),
      tyreCount: m?.tyre_count ?? 0,
    },
    model: {
      code: m?.code ?? "",
      name: m?.name ?? "",
      widthM: m?.width_m != null ? num(m.width_m) : undefined,
      lengthM: m?.length_m != null ? num(m.length_m) : undefined,
      deckLength: m?.deck_length ?? undefined,
      deckHeightM: m?.deck_height_m != null ? num(m.deck_height_m) : undefined,
      weightTon: m?.weight_ton != null ? num(m.weight_ton) : undefined,
      description: m?.description ?? undefined,
    },
    deposit,
    published: r.is_published,
    description: m?.description ?? "",
    uploadedPhotos: [...(r.trailer_photos ?? [])]
      .sort((a: any, b: any) => a.sort_order - b.sort_order || String(a.created_at).localeCompare(String(b.created_at)))
      .map((p: any) => ({ id: p.id, path: p.storage_path, url: `${SUPABASE_URL}/storage/v1/object/public/trailer-photos/${p.storage_path}` })),
  };
  t.pricing.deposit = deposit;
  return t;
}

function mapBooking(r: any, session: Session): Booking {
  const drivers = (r.booking_drivers ?? []).sort((a: any, b: any) => Number(b.is_primary) - Number(a.is_primary));
  const pending = (r.payments ?? []).find((p: any) => p.status === "PENDING_VERIFICATION");
  const creatorRole: Role | undefined =
    r.creator?.role ?? (r.created_by === session.userId ? session.role ?? undefined : "SALES");
  return {
    id: r.id,
    no: r.booking_no,
    customerId: r.customer_id,
    trailerId: r.trailer_id,
    guarantorId: r.guarantor_id,
    tractorId: r.tractor_id,
    driverIds: drivers.map((d: any) => d.driver_id),
    pickupYard: r.pickup?.code,
    returnYard: r.ret?.code,
    pickupAt: local(r.pickup_at),
    returnAt: local(r.return_at),
    status: r.status,
    channel: r.channel,
    createdBy: r.created_by,
    createdAt: local(r.created_at),
    paymentDueAt: r.payment_due_at ? local(r.payment_due_at) : undefined,
    flagged: r.flagged_reason ?? undefined,
    createdByRole: creatorRole,
    createdByName: r.creator?.full_name ?? (creatorRole === "CUSTOMER" ? "ลูกค้า" : "เจ้าหน้าที่"),
    amounts: {
      days: r.rental_days,
      tier: r.rate_tier,
      months: r.contract_months ?? 0,
      rental: num(r.rental_amount),
      tyreFee: num(r.tyre_fee),
      vat: num(r.vat_amount),
      deposit: num(r.deposit_amount),
      total: num(r.total_amount),
      monthlyRate: r.rate_monthly != null ? num(r.rate_monthly) : undefined,
    },
    pendingPaymentId: pending?.id,
    pendingPaymentRecordedByRole: pending?.recorder?.role,
    charges: (r.extra_charges ?? []).map((c: any) => ({
      kind: c.kind,
      amount: num(c.amount),
      status: c.status,
      description: c.description ?? "",
    })),
    deposit: r.deposits
      ? {
          status: r.deposits.status,
          amount: num(r.deposits.amount),
          deducted: num(r.deposits.deducted_amount),
          released: r.deposits.released_amount == null ? null : num(r.deposits.released_amount),
        }
      : undefined,
  };
}

export async function loadSupabaseStore(session: Session, ref: Reference): Promise<StoreData> {
  const sb = await createClient();
  const role = session.role;
  const staff = role === "SUPER_ADMIN" || role === "SALES" || role === "OPS";

  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date());

  const [trailersQ, reqQ, templateQ, settingsQ] = await Promise.all([
    sb.from("trailers").select("*, yard:yards(code), model:trailer_models(*), trailer_photos(id, storage_path, sort_order, created_at)").order("code"),
    sb.from("doc_requirements").select("*").order("sort_order"),
    sb.from("checklist_template_items").select("group_key, group_label, item_key, label, sort_order").order("sort_order"),
    sb.from("settings").select("key, value"),
  ]);

  const docRequirements: DocRequirement[] = (reqQ.data ?? []).map((r: any) => ({
    key: r.key,
    label: r.label,
    owner: r.owner,
    rule: r.rule ?? undefined,
    appliesTo: r.applies_to ?? "ALL",
    required: r.is_required !== false,
  }));

  const checklistTemplate: ChecklistGroup[] = [];
  for (const r of templateQ.data ?? []) {
    let g = checklistTemplate.find((x) => x.key === r.group_key);
    if (!g) checklistTemplate.push((g = { key: r.group_key, label: r.group_label, items: [] }));
    g.items.push({ key: r.item_key, label: r.label });
  }

  const base: StoreData = {
    ...ref,
    today,
    role,
    userName: session.name,
    currentCustomerId: null,
    currentDriverId: null,
    trailers: (trailersQ.data ?? []).map((r: any) => mapTrailer(r, ref)),
    customers: [],
    guarantors: [],
    tractors: [],
    drivers: [],
    staff: [],
    docRequirements,
    customerDocuments: [],
    bookings: [],
    appointments: [],
    checklistTemplate,
    settings: Object.fromEntries((settingsQ.data ?? []).map((r: any) => [r.key, r.value])),
  };
  if (!role) return base;

  // ---------------------------------------------------------------- driver: only their appointments
  if (role === "DRIVER") {
    const [{ data: me }, { data: rows }, { data: docs }, { data: insp }] = await Promise.all([
      sb.from("drivers").select("*, customer_drivers(customer_id, removed_at)").eq("profile_id", session.userId!).maybeSingle(),
      sb.from("driver_appointments_v").select("*").order("scheduled_at"),
      sb.from("documents").select("*").is("superseded_by", null),
      sb.from("inspections").select("id, appointment_id, completed_at, inspection_items(label, result), driver_acknowledgements(result)"),
    ]);
    if (!me) return base;
    const inspByAppt = new Map((insp ?? []).map((i: any) => [i.appointment_id, i]));
    base.currentDriverId = me.id;
    base.drivers = [mapDriver(me)];
    base.customerDocuments = (docs ?? []).map(mapDocument);
    const seen = new Map<string, Booking>();
    for (const r of rows ?? []) {
      const b =
        seen.get(r.booking_id) ??
        ({
          id: r.booking_id,
          no: r.booking_no,
          customerId: "",
          trailerId: r.trailer_id,
          guarantorId: "",
          tractorId: `view-${r.booking_id}`,
          driverIds: [me.id],
          pickupYard: r.yard_code,
          returnYard: r.yard_code,
          pickupAt: local(r.scheduled_at),
          returnAt: local(r.scheduled_at),
          status: r.booking_status,
          channel: "WEB",
          createdBy: "",
          createdAt: "",
          flagged: r.flagged_reason ?? undefined,
        } satisfies Booking);
      if (r.kind === "PICKUP") {
        b.pickupYard = r.yard_code;
        b.pickupAt = local(r.scheduled_at);
      } else {
        b.returnYard = r.yard_code;
        b.returnAt = local(r.scheduled_at);
      }
      seen.set(r.booking_id, b);
      base.tractors.push({ id: b.tractorId, customerId: "", plate: r.tractor_plate, brand: "", kind: "" });
      base.appointments.push({
        id: r.id,
        booking: b,
        kind: r.kind,
        at: local(r.scheduled_at),
        yard: r.yard_code,
        code: r.checkin_code,
        state: r.completed_at ? "DONE" : "UPCOMING",
        tractorPlate: r.tractor_plate,
        customerName: r.customer_name,
        checkedIn: !!r.checked_in_at,
        inspection: mapInspection(inspByAppt.get(r.id)),
      });
    }
    base.bookings = [...seen.values()];
    return base;
  }

  // ---------------------------------------------------------------- customer and staff
  const bookingSelect =
    "*, pickup:yards!bookings_pickup_yard_id_fkey(code), ret:yards!bookings_return_yard_id_fkey(code)," +
    " creator:profiles!bookings_created_by_fkey(role, full_name), booking_drivers(driver_id, is_primary)," +
    " payments(id, status, recorder:profiles!payments_recorded_by_fkey(role))," +
    " extra_charges(kind, amount, status, description), deposits(status, amount, deducted_amount, released_amount)";

  const [customersQ, guarantorsQ, tractorsQ, driversQ, docsQ, bookingsQ, apptQ] = await Promise.all([
    sb.from("customers").select("*").order("name"),
    sb.from("guarantors").select("*").eq("is_active", true),
    sb.from("tractors").select("*").eq("is_active", true).order("created_at"),
    sb.from("drivers").select("*, customer_drivers(customer_id, removed_at), invites(accepted_at)"),
    sb.from("documents").select("*").is("superseded_by", null),
    sb.from("bookings").select(bookingSelect).order("pickup_at", { ascending: false }),
    sb
      .from("appointments")
      .select(
        "id, booking_id, kind, scheduled_at, checkin_code, completed_at, checked_in_at, identity_match, yard:yards(code)," +
          " inspections(id, completed_at, inspection_items(label, result), driver_acknowledgements(result))",
      ),
  ]);

  base.customers = (customersQ.data ?? []).map(
    (r: any): Customer => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      taxId: r.tax_id,
      contact: r.contact_name ?? "",
      phone: r.phone ?? "",
      email: r.email ?? "",
      address: r.billing_address ?? "",
    }),
  );
  if (role === "CUSTOMER") {
    base.currentCustomerId = (customersQ.data ?? []).find((r: any) => r.owner_id === session.userId)?.id ?? null;
  }
  base.guarantors = (guarantorsQ.data ?? []).map(
    (r: any): Guarantor => ({ id: r.id, customerId: r.customer_id, name: r.full_name, relation: r.relation, phone: r.phone ?? "" }),
  );
  base.tractors = (tractorsQ.data ?? []).map(
    (r: any): Tractor => ({
      id: r.id,
      customerId: r.customer_id,
      plate: `${r.plate_no} ${r.province}`,
      brand: r.brand ?? "",
      kind: r.kind ?? "",
    }),
  );
  base.drivers = (driversQ.data ?? []).map(mapDriver);
  base.customerDocuments = (docsQ.data ?? []).map(mapDocument);
  base.bookings = (bookingsQ.data ?? []).map((r: any) => mapBooking(r, session));

  const bookingById = new Map(base.bookings.map((b) => [b.id, b]));
  base.appointments = (apptQ.data ?? [])
    .filter((r: any) => bookingById.has(r.booking_id))
    .map(
      (r: any): Appointment => ({
        id: r.id,
        booking: bookingById.get(r.booking_id)!,
        kind: r.kind,
        at: local(r.scheduled_at),
        yard: r.yard?.code,
        code: r.checkin_code,
        state: r.completed_at ? "DONE" : "UPCOMING",
        checkedIn: !!r.checked_in_at,
        identityMatch: r.identity_match,
        inspection: mapInspection(r.inspections),
      }),
    );

  // Super Admin "view as": open customer / driver pages for a chosen customer or driver
  if (role === "SUPER_ADMIN") {
    const jar = await cookies();
    const asCustomer = jar.get(VIEW_AS_CUSTOMER)?.value;
    const asDriver = jar.get(VIEW_AS_DRIVER)?.value;
    if (asCustomer && base.customers.some((c) => c.id === asCustomer)) base.currentCustomerId = asCustomer;
    if (asDriver && base.drivers.some((d) => d.id === asDriver)) base.currentDriverId = asDriver;
  }
  const tractorById = new Map(base.tractors.map((t) => [t.id, t]));
  const customerById = new Map(base.customers.map((c) => [c.id, c]));
  for (const a of base.appointments) {
    a.tractorPlate ??= tractorById.get(a.booking.tractorId)?.plate;
    a.customerName ??= customerById.get(a.booking.customerId)?.name;
  }

  if (staff) {
    const { data: staffRows } = await sb
      .from("profiles")
      .select("id, full_name, role, home_yard:yards(code)")
      .in("role", ["SUPER_ADMIN", "SALES", "OPS"])
      .eq("is_active", true);
    base.staff = (staffRows ?? []).map(
      (r: any): StaffUser => ({ id: r.id, name: r.full_name, role: r.role, homeYard: r.home_yard?.code }),
    );
  }
  return base;
}

function mapInspection(raw: any): Appointment["inspection"] {
  const i = Array.isArray(raw) ? raw[0] : raw;
  if (!i) return undefined;
  const ack = Array.isArray(i.driver_acknowledgements) ? i.driver_acknowledgements[0] : i.driver_acknowledgements;
  return {
    id: i.id,
    done: !!i.completed_at,
    damaged: (i.inspection_items ?? []).filter((x: any) => x.result === "DAMAGED").map((x: any) => x.label),
    ack: ack?.result,
  };
}

function mapDriver(r: any): Driver {
  return {
    id: r.id,
    name: r.full_name,
    phone: r.phone?.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3") ?? "",
    licenseNo: r.license_no,
    licenseClass: r.license_class,
    licenseExpires: r.license_expires_on,
    customerIds: (r.customer_drivers ?? []).filter((c: any) => !c.removed_at).map((c: any) => c.customer_id),
    invited: !!r.profile_id,
    invitePending: !r.profile_id && (r.invites ?? []).some((i: any) => !i.accepted_at),
  };
}

function mapDocument(r: any): CustomerDocument {
  return {
    id: r.id,
    path: r.storage_path,
    mimeType: r.mime_type ?? undefined,
    key: r.requirement_key,
    ownerId: r.customer_id ?? r.guarantor_id ?? r.tractor_id ?? r.driver_id,
    status: r.status,
    fileName: r.file_name ?? undefined,
    uploadedAt: r.created_at?.slice(0, 10),
    expiresAt: r.expires_on ?? undefined,
    note: r.reject_reason ?? undefined,
  };
}
