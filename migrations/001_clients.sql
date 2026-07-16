-- Clients tracker table (migrated from MES_Client_Tracker Google Sheet, 2026-07-16)
-- Installments are stored as a flexible JSONB array so a client can have any number of them.
-- Each installment: { "amount": number, "due_date": "YYYY-MM-DD"|null, "paid": bool, "paid_date": "YYYY-MM-DD"|null, "manual": bool }
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  onboarding_date date,
  source text,
  deal_size numeric,
  installments jsonb not null default '[]'::jsonb,
  coaching_start date,
  coaching_end date,
  last_session date,
  revoke_date date,
  notes text,
  payment_emails jsonb not null default '[]'::jsonb, -- extra emails used to auto-match payments
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clients enable row level security;
do $$ begin
  create policy "allow all clients" on clients for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- keep updated_at fresh
create or replace function set_clients_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at before update on clients
  for each row execute function set_clients_updated_at();

-- Seed: 26 clients imported from the sheet
insert into clients (name, email, onboarding_date, source, deal_size, installments, coaching_start, coaching_end, last_session, revoke_date, notes, payment_emails) values
('Aparna Vadde', 'aparna.kv@yahoo.com', '2025-12-18', '/', 6800.0, '[{"amount": 6800.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2025-12-18', '2026-05-25', '2026-05-24', '2026-05-25', NULL, '[]'::jsonb),
('Yash Ahuja', 'connect@eqstate.ca', '2026-02-05', 'Shako', 8000.0, '[{"amount": 8000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-02-05', '2026-05-05', '2026-02-05', '2026-02-05', NULL, '[]'::jsonb),
('Adam El Shafei', 'adamelshafei95@gmail.com', '2026-03-12', 'Shako', 5000.0, '[{"amount": 2500.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2500.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-03-12', '2026-06-12', '2026-05-12', '2026-05-12', NULL, '[]'::jsonb),
('Joyce Kassouf', NULL, '2026-04-21', 'Martin', 5000.0, '[{"amount": 5000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-21', '2026-07-21', '2026-07-21', '2026-07-21', NULL, '[]'::jsonb),
('Riaz Essa', 'riazessa@hotmail.com', '2026-04-04', 'Shako', 5000.0, '[{"amount": 5000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-04', '2026-07-04', '2026-07-04', '2026-07-04', NULL, '[]'::jsonb),
('Mansur Alsaggaf', NULL, '2026-04-23', 'Shako', 6800.0, '[{"amount": 5800.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 1000.0, "due_date": "2026-05-23", "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-27', '2026-07-27', '2026-07-27', '2026-07-27', NULL, '[]'::jsonb),
('Aswin Subrhamanian', NULL, '2026-01-14', 'Shako', 6000.0, '[{"amount": 2000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2500.0, "due_date": "2026-04-23", "paid": true, "paid_date": null, "manual": true}, {"amount": 1500.0, "due_date": "2026-06-23", "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-25', '2026-07-25', '2026-07-25', '2026-07-25', NULL, '[]'::jsonb),
('Rizwanuddin Mohammad', 'kamran.k2@icloud.com', '2026-03-17', 'Martin', 6800.0, '[{"amount": 1000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2900.0, "due_date": "2026-05-05", "paid": true, "paid_date": null, "manual": true}, {"amount": 2900.0, "due_date": "2026-06-05", "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-05-11', '2026-08-11', '2026-08-11', '2026-08-11', NULL, '[]'::jsonb),
('Katrina Riobuya', 'katrinariobuya@gmail.com', '2026-04-30', 'Martin', 6000.0, '[{"amount": 2000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2000.0, "due_date": "2026-05-30", "paid": true, "paid_date": null, "manual": true}, {"amount": 2000.0, "due_date": "2026-06-30", "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-05-04', '2026-08-04', '2026-08-04', '2026-08-04', NULL, '[]'::jsonb),
('Elias Basurto', 'elibasur24@icloud.com', '2026-03-23', 'Shako/group only', 5000.0, '[{"amount": 2500.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2500.0, "due_date": "2026-04-23", "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-03-23', '2026-06-23', '2026-06-23', '2026-06-23', NULL, '[]'::jsonb),
('Ravi Assomull', NULL, '2026-04-04', 'Shako', 13000.0, '[{"amount": 13000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-04', '2026-07-04', '2026-07-04', '2026-07-04', NULL, '[]'::jsonb),
('Harjinder Bajwa', 'harjinder.bajwa08@gmail.com', '2026-03-28', 'Shako', 15000.0, '[{"amount": 5000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 10000.0, "due_date": "2026-05-13", "paid": false, "paid_date": null, "manual": false}]'::jsonb, '2026-04-13', '2026-05-13', '2026-05-13', '2026-05-13', NULL, '[]'::jsonb),
('Andrius Rimdeika', 'ar@regogroup.lt', NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb),
('Fatima Ramadan', 'F.ramadan@takamol.sa', '2026-04-08', 'Martin', 15000.0, '[{"amount": 5000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 5000.0, "due_date": "2026-05-08", "paid": true, "paid_date": null, "manual": true}, {"amount": 5000.0, "due_date": "2026-06-08", "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-21', '2026-07-21', '2026-07-21', '2026-07-21', NULL, '[]'::jsonb),
('Rion Willard', NULL, NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb),
('Ayman Alshafai', 'ayman.alshafai@gmail.com', NULL, NULL, NULL, '[]'::jsonb, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb),
('Seve Ortale', NULL, '2026-03-24', 'Shako', 13000.0, '[{"amount": 1000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 12000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-04-03', '2026-08-03', '2026-08-03', '2026-08-03', NULL, '[]'::jsonb),
('Rohan Pardasani', NULL, '2026-06-02', 'Shako', 6000.0, '[{"amount": 6000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb),
('Mudasir Khan', 'nazar3khan84@gmail.com', '2026-06-03', 'Martin', 5100.0, '[{"amount": 1700.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 1700.0, "due_date": "2026-07-21", "paid": false, "paid_date": null, "manual": false}, {"amount": 1700.0, "due_date": "2026-08-21", "paid": false, "paid_date": null, "manual": false}]'::jsonb, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb),
('Khuzema Shabbir', 'khuzema.shabir@alshaya.com', '2026-06-25', 'Shako', 6000.0, '[{"amount": 2000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2000.0, "due_date": "2026-07-25", "paid": false, "paid_date": null, "manual": false}, {"amount": 2000.0, "due_date": "2026-08-25", "paid": false, "paid_date": null, "manual": false}]'::jsonb, '2026-06-25', '2026-08-25', '2026-08-25', '2026-08-25', NULL, '[]'::jsonb),
('Alexandria', NULL, '2026-06-12', 'Martin', 6900.0, '[{"amount": 2300.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 2300.0, "due_date": "2026-07-12", "paid": true, "paid_date": null, "manual": true}, {"amount": 2300.0, "due_date": "2026-08-12", "paid": false, "paid_date": null, "manual": false}]'::jsonb, NULL, NULL, NULL, NULL, NULL, '[]'::jsonb),
('Mahin Islam', 'mahin.f.islam@gmail.com', '2026-07-06', 'Shako', 5800.0, '[{"amount": 5800.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-07-06', '2026-10-06', '2026-10-06', '2026-11-06', NULL, '[]'::jsonb),
('Susan Klunder', NULL, '2026-07-07', 'Shako', 5900.0, '[{"amount": 2000.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}, {"amount": 1300.0, "due_date": "2026-08-07", "paid": false, "paid_date": null, "manual": false}, {"amount": 1300.0, "due_date": "2026-09-07", "paid": false, "paid_date": null, "manual": false}]'::jsonb, NULL, '2026-10-07', '2026-09-07', '2026-10-07', '4th installment 7.10.2026 + 1 month of group', '[]'::jsonb),
('Clara Marika Velte', NULL, '2026-10-07', 'Shako', 5800.0, '[{"amount": 5800.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-07-07', '2026-10-07', NULL, NULL, 'Plus 1 month of group', '[]'::jsonb),
('Mohamed Ali Khan', NULL, '2026-07-09', 'Shako', 5800.0, '[{"amount": 5800.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-07-09', '2026-10-09', NULL, NULL, 'Plus 1 month of group', '[]'::jsonb),
('Kelvinder Singh', NULL, '2026-10-10', 'Shako', 5800.0, '[{"amount": 5800.0, "due_date": null, "paid": true, "paid_date": null, "manual": true}]'::jsonb, '2026-07-10', '2026-10-10', NULL, NULL, 'Plus 1 month of group', '[]'::jsonb);
