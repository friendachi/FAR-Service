-- 1) Hand-over / return records get the full "ใบส่งมอบ" form: customer, tractor and trailer details, the 13-item
--    checklist, 13 guided photos and the two signatures (ผู้ส่งมอบ / ผู้ตรวจรับ). Returns use the photos only.
-- 2) trailer_checkups: the 6-monthly "ใบรายการตรวจเช็คหางรถเช่า" (20 general + 20 undercarriage items, ซ่อม / ไม่ซ่อม),
--    signed by ช่างผู้ซ่อม and ผู้ตรวจสอบ. Staff are alerted when a rented trailer is due.
-- Files (photos, signatures) live in the private bucket "vehicle-docs" under handovers/{id}/ and checkups/{id}/,
-- covered by the staff policy from 20261115000015. Safe to run more than once. Run after 20261115000015.

-- ---------------------------------------------------------------- 1. hand-over form
alter table rental_handovers add column if not exists details      jsonb not null default '{}';  -- form fields + checklist
alter table rental_handovers add column if not exists photos       jsonb not null default '{}';  -- slot -> [storage paths]
alter table rental_handovers add column if not exists deliver_name text check (char_length(deliver_name) <= 120);
alter table rental_handovers add column if not exists deliver_sign text check (char_length(deliver_sign) <= 300);  -- storage path
alter table rental_handovers add column if not exists receive_name text check (char_length(receive_name) <= 120);
alter table rental_handovers add column if not exists receive_sign text check (char_length(receive_sign) <= 300);  -- storage path

-- ---------------------------------------------------------------- 2. six-monthly inspection
create table if not exists trailer_checkups (
  id             uuid primary key default gen_random_uuid(),
  plate_no       text not null check (char_length(plate_no) between 1 and 20),
  trailer_kind   text check (char_length(trailer_kind) <= 40),       -- ประเภทรถ
  inspected_on   date not null,
  items          jsonb not null default '{}',                         -- item key -> {qty, spec, r: FIX | OK}
  repair_count   int not null default 0,
  note           text check (char_length(note) <= 2000),
  mechanic_name  text check (char_length(mechanic_name) <= 120),      -- ช่างผู้ซ่อม
  mechanic_sign  text check (char_length(mechanic_sign) <= 300),
  inspector_name text check (char_length(inspector_name) <= 120),     -- ผู้ตรวจสอบ
  inspector_sign text check (char_length(inspector_sign) <= 300),
  signed_on      date,
  created_by     uuid references profiles on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists trailer_checkups_plate_idx on trailer_checkups (plate_no, inspected_on desc);

alter table trailer_checkups enable row level security;
drop policy if exists trailer_checkups_staff on trailer_checkups;
create policy trailer_checkups_staff on trailer_checkups for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on trailer_checkups to authenticated;
