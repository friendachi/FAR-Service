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
