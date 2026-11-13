-- Lets the team add the owner to a property it sourced itself, and record the owner's agreement.
-- Both functions are called only by the website server with the secret key. Run once in the Supabase SQL editor.

-- Where an agreement came from, and the proof the team holds when it recorded the agreement itself.
alter table agreements
  add column accepted_via text not null default 'online form' check (accepted_via in ('online form', 'recorded by team')),
  add column recorded_by text,
  add column proof_note text,
  add column proof_path text;

-- Events about a property (owner attached, contact edited) go in the same append-only history as leads.
alter table audit add column listing_id uuid references listings(id);
create index audit_listing_idx on audit (listing_id, at);

-- Adds an owner and the owner's agreement to a property that has none, in one step.
-- Leads already linked to the property that have not had contact released pick up the owner and agreement.
create function attach_owner(p_listing uuid, p_owner jsonb, p_agreement jsonb, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_listing   listings;
  v_owner     owners;
  v_agreement agreements;
  v_on        date := (p_agreement ->> 'acceptedOn')::date;
  v_ref       text;
  v_leads     int;
begin
  select * into v_listing from listings where id = p_listing for update;
  if not found then raise exception 'That property could not be found.'; end if;
  if v_listing.owner_id is not null then raise exception 'This property already has an owner.'; end if;
  if v_on is null or v_on > (now() at time zone 'Africa/Lagos')::date then
    raise exception 'The date the owner agreed cannot be empty or in the future.';
  end if;
  v_ref := coalesce(nullif(trim(p_agreement ->> 'paymentReference'), ''), 'WAIVED-' || v_listing.code);
  if exists (select 1 from agreements where payment_reference = v_ref) then
    raise exception 'That payment reference has already been used for another property.';
  end if;

  -- The same person (same email and WhatsApp) keeps one owner account across properties.
  select * into v_owner from owners
   where lower(email) = lower(trim(p_owner ->> 'email')) and whatsapp = trim(p_owner ->> 'whatsapp') limit 1;
  if not found then
    insert into owners (name, email, whatsapp)
    values (trim(p_owner ->> 'name'), lower(trim(p_owner ->> 'email')), trim(p_owner ->> 'whatsapp'))
    returning * into v_owner;
  end if;

  insert into agreements (owner_id, purpose, version, accepted_at, listing_fee, fee_pct, fee_due, protection_months,
                          payment_reference, accepted_via, recorded_by, proof_note, proof_path)
  values (v_owner.id, case when v_listing.category = 'Rent' then 'Rent' else 'Sell' end, p_agreement ->> 'version',
          (v_on::text || ' 12:00 Africa/Lagos')::timestamptz, (p_agreement ->> 'listingFee')::bigint,
          (p_agreement ->> 'feePct')::numeric, p_agreement ->> 'feeDue', (p_agreement ->> 'protectionMonths')::int,
          v_ref, 'recorded by team', p_actor, p_agreement ->> 'proofNote', nullif(p_agreement ->> 'proofPath', ''))
  returning * into v_agreement;

  update listings set owner_id = v_owner.id, agreement_id = v_agreement.id where id = p_listing;

  with upd as (
    update leads set owner_id = v_owner.id, agreement_id = v_agreement.id, agreement_version = v_agreement.version,
                     fee_pct = v_agreement.fee_pct, fee_due = v_agreement.fee_due,
                     protection_months = v_agreement.protection_months, owner_ack_at = null
     where listing_id = p_listing and released_at is null
    returning id)
  insert into audit (lead_id, listing_id, actor, action, detail)
  select id, p_listing, p_actor, 'Owner and agreement attached to the property',
         'Owner ' || v_owner.code || ', agreement version ' || v_agreement.version || ' recorded by the team. The owner must acknowledge this customer.'
    from upd;
  get diagnostics v_leads = row_count;

  insert into audit (listing_id, actor, action, detail)
  values (p_listing, p_actor, 'Owner and agreement recorded by the team',
          'Owner ' || v_owner.code || ' (' || v_owner.name || '). Agreement version ' || v_agreement.version || ' accepted on ' || v_on
          || '. Listing fee ' || v_agreement.listing_fee || ', reference ' || v_ref || '. Proof: ' || coalesce(p_agreement ->> 'proofNote', '') || '.');

  return jsonb_build_object('ownerCode', v_owner.code, 'agreementId', v_agreement.id, 'leadsUpdated', v_leads);
end $$;

-- Fixes a typo in an owner's contact details. Every property of that owner gets a history entry.
create function update_owner_contact(p_owner uuid, p_name text, p_whatsapp text, p_email text, p_actor text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o owners;
begin
  select * into o from owners where id = p_owner for update;
  if not found then raise exception 'That owner could not be found.'; end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_whatsapp), '') = '' or coalesce(trim(p_email), '') = '' then
    raise exception 'Enter the name, WhatsApp number and email.';
  end if;
  insert into audit (listing_id, actor, action, detail)
  select id, p_actor, 'Owner contact details edited',
         'Was: ' || o.name || ', ' || o.whatsapp || ', ' || o.email || '. Now: ' || trim(p_name) || ', ' || trim(p_whatsapp) || ', ' || lower(trim(p_email)) || '.'
    from listings where owner_id = p_owner;
  update owners set name = trim(p_name), whatsapp = trim(p_whatsapp), email = lower(trim(p_email)) where id = p_owner;
  return jsonb_build_object('ownerCode', o.code);
end $$;

revoke execute on function attach_owner(uuid, jsonb, jsonb, text) from public, anon, authenticated;
revoke execute on function update_owner_contact(uuid, text, text, text, text) from public, anon, authenticated;
