-- Company-profile site: customers ask for a quotation instead of booking online. Anyone may submit from /quote;
-- every staff member is notified; staff handle requests at /admin/quotes. Safe to run more than once.
-- Run after 20261112000012 (uses the notifications table and is_staff()).

create table if not exists quote_requests (
  id            uuid primary key default gen_random_uuid(),
  company       text,
  contact_name  text not null,
  phone         text not null,
  email         text,
  line_id       text,
  customer_kind text check (customer_kind in ('COMPANY', 'PERSON')),
  items         jsonb not null default '[]',   -- [{ "model": "FB-3", "label": "หางพื้นเรียบ 3 เพลา", "qty": 2 }]
  start_date    date,
  months        int check (months between 1 and 120),
  yard_code     text,
  tyre_service  boolean not null default false,
  note          text,
  status        text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST')),
  handled_by    uuid references profiles,
  handled_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists quote_requests_status_idx on quote_requests (status, created_at desc);

alter table quote_requests enable row level security;
drop policy if exists quote_requests_insert on quote_requests;
create policy quote_requests_insert on quote_requests for insert with check (status = 'NEW' and handled_by is null);
drop policy if exists quote_requests_staff_read on quote_requests;
create policy quote_requests_staff_read on quote_requests for select using (is_staff());
drop policy if exists quote_requests_staff_update on quote_requests;
create policy quote_requests_staff_update on quote_requests for update using (is_staff()) with check (is_staff());
grant insert on quote_requests to anon, authenticated;
grant select, update on quote_requests to authenticated;

create or replace function notify_staff_quote_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (recipient_id, channel, event, payload, sent_at)
  select p.id, 'IN_APP', 'QUOTE_REQUESTED',
         jsonb_build_object('quote_id', new.id, 'company', new.company, 'contact', new.contact_name,
                            'phone', new.phone, 'items', new.items, 'months', new.months),
         now()
    from profiles p
   where p.role in ('SUPER_ADMIN', 'SALES', 'OPS') and p.is_active;
  return new;
end $$;
drop trigger if exists quote_requests_notify_staff on quote_requests;
create trigger quote_requests_notify_staff after insert on quote_requests for each row execute function notify_staff_quote_request();
