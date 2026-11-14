-- Back office for the fleet's paperwork and the current monthly rentals:
--   1) vehicle_registrations: plate, province and road-tax expiry per plate (renew = +1 year), staff alerted 20 days before.
--   2) vehicle_documents + private bucket "vehicle-docs": scans of the registration book, tax and compulsory insurance (พ.ร.บ.).
--   3) rental_contracts: who rents which trailer, start date, term, pay day, rent, person / company (VAT 7%, withholding 5%).
--   4) rental_handovers: hand-over and return records for each contract.
-- Plates are kept as text (not a foreign key) so plates that are not in the trailers table yet can still be recorded;
-- the app matches them to trailers by plate_no. Includes the data supplied on 12 Nov 2026.
-- Safe to run more than once. Can run before or after 20261114000014.

-- ---------------------------------------------------------------- 1. registrations and road tax
create table if not exists vehicle_registrations (
  id              uuid primary key default gen_random_uuid(),
  plate_no        text not null check (char_length(plate_no) between 1 and 20),
  province        text not null default 'ชลบุรี' check (char_length(province) <= 40),
  tax_expires_on  date,
  tax_renewed_at  timestamptz,
  tax_renewed_by  uuid references profiles on delete set null,
  note            text check (char_length(note) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  unique (plate_no)
);

alter table vehicle_registrations enable row level security;
drop policy if exists vehicle_registrations_staff on vehicle_registrations;
create policy vehicle_registrations_staff on vehicle_registrations for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on vehicle_registrations to authenticated;

-- ---------------------------------------------------------------- 2. document scans
create table if not exists vehicle_documents (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references vehicle_registrations on delete cascade,
  kind            text not null check (kind in ('BOOK', 'TAX', 'CMI')),  -- หน้าเล่ม / ภาษี / พ.ร.บ.
  storage_path    text not null,
  file_name       text check (char_length(file_name) <= 200),
  uploaded_by     uuid references profiles on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);
create index if not exists vehicle_documents_reg_idx on vehicle_documents (registration_id, kind, created_at desc);

alter table vehicle_documents enable row level security;
drop policy if exists vehicle_documents_staff on vehicle_documents;
create policy vehicle_documents_staff on vehicle_documents for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on vehicle_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('vehicle-docs', 'vehicle-docs', false, 15728640)
on conflict (id) do nothing;
drop policy if exists vehicle_docs_staff on storage.objects;
create policy vehicle_docs_staff on storage.objects for all to authenticated
  using (bucket_id = 'vehicle-docs' and public.is_staff())
  with check (bucket_id = 'vehicle-docs' and public.is_staff());

-- ---------------------------------------------------------------- 3. rental contracts
create table if not exists rental_contracts (
  id             uuid primary key default gen_random_uuid(),
  seq            int,                                         -- ลำดับในตาราง
  customer_name  text not null check (char_length(customer_name) between 1 and 200),
  nickname       text check (char_length(nickname) <= 80),    -- ชื่อเรียก / ผู้ติดต่อ เช่น K แบงค์
  phone          text check (char_length(phone) <= 30),
  customer_kind  text not null default 'PERSON' check (customer_kind in ('PERSON', 'COMPANY')),
  trailer_kind   text check (char_length(trailer_kind) <= 20),  -- SF3, SC3, SC2 …
  plate_no       text not null check (char_length(plate_no) between 1 and 20),
  plate_note     text check (char_length(plate_note) <= 40),
  start_date     date,
  term_months    int check (term_months between 1 and 120),
  pay_day        int check (pay_day between 1 and 31),
  monthly_rent   numeric(12,2) not null default 0 check (monthly_rent >= 0),
  vat_rate       numeric(5,2) not null default 0 check (vat_rate in (0, 7)),
  wht_rate       numeric(5,2) not null default 0 check (wht_rate in (0, 1, 3, 5)),
  billed_month   text check (billed_month ~ '^\d{4}-\d{2}$'),  -- เดือนล่าสุดที่วางบิลแล้ว (YYYY-MM)
  status         text not null default 'ACTIVE' check (status in ('ACTIVE', 'ENDED')),
  ended_on       date,
  note           text check (char_length(note) <= 1000),
  created_by     uuid references profiles on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz
);
create index if not exists rental_contracts_status_idx on rental_contracts (status, seq);

alter table rental_contracts enable row level security;
drop policy if exists rental_contracts_staff on rental_contracts;
create policy rental_contracts_staff on rental_contracts for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on rental_contracts to authenticated;

-- ---------------------------------------------------------------- 4. hand-over / return
create table if not exists rental_handovers (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid not null references rental_contracts on delete cascade,
  kind           text not null check (kind in ('HANDOVER', 'RETURN')),
  happened_on    date not null,
  yard_code      text check (char_length(yard_code) <= 10),
  driver_name    text check (char_length(driver_name) <= 120),
  tractor_plate  text check (char_length(tractor_plate) <= 40),
  tyres_ok       boolean,
  lights_ok      boolean,
  condition_note text check (char_length(condition_note) <= 1000),
  recorded_by    uuid references profiles on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);
create index if not exists rental_handovers_contract_idx on rental_handovers (contract_id, happened_on desc);

alter table rental_handovers enable row level security;
drop policy if exists rental_handovers_staff on rental_handovers;
create policy rental_handovers_staff on rental_handovers for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on rental_handovers to authenticated;

-- ---------------------------------------------------------------- data: road-tax expiry (BE 2570 = 2027)
insert into vehicle_registrations (plate_no, province, tax_expires_on) values
  ('75-0403', 'ชลบุรี', '2027-09-30'),
  ('72-9004', 'ชลบุรี', '2027-03-31'),
  ('71-9021', 'ชลบุรี', '2027-12-31'),
  ('73-0855', 'ชลบุรี', '2027-12-31'),
  ('73-0856', 'ชลบุรี', '2027-12-31'),
  ('73-0612', 'ชลบุรี', '2027-09-30'),
  ('73-0616', 'ชลบุรี', '2027-09-30'),
  ('73-0617', 'ชลบุรี', '2027-09-30'),
  ('73-0618', 'ชลบุรี', '2027-09-30'),
  ('73-4671', 'ชลบุรี', '2027-09-30'),
  ('74-4875', 'ชลบุรี', '2027-06-30'),
  ('74-4533', 'ชลบุรี', '2027-06-30'),
  ('74-4537', 'ชลบุรี', '2027-06-30'),
  ('74-4538', 'ชลบุรี', '2027-06-30'),
  ('74-4539', 'ชลบุรี', '2027-06-30'),
  ('74-4540', 'ชลบุรี', '2027-06-30'),
  ('74-8293', 'ชลบุรี', '2027-06-30'),
  ('74-8294', 'ชลบุรี', '2027-06-30'),
  ('74-8295', 'ชลบุรี', '2027-06-30'),
  ('74-8296', 'ชลบุรี', '2027-06-30'),
  ('75-0151', 'ชลบุรี', '2027-12-31'),
  ('73-0005', 'ชลบุรี', '2027-06-30'),
  ('73-0613', 'ชลบุรี', '2027-09-30'),
  ('73-6319', 'ชลบุรี', '2027-09-30'),
  ('72-5944', 'ชลบุรี', '2027-09-30'),
  ('63-0803', 'กรุงเทพมหานคร', '2027-09-30'),
  ('74-5117', 'ชลบุรี', '2027-09-30')
on conflict (plate_no) do nothing;

-- ---------------------------------------------------------------- data: current customers (sheet of 12 Nov 2026)
-- Two-digit years: 69 = BE 2569 (2026); 22 / 24 / 25 / 26 = CE 2022 / 2024 / 2025 / 2026.
do $$
begin
  if not exists (select 1 from rental_contracts) then
    insert into rental_contracts
      (seq, customer_name, nickname, customer_kind, trailer_kind, plate_no, plate_note, start_date, term_months, pay_day, monthly_rent, vat_rate, wht_rate)
    values
      (1,  'PSS', 'จุฬารัตน์', 'PERSON', 'SF3', '74-4875', null, null, null, null, 6000, 0, 0),
      (2,  'บริษัท เจียซุ่น ทรานสปอร์ต จำกัด', 'K แบงค์', 'COMPANY', 'SF3', '74-8296', null, '2026-07-07', 6, 7, 12500, 7, 5),
      (2,  'บริษัท เจียซุ่น ทรานสปอร์ต จำกัด', 'K แบงค์', 'COMPANY', 'SF3', '74-4539', null, '2026-10-27', 6, 27, 12500, 7, 5),
      (3,  'คุณศิริชัย', 'K ตือ', 'PERSON', 'SC3', '73-2746', null, '2026-06-08', 3, 8, 12500, 0, 0),
      (4,  'ศิรินภา สุวรรณรพ', 'K รัตน์', 'PERSON', 'SF3', '74-8294', null, '2025-03-10', 6, 10, 12500, 0, 0),
      (5,  'คุณวรพงษ์', null, 'PERSON', 'SF3', '73-5872', null, '2024-07-11', 12, 10, 12000, 0, 0),
      (6,  'PSS', null, 'PERSON', 'SC3', '73-0618', null, '2026-01-13', 3, 13, 6250, 0, 0),
      (7,  'PSS', null, 'PERSON', 'SC3', '73-0612', null, '2026-01-14', 3, 14, 6250, 0, 0),
      (8,  'ไดโอ', null, 'PERSON', 'SC2', '72-9004', null, '2022-06-17', null, 16, 7100, 0, 0),
      (9,  'คุณประจักษ์', null, 'PERSON', 'SF3', '74-8293', null, '2024-02-21', 12, 20, 12000, 0, 0),
      (10, 'นาย วันดี กาดกลางดอน', 'K วันดี', 'PERSON', 'SF3', '73-0617', '(2)', '2026-05-21', 12, 21, 12000, 0, 0),
      (11, 'นาย สุชินทร์ นันภักดี', 'พี่เตือน คุณสุชินทร์', 'PERSON', 'SF3', '74-4537', null, '2025-12-22', 12, 22, 12000, 0, 0),
      (12, 'นางสาว นภา ใจห้าว', 'P.ฝน', 'PERSON', 'SF3', '74-4540', null, '2026-01-27', 12, 27, 12000, 0, 0),
      (13, 'นางสาว สุพิชญา ภูมิพันธ์', 'คุณจั๊บ', 'PERSON', 'SC3', '73-0005', null, '2026-08-29', 12, 29, 11500, 0, 0);
  end if;
end $$;
