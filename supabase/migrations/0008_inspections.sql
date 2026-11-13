-- Inspection requests, confirming an inspection time, and a page where customers follow their enquiry.
-- Run once in the Supabase SQL editor.

alter table leads
  add column inspection_date date,
  add column inspection_slot text check (inspection_slot in ('Morning', 'Afternoon', 'Evening')),
  add column inspection_confirmed_for timestamptz,
  add column inspection_confirmed_by text;

-- ───────────── Registering a lead now keeps the inspection request and returns a tracking token ─────────────
create or replace function register_lead(p_email text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email   text := lower(trim(p_email));
  c         email_codes;
  p         jsonb;
  l         leads;
  v_listing listings;
begin
  select * into c from email_codes where email = v_email and expires_at > now()
   order by created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'That code has expired. Send the form again to get a new one.');
  end if;
  if c.code_hash <> encode(sha256(convert_to(trim(p_code) || v_email, 'UTF8')), 'hex') then
    if c.attempts >= 4 then
      update email_codes set attempts = attempts + 1, expires_at = now(), payload = '{}' where id = c.id;
      return jsonb_build_object('ok', false, 'reason', 'Too many wrong codes. Send the form again to get a new one.');
    end if;
    update email_codes set attempts = attempts + 1 where id = c.id;
    return jsonb_build_object('ok', false, 'reason', 'That code is not correct. Check the email and try again.');
  end if;

  p := c.payload;
  select * into v_listing from listings where code = p ->> 'listingId' and published;
  perform set_config('app.actor', 'Website', true);
  insert into leads (kind, enquiry_type, customer_name, customer_email, customer_phone, email_verified_at, customer_ack_at,
                     listing_id, source, property_type, location, budget, move_in_date, facilities, assistance, note,
                     inspection_date, inspection_slot)
  values (
    case when p ->> 'enquiryType' = 'Rent' then 'Rent' else 'Buy' end,
    p ->> 'enquiryType', p ->> 'fullName', v_email, p ->> 'phone', now(),
    coalesce((p ->> 'acknowledgedAt')::timestamptz, now()),
    v_listing.id, coalesce(nullif(p ->> 'source', ''), 'Direct'),
    coalesce(p ->> 'propertyType', ''), coalesce(p ->> 'location', ''), coalesce(p ->> 'budget', ''),
    nullif(p ->> 'moveInDate', '')::date,
    array(select jsonb_array_elements_text(coalesce(p -> 'facilities', '[]'::jsonb))),
    coalesce((p ->> 'assistance')::boolean, false), coalesce(p ->> 'note', ''),
    case when v_listing.id is null then null else nullif(p ->> 'inspectionDate', '')::date end,
    case when v_listing.id is null then null else nullif(p ->> 'inspectionSlot', '') end
  ) returning * into l;
  update email_codes set expires_at = now(), payload = '{}' where id = c.id;

  return jsonb_build_object('ok', true, 'lead', jsonb_build_object(
    'code', l.code, 'fullName', l.customer_name, 'email', l.customer_email, 'phone', l.customer_phone,
    'enquiryType', l.enquiry_type, 'propertyType', l.property_type, 'location', l.location, 'budget', l.budget,
    'moveInDate', l.move_in_date, 'facilities', to_jsonb(l.facilities), 'assistance', l.assistance,
    'note', l.note, 'source', l.source,
    'inspectionDate', l.inspection_date, 'inspectionSlot', l.inspection_slot,
    'trackToken', make_party_token(l.id, 'customer', 'track', 90),
    'property', case when v_listing.id is null then null else v_listing.code || ': ' || v_listing.title || ', ' || v_listing.location end));
end $$;

-- ───────────── History: the request and the confirmed time are recorded ─────────────
create or replace function lead_audit() returns trigger language plpgsql security definer set search_path = public as $$
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
    if new.inspection_date is not null then
      insert into audit (lead_id, actor, action, detail)
      values (new.id, 'Customer', 'Inspection requested', to_char(new.inspection_date, 'FMDay DD FMMonth YYYY') || coalesce(', ' || lower(new.inspection_slot), '') || '.');
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
  if new.inspection_confirmed_for is distinct from old.inspection_confirmed_for and new.inspection_confirmed_for is not null then
    insert into audit (lead_id, actor, action, detail)
    values (new.id, who, 'Inspection time confirmed', to_char(new.inspection_confirmed_for at time zone 'Africa/Lagos', 'FMDay DD FMMonth YYYY, HH24:MI') || ' (Lagos time).');
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

-- ───────────── Release also returns the inspection request and a link token for the customer ─────────────
create or replace function release_contact(p_lead uuid, p_actor text) returns jsonb
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
      'property', li.title || ', ' || li.location,
      'inspectionDate', l.inspection_date, 'inspectionSlot', l.inspection_slot,
      'trackToken', make_party_token(l.id, 'customer', 'track', 90))
    from owners o, listings li where o.id = l.owner_id and li.id = l.listing_id
  );
end $$;
revoke execute on function release_contact(uuid, text) from public, anon, authenticated;

-- ───────────── Confirming an inspection time (the team does this after contact was released) ─────────────
create function confirm_inspection(p_lead uuid, p_when timestamptz, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  perform set_config('app.actor', p_actor, true);
  select * into l from leads where id = p_lead for update;
  if not found then raise exception 'That lead could not be found.'; end if;
  if l.released_at is null then raise exception 'An inspection can only be confirmed after the contact has been released.'; end if;
  if l.status in ('Successfully Rented', 'Successfully Sold', 'Unsuccessful', 'Disputed') then
    raise exception 'This lead is closed.';
  end if;
  if p_when is null or p_when < now() then raise exception 'Choose a date and time that has not passed.'; end if;

  update leads set inspection_confirmed_for = p_when, inspection_confirmed_by = p_actor,
                   status = case when l.status = 'Contact Released' then 'Inspection Scheduled' else l.status end
   where id = p_lead returning * into l;

  return (
    select jsonb_build_object(
      'leadCode', l.code, 'customerName', l.customer_name, 'customerEmail', l.customer_email,
      'ownerName', o.name, 'ownerEmail', o.email, 'property', li.title || ', ' || li.location,
      'when', p_when, 'trackToken', make_party_token(l.id, 'customer', 'track', 90))
    from owners o, listings li where o.id = l.owner_id and li.id = l.listing_id
  );
end $$;

-- ───────────── What a customer may see about their own enquiry (never the owner's contact or any fees) ─────────────
create function track_view(l leads) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', l.code, 'kind', l.kind, 'status', l.status, 'introducedAt', l.introduced_at, 'verifiedAt', l.email_verified_at,
    'releasedAt', l.released_at, 'inspectionDate', l.inspection_date, 'inspectionSlot', l.inspection_slot,
    'inspectionConfirmedFor', l.inspection_confirmed_for,
    'property', (select title || ', ' || location from listings where id = l.listing_id));
$$;

-- By the private link in an email.
create function track_lead(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  select ld.* into l from party_tokens t join leads ld on ld.id = t.lead_id
   where t.token_hash = encode(sha256(convert_to(trim(p_token), 'UTF8')), 'hex')
     and t.purpose = 'track' and t.party = 'customer' and t.expires_at > now();
  if not found then return null; end if;
  return track_view(l);
end $$;

-- By Lead ID and the email address used. Any mismatch gives the same empty answer.
create function track_lead_by_code(p_code text, p_email text) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l leads;
begin
  select * into l from leads where code = upper(trim(p_code)) and lower(customer_email) = lower(trim(p_email));
  if not found then return null; end if;
  return track_view(l);
end $$;

revoke execute on function register_lead(text, text) from public, anon, authenticated;
revoke execute on function confirm_inspection(uuid, timestamptz, text) from public, anon, authenticated;
revoke execute on function track_view(leads) from public, anon, authenticated;
revoke execute on function track_lead(text) from public, anon, authenticated;
revoke execute on function track_lead_by_code(text, text) from public, anon, authenticated;
