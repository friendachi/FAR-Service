-- 1) First payment before pickup = deposit + first month's rent + tyre fitting + VAT (rentals longer than a month
--    pay the rest monthly on the pickup date). 2) Every staff member gets an in-app notification for each new
--    booking. 3) Page views for the Super Admin traffic report. Safe to run more than once. Run after 20261111000011.

-- ---------------------------------------------------------------- 1. first payment
-- Mirrors paymentSchedule() in src/lib/pricing.ts.
create or replace function first_payment_amount(b bookings) returns numeric
language sql stable as $$
  select case
    when b.rate_monthly is not null and b.rate_monthly > 0 and b.rental_amount > b.rate_monthly then
      b.rate_monthly + b.tyre_fee + b.deposit_amount
      + round((b.rate_monthly + b.tyre_fee)
              * case when b.rental_amount + b.tyre_fee > 0 then b.vat_amount / (b.rental_amount + b.tyre_fee) else b.vat_rate end)
    else b.total_amount
  end
$$;

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
  values (b.id, p_method, first_payment_amount(b), 'PENDING_VERIFICATION', p_slip_path, auth.uid())
  returning * into p;
  return p;
end $$;

-- ---------------------------------------------------------------- 2. notify every staff member of a new booking
create or replace function notify_staff_new_booking() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_customer text; v_trailer text;
begin
  select name into v_customer from customers where id = new.customer_id;
  select code into v_trailer from trailers where id = new.trailer_id;
  insert into notifications (recipient_id, channel, event, booking_id, payload, sent_at)
  select p.id, 'IN_APP', 'BOOKING_CREATED', new.id,
         jsonb_build_object('booking_no', new.booking_no, 'customer', v_customer, 'trailer', v_trailer,
                            'pickup_at', new.pickup_at, 'channel', new.channel),
         now()
    from profiles p
   where p.role in ('SUPER_ADMIN', 'SALES', 'OPS') and p.is_active and p.id is distinct from new.created_by;
  return new;
end $$;
drop trigger if exists bookings_notify_staff on bookings;
create trigger bookings_notify_staff after insert on bookings for each row execute function notify_staff_new_booking();

-- ---------------------------------------------------------------- 3. page views
create table if not exists page_views (
  id         bigint generated always as identity primary key,
  path       text not null check (char_length(path) <= 300),
  visitor_id text not null check (char_length(visitor_id) <= 64),
  profile_id uuid default auth.uid() references profiles on delete set null,
  referrer   text check (char_length(referrer) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on page_views (created_at desc);
create index if not exists page_views_path_idx on page_views (path, created_at desc);

alter table page_views enable row level security;
drop policy if exists page_views_insert on page_views;
create policy page_views_insert on page_views for insert with check (true);
grant insert on page_views to anon, authenticated;

-- Super Admin traffic report for the last p_days days (Bangkok dates).
create or replace function analytics_summary(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_from timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok'
                              - make_interval(days => greatest(p_days, 1) - 1);
        v_today timestamptz := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
begin
  if auth_role() is distinct from 'SUPER_ADMIN' then raise exception 'ดูสถิติได้เฉพาะ Super Admin'; end if;
  return jsonb_build_object(
    'all_time_views', (select count(*) from page_views),
    'all_time_visitors', (select count(distinct visitor_id) from page_views),
    'views', (select count(*) from page_views where created_at >= v_from),
    'visitors', (select count(distinct visitor_id) from page_views where created_at >= v_from),
    'today_views', (select count(*) from page_views where created_at >= v_today),
    'today_visitors', (select count(distinct visitor_id) from page_views where created_at >= v_today),
    'by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'views', v, 'visitors', u) order by d)
        from (select (created_at at time zone 'Asia/Bangkok')::date d, count(*) v, count(distinct visitor_id) u
                from page_views where created_at >= v_from group by 1) x), '[]'),
    'top_pages', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'views', v, 'visitors', u) order by v desc)
        from (select path, count(*) v, count(distinct visitor_id) u
                from page_views where created_at >= v_from group by path order by count(*) desc limit 20) x), '[]')
  );
end $$;
grant execute on function analytics_summary(int) to authenticated;
revoke execute on function analytics_summary(int) from anon, public;
