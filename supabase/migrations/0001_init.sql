-- Oluwaseyi Homes & Properties: database setup.
-- Run once in the Supabase SQL editor (or with psql). Safe to read top to bottom:
--   1. team and permissions      4. leads and transactions
--   2. website content and fees  5. rules enforced by the database
--   3. owners and properties     6. who can read and write what (RLS), file buckets, starting data

-- ───────────────────────────── 1. Team and permissions ─────────────────────────────

create table roles (
  name   text primary key,
  locked boolean not null default false -- the Owner role cannot be edited or removed
);

create table role_permissions (
  role       text not null references roles(name) on update cascade on delete cascade,
  permission text not null,
  primary key (role, permission)
);

create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       text not null references roles(name) on update cascade,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- True when the signed-in team member's role includes this permission.
create function has_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles pr
    join role_permissions rp on rp.role = pr.role
    where pr.id = auth.uid() and pr.active and rp.permission = p
  );
$$;

-- Who is acting, for the history. n8n sets app.actor; the dashboard falls back to the signed-in person.
create function current_actor() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('app.actor', true), ''),
    (select coalesce(nullif(name, ''), email) from profiles where id = auth.uid()),
    'System'
  );
$$;

-- The very first account becomes the Owner. Everyone after that gets the role they were invited with.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case
      when not exists (select 1 from profiles) then 'Owner'
      when exists (select 1 from roles where name = new.raw_user_meta_data ->> 'role' and not locked)
        then new.raw_user_meta_data ->> 'role'
      else 'Staff'
    end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────────── 2. Website content and fees ─────────────────────────────

create table site_content (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- One row. Every fee the company charges.
create table pricing (
  id                  int primary key default 1 check (id = 1),
  listing_fee         bigint not null check (listing_fee >= 0),          -- naira, paid by the owner on listing
  agency_fee_pct      numeric(5,2) not null check (agency_fee_pct >= 0), -- % of annual rent, paid by the landlord
  sale_commission_pct numeric(5,2) not null check (sale_commission_pct >= 0),
  tenant_assist_fee   bigint check (tenant_assist_fee >= 0),             -- null = "Fee to be confirmed"
  protection_months   int not null check (protection_months > 0),
  agreement_version   text not null,
  updated_at          timestamptz not null default now()
);

-- Extra details the admin has chosen to record for properties.
create table detail_fields (
  id        text primary key,
  label     text not null,
  type      text not null check (type in ('Text', 'Number', 'Dropdown', 'Date', 'Yes or no')),
  options   jsonb,
  ask_owner text not null default 'No' check (ask_owner in ('No', 'Rent', 'Sell', 'Both')),
  position  int not null default 0
);

-- ───────────────────────────── 3. Owners and properties ─────────────────────────────

create sequence owner_code_seq;
create table owners (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique default 'OWN-' || lpad(nextval('owner_code_seq')::text, 4, '0'),
  name       text not null,
  email      text not null,
  whatsapp   text not null,
  created_at timestamptz not null default now()
);

-- An accepted Property Listing and Agency Agreement. Never edited: a new acceptance is a new row.
create table agreements (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references owners(id),
  purpose           text not null check (purpose in ('Rent', 'Sell')),
  version           text not null,
  accepted_at       timestamptz not null default now(),
  listing_fee       bigint not null,
  fee_pct           numeric(5,2) not null,
  fee_due           text not null,           -- when the agency fee or commission becomes payable
  protection_months int not null,
  payment_reference text not null unique     -- one listing-fee payment can only be used once
);

create table submissions (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references owners(id),
  agreement_id   uuid not null references agreements(id),
  purpose        text not null check (purpose in ('Rent', 'Sell')),
  relationship   text not null,
  property_type  text not null,
  address        text not null,
  neighbourhood  text not null,
  bedrooms       int,
  asking_amount  bigint not null,
  legal_fee      bigint not null default 0,
  caution_pct    numeric(5,2) not null default 0,
  service_charge bigint not null default 0,
  service_covers text not null default '',
  facilities     text[] not null default '{}',
  parking        text not null default '',
  security       text not null default '',
  inspection     text not null default '',
  video_path     text,
  video_url      text,
  description    text not null default '',
  details        jsonb not null default '{}',
  status         text not null default 'New' check (status in ('New', 'Contacted', 'Approved', 'Rejected')),
  unread         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table submission_images (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  path          text not null,
  position      int not null default 0
);

create sequence listing_code_seq;
create table listings (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default 'P-' || lpad(nextval('listing_code_seq')::text, 4, '0'),
  category       text not null check (category in ('Rent', 'Buy', 'Invest')),
  property_type  text not null,
  title          text not null,
  location       text not null,
  price          bigint not null,            -- annual rent, or the sale price
  beds           int,
  baths          int,
  size           text,
  description    text not null default '',
  details        jsonb not null default '{}',
  agency_fee     bigint not null default 0,  -- charged to the tenant; normally 0
  legal_fee      bigint not null default 0,
  caution_pct    numeric(5,2) not null default 0,
  service_charge bigint not null default 0,
  service_covers text not null default '',
  facilities     text[] not null default '{}',
  parking        text not null default '',
  security       text not null default '',
  inspection     text not null default '',
  video_url      text,
  verified       boolean not null default false,
  published      boolean not null default false,
  owner_id       uuid references owners(id),
  agreement_id   uuid references agreements(id),
  submission_id  uuid references submissions(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table listing_images (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  path       text not null,
  position   int not null default 0
);

-- ───────────────────────────── 4. Leads and transactions ─────────────────────────────

create type lead_status as enum (
  'New Enquiry', 'Contact Released', 'Inspection Scheduled', 'Inspection Completed', 'Negotiation',
  'Offer Accepted', 'Successfully Rented', 'Successfully Sold', 'Unsuccessful', 'Disputed'
);

create sequence lead_code_seq;
create sequence receipt_code_seq;

-- One customer introduced to one owner about one property.
create table leads (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique default 'OHP-L-' || lpad(nextval('lead_code_seq')::text, 6, '0'),
  kind                  text not null check (kind in ('Rent', 'Buy')),   -- Invest enquiries are tracked as Buy
  enquiry_type          text not null check (enquiry_type in ('Rent', 'Buy', 'Invest')),
  customer_name         text not null,
  customer_email        text not null,
  customer_phone        text not null,
  email_verified_at     timestamptz,
  listing_id            uuid references listings(id),
  owner_id              uuid references owners(id),
  source                text not null default 'Direct',
  introduced_at         timestamptz not null default now(),
  customer_ack_at       timestamptz,
  owner_ack_at          timestamptz,
  released_at           timestamptz,
  status                lead_status not null default 'New Enquiry',
  -- The owner's agreement as it stood when this lead was linked to the property.
  agreement_id          uuid references agreements(id),
  agreement_version     text,
  fee_pct               numeric(5,2),
  fee_due               text,
  protection_months     int,
  -- What the customer asked for.
  property_type         text not null default '',
  location              text not null default '',
  budget                text not null default '',
  move_in_date          date,
  facilities            text[] not null default '{}',
  assistance            boolean not null default false,
  note                  text not null default '',
  -- Answers to the automatic follow-ups.
  customer_inspected    boolean,
  owner_inspected       boolean,
  customer_completed    boolean,
  owner_completed       boolean,
  -- Completion, invoice and payment.
  completion_date       date,
  final_price           bigint check (final_price > 0),
  evidence_note         text not null default '',
  evidence_paths        text[] not null default '{}',
  completion_verified_at timestamptz,
  fee_amount            bigint generated always as (round(final_price * fee_pct / 100.0)) stored,
  invoice_status        text not null default 'Not issued' check (invoice_status in ('Not issued', 'Issued', 'Paid')),
  invoice_issued_at     timestamptz,
  paid_at               timestamptz,
  payment_reference     text,
  receipt_code          text unique,
  suspect_reason        text,
  conflict              boolean generated always as (
    coalesce(customer_inspected <> owner_inspected, false) or coalesce(customer_completed <> owner_completed, false)
  ) stored
);
create index leads_listing_idx on leads (listing_id);
create index leads_owner_idx on leads (owner_id);
create index leads_status_idx on leads (status);
create index leads_introduced_idx on leads (introduced_at desc);

-- Six-digit codes sent to prove an email address. Only the hash is stored.
create table email_codes (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  code_hash  text not null,
  payload    jsonb not null,           -- the enquiry, held until the code is confirmed
  attempts   int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index email_codes_email_idx on email_codes (email);

-- One-time links emailed to a customer or owner (acknowledge, answer a follow-up, report a completion).
create table party_tokens (
  token_hash text primary key,
  lead_id    uuid not null references leads(id),
  party      text not null check (party in ('customer', 'owner')),
  purpose    text not null,
  expires_at timestamptz not null,
  used_at    timestamptz
);

-- The history. Rows are only ever added.
create table audit (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  lead_id       uuid references leads(id),
  submission_id uuid references submissions(id),
  actor         text not null,
  action        text not null,
  detail        text not null default ''
);
create index audit_lead_idx on audit (lead_id, at);

create table page_views (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  path   text not null,
  source text not null default 'Direct',
  device text not null default '',
  event  text                             -- null for a visit, or the name of a button that was clicked
);
create index page_views_at_idx on page_views (at desc);

-- ───────────────────────────── 5. Rules enforced by the database ─────────────────────────────

-- History can never be changed or removed, by anyone, through any route.
create function forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows cannot be changed or deleted', tg_table_name using errcode = 'P0001';
end $$;

create trigger audit_no_change before update or delete on audit
  for each row execute function forbid_change();
create trigger audit_no_truncate before truncate on audit
  for each statement execute function forbid_change();
create trigger leads_no_delete before delete on leads
  for each row execute function forbid_change();
create trigger agreements_no_change before update or delete on agreements
  for each row execute function forbid_change();

-- What is still missing before contact details may be released. Empty means ready.
create function release_blockers(l leads) returns text[] language sql stable as $$
  select array_remove(array[
    case when l.listing_id is null then 'No property is linked to this lead.' end,
    case when l.email_verified_at is null then 'The customer''s email is not verified.' end,
    case when l.customer_ack_at is null then 'The customer has not acknowledged that the introduction comes from the platform.' end,
    case when l.listing_id is not null and l.agreement_id is null then 'The owner has not accepted the Property Listing and Agency Agreement.' end,
    case when l.listing_id is not null and l.owner_ack_at is null then 'The owner has not acknowledged receiving this customer.' end
  ], null);
$$;

create function lead_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  missing text[];
  won     lead_status := case when new.kind = 'Rent' then 'Successfully Rented' else 'Successfully Sold' end;
begin
  -- Linking a property copies its owner and the owner's agreement onto the lead.
  if new.listing_id is not null and (tg_op = 'INSERT' or new.listing_id is distinct from old.listing_id) then
    if tg_op = 'UPDATE' and old.released_at is not null then
      raise exception 'The property cannot be changed after contact has been released';
    end if;
    select li.owner_id, a.id, a.version, a.fee_pct, a.fee_due, a.protection_months
      into new.owner_id, new.agreement_id, new.agreement_version, new.fee_pct, new.fee_due, new.protection_months
      from listings li left join agreements a on a.id = li.agreement_id
     where li.id = new.listing_id;
    new.owner_ack_at := null;
  end if;

  if tg_op = 'INSERT' then
    if new.released_at is not null or new.status <> 'New Enquiry' or new.invoice_status <> 'Not issued' then
      raise exception 'A new lead must start as New Enquiry with nothing released or invoiced';
    end if;
    return new;
  end if;

  -- Facts that are fixed once recorded.
  if new.code <> old.code or new.introduced_at <> old.introduced_at or new.kind <> old.kind
     or (old.customer_ack_at is not null and new.customer_ack_at is distinct from old.customer_ack_at)
     or (old.email_verified_at is not null and new.email_verified_at is distinct from old.email_verified_at)
     or (old.released_at is not null and new.released_at is distinct from old.released_at)
     or (old.completion_verified_at is not null and (
           new.completion_verified_at is distinct from old.completion_verified_at
           or new.final_price is distinct from old.final_price
           or new.completion_date is distinct from old.completion_date))
     or (old.released_at is not null and (
           new.agreement_id is distinct from old.agreement_id or new.fee_pct is distinct from old.fee_pct))
  then
    raise exception 'This part of a lead''s record cannot be changed once it has been recorded';
  end if;

  -- Contact release needs every record in place.
  if old.released_at is null and new.released_at is not null then
    missing := release_blockers(new);
    if cardinality(missing) > 0 then
      raise exception 'Contact details cannot be released yet: %', array_to_string(missing, ' ');
    end if;
    new.status := 'Contact Released';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'New Enquiry' then
      raise exception 'A lead cannot go back to New Enquiry';
    end if;
    if new.status = 'Contact Released' and new.released_at is null then
      raise exception 'Use the release step to release contact details';
    end if;
    if new.released_at is null and new.status not in ('Unsuccessful', 'Disputed') then
      raise exception 'The status cannot move on until contact has been released';
    end if;
    if new.status in ('Successfully Rented', 'Successfully Sold') then
      if new.status <> won then raise exception 'A % lead cannot be marked %', new.kind, new.status; end if;
      if new.completion_verified_at is null then
        raise exception 'A transaction can only be marked successful after the reported completion has been checked';
      end if;
    end if;
  end if;

  -- Completion check needs a date and a final price.
  if old.completion_verified_at is null and new.completion_verified_at is not null
     and (new.completion_date is null or new.final_price is null or new.released_at is null) then
    raise exception 'A completion needs a date and a final price, after contact was released, before it can be checked';
  end if;

  -- Invoice and payment follow a checked completion, in order.
  if new.invoice_status is distinct from old.invoice_status then
    -- fee_amount is worked out by the database after this check, so test what it is made from.
    if new.completion_verified_at is null or new.final_price is null or new.fee_pct is null then
      raise exception 'No invoice can be issued until the completion has been checked';
    end if;
    if old.invoice_status = 'Not issued' and new.invoice_status = 'Issued' then
      new.invoice_issued_at := now();
    elsif old.invoice_status = 'Issued' and new.invoice_status = 'Paid' then
      new.paid_at := now();
      new.receipt_code := 'OHP-R-' || lpad(nextval('receipt_code_seq')::text, 6, '0');
    else
      raise exception 'An invoice goes from Not issued to Issued to Paid, one step at a time';
    end if;
  end if;

  return new;
end $$;

create trigger leads_guard before insert or update on leads
  for each row execute function lead_guard();

-- Writes the history for a lead automatically, so no change can go unrecorded.
create function lead_audit() returns trigger language plpgsql security definer set search_path = public as $$
declare
  who text := current_actor();
begin
  if tg_op = 'INSERT' then
    insert into audit (lead_id, actor, action, detail)
    values (new.id, who, 'Lead registered', 'Lead ID ' || new.code || '. Source: ' || new.source || '.');
    if new.email_verified_at is not null then
      insert into audit (lead_id, actor, action) values (new.id, 'Customer', 'Email verified');
    end if;
    if new.customer_ack_at is not null then
      insert into audit (lead_id, actor, action) values (new.id, 'Customer', 'Acknowledged that the introduction comes from the platform');
    end if;
    return new;
  end if;

  if new.listing_id is distinct from old.listing_id then
    insert into audit (lead_id, actor, action, detail)
    values (new.id, who, 'Property linked', (select code || ': ' || title || ', ' || location from listings where id = new.listing_id));
  end if;
  if old.email_verified_at is null and new.email_verified_at is not null then
    insert into audit (lead_id, actor, action) values (new.id, 'Customer', 'Email verified');
  end if;
  if old.customer_ack_at is null and new.customer_ack_at is not null then
    insert into audit (lead_id, actor, action) values (new.id, 'Customer', 'Acknowledged that the introduction comes from the platform');
  end if;
  if old.owner_ack_at is null and new.owner_ack_at is not null then
    insert into audit (lead_id, actor, action) values (new.id, 'Owner', 'Acknowledged receipt of this customer');
  end if;
  if old.released_at is null and new.released_at is not null then
    insert into audit (lead_id, actor, action) values (new.id, who, 'Contact details released to the customer');
  end if;
  if new.status is distinct from old.status then
    insert into audit (lead_id, actor, action, detail) values (new.id, who, 'Status changed', old.status || ' to ' || new.status);
  end if;
  if new.customer_inspected is distinct from old.customer_inspected or new.customer_completed is distinct from old.customer_completed then
    insert into audit (lead_id, actor, action, detail) values (new.id, 'Customer', 'Follow-up answered',
      'Inspection took place: ' || coalesce(new.customer_inspected::text, 'no answer') || '. Completed: ' || coalesce(new.customer_completed::text, 'no answer') || '.');
  end if;
  if new.owner_inspected is distinct from old.owner_inspected or new.owner_completed is distinct from old.owner_completed then
    insert into audit (lead_id, actor, action, detail) values (new.id, 'Owner', 'Follow-up answered',
      'Inspection took place: ' || coalesce(new.owner_inspected::text, 'no answer') || '. Completed: ' || coalesce(new.owner_completed::text, 'no answer') || '.');
  end if;
  if new.conflict and not old.conflict then
    insert into audit (lead_id, actor, action) values (new.id, 'System', 'Conflicting answers flagged for review');
  end if;
  if new.final_price is distinct from old.final_price or new.completion_date is distinct from old.completion_date then
    insert into audit (lead_id, actor, action, detail) values (new.id, who, 'Completion reported',
      coalesce(new.completion_date::text, 'no date') || ', final amount ' || coalesce(new.final_price::text, 'not given') || '.');
  end if;
  if old.completion_verified_at is null and new.completion_verified_at is not null then
    insert into audit (lead_id, actor, action, detail) values (new.id, who, 'Completion evidence checked',
      'Fee ' || new.fee_amount || ' (' || new.fee_pct || '% of ' || new.final_price || ', agreement ' || coalesce(new.agreement_version, '') || ').');
  end if;
  if new.invoice_status is distinct from old.invoice_status then
    insert into audit (lead_id, actor, action, detail) values (new.id, who,
      case new.invoice_status when 'Issued' then 'Invoice issued' else 'Payment verified, receipt issued' end,
      case new.invoice_status when 'Issued' then 'Amount ' || new.fee_amount || '.' else 'Receipt ' || new.receipt_code || '.' end);
  end if;
  if new.suspect_reason is distinct from old.suspect_reason and new.suspect_reason is not null then
    insert into audit (lead_id, actor, action, detail) values (new.id, 'System', 'Flagged: possible unreported deal', new.suspect_reason);
  end if;
  return new;
end $$;

create trigger leads_audit after insert or update on leads
  for each row execute function lead_audit();

-- The one way to release contact details. Returns the owner's contact for the email to the customer.
create function release_contact(p_lead uuid, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  perform set_config('app.actor', p_actor, true);
  update leads set released_at = now() where id = p_lead and released_at is null returning * into l;
  if not found then
    raise exception 'This lead does not exist or its contact details were already released';
  end if;
  return (
    select jsonb_build_object(
      'leadCode', l.code, 'customerName', l.customer_name, 'customerEmail', l.customer_email,
      'ownerName', o.name, 'ownerWhatsapp', o.whatsapp, 'ownerEmail', o.email,
      'property', li.title || ', ' || li.location)
    from owners o, listings li where o.id = l.owner_id and li.id = l.listing_id
  );
end $$;
revoke execute on function release_contact(uuid, text) from public, anon, authenticated;

-- The Owner role always keeps every permission and cannot be removed.
create function protect_owner_role() returns trigger language plpgsql as $$
begin
  if old.locked then
    raise exception 'The Owner role cannot be changed or removed';
  end if;
  return coalesce(new, old);
end $$;
create function protect_owner_permissions() returns trigger language plpgsql as $$
begin
  if exists (select 1 from roles where name = old.role and locked) then
    raise exception 'The Owner role always has every permission';
  end if;
  return coalesce(new, old);
end $$;
create trigger roles_protect before update or delete on roles
  for each row execute function protect_owner_role();
create trigger role_permissions_protect before update or delete on role_permissions
  for each row execute function protect_owner_permissions();

-- Only people allowed to publish can put a property on the website or mark it verified.
create function listing_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not has_permission('publish')
     and (new.published or new.verified)
     and (tg_op = 'INSERT' or new.published is distinct from old.published or new.verified is distinct from old.verified) then
    raise exception 'Your role cannot publish or verify a property';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger listings_guard before insert or update on listings
  for each row execute function listing_guard();

-- ───────────────────────────── 6. Who can read and write what ─────────────────────────────
-- n8n and the website server use the service key, which is not limited by these rules.
-- These rules are for visitors (anon) and signed-in team members (authenticated).

alter table roles             enable row level security;
alter table role_permissions  enable row level security;
alter table profiles          enable row level security;
alter table site_content      enable row level security;
alter table pricing           enable row level security;
alter table detail_fields     enable row level security;
alter table owners            enable row level security;
alter table agreements        enable row level security;
alter table submissions       enable row level security;
alter table submission_images enable row level security;
alter table listings          enable row level security;
alter table listing_images    enable row level security;
alter table leads             enable row level security;
alter table email_codes       enable row level security; -- no policies: server only
alter table party_tokens      enable row level security; -- no policies: server only
alter table audit             enable row level security;
alter table page_views        enable row level security;

-- Visitors: published properties, website wording, fees and detail definitions only.
create policy "public reads published listings" on listings for select to anon, authenticated using (published);
create policy "public reads images of published listings" on listing_images for select to anon, authenticated
  using (exists (select 1 from listings l where l.id = listing_id and l.published));
create policy "public reads content" on site_content for select to anon, authenticated using (true);
create policy "public reads pricing" on pricing for select to anon, authenticated using (true);
create policy "public reads detail fields" on detail_fields for select to anon, authenticated using (true);

-- Team: properties.
create policy "team reads all listings" on listings for select to authenticated using (has_permission('view'));
create policy "team adds listings" on listings for insert to authenticated with check (has_permission('drafts'));
create policy "team edits listings" on listings for update to authenticated using (has_permission('drafts')) with check (has_permission('drafts'));
create policy "publishers delete listings" on listings for delete to authenticated using (has_permission('publish'));
create policy "team reads all listing images" on listing_images for select to authenticated using (has_permission('view'));
create policy "team manages listing images" on listing_images for all to authenticated using (has_permission('drafts')) with check (has_permission('drafts'));

-- Team: website wording, fees, detail definitions.
create policy "editors write content" on site_content for all to authenticated using (has_permission('content')) with check (has_permission('content'));
create policy "editors write pricing" on pricing for update to authenticated using (has_permission('content')) with check (has_permission('content'));
create policy "editors write detail fields" on detail_fields for all to authenticated using (has_permission('content') or has_permission('drafts')) with check (has_permission('content') or has_permission('drafts'));

-- Team: owner submissions (contain personal details).
create policy "team reads owners" on owners for select to authenticated using (has_permission('submissions'));
create policy "team reads agreements" on agreements for select to authenticated using (has_permission('submissions'));
create policy "team reads submissions" on submissions for select to authenticated using (has_permission('submissions'));
create policy "team updates submissions" on submissions for update to authenticated using (has_permission('submissions')) with check (has_permission('submissions'));
create policy "team reads submission images" on submission_images for select to authenticated using (has_permission('submissions'));

-- Team: leads and their history. Release, invoices and payments go through the server, not these rules.
create policy "team reads leads" on leads for select to authenticated using (has_permission('view'));
create policy "team updates leads" on leads for update to authenticated using (has_permission('transactions')) with check (has_permission('transactions'));
create policy "team reads history" on audit for select to authenticated using (has_permission('view'));
create policy "team reads traffic" on page_views for select to authenticated using (has_permission('view'));

-- Team: people and roles.
create policy "read own profile or all with team permission" on profiles for select to authenticated using (id = auth.uid() or has_permission('team'));
create policy "team managers edit profiles" on profiles for update to authenticated using (has_permission('team')) with check (has_permission('team'));
create policy "signed-in reads roles" on roles for select to authenticated using (true);
create policy "team managers write roles" on roles for all to authenticated using (has_permission('team')) with check (has_permission('team'));
create policy "signed-in reads role permissions" on role_permissions for select to authenticated using (true);
create policy "team managers write role permissions" on role_permissions for all to authenticated using (has_permission('team')) with check (has_permission('team'));

-- File buckets. Uploads from the public forms use one-time signed links created by the server.
insert into storage.buckets (id, name, public) values
  ('listings', 'listings', true),       -- photos shown on the website
  ('submissions', 'submissions', false), -- photos and videos owners send in
  ('evidence', 'evidence', false);       -- proof of a completed rental or sale

create policy "team uploads listing photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'listings' and has_permission('drafts'));
create policy "team changes listing photos" on storage.objects for update to authenticated
  using (bucket_id = 'listings' and has_permission('drafts'));
create policy "team removes listing photos" on storage.objects for delete to authenticated
  using (bucket_id = 'listings' and has_permission('drafts'));
create policy "team views submission files" on storage.objects for select to authenticated
  using (bucket_id = 'submissions' and has_permission('submissions'));
create policy "team views evidence" on storage.objects for select to authenticated
  using (bucket_id = 'evidence' and has_permission('transactions'));

-- Starting data.
insert into roles (name, locked) values ('Owner', true), ('Manager', false), ('Staff', false);

insert into role_permissions (role, permission)
select 'Owner', p from unnest(array['view','submissions','drafts','publish','approve','release','transactions','content','team']) p
union all
select 'Manager', p from unnest(array['view','submissions','drafts','publish','approve','release','transactions','content']) p
union all
select 'Staff', p from unnest(array['view','submissions','drafts']) p;

insert into pricing (listing_fee, agency_fee_pct, sale_commission_pct, tenant_assist_fee, protection_months, agreement_version)
values (5000, 10, 10, null, 12, '2026-11');

insert into detail_fields (id, label, type, options, ask_owner, position) values
  ('minimum-rent-period', 'Minimum rent period', 'Dropdown', '["6 months","1 year","2 years"]', 'Rent', 1),
  ('furnishing', 'Furnishing', 'Dropdown', '["Furnished","Semi-furnished","Unfurnished"]', 'Both', 2),
  ('available-from', 'Available from', 'Date', null, 'Both', 3),
  ('pets', 'Pets allowed', 'Yes or no', null, 'Rent', 4),
  ('title-document', 'Title document', 'Dropdown', '["Certificate of Occupancy","Governor''s Consent","Deed of Assignment","Survey plan only"]', 'Sell', 5);
