-- Stand-alone service requests (no trailer rental): tyre mounting/removal, tractor/trailer washing, parking.
-- Anyone may submit from /services; staff see and handle them at /admin/services. Safe to run more than once.

create table if not exists service_requests (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('TYRE', 'WASH', 'PARKING')),
  name           text not null,
  phone          text not null,
  company        text,
  yard_code      text,
  preferred_date date,
  details        jsonb not null default '{}',
  estimate       numeric(12,2),
  note           text,
  accepted_terms boolean not null default false,
  status         text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'DONE', 'CANCELLED')),
  profile_id     uuid default auth.uid() references profiles on delete set null,
  handled_by     uuid references profiles,
  handled_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists service_requests_status_idx on service_requests (status, created_at desc);

alter table service_requests enable row level security;
drop policy if exists service_requests_insert on service_requests;
create policy service_requests_insert on service_requests for insert with check (status = 'NEW' and handled_by is null);
drop policy if exists service_requests_staff_read on service_requests;
create policy service_requests_staff_read on service_requests for select using (is_staff());
drop policy if exists service_requests_staff_update on service_requests;
create policy service_requests_staff_update on service_requests for update using (is_staff()) with check (is_staff());

grant insert on service_requests to anon, authenticated;
grant select, update on service_requests to authenticated;

-- Washing is now THB 1,000 per unit; parking is daily or monthly (shown in the extra services list).
update settings set value = (
  select jsonb_agg(
    case
      when e->>'id' = 'wash' then e || '{"priceTh":"1,000 บาท/คัน","priceEn":"THB 1,000 per unit"}'
      when e->>'id' = 'parking' then e || '{"priceTh":"รายวัน 200 บาท/วัน · รายเดือน 2,000 บาท/เดือน","priceEn":"Daily THB 200/day · Monthly THB 2,000/month"}'
      when e->>'id' = 'tyre' then e || '{"priceTh":"หางที่เช่ากับเรา 100 บาท/เส้น · หางภายนอก 300 บาท/เส้น","priceEn":"Our rental trailers THB 100/tire · Outside trailers THB 300/tire"}'
      else e end)
  from jsonb_array_elements(value) e)
where key = 'extra_services' and jsonb_typeof(value) = 'array';
