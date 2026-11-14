-- Overdue rent (ค่าเช่าค้างชำระ) on the rental register: which months are unpaid for each contract, an optional
-- amount when it differs from months × monthly total (part payments), and a note. Staff edit it at /admin/rentals.
-- Includes the arrears supplied on 13 Nov 2026. Safe to run more than once. Run after 20261115000015.

alter table rental_contracts add column if not exists unpaid_months  text[] not null default '{}';  -- 'YYYY-MM'
alter table rental_contracts add column if not exists arrears_amount numeric(12,2) check (arrears_amount is null or arrears_amount >= 0);
alter table rental_contracts add column if not exists arrears_note   text check (char_length(arrears_note) <= 500);

alter table rental_contracts drop constraint if exists rental_contracts_unpaid_months_check;
alter table rental_contracts add constraint rental_contracts_unpaid_months_check
  check (array_position(unpaid_months, null) is null and cardinality(unpaid_months) <= 120);

-- data (BE 2569 = 2026). Only filled while still empty, so running again never overwrites staff edits.
update rental_contracts set unpaid_months = '{2026-11}'
 where plate_no in ('74-8296', '74-4539', '74-8294') and status = 'ACTIVE' and unpaid_months = '{}';
update rental_contracts set unpaid_months = '{2026-10,2026-11}'
 where plate_no = '73-2746' and status = 'ACTIVE' and unpaid_months = '{}';
update rental_contracts set unpaid_months = '{2026-08,2026-09,2026-10,2026-11}'
 where plate_no = '73-5872' and status = 'ACTIVE' and unpaid_months = '{}';
-- the sheet says "1 เดือน (ส.ค. - ต.ค.69)"; recorded as the three months named
update rental_contracts set unpaid_months = '{2026-08,2026-09,2026-10}'
 where plate_no = '74-8293' and status = 'ACTIVE' and unpaid_months = '{}';
