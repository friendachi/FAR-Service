-- FAR Service — schema (database.md §3–§11)
-- Run order: 0001_schema → 0002_functions → 0003_rls → 0004_storage → seed.sql

create extension if not exists btree_gist;
create extension if not exists citext;

-- ---------------------------------------------------------------- enums
create type app_role           as enum ('SUPER_ADMIN','SALES','OPS','CUSTOMER','DRIVER');
create type customer_kind      as enum ('COMPANY','PERSON');
create type guarantor_relation as enum ('DIRECTOR','OTHER');
create type trailer_type_code  as enum ('FLATBED','SKELETAL','LOWBED');
create type trailer_status     as enum ('AVAILABLE','RESERVED','RENTED','INSPECTION','MAINTENANCE','RETIRED');
create type doc_owner          as enum ('CUSTOMER','GUARANTOR','TRACTOR','DRIVER');
create type doc_status         as enum ('PENDING','APPROVED','REJECTED','EXPIRED');
create type booking_status     as enum (
  'DRAFT','PENDING_REVIEW','NEED_MORE_DOCS','APPROVED_AWAITING_PAYMENT','CONFIRMED',
  'READY_FOR_PICKUP','IN_RENTAL','RETURNED_PENDING_SETTLEMENT','COMPLETED',
  'REJECTED','CANCELLED','EXPIRED'
);
create type booking_channel    as enum ('WEB','PHONE','LINE','WALK_IN','EMAIL');
create type rate_tier          as enum ('DAILY','WEEKLY','MONTHLY');
create type payment_purpose    as enum ('RENTAL_AND_DEPOSIT','EXTRA_CHARGE');
create type payment_method     as enum ('PROMPTPAY','TRANSFER');
create type payment_status     as enum ('UNPAID','PENDING_VERIFICATION','PAID','REJECTED','PARTIALLY_REFUNDED','REFUNDED');
create type refund_reason      as enum ('CANCELLATION','EARLY_RETURN','DEPOSIT_RELEASE','COMPANY_CANCEL','OVERPAYMENT');
create type deposit_status     as enum ('PENDING','HELD','RELEASED','PARTIALLY_DEDUCTED','FULLY_DEDUCTED');
create type charge_kind        as enum ('LATE_RETURN','DAMAGE','EARLY_RETURN_DIFF','CANCELLATION_FEE','OTHER');
create type charge_status      as enum ('PROPOSED','APPROVED','WAIVED','SETTLED');
create type appointment_kind   as enum ('PICKUP','RETURN');
create type inspection_kind    as enum ('OUT','IN');
create type checklist_result   as enum ('OK','DAMAGED','NA');
create type ack_result         as enum ('AGREE','REMARK','DISPUTE','REFUSED_TO_SIGN');
create type ack_device         as enum ('DRIVER_PHONE','YARD_TABLET');
create type invite_kind        as enum ('CUSTOMER','DRIVER','STAFF');

-- ---------------------------------------------------------------- reference data
create table yards (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,                 -- 'BP', 'NY' (ใช้เป็นคีย์ใน UI)
  number      smallint not null unique,             -- เลขบนโล่ 1, 2
  name        text not null,
  short_name  text not null,
  address     text not null,
  note        text,
  map_url     text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  open_hours  text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table checklist_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  trailer_type trailer_type_code,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

create table checklist_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates on delete cascade,
  group_key   text not null,
  group_label text not null,
  item_key    text not null,
  label       text not null,
  sort_order  smallint not null default 0,
  unique (template_id, item_key)
);

create table trailer_types (
  code                  trailer_type_code primary key,
  name_th               text not null,
  name_en               text not null,
  use_case              text,
  default_deposit       numeric(12,2) not null check (default_deposit >= 0),
  checklist_template_id uuid references checklist_templates,
  sort_order            smallint not null default 0
);

create table doc_requirements (
  key           text primary key,
  label         text not null,
  owner         doc_owner not null,
  applies_to    customer_kind[],                     -- null = ทุกสัญญา
  rule          text,
  review_checks text[] not null default '{}',
  max_age_days  int,
  has_expiry    boolean not null default false,
  is_required   boolean not null default true,
  sort_order    smallint not null default 0
);

create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- people
create table profiles (
  id                   uuid primary key references auth.users on delete cascade,
  role                 app_role not null default 'CUSTOMER',
  full_name            text not null default '',
  phone                text,
  email                citext,
  home_yard_id         uuid references yards,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);
create unique index profiles_phone_uq on profiles (phone) where phone is not null;
create unique index profiles_email_uq on profiles (email) where email is not null;

create table customers (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid unique references profiles on delete set null,
  kind              customer_kind not null,
  name              text not null,
  tax_id            text not null unique check (tax_id ~ '^\d{13}$'),
  branch            text not null default 'สำนักงานใหญ่',
  contact_name      text,
  phone             text,
  email             citext,
  billing_address   text not null default '',
  is_blacklisted    boolean not null default false,
  blacklist_reason  text,
  pdpa_consent_at   timestamptz,
  marketing_consent boolean not null default false,
  created_by        uuid references profiles,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz
);

create table guarantors (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  relation    guarantor_relation not null,
  full_name   text not null,
  national_id text check (national_id is null or national_id ~ '^\d{13}$'),
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create table tractors (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  plate_no    text not null check (plate_no ~ '^\d{2}-\d{4}$'),
  province    text not null,
  brand       text,
  kind        text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  unique (customer_id, plate_no, province)
);

create table drivers (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid unique references profiles on delete set null,
  full_name          text not null,
  phone              text not null unique check (phone ~ '^0\d{9}$'),
  license_no         text not null,
  license_class      text not null,
  license_expires_on date not null,
  is_blacklisted     boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz
);

create table customer_drivers (
  customer_id uuid not null references customers on delete cascade,
  driver_id   uuid not null references drivers on delete cascade,
  added_by    uuid references profiles,
  removed_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (customer_id, driver_id)
);

create table invites (
  id           uuid primary key default gen_random_uuid(),
  kind         invite_kind not null,
  customer_id  uuid references customers on delete cascade,
  driver_id    uuid references drivers on delete cascade,
  phone        text,
  email        citext,
  token_hash   text not null unique,
  sent_count   int not null default 1,
  last_sent_at timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_at  timestamptz,
  invited_by   uuid references profiles,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- fleet
create table trailers (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,              -- รหัสช่องจอด 1-A01
  plate_no        text not null unique,
  vin             text unique,
  type            trailer_type_code not null references trailer_types,
  brand           text,
  model           text,
  year            smallint,
  length_ft       smallint,
  axles           smallint,
  payload_ton     numeric(5,1),
  tare_ton        numeric(5,1),
  current_yard_id uuid not null references yards,
  status          trailer_status not null default 'AVAILABLE',
  daily_rate      numeric(12,2) not null check (daily_rate > 0),
  weekly_rate     numeric(12,2) not null check (weekly_rate > 0),
  monthly_rate    numeric(12,2) not null check (monthly_rate > 0),
  deposit_amount  numeric(12,2) check (deposit_amount is null or deposit_amount >= 0),
  is_published    boolean not null default true,
  description     text,
  retired_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create table trailer_photos (
  id           uuid primary key default gen_random_uuid(),
  trailer_id   uuid not null references trailers on delete cascade,
  storage_path text not null,
  caption      text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create table trailer_compliance (
  id            uuid primary key default gen_random_uuid(),
  trailer_id    uuid not null references trailers on delete cascade,
  kind          text not null check (kind in ('TAX','CMI','INSURANCE','INSPECTION')),
  expires_on    date not null,
  document_path text,
  created_at    timestamptz not null default now()
);

create table maintenance_records (
  id              uuid primary key default gen_random_uuid(),
  trailer_id      uuid not null references trailers on delete cascade,
  reason          text not null,
  starts_at       timestamptz not null,
  expected_end_at timestamptz,
  ended_at        timestamptz,
  period          tstzrange generated always as
                    (tstzrange(starts_at, coalesce(ended_at, expected_end_at, 'infinity'::timestamptz), '[)')) stored,
  created_by      uuid references profiles,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------- documents
create table documents (
  id              uuid primary key default gen_random_uuid(),
  requirement_key text not null references doc_requirements,
  customer_id     uuid references customers on delete cascade,
  guarantor_id    uuid references guarantors on delete cascade,
  tractor_id      uuid references tractors on delete cascade,
  driver_id       uuid references drivers on delete cascade,
  storage_path    text not null,
  file_name       text,
  mime_type       text check (mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes      int check (size_bytes <= 10485760),
  status          doc_status not null default 'PENDING',
  review_checks   jsonb,
  reject_reason   text,
  reviewed_by     uuid references profiles,
  reviewed_at     timestamptz,
  expires_on      date,
  uploaded_by     uuid references profiles,
  superseded_by   uuid references documents,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  check (num_nonnulls(customer_id, guarantor_id, tractor_id, driver_id) = 1)
);
create unique index documents_current_uq on documents
  (requirement_key, coalesce(customer_id, guarantor_id, tractor_id, driver_id))
  where superseded_by is null;

-- ---------------------------------------------------------------- bookings
create table booking_counters (yymm char(4) primary key, last_no int not null);

create table bookings (
  id                    uuid primary key default gen_random_uuid(),
  booking_no            text not null unique,
  customer_id           uuid not null references customers,
  trailer_id            uuid not null references trailers,
  guarantor_id          uuid not null references guarantors,
  tractor_id            uuid not null references tractors,
  pickup_yard_id        uuid not null references yards,
  return_yard_id        uuid not null references yards,
  pickup_at             timestamptz not null,
  return_at             timestamptz not null,
  lock_range            tstzrange not null,
  status                booking_status not null default 'PENDING_REVIEW',
  channel               booking_channel not null default 'WEB',
  created_by            uuid not null references profiles,
  approved_by           uuid references profiles,
  approved_at           timestamptz,
  self_approved         boolean not null default false,
  reject_reason         text,
  cancel_reason         text,
  cancelled_by          uuid references profiles,
  need_docs_due_at      timestamptz,
  payment_due_at        timestamptz,
  rate_daily            numeric(12,2) not null,
  rate_weekly           numeric(12,2) not null,
  rate_monthly          numeric(12,2) not null,
  rental_days           int not null check (rental_days > 0),
  rate_tier             rate_tier not null,
  rental_amount         numeric(12,2) not null,
  vat_rate              numeric(4,3) not null,
  vat_amount            numeric(12,2) not null,
  deposit_amount        numeric(12,2) not null,
  total_amount          numeric(12,2) not null,
  actual_pickup_at      timestamptz,
  actual_return_at      timestamptz,
  actual_return_yard_id uuid references yards,
  early_termination     boolean not null default false,
  recalculated_days     int,
  recalculated_tier     rate_tier,
  recalculated_rental   numeric(12,2),
  cancellation_fee      numeric(12,2),
  invoice_name          text,
  invoice_tax_id        text,
  invoice_branch        text,
  invoice_address       text,
  flagged_reason        text,
  internal_note         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz,
  check (return_at > pickup_at)
);

create table booking_drivers (
  booking_id uuid not null references bookings on delete cascade,
  driver_id  uuid not null references drivers,
  is_primary boolean not null default false,
  primary key (booking_id, driver_id)
);

create table booking_documents (
  booking_id      uuid not null references bookings on delete cascade,
  document_id     uuid not null references documents,
  requirement_key text not null,
  primary key (booking_id, document_id)
);

create table booking_status_history (
  id          bigint generated always as identity primary key,
  booking_id  uuid not null references bookings on delete cascade,
  from_status booking_status,
  to_status   booking_status not null,
  changed_by  uuid,
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- money
create table extra_charges (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references bookings on delete cascade,
  kind                charge_kind not null,
  amount              numeric(12,2) not null,
  description         text,
  inspection_item_id  uuid,
  status              charge_status not null default 'PROPOSED',
  proposed_by         uuid references profiles,
  approved_by         uuid references profiles,
  settle_from_deposit boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz
);

create table payments (
  id              uuid primary key default gen_random_uuid(),
  booking_id      uuid not null references bookings on delete cascade,
  purpose         payment_purpose not null default 'RENTAL_AND_DEPOSIT',
  extra_charge_id uuid references extra_charges,
  method          payment_method not null,
  amount          numeric(12,2) not null check (amount > 0),
  status          payment_status not null default 'UNPAID',
  promptpay_ref   text,
  slip_path       text,
  recorded_by     uuid references profiles,
  verified_by     uuid references profiles,
  verified_at     timestamptz,
  paid_at         timestamptz,
  receipt_no      text unique,
  tax_invoice_no  text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz
);

create table refunds (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references bookings on delete cascade,
  payment_id  uuid references payments,
  reason      refund_reason not null,
  amount      numeric(12,2) not null check (amount > 0),
  proof_path  text,
  refunded_by uuid references profiles,
  refunded_at timestamptz,
  created_at  timestamptz not null default now()
);

create table deposits (
  booking_id      uuid primary key references bookings on delete cascade,
  amount          numeric(12,2) not null,
  status          deposit_status not null default 'PENDING',
  deducted_amount numeric(12,2) not null default 0,
  released_amount numeric(12,2),
  released_at     timestamptz,
  updated_at      timestamptz
);

-- ---------------------------------------------------------------- yard work
create table appointments (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references bookings on delete cascade,
  kind               appointment_kind not null,
  yard_id            uuid not null references yards,
  scheduled_at       timestamptz not null,
  checkin_code       char(6) not null,
  checkin_token_hash text,
  code_valid_from    timestamptz,
  code_valid_to      timestamptz,
  checked_in_at      timestamptz,
  checked_in_by      uuid references profiles,
  driver_id          uuid references drivers,
  tractor_plate_seen text,
  identity_match     boolean,
  completed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz,
  unique (booking_id, kind)
);

create table inspections (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments on delete cascade,
  kind           inspection_kind not null,
  template_id    uuid references checklist_templates,
  inspector_id   uuid references profiles,
  notes          text,
  damaged_count  int not null default 0,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);

create table inspection_items (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections on delete cascade,
  item_key      text not null,
  label         text not null,
  result        checklist_result not null,
  note          text,
  unique (inspection_id, item_key)
);

alter table extra_charges
  add constraint extra_charges_item_fk foreign key (inspection_item_id) references inspection_items;

create table inspection_photos (
  id                 uuid primary key default gen_random_uuid(),
  inspection_id      uuid not null references inspections on delete cascade,
  inspection_item_id uuid references inspection_items,
  angle              text not null check (angle in ('FRONT','REAR','LEFT','RIGHT','DETAIL')),
  storage_path       text not null,
  taken_by           uuid references profiles,
  taken_at           timestamptz not null default now()
);

create table driver_acknowledgements (
  inspection_id  uuid primary key references inspections on delete cascade,
  driver_id      uuid references drivers,
  result         ack_result not null,
  remark         text,
  signature_path text,
  device         ack_device not null,
  geo_lat        numeric(9,6),
  geo_lng        numeric(9,6),
  signed_at      timestamptz not null default now(),
  check (result not in ('REMARK','DISPUTE') or coalesce(remark, '') <> ''),
  check (result = 'REFUSED_TO_SIGN' or signature_path is not null)
);

create table yard_transfers (
  id           uuid primary key default gen_random_uuid(),
  trailer_id   uuid not null references trailers on delete cascade,
  from_yard_id uuid not null references yards,
  to_yard_id   uuid not null references yards,
  reason       text not null check (reason in ('RETURN_OTHER_YARD','REBALANCE')),
  booking_id   uuid references bookings,
  moved_at     timestamptz not null default now(),
  moved_by     uuid references profiles,
  check (from_yard_id <> to_yard_id)
);

-- ---------------------------------------------------------------- system
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid references profiles on delete cascade,
  channel      text not null check (channel in ('IN_APP','EMAIL','SMS','LINE')),
  event        text not null,
  booking_id   uuid references bookings on delete cascade,
  payload      jsonb,
  sent_at      timestamptz,
  read_at      timestamptz,
  error        text,
  created_at   timestamptz not null default now()
);

create table audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  table_name text not null,
  row_id     text,
  before     jsonb,
  after      jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);

create table contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null,
  message    text not null,
  handled_by uuid references profiles,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes (§15.6)
create index bookings_customer_status_idx on bookings (customer_id, status);
create index bookings_status_pickup_idx   on bookings (status, pickup_at);
create index appointments_open_idx        on appointments (yard_id, scheduled_at) where completed_at is null;
create index documents_pending_idx        on documents (status) where status = 'PENDING';
create index payments_verify_idx          on payments (status) where status = 'PENDING_VERIFICATION';
create index trailers_yard_type_idx       on trailers (current_yard_id, type) where retired_at is null;
create index booking_drivers_driver_idx   on booking_drivers (driver_id);
create index notifications_recipient_idx  on notifications (recipient_id, read_at);
create index maintenance_period_idx       on maintenance_records using gist (trailer_id, period);
