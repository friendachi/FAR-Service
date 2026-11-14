-- Run once in the Supabase SQL Editor: migrations 8 and 9 together.

-- Lowbed models may be priced per day only (no monthly rate yet), e.g. หางโลว์เบด 2 เพลา สเปคมาตรฐาน 3,500/day.
-- When monthly_rate is null the rental is simply daily_rate × days.

-- 1. Relax the DAILY_MONTHLY check: daily rate required, monthly rate optional.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'trailer_models'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%DAILY_MONTHLY%' and pg_get_constraintdef(oid) like '%daily_rate%'
  loop
    execute format('alter table trailer_models drop constraint %I', c.conname);
  end loop;
end $$;

alter table trailer_models drop constraint if exists trailer_models_daily_rate_check_plan;
alter table trailer_models add constraint trailer_models_daily_rate_check_plan
  check (rate_plan <> 'DAILY_MONTHLY' or (coalesce(daily_rate, 0) > 0 and (monthly_rate is null or monthly_rate > 0)));

-- 2. Quote: daily-only models charge daily_rate × days.
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
  elsif m.monthly_rate is null then
    months := 0;
    rental := m.daily_rate * p_days;
    tier := 'DAILY';
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

-- 3. New model: หางโลว์เบด 2 เพลา สเปคมาตรฐาน — 3,500/day, no trailers in the fleet yet.
insert into trailer_models (code, type, name, axles, rate_plan, daily_rate, monthly_rate, deposit, tyre_fee, tyre_count, sort_order)
select 'LB2-STD', 'LOWBED', 'หางโลว์เบด 2 เพลา สเปคมาตรฐาน', 2, 'DAILY_MONTHLY', 3500, null, 30000, 0, 0, 4
where exists (select 1 from trailer_types where code = 'LOWBED')  -- fresh databases get it from seed.sql
on conflict (code) do update set daily_rate = excluded.daily_rate, name = excluded.name;

-- 4. Prices confirmed Nov 2026.
update trailer_models set daily_rate = 6500 where code = 'LB2-2S';

-- Lowbed weekly rates and prices from the company price deck (Rental cost FAR - Eng.pdf, Nov 2026),
-- and the driver's ID card as a document every contract needs. Run after 20261108000008.

alter table trailer_models add column if not exists weekly_rate numeric(12,2);

-- DAILY_MONTHLY pricing: whole months at the monthly rate, then whole weeks at the weekly rate, then days at
-- the daily rate. Each step never costs more than the next unit up (days ≤ a week, the remainder ≤ a month).
create or replace function quote_rental(p_trailer uuid, p_days int, p_tyres int default 0)
returns table (tier text, months int, rental numeric, tyre_fee numeric, vat_rate numeric, vat numeric,
               deposit numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare t trailers; m trailer_models; v_rate numeric := coalesce(setting_num('vat_rate'), 0.07);
        v_rem int; v_weeks int; v_days int; v_day_cost numeric; v_rem_cost numeric;
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
    months := case when m.monthly_rate is null then 0 else floor(p_days / 30.0)::int end;
    v_rem := p_days - months * 30;
    v_weeks := case when m.weekly_rate is null then 0 else floor(v_rem / 7.0)::int end;
    v_days := v_rem - v_weeks * 7;
    v_day_cost := m.daily_rate * v_days;
    tier := case when months > 0 then 'MONTHLY' when v_weeks > 0 then 'WEEKLY' else 'DAILY' end;
    if m.weekly_rate is not null and v_day_cost > m.weekly_rate then
      v_day_cost := m.weekly_rate;
      if tier = 'DAILY' then tier := 'WEEKLY'; end if;
    end if;
    v_rem_cost := coalesce(m.weekly_rate, 0) * v_weeks + v_day_cost;
    if m.monthly_rate is not null and v_rem_cost > m.monthly_rate then
      v_rem_cost := m.monthly_rate;
      tier := 'MONTHLY';
    end if;
    rental := coalesce(m.monthly_rate, 0) * months + v_rem_cost;
  end if;

  tyre_fee := case when m.tyre_fee > 0 then m.tyre_fee * greatest(coalesce(p_tyres, 0), 0) else 0 end;
  vat_rate := v_rate;
  vat := round((rental + tyre_fee) * v_rate);
  deposit := coalesce(t.deposit_amount, m.deposit);
  total := rental + tyre_fee + vat + deposit;
  return next;
end $$;

-- Keep the weekly rate on the booking record too.
create or replace function bookings_fill_weekly() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rate_weekly is null then
    select m.weekly_rate into new.rate_weekly from trailers t join trailer_models m on m.id = t.model_id
     where t.id = new.trailer_id;
  end if;
  return new;
end $$;
drop trigger if exists bookings_fill_weekly on bookings;
create trigger bookings_fill_weekly before insert on bookings for each row execute function bookings_fill_weekly();

-- Lowbed prices and specs from the price deck (tyres included on lowbeds).
update trailer_models set daily_rate = 2700, weekly_rate = 13500, monthly_rate = 27000,
       width_m = 3.00, deck_length = '6.9', deck_height_m = 1.10 where code = 'LB2-STD';
update trailer_models set daily_rate = 8500, weekly_rate = 40000, monthly_rate = 80000,
       width_m = 2.55, deck_length = '6.15', deck_height_m = 0.65 where code = 'LB2-2S';
update trailer_models set daily_rate = 3000, weekly_rate = 15000, monthly_rate = 30000,
       width_m = 3.00, deck_length = '6.9', deck_height_m = 1.10 where code = 'LB3-STD';
update trailer_models set daily_rate = 5000, weekly_rate = 25000, monthly_rate = 50000,
       width_m = 3.00, deck_length = '12.5', deck_height_m = 0.90 where code = 'LB3-SP';
update trailer_models set daily_rate = 5000, weekly_rate = 25000, monthly_rate = 50000 where code = 'LB3-SPO';
update trailer_models set description = 'รวมยาง · Tires included' where type = 'LOWBED';

-- Every contract: the tractor driver's ID card (alongside the driving licence).
insert into doc_requirements (key, label, owner, applies_to, rule, review_checks, max_age_days, has_expiry, sort_order)
values ('driver_id_card', 'สำเนาบัตรประชาชนคนขับหัวลาก', 'DRIVER', null, null,
        '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับคนขับ,ยังไม่หมดอายุ}', null, true, 12)
on conflict (key) do nothing;
