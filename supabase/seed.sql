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
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับคนขับ,ประเภทใบขับขี่ลากจูงได้,ยังไม่หมดอายุ}', null, true, 11),
  ('driver_id_card', 'สำเนาบัตรประชาชนคนขับหัวลาก',       'DRIVER',    null, null,
     '{อ่านได้ชัดเจน ครบทั้งแผ่น,ชื่อตรงกับคนขับ,ยังไม่หมดอายุ}', null, true, 12)
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
  ('LB2-2S', 'LOWBED'::trailer_type_code, 'หางโลว์เบด 2 เพลา สเปคพิเศษ 2 สเตป', 2, null, 2.55, 12.5, '6.15 + 2.35', 0.65, 'DAILY_MONTHLY', 6500, 85000, null, null, null, 30000, 0, 0, null, 7),
  ('LB2-STD', 'LOWBED'::trailer_type_code, 'หางโลว์เบด 2 เพลา สเปคมาตรฐาน', 2, null, null, null, null, null, 'DAILY_MONTHLY', 3500, null, null, null, null, 30000, 0, 0, null, 4)
on conflict (code) do nothing;

-- Lowbed prices from the price deck (needs migration 20261109000009 for weekly_rate).
update trailer_models set daily_rate = 2700, weekly_rate = 13500, monthly_rate = 27000, width_m = 3.00, deck_length = '6.9', deck_height_m = 1.10 where code = 'LB2-STD';
update trailer_models set daily_rate = 8500, weekly_rate = 40000, monthly_rate = 80000, width_m = 2.55, deck_length = '6.15', deck_height_m = 0.65 where code = 'LB2-2S';
update trailer_models set daily_rate = 3000, weekly_rate = 15000, monthly_rate = 30000, width_m = 3.00, deck_length = '6.9', deck_height_m = 1.10 where code = 'LB3-STD';
update trailer_models set daily_rate = 5000, weekly_rate = 25000, monthly_rate = 50000, width_m = 3.00, deck_length = '12.5', deck_height_m = 0.90 where code = 'LB3-SP';
update trailer_models set daily_rate = 5000, weekly_rate = 25000, monthly_rate = 50000 where code = 'LB3-SPO';
update trailer_models set description = 'รวมยาง · Tires included' where type = 'LOWBED';

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
