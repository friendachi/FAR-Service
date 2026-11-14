-- ======================================== supabase/migrations/20261107000001_schema.sql
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

-- ======================================== supabase/migrations/20261107000002_functions.sql
-- FAR Service — functions, triggers and business rules (database.md §12)

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['yards','checklist_templates','profiles','customers','guarantors','tractors','drivers',
                           'trailers','documents','bookings','extra_charges','payments','deposits','appointments','inspections']
  loop
    execute format('create trigger %I_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

create or replace function auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active
$$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('SUPER_ADMIN','SALES','OPS'), false)
$$;

create or replace function my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from customers where owner_id = auth.uid()
$$;

create or replace function my_driver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from drivers where profile_id = auth.uid()
$$;

create or replace function setting_num(p_key text) returns numeric
language sql stable security definer set search_path = public as $$
  select (value #>> '{}')::numeric from settings where key = p_key
$$;

create or replace function setting_text(p_key text) returns text
language sql stable security definer set search_path = public as $$
  select value #>> '{}' from settings where key = p_key
$$;

-- ---------------------------------------------------------------- new auth user → profile (+ customer)
-- Role comes from app_metadata (only the service role can set it). Customer details come from the
-- sign-up form's user_metadata: customer_kind, customer_name, tax_id, phone, full_name.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := coalesce((new.raw_app_meta_data ->> 'role')::app_role, 'CUSTOMER');
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into profiles (id, role, full_name, phone, email)
  values (new.id, v_role, coalesce(v_meta ->> 'full_name', v_meta ->> 'customer_name', ''),
          nullif(v_meta ->> 'phone', ''), new.email);

  if v_role = 'CUSTOMER' and v_meta ? 'tax_id' then
    -- A customer created by staff on behalf of a caller is claimed by matching tax id.
    update customers set owner_id = new.id
     where tax_id = v_meta ->> 'tax_id' and owner_id is null;
    if not found then
      insert into customers (owner_id, kind, name, tax_id, contact_name, phone, email, pdpa_consent_at,
                             marketing_consent, created_by)
      values (new.id, (v_meta ->> 'customer_kind')::customer_kind, v_meta ->> 'customer_name', v_meta ->> 'tax_id',
              v_meta ->> 'full_name', v_meta ->> 'phone', new.email, now(),
              coalesce((v_meta ->> 'marketing_consent')::boolean, false), new.id);
    end if;
  end if;

  if v_role = 'DRIVER' then
    update drivers set profile_id = new.id
     where profile_id is null and phone = regexp_replace(coalesce(v_meta ->> 'phone', new.phone, ''), '\D', '', 'g');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------- booking number (§12.1)
create or replace function next_booking_no() returns text
language plpgsql security definer set search_path = public as $$
declare k char(4) := to_char(now() at time zone 'Asia/Bangkok', 'YYMM'); n int;
begin
  insert into booking_counters values (k, 1)
  on conflict (yymm) do update set last_no = booking_counters.last_no + 1
  returning last_no into n;
  return format('FAR-%s-%s', k, lpad(n::text, 5, '0'));
end $$;

-- ---------------------------------------------------------------- lock range + no double booking (§12.2)
create or replace function set_lock_range() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.lock_range := tstzrange(new.pickup_at,
                              new.return_at + coalesce(setting_text('booking_buffer'), '1 day')::interval, '[)');
  return new;
end $$;

create trigger bookings_lock_range before insert or update of pickup_at, return_at
  on bookings for each row execute function set_lock_range();

alter table bookings add constraint bookings_no_overlap
  exclude using gist (trailer_id with =, lock_range with &&)
  where (status in ('PENDING_REVIEW','NEED_MORE_DOCS','APPROVED_AWAITING_PAYMENT','CONFIRMED',
                    'READY_FOR_PICKUP','IN_RENTAL','RETURNED_PENDING_SETTLEMENT'));

-- ---------------------------------------------------------------- status history
create or replace function log_booking_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into booking_status_history (booking_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger bookings_status_log after insert or update of status on bookings
  for each row execute function log_booking_status();

-- ---------------------------------------------------------------- pricing (BR-01, BR-02, D15)
create or replace function rental_days(p_from timestamptz, p_to timestamptz) returns int
language sql stable as $$
  select greatest(1,
    floor(extract(epoch from (p_to - p_from)) / 86400)::int
    + case when extract(epoch from (p_to - p_from)) / 3600
                - floor(extract(epoch from (p_to - p_from)) / 86400) * 24
                > coalesce(setting_num('day_remainder_hours'), 3) then 1 else 0 end)
$$;

create or replace function quote_rental(p_trailer uuid, p_days int)
returns table (tier rate_tier, rental numeric, vat_rate numeric, vat numeric, deposit numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare t trailers; v_rate numeric := coalesce(setting_num('vat_rate'), 0.07);
begin
  select * into t from trailers where id = p_trailer;
  if not found then raise exception 'ไม่พบหาง'; end if;
  if p_days >= coalesce(setting_num('monthly_tier_min_days'), 30) then
    tier := 'MONTHLY'; rental := round(t.monthly_rate / 30 * p_days);
  elsif p_days >= coalesce(setting_num('weekly_tier_min_days'), 7) then
    tier := 'WEEKLY';  rental := round(t.weekly_rate / 7 * p_days);
  else
    tier := 'DAILY';   rental := t.daily_rate * p_days;
  end if;
  vat_rate := v_rate;
  vat := round(rental * v_rate);
  deposit := coalesce(t.deposit_amount, (select default_deposit from trailer_types where code = t.type));
  total := rental + vat + deposit;
  return next;
end $$;

-- ---------------------------------------------------------------- expected yard on a date (BR-22)
create or replace function expected_yard(p_trailer uuid, p_at timestamptz) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select b.return_yard_id from bookings b
      where b.trailer_id = p_trailer and b.return_at <= p_at
        and b.status not in ('REJECTED','CANCELLED','EXPIRED','DRAFT')
      order by b.return_at desc limit 1),
    (select current_yard_id from trailers where id = p_trailer))
$$;

-- ---------------------------------------------------------------- create booking (§12.3)
create or replace function create_booking(
  p_customer_id   uuid,
  p_trailer_id    uuid,
  p_tractor_id    uuid,
  p_driver_ids    uuid[],
  p_guarantor_id  uuid,
  p_pickup_at     timestamptz,
  p_return_at     timestamptz,
  p_return_yard   uuid,
  p_channel       booking_channel default 'WEB',
  p_invoice_name  text default null,
  p_invoice_tax_id text default null,
  p_invoice_address text default null
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := auth_role();
  v_customer customers;
  v_trailer trailers;
  v_days int;
  q record;
  b bookings;
  v_driver uuid;
begin
  if v_role is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select * into v_customer from customers where id = p_customer_id;
  if not found then raise exception 'ไม่พบลูกค้า'; end if;

  -- who may book (D3, D5): the customer themself, or Sales / Super Admin on their behalf
  if not (v_customer.owner_id = auth.uid() or v_role in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์จองให้ลูกค้ารายนี้';
  end if;
  if v_role = 'CUSTOMER' then p_channel := 'WEB'; end if;
  if v_customer.is_blacklisted then raise exception 'บัญชีนี้จองไม่ได้ กรุณาติดต่อเจ้าหน้าที่'; end if;

  select * into v_trailer from trailers where id = p_trailer_id and retired_at is null for update;
  if not found or v_trailer.status = 'MAINTENANCE' then raise exception 'หางคันนี้ไม่พร้อมให้เช่า'; end if;
  if p_return_at <= p_pickup_at then raise exception 'วันคืนต้องอยู่หลังวันรับ'; end if;
  if p_pickup_at < now() + make_interval(hours => coalesce(setting_num('min_lead_hours'), 24)::int) and v_role = 'CUSTOMER' then
    raise exception 'ต้องจองล่วงหน้าอย่างน้อย % ชั่วโมง', coalesce(setting_num('min_lead_hours'), 24);
  end if;

  -- tractor, guarantor and drivers must belong to this customer (BR-19)
  if not exists (select 1 from tractors where id = p_tractor_id and customer_id = p_customer_id and is_active) then
    raise exception 'หัวลากไม่ใช่ของลูกค้ารายนี้';
  end if;
  if not exists (select 1 from guarantors where id = p_guarantor_id and customer_id = p_customer_id and is_active) then
    raise exception 'ผู้ค้ำประกันไม่ใช่ของลูกค้ารายนี้';
  end if;
  if coalesce(array_length(p_driver_ids, 1), 0) = 0 then raise exception 'เลือกคนขับอย่างน้อย 1 คน'; end if;
  foreach v_driver in array p_driver_ids loop
    if not exists (select 1 from customer_drivers cd join drivers d on d.id = cd.driver_id
                    where cd.customer_id = p_customer_id and cd.driver_id = v_driver and cd.removed_at is null
                      and not d.is_blacklisted and d.license_expires_on >= p_return_at::date) then
      raise exception 'คนขับบางคนไม่อยู่ในบัญชีนี้ ติด Blacklist หรือใบขับขี่หมดอายุก่อนวันคืน';
    end if;
  end loop;

  -- trailer must be at the pickup yard on that day (BR-22) and not under maintenance
  if exists (select 1 from maintenance_records m where m.trailer_id = p_trailer_id
              and m.period && tstzrange(p_pickup_at, p_return_at)) then
    raise exception 'หางคันนี้มีกำหนดซ่อมในช่วงเวลาที่เลือก';
  end if;
  if exists (select 1 from trailer_compliance c where c.trailer_id = p_trailer_id and c.expires_on < p_return_at::date) then
    raise exception 'เอกสารหางหมดอายุก่อนวันคืน';
  end if;

  -- price is always computed here, never taken from the client (BR-20)
  v_days := rental_days(p_pickup_at, p_return_at);
  select * into q from quote_rental(p_trailer_id, v_days);

  insert into bookings (booking_no, customer_id, trailer_id, guarantor_id, tractor_id,
                        pickup_yard_id, return_yard_id, pickup_at, return_at, lock_range, status, channel, created_by,
                        rate_daily, rate_weekly, rate_monthly, rental_days, rate_tier, rental_amount,
                        vat_rate, vat_amount, deposit_amount, total_amount,
                        invoice_name, invoice_tax_id, invoice_branch, invoice_address)
  values (next_booking_no(), p_customer_id, p_trailer_id, p_guarantor_id, p_tractor_id,
          expected_yard(p_trailer_id, p_pickup_at), coalesce(p_return_yard, expected_yard(p_trailer_id, p_pickup_at)),
          p_pickup_at, p_return_at, tstzrange(p_pickup_at, p_return_at), 'PENDING_REVIEW', p_channel, auth.uid(),
          v_trailer.daily_rate, v_trailer.weekly_rate, v_trailer.monthly_rate, v_days, q.tier, q.rental,
          q.vat_rate, q.vat, q.deposit, q.total,
          coalesce(p_invoice_name, v_customer.name), coalesce(p_invoice_tax_id, v_customer.tax_id),
          v_customer.branch, coalesce(p_invoice_address, v_customer.billing_address))
  returning * into b;
  -- (bookings_no_overlap raises exclusion_violation here if the trailer is already locked)

  insert into booking_drivers (booking_id, driver_id, is_primary)
  select b.id, d, ord = 1 from unnest(p_driver_ids) with ordinality as x(d, ord);

  insert into booking_documents (booking_id, document_id, requirement_key)
  select b.id, doc.id, doc.requirement_key from documents doc
   where doc.superseded_by is null
     and (doc.customer_id = p_customer_id or doc.guarantor_id = p_guarantor_id
          or doc.tractor_id = p_tractor_id or doc.driver_id = p_driver_ids[1]);

  insert into deposits (booking_id, amount) values (b.id, q.deposit);

  insert into appointments (booking_id, kind, yard_id, scheduled_at, checkin_code, code_valid_from, code_valid_to)
  values
    (b.id, 'PICKUP', b.pickup_yard_id, b.pickup_at, lpad((floor(random() * 1000000))::int::text, 6, '0'),
     b.pickup_at - interval '1 day', b.pickup_at + interval '1 day'),
    (b.id, 'RETURN', b.return_yard_id, b.return_at, lpad((floor(random() * 1000000))::int::text, 6, '0'),
     b.return_at - interval '1 day', b.return_at + interval '1 day');

  return b;
exception
  when exclusion_violation then
    raise exception 'หางคันนี้ถูกจองในช่วงเวลาที่เลือกแล้ว กรุณาเลือกช่วงวันหรือหางคันอื่น';
end $$;

-- ---------------------------------------------------------------- document review (FR-APV-04)
create or replace function review_document(p_document uuid, p_approve boolean, p_reason text default null,
                                           p_checks jsonb default null) returns documents
language plpgsql security definer set search_path = public as $$
declare d documents;
begin
  if auth_role() not in ('SALES','SUPER_ADMIN') then raise exception 'ไม่มีสิทธิ์ตรวจเอกสาร'; end if;
  if not p_approve and coalesce(p_reason, '') = '' then raise exception 'ระบุเหตุผลที่ไม่ผ่าน'; end if;
  update documents set status = case when p_approve then 'APPROVED' else 'REJECTED' end::doc_status,
         reject_reason = case when p_approve then null else p_reason end,
         review_checks = p_checks, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_document returning * into d;
  return d;
end $$;

-- ---------------------------------------------------------------- approval rule (BR-15, D6, D9)
create or replace function assert_can_decide(p_booking bookings) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_role app_role := auth_role(); v_creator app_role;
begin
  if v_role not in ('SALES','SUPER_ADMIN') then raise exception 'ไม่มีสิทธิ์อนุมัติ'; end if;
  select role into v_creator from profiles where id = p_booking.created_by;
  if v_role = 'SALES' and v_creator = 'SALES' then
    raise exception 'การจองที่ Sales สร้างแทนลูกค้า ต้องให้ Super Admin อนุมัติ';
  end if;
end $$;

-- Required documents (by customer kind) that do not yet have an approved current version.
create or replace function missing_documents(p_booking uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(r.label order by r.sort_order), '{}')
    from bookings b
    join customers c on c.id = b.customer_id
    join doc_requirements r on r.is_required and (r.applies_to is null or c.kind = any(r.applies_to))
   where b.id = p_booking
     and not exists (
       select 1 from documents d
        where d.requirement_key = r.key and d.superseded_by is null and d.status = 'APPROVED'
          and case r.owner
                when 'CUSTOMER'  then d.customer_id = b.customer_id
                when 'GUARANTOR' then d.guarantor_id = b.guarantor_id
                when 'TRACTOR'   then d.tractor_id = b.tractor_id
                when 'DRIVER'    then d.driver_id = (select driver_id from booking_drivers
                                                      where booking_id = b.id and is_primary limit 1)
              end)
$$;

create or replace function approve_booking(p_booking uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS') then raise exception 'สถานะนี้อนุมัติไม่ได้'; end if;
  perform assert_can_decide(b);
  if cardinality(missing_documents(b.id)) > 0 then
    raise exception 'ยังมีเอกสารที่ไม่ผ่านการตรวจ: %', array_to_string(missing_documents(b.id), ', ');
  end if;
  update bookings set status = 'APPROVED_AWAITING_PAYMENT', approved_by = auth.uid(), approved_at = now(),
         self_approved = (created_by = auth.uid()),
         payment_due_at = now() + make_interval(hours => coalesce(setting_num('payment_window_hours'), 24)::int)
   where id = b.id returning * into b;
  return b;
end $$;

create or replace function request_more_docs(p_booking uuid, p_note text) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS') then raise exception 'สถานะนี้ขอเอกสารเพิ่มไม่ได้'; end if;
  perform assert_can_decide(b);
  update bookings set status = 'NEED_MORE_DOCS', internal_note = coalesce(p_note, internal_note),
         need_docs_due_at = now() + make_interval(hours => coalesce(setting_num('need_docs_window_hours'), 48)::int)
   where id = b.id returning * into b;
  return b;
end $$;

create or replace function reject_booking(p_booking uuid, p_reason text) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS') then raise exception 'สถานะนี้ปฏิเสธไม่ได้'; end if;
  perform assert_can_decide(b);
  update bookings set status = 'REJECTED', reject_reason = p_reason where id = b.id returning * into b;
  return b;
end $$;

-- ---------------------------------------------------------------- customer resubmits documents
create or replace function resubmit_documents(p_booking uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings;
begin
  select * into b from bookings where id = p_booking for update;
  if b.customer_id is distinct from my_customer_id() and auth_role() not in ('SALES','SUPER_ADMIN') then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  if b.status <> 'NEED_MORE_DOCS' then raise exception 'การจองนี้ไม่ได้รอเอกสารเพิ่ม'; end if;
  -- point the booking at the latest version of each document
  delete from booking_documents where booking_id = b.id;
  insert into booking_documents (booking_id, document_id, requirement_key)
  select b.id, doc.id, doc.requirement_key from documents doc
   where doc.superseded_by is null
     and (doc.customer_id = b.customer_id or doc.guarantor_id = b.guarantor_id or doc.tractor_id = b.tractor_id
          or doc.driver_id = (select driver_id from booking_drivers where booking_id = b.id and is_primary limit 1));
  update bookings set status = 'PENDING_REVIEW', need_docs_due_at = null where id = b.id returning * into b;
  return b;
end $$;

-- ---------------------------------------------------------------- payments (D2, D10, BR-17, BR-18)
create or replace function submit_payment(p_booking uuid, p_method payment_method, p_slip_path text default null)
returns payments
language plpgsql security definer set search_path = public as $$
declare b bookings; p payments;
begin
  select * into b from bookings where id = p_booking;
  if b.customer_id is distinct from my_customer_id() and auth_role() not in ('SALES','SUPER_ADMIN') then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  if b.status <> 'APPROVED_AWAITING_PAYMENT' then
    raise exception 'ชำระได้หลังการจองได้รับอนุมัติเท่านั้น';
  end if;
  if p_method = 'TRANSFER' and coalesce(p_slip_path, '') = '' then raise exception 'แนบสลิปการโอน'; end if;
  insert into payments (booking_id, method, amount, status, slip_path, recorded_by)
  values (b.id, p_method, b.total_amount, 'PENDING_VERIFICATION', p_slip_path, auth.uid())
  returning * into p;
  return p;
end $$;

create or replace function verify_payment(p_payment uuid, p_approve boolean) returns payments
language plpgsql security definer set search_path = public as $$
declare p payments; v_role app_role := auth_role(); v_recorder app_role;
begin
  if v_role not in ('SALES','SUPER_ADMIN') then raise exception 'ไม่มีสิทธิ์ยืนยันการชำระ'; end if;
  select * into p from payments where id = p_payment for update;
  select role into v_recorder from profiles where id = p.recorded_by;
  if v_role = 'SALES' and v_recorder = 'SALES' then
    raise exception 'การชำระที่ Sales บันทึกแทนลูกค้า ต้องให้ Super Admin ยืนยัน';
  end if;
  if p.status <> 'PENDING_VERIFICATION' then raise exception 'รายการนี้ไม่ได้รอตรวจ'; end if;

  if p_approve then
    update payments set status = 'PAID', verified_by = auth.uid(), verified_at = now(), paid_at = now()
     where id = p.id returning * into p;
    if p.purpose = 'RENTAL_AND_DEPOSIT' then
      update bookings set status = 'CONFIRMED' where id = p.booking_id;
      update deposits set status = 'HELD' where booking_id = p.booking_id;
    end if;
  else
    update payments set status = 'REJECTED', verified_by = auth.uid(), verified_at = now()
     where id = p.id returning * into p;
  end if;
  return p;
end $$;

-- ---------------------------------------------------------------- cancellation (D17, BR-08)
create or replace function cancel_booking(p_booking uuid, p_reason text default null) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; v_role app_role := auth_role(); v_paid boolean; v_fee numeric;
begin
  select * into b from bookings where id = p_booking for update;
  if not (b.customer_id = my_customer_id() or v_role in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์ยกเลิก';
  end if;
  if b.status not in ('PENDING_REVIEW','NEED_MORE_DOCS','APPROVED_AWAITING_PAYMENT','CONFIRMED','READY_FOR_PICKUP') then
    raise exception 'ยกเลิกได้ก่อนรับหางเท่านั้น';
  end if;
  v_paid := b.status in ('CONFIRMED','READY_FOR_PICKUP');
  v_fee := case when v_paid and v_role = 'CUSTOMER' then setting_num('cancellation_fee') end;
  if v_fee is not null and v_fee > 0 then
    insert into extra_charges (booking_id, kind, amount, description, status, approved_by)
    values (b.id, 'CANCELLATION_FEE', v_fee, 'ค่าธรรมเนียมยกเลิกก่อนรับหาง', 'APPROVED', auth.uid());
  end if;
  update bookings set status = 'CANCELLED', cancel_reason = p_reason, cancelled_by = auth.uid(),
         cancellation_fee = v_fee
   where id = b.id returning * into b;
  -- refunds are recorded by Sales/SA when the money is actually transferred back
  return b;
end $$;

-- ---------------------------------------------------------------- audit log (FR-ADM-19)
create or replace function audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_logs (actor_id, action, table_name, row_id, before, after)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'id',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'key',
                   (case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end) ->> 'booking_id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['bookings','payments','refunds','deposits','extra_charges','trailers','documents',
                           'profiles','customers','settings']
  loop
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- views (§15)
-- Runs with the view owner's rights (drivers cannot read bookings directly) and filters to the
-- signed-in driver, exposing no money or company documents (PRD §5.1 note 2).
create or replace view driver_appointments_v as
select a.id, a.booking_id, a.kind, a.scheduled_at, a.checkin_code, a.completed_at,
       y.code as yard_code, y.number as yard_number, y.short_name as yard_short, y.address as yard_address,
       y.map_url as yard_map_url,
       t.id as trailer_id, t.code as trailer_code, t.plate_no as trailer_plate, t.type as trailer_type,
       t.length_ft as trailer_length_ft,
       tr.plate_no || ' ' || tr.province as tractor_plate, b.booking_no, b.status as booking_status,
       b.flagged_reason, c.name as customer_name
  from appointments a
  join bookings b on b.id = a.booking_id
  join booking_drivers bd on bd.booking_id = b.id and bd.driver_id = my_driver_id()
  join yards y on y.id = a.yard_id
  join trailers t on t.id = b.trailer_id
  join tractors tr on tr.id = b.tractor_id
  join customers c on c.id = b.customer_id;

create or replace view revenue_by_month_v with (security_invoker = true) as
select date_trunc('month', pickup_at at time zone 'Asia/Bangkok')::date as month,
       sum(coalesce(recalculated_rental, rental_amount)) as rental
  from bookings
 where status in ('CONFIRMED','READY_FOR_PICKUP','IN_RENTAL','RETURNED_PENDING_SETTLEMENT','COMPLETED')
 group by 1;

revoke all on driver_appointments_v from anon;

-- RPCs callable by signed-in users only
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
-- RLS policies call these helpers for anonymous visitors too (public trailer search)
grant execute on function auth_role(), is_staff(), my_customer_id(), my_driver_id(), expected_yard(uuid, timestamptz)
  to anon;

-- ======================================== supabase/migrations/20261107000003_rls.sql
-- FAR Service — Row Level Security (database.md §13)
-- Business writes (bookings, approvals, payments, documents, drivers) go through
-- security-definer RPCs; table policies below cover reads and simple owner edits.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- reference data
create policy yards_read on yards for select using (true);
create policy yards_admin on yards for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

create policy trailer_types_read on trailer_types for select using (true);
create policy trailer_types_admin on trailer_types for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

create policy doc_requirements_read on doc_requirements for select using (true);
create policy doc_requirements_admin on doc_requirements for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

create policy checklist_templates_read on checklist_templates for select using (is_staff() or auth.uid() is not null);
create policy checklist_templates_admin on checklist_templates for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');
create policy checklist_items_read on checklist_template_items for select using (auth.uid() is not null);
create policy checklist_items_admin on checklist_template_items for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

-- settings: everyone signed in may read policy values (prices need VAT etc.), only SA writes
create policy settings_read on settings for select using (true);
create policy settings_admin on settings for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------- profiles
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_staff());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles p where p.id = auth.uid()));
create policy profiles_admin on profiles for all using (auth_role() = 'SUPER_ADMIN') with check (auth_role() = 'SUPER_ADMIN');

-- ---------------------------------------------------------------- customers & their things
create policy customers_read on customers for select
  using (owner_id = auth.uid() or is_staff()
         or id in (select customer_id from customer_drivers where driver_id = my_driver_id()));
create policy customers_owner_update on customers for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and is_blacklisted = false);
create policy customers_staff_write on customers for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy guarantors_read on guarantors for select using (customer_id = my_customer_id() or is_staff());
create policy guarantors_owner_write on guarantors for all
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());
create policy guarantors_staff_write on guarantors for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy tractors_read on tractors for select using (customer_id = my_customer_id() or is_staff());
create policy tractors_owner_write on tractors for all
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());
create policy tractors_staff_write on tractors for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy drivers_read on drivers for select
  using (is_staff() or profile_id = auth.uid()
         or id in (select driver_id from customer_drivers where customer_id = my_customer_id() and removed_at is null));
create policy drivers_self_update on drivers for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy drivers_staff_write on drivers for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy customer_drivers_read on customer_drivers for select
  using (customer_id = my_customer_id() or driver_id = my_driver_id() or is_staff());
create policy customer_drivers_owner_update on customer_drivers for update
  using (customer_id = my_customer_id()) with check (customer_id = my_customer_id());

create policy invites_read on invites for select
  using (is_staff() or customer_id = my_customer_id()
         or driver_id in (select driver_id from customer_drivers where customer_id = my_customer_id()));

-- ---------------------------------------------------------------- fleet
create policy trailers_public_read on trailers for select using ((is_published and retired_at is null) or is_staff());
create policy trailers_staff_insert on trailers for insert with check (is_staff());
create policy trailers_staff_update on trailers for update using (is_staff()) with check (is_staff());
-- OPS may not change prices (handled in trigger below)

create policy trailer_photos_read on trailer_photos for select using (true);
create policy trailer_photos_staff on trailer_photos for all using (is_staff()) with check (is_staff());
create policy trailer_compliance_staff on trailer_compliance for all using (is_staff()) with check (is_staff());
create policy maintenance_read on maintenance_records for select using (is_staff());
create policy maintenance_write on maintenance_records for all
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));
create policy yard_transfers_read on yard_transfers for select using (is_staff());
create policy yard_transfers_write on yard_transfers for insert with check (auth_role() in ('OPS','SUPER_ADMIN'));

create or replace function guard_trailer_prices() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth_role() = 'OPS' and (new.daily_rate, new.weekly_rate, new.monthly_rate)
                          is distinct from (old.daily_rate, old.weekly_rate, old.monthly_rate) then
    raise exception 'Staff (Ops) แก้เรทราคาไม่ได้';
  end if;
  if auth_role() <> 'SUPER_ADMIN' and new.deposit_amount is distinct from old.deposit_amount then
    raise exception 'แก้เงินค้ำประกันได้เฉพาะ Super Admin';
  end if;
  if auth_role() = 'SALES' and new.retired_at is distinct from old.retired_at then
    raise exception 'ปลดระวางหางได้เฉพาะ Ops และ Super Admin';
  end if;
  return new;
end $$;
create trigger trailers_guard before update on trailers for each row execute function guard_trailer_prices();

-- ---------------------------------------------------------------- documents
create policy documents_read on documents for select using (
  auth_role() in ('SALES','SUPER_ADMIN')
  or customer_id = my_customer_id()
  or guarantor_id in (select id from guarantors where customer_id = my_customer_id())
  or tractor_id in (select id from tractors where customer_id = my_customer_id())
  or driver_id in (select driver_id from customer_drivers where customer_id = my_customer_id())
  or driver_id = my_driver_id()
  -- Ops see only what they check at the gate
  or (auth_role() = 'OPS' and requirement_key in ('driver_license','tractor_book'))
);

-- ---------------------------------------------------------------- bookings
create policy bookings_read on bookings for select using (
  is_staff() or customer_id = my_customer_id()
);
create policy bookings_staff_note on bookings for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

create policy booking_drivers_read on booking_drivers for select using (
  is_staff() or driver_id = my_driver_id()
  or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy booking_documents_read on booking_documents for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy booking_history_read on booking_status_history for select using (
  is_staff() or booking_id in (select id from bookings where customer_id = my_customer_id())
);

-- ---------------------------------------------------------------- money
create policy payments_read on payments for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy refunds_read on refunds for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy refunds_write on refunds for insert with check (auth_role() in ('SALES','SUPER_ADMIN'));
create policy deposits_read on deposits for select using (
  auth_role() in ('SALES','SUPER_ADMIN') or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy deposits_write on deposits for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));
create policy extra_charges_read on extra_charges for select using (
  is_staff() or booking_id in (select id from bookings where customer_id = my_customer_id())
);
create policy extra_charges_propose on extra_charges for insert with check (is_staff() and status = 'PROPOSED');
create policy extra_charges_decide on extra_charges for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));

-- ---------------------------------------------------------------- yard work
create policy appointments_read on appointments for select using (
  is_staff()
  or booking_id in (select id from bookings where customer_id = my_customer_id())
  or booking_id in (select booking_id from booking_drivers where driver_id = my_driver_id())
);
create policy appointments_ops on appointments for update
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));

create policy inspections_read on inspections for select using (
  is_staff()
  or appointment_id in (select a.id from appointments a join bookings b on b.id = a.booking_id
                         where b.customer_id = my_customer_id())
  or appointment_id in (select a.id from appointments a join booking_drivers bd on bd.booking_id = a.booking_id
                         where bd.driver_id = my_driver_id())
);
create policy inspections_ops on inspections for all
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));

create policy inspection_items_read on inspection_items for select
  using (inspection_id in (select id from inspections));          -- inherits inspections_read
create policy inspection_items_ops on inspection_items for all
  using (auth_role() in ('OPS','SUPER_ADMIN')) with check (auth_role() in ('OPS','SUPER_ADMIN'));

create policy inspection_photos_read on inspection_photos for select using (inspection_id in (select id from inspections));
create policy inspection_photos_write on inspection_photos for insert
  with check (auth_role() in ('OPS','SUPER_ADMIN') or (auth_role() = 'DRIVER' and inspection_id in (select id from inspections)));

create policy acks_read on driver_acknowledgements for select using (inspection_id in (select id from inspections));
create policy acks_driver on driver_acknowledgements for insert with check (
  (driver_id = my_driver_id() and inspection_id in (select id from inspections))
  or auth_role() in ('OPS','SUPER_ADMIN')               -- signed on the yard tablet
);

-- ---------------------------------------------------------------- system
create policy notifications_own on notifications for select using (recipient_id = auth.uid());
create policy notifications_mark_read on notifications for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
create policy audit_read on audit_logs for select using (auth_role() = 'SUPER_ADMIN');
create policy contact_insert on contact_messages for insert with check (true);
create policy contact_staff on contact_messages for select using (auth_role() in ('SALES','SUPER_ADMIN'));
create policy contact_staff_update on contact_messages for update
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));
-- booking_counters: no policy → only security-definer functions touch it

-- ---------------------------------------------------------------- RPCs for owner-side writes
-- Add (or reuse by phone) a driver, link to the customer, and record an invite.
create or replace function add_driver(p_customer uuid, p_full_name text, p_phone text, p_license_no text,
                                      p_license_class text, p_license_expires date) returns drivers
language plpgsql security definer set search_path = public as $$
declare d drivers; v_phone text := regexp_replace(p_phone, '\D', '', 'g');
begin
  if not (p_customer = my_customer_id() or auth_role() in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์เพิ่มคนขับให้ลูกค้ารายนี้';
  end if;
  if p_license_expires <= current_date then raise exception 'ใบขับขี่หมดอายุแล้ว'; end if;
  select * into d from drivers where phone = v_phone;
  if not found then
    insert into drivers (full_name, phone, license_no, license_class, license_expires_on)
    values (p_full_name, v_phone, p_license_no, p_license_class, p_license_expires) returning * into d;
  end if;
  insert into customer_drivers (customer_id, driver_id, added_by) values (p_customer, d.id, auth.uid())
  on conflict (customer_id, driver_id) do update set removed_at = null;
  if d.profile_id is null then
    insert into invites (kind, customer_id, driver_id, phone, token_hash, invited_by)
    values ('DRIVER', p_customer, d.id, v_phone, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), auth.uid());
  end if;
  return d;
end $$;

create or replace function resend_driver_invite(p_driver uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_driver in (select driver_id from customer_drivers where customer_id = my_customer_id())
          or auth_role() in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์';
  end if;
  update invites set sent_count = sent_count + 1, last_sent_at = now(), expires_at = now() + interval '7 days'
   where driver_id = p_driver and accepted_at is null;
  if not found then
    insert into invites (kind, driver_id, phone, token_hash, invited_by)
    select 'DRIVER', id, phone, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), auth.uid()
      from drivers where id = p_driver;
  end if;
end $$;

-- Register an uploaded file as the current version of a required document.
create or replace function register_document(p_requirement text, p_owner doc_owner, p_owner_id uuid,
                                             p_storage_path text, p_file_name text, p_mime text, p_size int,
                                             p_expires date default null) returns documents
language plpgsql security definer set search_path = public as $$
declare d documents; v_mine boolean;
begin
  v_mine := case p_owner
    when 'CUSTOMER'  then p_owner_id = my_customer_id()
    when 'GUARANTOR' then p_owner_id in (select id from guarantors where customer_id = my_customer_id())
    when 'TRACTOR'   then p_owner_id in (select id from tractors where customer_id = my_customer_id())
    when 'DRIVER'    then p_owner_id in (select driver_id from customer_drivers where customer_id = my_customer_id())
                          or p_owner_id = my_driver_id()
  end;
  if not (coalesce(v_mine, false) or auth_role() in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์อัปโหลดเอกสารนี้';
  end if;
  if (select owner from doc_requirements where key = p_requirement) is distinct from p_owner then
    raise exception 'ประเภทเอกสารไม่ตรงกับเจ้าของ';
  end if;

  insert into documents (requirement_key, customer_id, guarantor_id, tractor_id, driver_id,
                         storage_path, file_name, mime_type, size_bytes, expires_on, uploaded_by)
  values (p_requirement,
          case when p_owner = 'CUSTOMER' then p_owner_id end,
          case when p_owner = 'GUARANTOR' then p_owner_id end,
          case when p_owner = 'TRACTOR' then p_owner_id end,
          case when p_owner = 'DRIVER' then p_owner_id end,
          p_storage_path, p_file_name, p_mime, p_size, p_expires, auth.uid())
  returning * into d;
  -- the unique "current" index is enforced after the old version is superseded
  return d;
end $$;

-- Supersede the previous current version before a new one is inserted.
create or replace function supersede_document() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update documents set superseded_by = new.id
   where requirement_key = new.requirement_key and superseded_by is null and id <> new.id
     and coalesce(customer_id, guarantor_id, tractor_id, driver_id)
       = coalesce(new.customer_id, new.guarantor_id, new.tractor_id, new.driver_id);
  return new;
end $$;
-- documents_current_uq must be deferrable for the swap; recreate it as a constraint trigger check instead
drop index documents_current_uq;
create trigger documents_supersede after insert on documents for each row execute function supersede_document();
create index documents_current_idx on documents
  (requirement_key, coalesce(customer_id, guarantor_id, tractor_id, driver_id)) where superseded_by is null;

grant execute on function add_driver(uuid, text, text, text, text, date), resend_driver_invite(uuid),
  register_document(text, doc_owner, uuid, text, text, text, int, date) to authenticated;
revoke execute on function add_driver(uuid, text, text, text, text, date), resend_driver_invite(uuid),
  register_document(text, doc_owner, uuid, text, text, text, int, date) from anon, public;

-- ======================================== supabase/migrations/20261107000004_storage.sql
-- FAR Service — storage buckets (database.md §14)
-- Safe to run more than once.
-- Paths: documents/{customer_id}/{requirement_key}/{uuid}.{ext}
--        payment-slips/{booking_id}/{uuid}.{ext}
--        inspection-photos/{booking_id}/{inspection_id}/{uuid}.jpg
--        signatures/{booking_id}/{inspection_id}.png

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('trailer-photos',    'trailer-photos',    true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('documents',         'documents',         false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('payment-slips',     'payment-slips',     false, 10485760, array['image/jpeg','image/png','application/pdf']),
  ('inspection-photos', 'inspection-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('signatures',        'signatures',        false, 1048576,  array['image/png']),
  ('refund-proofs',     'refund-proofs',     false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

-- trailer photos: public read, staff write
drop policy if exists "trailer photos read" on storage.objects;
create policy "trailer photos read" on storage.objects for select using (bucket_id = 'trailer-photos');
drop policy if exists "trailer photos staff" on storage.objects;
create policy "trailer photos staff" on storage.objects for all
  using (bucket_id = 'trailer-photos' and public.is_staff())
  with check (bucket_id = 'trailer-photos' and public.is_staff());

-- documents: first folder = customer id
drop policy if exists "documents owner" on storage.objects;
create policy "documents owner" on storage.objects for all
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = public.my_customer_id()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = public.my_customer_id()::text);
drop policy if exists "documents reviewers" on storage.objects;
create policy "documents reviewers" on storage.objects for all
  using (bucket_id = 'documents' and public.auth_role() in ('SALES','SUPER_ADMIN'))
  with check (bucket_id = 'documents' and public.auth_role() in ('SALES','SUPER_ADMIN'));

-- payment slips: first folder = booking id of the customer
drop policy if exists "slips owner" on storage.objects;
create policy "slips owner" on storage.objects for all
  using (bucket_id = 'payment-slips' and (storage.foldername(name))[1]::uuid in
         (select id from public.bookings where customer_id = public.my_customer_id()))
  with check (bucket_id = 'payment-slips' and (storage.foldername(name))[1]::uuid in
         (select id from public.bookings where customer_id = public.my_customer_id()));
drop policy if exists "slips staff" on storage.objects;
create policy "slips staff" on storage.objects for all
  using (bucket_id in ('payment-slips','refund-proofs') and public.auth_role() in ('SALES','SUPER_ADMIN'))
  with check (bucket_id in ('payment-slips','refund-proofs') and public.auth_role() in ('SALES','SUPER_ADMIN'));

-- inspection photos & signatures: staff write; customer and booked drivers read; drivers may add photos/signature
drop policy if exists "inspection media staff" on storage.objects;
create policy "inspection media staff" on storage.objects for all
  using (bucket_id in ('inspection-photos','signatures') and public.is_staff())
  with check (bucket_id in ('inspection-photos','signatures') and public.is_staff());
drop policy if exists "inspection media parties" on storage.objects;
create policy "inspection media parties" on storage.objects for select
  using (bucket_id in ('inspection-photos','signatures') and (storage.foldername(name))[1]::uuid in (
    select id from public.bookings where customer_id = public.my_customer_id()
    union select booking_id from public.booking_drivers where driver_id = public.my_driver_id()));
drop policy if exists "inspection media driver upload" on storage.objects;
create policy "inspection media driver upload" on storage.objects for insert
  with check (bucket_id in ('inspection-photos','signatures') and (storage.foldername(name))[1]::uuid in (
    select booking_id from public.booking_drivers where driver_id = public.my_driver_id()));

-- ======================================== supabase/migrations/20261107000005_sync_role.sql
-- FAR Service — keep profiles.role in sync with auth app_metadata.
-- Supabase Auth writes app_metadata in a separate UPDATE after creating the user, so the
-- insert trigger alone always sees the default role. This also covers promoting a user
-- later from the dashboard or with the admin API. Safe to run more than once.

create or replace function sync_user_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := (new.raw_app_meta_data ->> 'role')::app_role;
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''), '\D', '', 'g');
begin
  if v_role is null then return new; end if;
  update profiles set role = v_role where id = new.id and role is distinct from v_role;
  if v_role = 'DRIVER' and v_phone <> '' then
    update drivers set profile_id = new.id where profile_id is null and phone = v_phone;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_role_changed on auth.users;
create trigger on_auth_user_role_changed after update of raw_app_meta_data on auth.users
  for each row when (old.raw_app_meta_data ->> 'role' is distinct from new.raw_app_meta_data ->> 'role')
  execute function sync_user_role();

-- ======================================== supabase/migrations/20261107000006_yard_operations.sql
-- FAR Service — yard operations: check-in, checklist, driver acknowledgement, handover, settlement
-- (PRD D4, D7, D8, D13, D16, BR-11, BR-16, BR-23; database.md §12.6). Safe to run more than once.

-- ---------------------------------------------------------------- check-in (BR-23)
create or replace function checkin_appointment(p_appointment uuid, p_code text, p_identity_match boolean)
returns appointments
language plpgsql security definer set search_path = public as $$
declare a appointments;
begin
  if auth_role() not in ('OPS','SUPER_ADMIN') then raise exception 'เช็กอินได้เฉพาะเจ้าหน้าที่ลาน'; end if;
  select * into a from appointments where id = p_appointment for update;
  if not found then raise exception 'ไม่พบนัดนี้'; end if;
  if a.completed_at is not null then raise exception 'นัดนี้เสร็จสิ้นแล้ว'; end if;
  if trim(p_code) <> a.checkin_code then raise exception 'รหัสเช็กอินไม่ถูกต้อง'; end if;
  if now() not between coalesce(a.code_valid_from, '-infinity') and coalesce(a.code_valid_to, 'infinity') then
    raise exception 'รหัสนี้ใช้ได้เฉพาะวันนัด ±1 วัน';
  end if;
  update appointments
     set checked_in_at = now(), checked_in_by = auth.uid(), identity_match = p_identity_match,
         driver_id = (select driver_id from booking_drivers where booking_id = a.booking_id and is_primary limit 1)
   where id = a.id returning * into a;
  return a;
end $$;

-- ---------------------------------------------------------------- full checklist by Ops (D7, D8)
-- p_items: [{ "key": "chassis", "label": "แชสซีและคานขวาง", "result": "OK" | "DAMAGED" | "NA", "note": "" }, ...]
create or replace function save_inspection(p_appointment uuid, p_items jsonb, p_notes text default null,
                                           p_damage_amount numeric default null) returns inspections
language plpgsql security definer set search_path = public as $$
declare a appointments; b bookings; i inspections; v_kind inspection_kind; v_damaged int;
begin
  if auth_role() not in ('OPS','SUPER_ADMIN') then raise exception 'บันทึกผลตรวจได้เฉพาะเจ้าหน้าที่ลาน'; end if;
  select * into a from appointments where id = p_appointment;
  if not found then raise exception 'ไม่พบนัดนี้'; end if;
  select * into b from bookings where id = a.booking_id for update;
  v_kind := case a.kind when 'PICKUP' then 'OUT' else 'IN' end;
  if v_kind = 'OUT' and b.status not in ('CONFIRMED','READY_FOR_PICKUP') then
    raise exception 'ตรวจก่อนส่งมอบได้เมื่อการจองชำระเงินแล้วเท่านั้น';
  end if;
  if v_kind = 'IN' and b.status <> 'IN_RENTAL' then raise exception 'การจองนี้ยังไม่ได้อยู่ระหว่างเช่า'; end if;
  if v_kind = 'IN' and a.checked_in_at is null then raise exception 'เช็กอินคนขับก่อนตรวจรับคืน'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'ยังไม่มีผลตรวจ'; end if;

  insert into inspections (appointment_id, kind, template_id, inspector_id, notes)
  values (a.id, v_kind, (select checklist_template_id from trailer_types tt join trailers t on t.type = tt.code where t.id = b.trailer_id),
          auth.uid(), p_notes)
  on conflict (appointment_id) do update set inspector_id = excluded.inspector_id, notes = excluded.notes
  returning * into i;

  delete from inspection_items where inspection_id = i.id;
  insert into inspection_items (inspection_id, item_key, label, result, note)
  select i.id, x ->> 'key', x ->> 'label', (x ->> 'result')::checklist_result, nullif(x ->> 'note', '')
    from jsonb_array_elements(p_items) x;
  select count(*) into v_damaged from inspection_items where inspection_id = i.id and result = 'DAMAGED';

  update inspections set damaged_count = v_damaged, completed_at = now() where id = i.id returning * into i;

  if v_kind = 'OUT' and b.status = 'CONFIRMED' then
    update bookings set status = 'READY_FOR_PICKUP' where id = b.id;
    update trailers set status = 'RESERVED' where id = b.trailer_id and status = 'AVAILABLE';
  end if;
  if v_kind = 'IN' and coalesce(p_damage_amount, 0) > 0 then
    insert into extra_charges (booking_id, kind, amount, description, status, proposed_by)
    values (b.id, 'DAMAGE', p_damage_amount, coalesce(p_notes, 'ความเสียหายจากการตรวจรับคืน'), 'PROPOSED', auth.uid());
  end if;
  return i;
end $$;

-- ---------------------------------------------------------------- driver's quick confirmation (FR-DRV-04)
create or replace function acknowledge_inspection(p_inspection uuid, p_result ack_result, p_remark text default null,
                                                  p_signature_path text default null,
                                                  p_device ack_device default 'DRIVER_PHONE')
returns driver_acknowledgements
language plpgsql security definer set search_path = public as $$
declare i inspections; a appointments; v_driver uuid; r driver_acknowledgements;
begin
  select * into i from inspections where id = p_inspection;
  if not found or i.completed_at is null then raise exception 'เจ้าหน้าที่ยังบันทึกผลตรวจไม่เสร็จ'; end if;
  select * into a from appointments where id = i.appointment_id;
  if auth_role() = 'DRIVER' then
    v_driver := my_driver_id();
    if not exists (select 1 from booking_drivers where booking_id = a.booking_id and driver_id = v_driver) then
      raise exception 'นัดนี้ไม่ใช่ของคุณ';
    end if;
    if a.checked_in_at is null then raise exception 'ให้เจ้าหน้าที่ลานเช็กอินก่อน'; end if;
    p_device := 'DRIVER_PHONE';
  elsif auth_role() in ('OPS','SUPER_ADMIN') then
    v_driver := coalesce(a.driver_id, (select driver_id from booking_drivers where booking_id = a.booking_id and is_primary limit 1));
    p_device := 'YARD_TABLET';
  else
    raise exception 'ไม่มีสิทธิ์';
  end if;
  if exists (select 1 from driver_acknowledgements where inspection_id = i.id) then
    raise exception 'ผลตรวจนี้เซ็นรับทราบแล้ว';
  end if;

  insert into driver_acknowledgements (inspection_id, driver_id, result, remark, signature_path, device)
  values (i.id, v_driver, p_result, nullif(trim(coalesce(p_remark, '')), ''), p_signature_path, p_device)
  returning * into r;

  if p_result in ('REMARK','DISPUTE') then
    update bookings set flagged_reason = 'คนขับ' || case when p_result = 'DISPUTE' then 'โต้แย้ง' else 'มีข้อสังเกต' end
                                         || 'ผลตรวจ: ' || r.remark
     where id = a.booking_id;
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------- handover / return (BR-16, D13, D16, BR-11)
create or replace function complete_handover(p_appointment uuid) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  a appointments; b bookings; i inspections; t trailers;
  v_days int; q record; v_late_days int;
begin
  if auth_role() not in ('OPS','SUPER_ADMIN') then raise exception 'ส่งมอบ/รับคืนได้เฉพาะเจ้าหน้าที่ลาน'; end if;
  select * into a from appointments where id = p_appointment for update;
  select * into b from bookings where id = a.booking_id for update;
  select * into i from inspections where appointment_id = a.id;
  select * into t from trailers where id = b.trailer_id for update;

  if a.completed_at is not null then raise exception 'นัดนี้เสร็จสิ้นแล้ว'; end if;
  if a.checked_in_at is null then raise exception 'ยังไม่ได้เช็กอินคนขับ'; end if;
  if not coalesce(a.identity_match, false) then raise exception 'คนขับหรือหัวลากไม่ตรงกับการจอง ห้ามส่งมอบ'; end if;
  if i.id is null or i.completed_at is null then raise exception 'ยังไม่ได้บันทึกผลตรวจสภาพ'; end if;
  if not exists (select 1 from driver_acknowledgements where inspection_id = i.id) then
    raise exception 'คนขับยังไม่ได้เซ็นรับทราบผลตรวจ';
  end if;

  update appointments set completed_at = now() where id = a.id;

  if a.kind = 'PICKUP' then
    if b.status <> 'READY_FOR_PICKUP' then raise exception 'การจองยังไม่พร้อมส่งมอบ'; end if;
    update bookings set status = 'IN_RENTAL', actual_pickup_at = now() where id = b.id returning * into b;
    update trailers set status = 'RENTED' where id = t.id;
    return b;
  end if;

  -- RETURN
  if b.status <> 'IN_RENTAL' then raise exception 'การจองนี้ไม่ได้อยู่ระหว่างเช่า'; end if;
  update bookings set status = 'RETURNED_PENDING_SETTLEMENT', actual_return_at = now(), actual_return_yard_id = a.yard_id
   where id = b.id returning * into b;

  if a.yard_id <> t.current_yard_id then
    insert into yard_transfers (trailer_id, from_yard_id, to_yard_id, reason, booking_id, moved_by)
    values (t.id, t.current_yard_id, a.yard_id, 'RETURN_OTHER_YARD', b.id, auth.uid());
  end if;
  update trailers set status = 'INSPECTION', current_yard_id = a.yard_id where id = t.id;

  if b.actual_return_at < b.return_at - interval '3 hours' then
    -- early termination (D16): re-price on actual days with the matching tier
    v_days := rental_days(b.pickup_at, b.actual_return_at);
    select * into q from quote_rental(b.trailer_id, v_days, b.tyre_count);  -- 3-arg form from migration 7
    update bookings set early_termination = true, recalculated_days = v_days, recalculated_tier = q.tier,
           recalculated_rental = q.rental, return_at = greatest(actual_return_at, pickup_at + interval '1 hour')
     where id = b.id returning * into b;
    if (b.rental_amount + b.tyre_fee + b.vat_amount) - (q.rental + q.tyre_fee + q.vat) <> 0 then
      insert into extra_charges (booking_id, kind, amount, description, status, proposed_by)
      values (b.id, 'EARLY_RETURN_DIFF', (q.rental + q.tyre_fee + q.vat) - (b.rental_amount + b.tyre_fee + b.vat_amount),
              format('คืนก่อนกำหนด: คิดใหม่ %s วัน (%s)', v_days, q.tier), 'PROPOSED', auth.uid());
    end if;
  elsif b.actual_return_at > b.return_at + interval '3 hours' then
    v_late_days := ceil(extract(epoch from (b.actual_return_at - b.return_at)) / 86400)::int;
    insert into extra_charges (booking_id, kind, amount, description, status, proposed_by)
    values (b.id, 'LATE_RETURN', round(b.rate_daily * coalesce(setting_num('late_return_multiplier'), 1.5) * v_late_days),
            format('คืนช้า %s วัน', v_late_days), 'PROPOSED', auth.uid());
  end if;
  return b;
end $$;

-- ---------------------------------------------------------------- settlement (FR-APV-10, FR-PAY-07)
create or replace function settle_booking(p_booking uuid, p_waive_damage boolean default false) returns bookings
language plpgsql security definer set search_path = public as $$
declare b bookings; d deposits; v_charges numeric; v_deduct numeric;
begin
  if auth_role() not in ('SALES','SUPER_ADMIN') then raise exception 'ปิดยอดได้เฉพาะฝ่ายขายหรือ Super Admin'; end if;
  select * into b from bookings where id = p_booking for update;
  if b.status <> 'RETURNED_PENDING_SETTLEMENT' then raise exception 'การจองนี้ยังไม่ได้คืนหาง'; end if;

  update extra_charges set status = case when p_waive_damage and kind = 'DAMAGE' then 'WAIVED' else 'APPROVED' end::charge_status,
         approved_by = auth.uid()
   where booking_id = b.id and status = 'PROPOSED';

  -- positive charges (damage, late return, fees) come out of the deposit; negative ones (early-return
  -- difference) are money owed back to the customer and are refunded separately (refunds table)
  select coalesce(sum(amount), 0) into v_charges from extra_charges
   where booking_id = b.id and status = 'APPROVED' and amount > 0;
  select * into d from deposits where booking_id = b.id for update;
  v_deduct := least(greatest(v_charges, 0), d.amount);
  update deposits set deducted_amount = v_deduct,
         released_amount = d.amount - v_deduct,
         status = case when v_deduct = 0 then 'RELEASED' when v_deduct >= d.amount then 'FULLY_DEDUCTED'
                       else 'PARTIALLY_DEDUCTED' end::deposit_status,
         released_at = now()
   where booking_id = b.id;
  update extra_charges set status = 'SETTLED' where booking_id = b.id and status = 'APPROVED';

  update bookings set status = 'COMPLETED' where id = b.id returning * into b;
  update trailers set status = 'AVAILABLE' where id = b.trailer_id and status = 'INSPECTION';
  return b;
end $$;

grant execute on function checkin_appointment(uuid, text, boolean), save_inspection(uuid, jsonb, text, numeric),
  acknowledge_inspection(uuid, ack_result, text, text, ack_device), complete_handover(uuid),
  settle_booking(uuid, boolean) to authenticated;
revoke execute on function checkin_appointment(uuid, text, boolean), save_inspection(uuid, jsonb, text, numeric),
  acknowledge_inspection(uuid, ack_result, text, text, ack_device), complete_handover(uuid),
  settle_booking(uuid, boolean) from anon, public;

-- ---------------------------------------------------------------- driver view: expose check-in state
create or replace view driver_appointments_v as
select a.id, a.booking_id, a.kind, a.scheduled_at, a.checkin_code, a.completed_at,
       y.code as yard_code, y.number as yard_number, y.short_name as yard_short, y.address as yard_address,
       y.map_url as yard_map_url,
       t.id as trailer_id, t.code as trailer_code, t.plate_no as trailer_plate, t.type as trailer_type,
       t.length_ft as trailer_length_ft,
       tr.plate_no || ' ' || tr.province as tractor_plate, b.booking_no, b.status as booking_status,
       b.flagged_reason, c.name as customer_name,
       a.checked_in_at
  from appointments a
  join bookings b on b.id = a.booking_id
  join booking_drivers bd on bd.booking_id = b.id and bd.driver_id = my_driver_id()
  join yards y on y.id = a.yard_id
  join trailers t on t.id = b.trailer_id
  join tractors tr on tr.id = b.tractor_id
  join customers c on c.id = b.customer_id;
revoke all on driver_appointments_v from anon;

-- ======================================== supabase/migrations/20261108000007_trailer_models.sql
-- FAR Service — trailer models with real specs and price lists (Nov 2026 price list).
-- Skeletal / flatbed: monthly rate by contract length (1–5, 6–11, 12+ months), tyres not included,
-- optional tyre-fitting service per tyre. Lowbed: daily and monthly rate. All prices exclude VAT.

create table if not exists trailer_models (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  type              trailer_type_code not null references trailer_types,
  name              text not null,
  axles             smallint not null,
  length_ft         smallint,
  width_m           numeric(4,2),
  length_m          numeric(4,2),
  deck_length       text,                -- e.g. '9.6' or '6.15 + 2.35'
  deck_height_m     numeric(4,2),
  weight_ton        numeric(5,2),
  rate_plan         text not null check (rate_plan in ('MONTHLY_TIERED','DAILY_MONTHLY')),
  daily_rate        numeric(12,2),
  monthly_rate      numeric(12,2),
  monthly_rate_1_5  numeric(12,2),
  monthly_rate_6_11 numeric(12,2),
  monthly_rate_12   numeric(12,2),
  deposit           numeric(12,2) not null,
  tyre_fee          numeric(12,2) not null default 0,   -- per tyre, 0 = not offered
  tyre_count        smallint not null default 0,        -- tyre positions on this model
  description       text,
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz,
  check (rate_plan <> 'MONTHLY_TIERED' or (monthly_rate_1_5 > 0 and monthly_rate_6_11 > 0 and monthly_rate_12 > 0)),
  check (rate_plan <> 'DAILY_MONTHLY' or (daily_rate > 0 and monthly_rate > 0))
);

alter table trailer_models enable row level security;
drop policy if exists trailer_models_read on trailer_models;
create policy trailer_models_read on trailer_models for select using (true);
drop policy if exists trailer_models_write on trailer_models;
create policy trailer_models_write on trailer_models for all
  using (auth_role() in ('SALES','SUPER_ADMIN')) with check (auth_role() in ('SALES','SUPER_ADMIN'));
drop trigger if exists trailer_models_updated_at on trailer_models;
create trigger trailer_models_updated_at before update on trailer_models for each row execute function set_updated_at();

-- trailers point at a model; per-trailer rate columns become optional overrides (unused for now)
alter table trailers add column if not exists model_id uuid references trailer_models;
alter table trailers alter column daily_rate drop not null,
                     alter column weekly_rate drop not null,
                     alter column monthly_rate drop not null;

-- bookings keep the price snapshot of the plan used
alter table bookings alter column rate_daily drop not null,
                     alter column rate_weekly drop not null,
                     alter column rate_monthly drop not null;
alter table bookings alter column rate_tier type text using rate_tier::text;
alter table bookings alter column recalculated_tier type text using recalculated_tier::text;
alter table bookings add column if not exists contract_months int,
                     add column if not exists tyre_count int not null default 0,
                     add column if not exists tyre_fee numeric(12,2) not null default 0;

-- ---------------------------------------------------------------- pricing
-- MONTHLY_TIERED: months = ceil(days / 30.4375); rate by contract length; tier MONTHLY_1_5 / MONTHLY_6_11 / MONTHLY_12
-- DAILY_MONTHLY: whole months at the monthly rate + remaining days at the daily rate (capped at one month)
drop function if exists quote_rental(uuid, int);
create or replace function quote_rental(p_trailer uuid, p_days int, p_tyres int default 0)
returns table (tier text, months int, rental numeric, tyre_fee numeric, vat_rate numeric, vat numeric,
               deposit numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare t trailers; m trailer_models; v_rate numeric := coalesce(setting_num('vat_rate'), 0.07); v_full int; v_rem int;
begin
  select * into t from trailers where id = p_trailer;
  if not found then raise exception 'ไม่พบหาง'; end if;
  select * into m from trailer_models where id = t.model_id;
  if not found then raise exception 'หางคันนี้ยังไม่ได้กำหนดรุ่นและราคา'; end if;

  if m.rate_plan = 'MONTHLY_TIERED' then
    months := greatest(1, ceil(p_days / 30.4375)::int);  -- calendar months (365.25 / 12 days)
    if months >= 12 then tier := 'MONTHLY_12'; rental := m.monthly_rate_12 * months;
    elsif months >= 6 then tier := 'MONTHLY_6_11'; rental := m.monthly_rate_6_11 * months;
    else tier := 'MONTHLY_1_5'; rental := m.monthly_rate_1_5 * months;
    end if;
  else
    v_full := floor(p_days / 30.0)::int;
    v_rem := p_days - v_full * 30;
    months := v_full;
    rental := m.monthly_rate * v_full + least(m.daily_rate * v_rem, m.monthly_rate);
    tier := case when v_full = 0 and m.daily_rate * v_rem < m.monthly_rate then 'DAILY' else 'MONTHLY' end;
  end if;

  tyre_fee := case when m.tyre_fee > 0 then m.tyre_fee * greatest(coalesce(p_tyres, 0), 0) else 0 end;
  vat_rate := v_rate;
  vat := round((rental + tyre_fee) * v_rate);
  deposit := coalesce(t.deposit_amount, m.deposit);
  total := rental + tyre_fee + vat + deposit;
  return next;
end $$;

-- ---------------------------------------------------------------- create_booking with tyre service
drop function if exists create_booking(uuid, uuid, uuid, uuid[], uuid, timestamptz, timestamptz, uuid, booking_channel, text, text, text);
create or replace function create_booking(
  p_customer_id   uuid,
  p_trailer_id    uuid,
  p_tractor_id    uuid,
  p_driver_ids    uuid[],
  p_guarantor_id  uuid,
  p_pickup_at     timestamptz,
  p_return_at     timestamptz,
  p_return_yard   uuid,
  p_channel       booking_channel default 'WEB',
  p_invoice_name  text default null,
  p_invoice_tax_id text default null,
  p_invoice_address text default null,
  p_tyre_count    int default 0
) returns bookings
language plpgsql security definer set search_path = public as $$
declare
  v_role app_role := auth_role();
  v_customer customers;
  v_trailer trailers;
  v_model trailer_models;
  v_days int;
  q record;
  b bookings;
  v_driver uuid;
begin
  if v_role is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
  select * into v_customer from customers where id = p_customer_id;
  if not found then raise exception 'ไม่พบลูกค้า'; end if;
  if not (v_customer.owner_id = auth.uid() or v_role in ('SALES','SUPER_ADMIN')) then
    raise exception 'ไม่มีสิทธิ์จองให้ลูกค้ารายนี้';
  end if;
  if v_role = 'CUSTOMER' then p_channel := 'WEB'; end if;
  if v_customer.is_blacklisted then raise exception 'บัญชีนี้จองไม่ได้ กรุณาติดต่อเจ้าหน้าที่'; end if;

  select * into v_trailer from trailers where id = p_trailer_id and retired_at is null for update;
  if not found or v_trailer.status = 'MAINTENANCE' then raise exception 'หางคันนี้ไม่พร้อมให้เช่า'; end if;
  -- rented outside the system (no booking on record): not bookable until Ops marks it available
  if v_trailer.status = 'RENTED' and not exists (
       select 1 from bookings where trailer_id = v_trailer.id and status in ('IN_RENTAL','READY_FOR_PICKUP','CONFIRMED')) then
    raise exception 'หางคันนี้มีผู้เช่าอยู่ ยังไม่ทราบวันคืน กรุณาเลือกคันอื่น';
  end if;
  select * into v_model from trailer_models where id = v_trailer.model_id;
  if not found then raise exception 'หางคันนี้ยังไม่ได้กำหนดราคา'; end if;

  if p_return_at <= p_pickup_at then raise exception 'วันคืนต้องอยู่หลังวันรับ'; end if;
  if p_pickup_at < now() + make_interval(hours => coalesce(setting_num('min_lead_hours'), 24)::int) and v_role = 'CUSTOMER' then
    raise exception 'ต้องจองล่วงหน้าอย่างน้อย % ชั่วโมง', coalesce(setting_num('min_lead_hours'), 24);
  end if;
  if not exists (select 1 from tractors where id = p_tractor_id and customer_id = p_customer_id and is_active) then
    raise exception 'หัวลากไม่ใช่ของลูกค้ารายนี้';
  end if;
  if not exists (select 1 from guarantors where id = p_guarantor_id and customer_id = p_customer_id and is_active) then
    raise exception 'ผู้ค้ำประกันไม่ใช่ของลูกค้ารายนี้';
  end if;
  if coalesce(array_length(p_driver_ids, 1), 0) = 0 then raise exception 'เลือกคนขับอย่างน้อย 1 คน'; end if;
  foreach v_driver in array p_driver_ids loop
    if not exists (select 1 from customer_drivers cd join drivers d on d.id = cd.driver_id
                    where cd.customer_id = p_customer_id and cd.driver_id = v_driver and cd.removed_at is null
                      and not d.is_blacklisted and d.license_expires_on >= p_return_at::date) then
      raise exception 'คนขับบางคนไม่อยู่ในบัญชีนี้ ติด Blacklist หรือใบขับขี่หมดอายุก่อนวันคืน';
    end if;
  end loop;
  if exists (select 1 from maintenance_records m where m.trailer_id = p_trailer_id
              and m.period && tstzrange(p_pickup_at, p_return_at)) then
    raise exception 'หางคันนี้มีกำหนดซ่อมในช่วงเวลาที่เลือก';
  end if;
  if exists (select 1 from trailer_compliance c where c.trailer_id = p_trailer_id and c.expires_on < p_return_at::date) then
    raise exception 'เอกสารหางหมดอายุก่อนวันคืน';
  end if;
  if coalesce(p_tyre_count, 0) > 0 and v_model.tyre_fee = 0 then p_tyre_count := 0; end if;
  if coalesce(p_tyre_count, 0) > v_model.tyre_count then p_tyre_count := v_model.tyre_count; end if;

  v_days := rental_days(p_pickup_at, p_return_at);
  select * into q from quote_rental(p_trailer_id, v_days, p_tyre_count);

  insert into bookings (booking_no, customer_id, trailer_id, guarantor_id, tractor_id,
                        pickup_yard_id, return_yard_id, pickup_at, return_at, lock_range, status, channel, created_by,
                        rate_daily, rate_weekly, rate_monthly, rental_days, contract_months, rate_tier, rental_amount,
                        tyre_count, tyre_fee, vat_rate, vat_amount, deposit_amount, total_amount,
                        invoice_name, invoice_tax_id, invoice_branch, invoice_address)
  values (next_booking_no(), p_customer_id, p_trailer_id, p_guarantor_id, p_tractor_id,
          expected_yard(p_trailer_id, p_pickup_at), coalesce(p_return_yard, expected_yard(p_trailer_id, p_pickup_at)),
          p_pickup_at, p_return_at, tstzrange(p_pickup_at, p_return_at), 'PENDING_REVIEW', p_channel, auth.uid(),
          v_model.daily_rate, null,
          case q.tier when 'MONTHLY_1_5' then v_model.monthly_rate_1_5 when 'MONTHLY_6_11' then v_model.monthly_rate_6_11
                      when 'MONTHLY_12' then v_model.monthly_rate_12 else v_model.monthly_rate end,
          v_days, q.months, q.tier, q.rental, coalesce(p_tyre_count, 0), q.tyre_fee,
          q.vat_rate, q.vat, q.deposit, q.total,
          coalesce(p_invoice_name, v_customer.name), coalesce(p_invoice_tax_id, v_customer.tax_id),
          v_customer.branch, coalesce(p_invoice_address, v_customer.billing_address))
  returning * into b;

  insert into booking_drivers (booking_id, driver_id, is_primary)
  select b.id, d, ord = 1 from unnest(p_driver_ids) with ordinality as x(d, ord);
  insert into booking_documents (booking_id, document_id, requirement_key)
  select b.id, doc.id, doc.requirement_key from documents doc
   where doc.superseded_by is null
     and (doc.customer_id = p_customer_id or doc.guarantor_id = p_guarantor_id
          or doc.tractor_id = p_tractor_id or doc.driver_id = p_driver_ids[1]);
  insert into deposits (booking_id, amount) values (b.id, q.deposit);
  insert into appointments (booking_id, kind, yard_id, scheduled_at, checkin_code, code_valid_from, code_valid_to)
  values
    (b.id, 'PICKUP', b.pickup_yard_id, b.pickup_at, lpad((floor(random() * 1000000))::int::text, 6, '0'),
     b.pickup_at - interval '1 day', b.pickup_at + interval '1 day'),
    (b.id, 'RETURN', b.return_yard_id, b.return_at, lpad((floor(random() * 1000000))::int::text, 6, '0'),
     b.return_at - interval '1 day', b.return_at + interval '1 day');
  return b;
exception
  when exclusion_violation then
    raise exception 'หางคันนี้ถูกจองในช่วงเวลาที่เลือกแล้ว กรุณาเลือกช่วงวันหรือหางคันอื่น';
end $$;

grant execute on function quote_rental(uuid, int, int),
  create_booking(uuid, uuid, uuid, uuid[], uuid, timestamptz, timestamptz, uuid, booking_channel, text, text, text, int)
  to authenticated;
revoke execute on function quote_rental(uuid, int, int),
  create_booking(uuid, uuid, uuid, uuid[], uuid, timestamptz, timestamptz, uuid, booking_channel, text, text, text, int)
  from anon, public;

-- ======================================== supabase/seed.sql
-- FAR Service — reference data and sample fleet
-- Yards, trailer types, deposits and document list are real (PRD D11, D12, D15).
-- Trailer models, prices and the 27-trailer fleet are the company's real data (Nov 2026).

insert into yards (code, number, name, short_name, address, note, map_url, open_hours) values
  ('BP', 1, 'ลานจอดพนัสมาวิม บางพระ', 'บางพระ', 'ต.บางพระ อ.ศรีราชา จ.ชลบุรี', 'ติดถนนเส้นหลัก มอเตอร์เวย์',
   'https://goo.gl/maps/kYr4J5GGGDrZAvfX7', 'จ.–ส. 08:00–17:00'),
  ('NY', 2, 'ลานจอดพนัสมาวิม หนองใหญ่', 'หนองใหญ่', 'ต.หนองใหญ่ อ.หนองใหญ่ จ.ชลบุรี', 'ลานสำรองสำหรับหางโลว์เบดและหางพื้นเรียบ',
   'https://g.co/kgs/VHnkaws', 'จ.–ส. 08:00–17:00')
on conflict (code) do nothing;

with t as (
  insert into checklist_templates (name) values ('มาตรฐานทุกประเภทหาง') returning id
)
insert into checklist_template_items (template_id, group_key, group_label, item_key, label, sort_order)
select t.id, g, gl, k, l, o from t, (values
  ('frame','โครงสร้าง','chassis','แชสซีและคานขวาง',1),
  ('frame','โครงสร้าง','deck','พื้นหาง / โครงก้างปลา',2),
  ('frame','โครงสร้าง','landing','ขาค้ำ (Landing Gear)',3),
  ('frame','โครงสร้าง','kingpin','คิงพิน (King Pin)',4),
  ('wheels','ล้อและยาง','tread','ดอกยางทุกเส้น',5),
  ('wheels','ล้อและยาง','pressure','แรงดันลม',6),
  ('wheels','ล้อและยาง','nuts','กระทะล้อและน็อตล้อ',7),
  ('wheels','ล้อและยาง','spare','ยางอะไหล่',8),
  ('brakes','ระบบเบรก','chamber','หม้อลมเบรก',9),
  ('brakes','ระบบเบรก','hoses','สายลมและข้อต่อลม',10),
  ('brakes','ระบบเบรก','test','ทดสอบการทำงานของเบรก',11),
  ('lights','ระบบไฟ','tail','ไฟท้าย ไฟเบรก ไฟเลี้ยว',12),
  ('lights','ระบบไฟ','side','ไฟข้างและแผ่นสะท้อนแสง',13),
  ('lights','ระบบไฟ','plug','ปลั๊กไฟ',14),
  ('equip','อุปกรณ์','twist','ล็อกตู้ / ทางลาด',15),
  ('equip','อุปกรณ์','guard','บังโคลนและกันชนท้าย',16),
  ('equip','อุปกรณ์','plate','ป้ายทะเบียนและเอกสารประจำหาง',17)
) as v(g, gl, k, l, o);

insert into trailer_types (code, name_th, name_en, use_case, default_deposit, checklist_template_id, sort_order)
select v.code::trailer_type_code, v.th, v.en, v.use_case, v.dep, (select id from checklist_templates limit 1), v.o
from (values
  ('FLATBED',  'หางพื้นเรียบ', 'Flatbed',  'สินค้าทั่วไป เหล็ก วัสดุก่อสร้าง พาเลท',       20000, 1),
  ('SKELETAL', 'หางก้างปลา',  'Skeletal', 'ตู้คอนเทนเนอร์ 20 และ 40 ฟุต',               20000, 2),
  ('LOWBED',   'หางโลว์เบด',  'Lowbed',   'เครื่องจักรหนัก รถแบคโฮ สินค้าสูงเกินพิกัด',  30000, 3)
) as v(code, th, en, use_case, dep, o)
on conflict (code) do nothing;

insert into doc_requirements (key, label, owner, applies_to, rule, review_checks, max_age_days, has_expiry, sort_order) values
  ('company_cert',   'หนังสือรับรองบริษัท',            'CUSTOMER',  '{COMPANY}', 'ประทับตราบริษัท และออกให้ไม่เกิน 6 เดือน',
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้เช่า,มีตราประทับบริษัท,ออกให้ไม่เกิน 6 เดือน}', 180, false, 1),
  ('pp20',           'ภ.พ.20',                         'CUSTOMER',  '{COMPANY}', 'ประทับตราบริษัท',
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้เช่า,มีตราประทับบริษัท}', null, false, 2),
  ('director_id',    'สำเนาบัตรประชาชนกรรมการ (ผู้ค้ำ)',  'GUARANTOR', '{COMPANY}', 'เซ็นรับรองสำเนาถูกต้อง ไม่ประทับตราบริษัท',
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้ค้ำ,มีลายเซ็นรับรองสำเนาถูกต้อง,ไม่มีตราบริษัทประทับ,ยังไม่หมดอายุ}', null, true, 3),
  ('director_house', 'สำเนาทะเบียนบ้านกรรมการ (ผู้ค้ำ)', 'GUARANTOR', '{COMPANY}', 'เซ็นรับรองสำเนาถูกต้อง ไม่ประทับตราบริษัท',
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้ค้ำ,มีลายเซ็นรับรองสำเนาถูกต้อง,ไม่มีตราบริษัทประทับ}', null, false, 4),
  ('renter_id',      'สำเนาบัตรประชาชนผู้เช่า',          'CUSTOMER',  '{PERSON}', null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้เช่า,ยังไม่หมดอายุ}', null, true, 5),
  ('renter_house',   'สำเนาทะเบียนบ้านผู้เช่า',          'CUSTOMER',  '{PERSON}', null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้เช่า}', null, false, 6),
  ('guarantor_id',   'สำเนาบัตรประชาชนผู้ค้ำประกัน',      'GUARANTOR', '{PERSON}', null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้ค้ำ,ยังไม่หมดอายุ}', null, true, 7),
  ('guarantor_house','สำเนาทะเบียนบ้านผู้ค้ำประกัน',      'GUARANTOR', '{PERSON}', null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับผู้ค้ำ}', null, false, 8),
  ('tractor_book',   'สำเนาหน้าเล่มทะเบียนหัวลาก',       'TRACTOR',   null, null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ทะเบียนตรงกับหัวลากที่จอง}', null, false, 9),
  ('tractor_policy', 'สำเนากรมธรรม์หัวลาก',              'TRACTOR',   null, null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ทะเบียนตรงกับหัวลากที่จอง,ยังไม่หมดอายุ}', null, true, 10),
  ('driver_license', 'สำเนาใบขับขี่คนขับหัวลาก',          'DRIVER',    null, null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับคนขับ,ประเภทใบขับขี่ลากจูงได้,ยังไม่หมดอายุ}', null, true, 11)
on conflict (key) do nothing;

insert into settings (key, value) values
  ('vat_rate', '0.07'),
  ('weekly_tier_min_days', '7'),
  ('monthly_tier_min_days', '30'),
  ('day_remainder_hours', '3'),
  ('booking_buffer', '"1 day"'),
  ('min_lead_hours', '24'),
  ('max_advance_days', '180'),
  ('payment_window_hours', '24'),
  ('need_docs_window_hours', '48'),
  ('cancellation_fee', 'null'),
  ('late_return_multiplier', '1.5'),
  ('deposit_refund_business_days', '7'),
  ('company_profile', '{"name":"FAR Service","phone":"090-289-4964","tax_id":null,"address":null,"logo_path":null}'),
  ('payment_accounts', '{"promptpay_id":null,"bank":null,"account_no":null,"account_name":null}')
on conflict (key) do nothing;

-- Price list by trailer model (all prices exclude VAT)
insert into trailer_models (code, type, name, axles, length_ft, width_m, length_m, deck_length, deck_height_m, rate_plan, daily_rate, monthly_rate, monthly_rate_1_5, monthly_rate_6_11, monthly_rate_12, deposit, tyre_fee, tyre_count, description, sort_order) values
  ('SK40-2', 'SKELETAL'::trailer_type_code, 'หางก้างปลา 40 ฟุต 2 เพลา', 2, 40, null, null, null, null, 'MONTHLY_TIERED', null, null, 9000, 8500, 8000, 20000, 100, 8, 'ไม่รวมยาง · บริการใส่ยาง 100 บาท/เส้น', 1),
  ('SK40-3', 'SKELETAL'::trailer_type_code, 'หางก้างปลา 40 ฟุต 3 เพลา', 3, 40, null, null, null, null, 'MONTHLY_TIERED', null, null, 12500, 12000, 11500, 20000, 100, 12, 'ไม่รวมยาง · บริการใส่ยาง 100 บาท/เส้น', 2),
  ('FB-3', 'FLATBED'::trailer_type_code, 'หางพื้นเรียบ 3 เพลา', 3, null, null, null, null, null, 'MONTHLY_TIERED', null, null, 13000, 12500, 12000, 20000, 100, 12, 'ไม่รวมยาง · บริการใส่ยาง 100 บาท/เส้น', 3),
  ('LB3-STD', 'LOWBED'::trailer_type_code, 'หางโลว์เบด 3 เพลา มาตรฐาน', 3, null, 2.5, 12.5, '9.6', 1.1, 'DAILY_MONTHLY', 4000, 30000, null, null, null, 30000, 0, 0, null, 4),
  ('LB3-SP', 'LOWBED'::trailer_type_code, 'หางโลว์เบด 3 เพลา สเปคพิเศษ', 3, null, 3, 16, '12.5', 0.9, 'DAILY_MONTHLY', 5000, 45000, null, null, null, 30000, 0, 0, null, 5),
  ('LB3-SPO', 'LOWBED'::trailer_type_code, 'หางโลว์เบด 3 เพลา สเปคพิเศษ ล้อเปิด', 3, null, 3, 16, '8', 0.8, 'DAILY_MONTHLY', 5000, 45000, null, null, null, 30000, 0, 0, null, 6),
  ('LB2-2S', 'LOWBED'::trailer_type_code, 'หางโลว์เบด 2 เพลา สเปคพิเศษ 2 สเตป', 2, null, 2.55, 12.5, '6.15 + 2.35', 0.65, 'DAILY_MONTHLY', 8000, 85000, null, null, null, 30000, 0, 0, null, 7)
on conflict (code) do nothing;

-- The real fleet (27 trailers, Nov 2026). Rented trailers have no booking on record yet; their yard is set to
-- ลาน 1 until they come back. Plates are stored without province.
insert into trailers (code, plate_no, type, model_id, axles, length_ft, current_yard_id, status, description)
select v.code, v.plate, m.type, m.id, m.axles, m.length_ft, (select id from yards where code = v.yard),
       v.status::trailer_status, 'คันที่ ' || v.no
from (values
  ('SK01', '75-0403', 'SK40-2', 'AVAILABLE', 'BP', 1),
  ('SK02', '72-9004', 'SK40-2', 'RENTED', 'BP', 2),
  ('SK03', '71-9021', 'SK40-2', 'AVAILABLE', 'NY', 3),
  ('SK04', '73-0855', 'SK40-2', 'AVAILABLE', 'BP', 4),
  ('SK05', '73-0856', 'SK40-2', 'AVAILABLE', 'NY', 5),
  ('SK06', '73-0612', 'SK40-3', 'RENTED', 'BP', 6),
  ('SK07', '73-0616', 'SK40-3', 'AVAILABLE', 'BP', 7),
  ('SK08', '73-0617', 'SK40-3', 'AVAILABLE', 'BP', 8),
  ('SK09', '73-0618', 'SK40-3', 'RENTED', 'BP', 9),
  ('FB01', '73-4671', 'FB-3', 'AVAILABLE', 'NY', 10),
  ('FB02', '74-4875', 'FB-3', 'RENTED', 'BP', 11),
  ('FB03', '74-4533', 'FB-3', 'RENTED', 'BP', 12),
  ('FB04', '74-4537', 'FB-3', 'RENTED', 'BP', 13),
  ('FB05', '74-4538', 'FB-3', 'AVAILABLE', 'BP', 14),
  ('FB06', '74-4539', 'FB-3', 'RENTED', 'BP', 15),
  ('FB07', '74-4540', 'FB-3', 'RENTED', 'BP', 16),
  ('FB08', '74-8293', 'FB-3', 'RENTED', 'BP', 17),
  ('FB09', '74-8294', 'FB-3', 'RENTED', 'BP', 18),
  ('FB10', '74-8295', 'FB-3', 'RENTED', 'BP', 19),
  ('FB11', '74-8296', 'FB-3', 'RENTED', 'BP', 20),
  ('FB12', '75-0151', 'FB-3', 'RENTED', 'BP', 21),
  ('LB01', '73-6319', 'LB3-STD', 'RENTED', 'BP', 22),
  ('LB02', '72-5944', 'LB3-STD', 'RENTED', 'BP', 23),
  ('LB03', '75-0137', 'LB3-STD', 'RENTED', 'BP', 24),
  ('LB04', '63-0803', 'LB3-SP', 'RENTED', 'BP', 25),
  ('LB05', '63-0854', 'LB3-SPO', 'RENTED', 'BP', 26),
  ('LB06', '74-5117', 'LB2-2S', 'RENTED', 'BP', 27)
) as v(code, plate, model, status, yard, no)
join trailer_models m on m.code = v.model
on conflict (code) do nothing;

