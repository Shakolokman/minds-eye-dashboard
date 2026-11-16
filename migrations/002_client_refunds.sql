-- Client refunds (2026-11-16)
-- Run once in Supabase → SQL Editor before (or right after) deploying the refund feature.
alter table clients add column if not exists refund_amount numeric;
alter table clients add column if not exists refund_date date;
alter table clients add column if not exists refund_reason text;
