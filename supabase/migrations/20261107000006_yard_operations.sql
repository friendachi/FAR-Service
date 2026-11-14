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
