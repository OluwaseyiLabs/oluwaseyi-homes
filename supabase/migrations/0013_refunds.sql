-- Refunds of the listing fee for rejected submissions, and a record of why a submission was rejected.
-- Run once in the Supabase SQL editor (staging first, then production).

-- ───────────── Why a submission was rejected, and what was decided about the refund ─────────────
alter table submissions
  add column rejected_reason text,      -- the reason chosen when it was rejected
  add column rejected_note   text,      -- what the team told the owner
  add column refund_decision boolean;   -- true: the listing fee is to be refunded; false: it is not; null: not decided

-- ───────────── Refunds ─────────────
create table refunds (
  id                uuid primary key default gen_random_uuid(),
  submission_id     uuid not null references submissions(id),
  agreement_id      uuid not null references agreements(id),
  payment_reference text not null,                       -- the Paystack reference of the listing fee that was paid
  amount            bigint not null check (amount > 0),  -- naira: always the full listing fee, set by the server
  method            text not null check (method in ('Paystack', 'Manual')),
  status            text not null default 'Started' check (status in ('Started', 'Refunded', 'Failed')),
  reason            text not null default '',
  note              text not null default '',
  paystack_refund_id text,
  failure           text,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz
);
create index refunds_submission_idx on refunds (submission_id);

-- One listing fee can be refunded only once: while a refund is Started or Refunded, no second one can be made.
-- A Failed refund does not count, so it can be tried again.
create unique index refunds_one_per_fee on refunds (submission_id) where status <> 'Failed';

create function refunds_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger refunds_touch before update on refunds for each row execute function refunds_touch();

-- Refund rows are kept for good.
create trigger refunds_no_delete before delete on refunds for each row execute function forbid_change();

alter table refunds enable row level security;
-- Only people who may send refunds can read them. Writing happens on the server, after that permission is checked.
create policy "refund team reads refunds" on refunds for select to authenticated using (has_permission('refunds'));
revoke execute on function refunds_touch() from public, anon, authenticated;

-- ───────────── The permission itself ─────────────
-- The Owner always holds every permission, and that is stored as rows, so the Owner gets the new one here.
-- Other roles get it only when someone ticks it on the Team page.
insert into role_permissions (role, permission) values ('Owner', 'refunds');
