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
