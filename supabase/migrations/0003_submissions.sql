-- List Property flow: a paid submission creates the owner, their accepted agreement and the submission in one step.
-- Called only by n8n with the secret key. Run once in the Supabase SQL editor.

-- Every submission gets a reference the owner can quote, for example OHP-S-000012.
create sequence submission_code_seq;
alter table submissions
  add column code text not null unique default 'OHP-S-' || lpad(nextval('submission_code_seq')::text, 6, '0');

create function submit_listing(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p ->> 'email'));
  v_owner owners;
  v_agreement agreements;
  v_sub submissions;
begin
  -- One listing-fee payment pays for one submission.
  if exists (select 1 from agreements where payment_reference = p ->> 'paymentReference') then
    return jsonb_build_object('ok', false, 'reason', 'This payment has already been used for a property. Each property needs its own listing fee.');
  end if;

  -- The same person listing again keeps one owner account.
  select * into v_owner from owners where lower(email) = v_email and whatsapp = p ->> 'phone' limit 1;
  if not found then
    insert into owners (name, email, whatsapp) values (p ->> 'fullName', v_email, p ->> 'phone') returning * into v_owner;
  end if;

  insert into agreements (owner_id, purpose, version, listing_fee, fee_pct, fee_due, protection_months, payment_reference)
  values (v_owner.id, p ->> 'purpose', p ->> 'agreementVersion', (p ->> 'listingFee')::bigint, (p ->> 'feePct')::numeric,
          p ->> 'feeDue', (p ->> 'protectionMonths')::int, p ->> 'paymentReference')
  returning * into v_agreement;

  insert into submissions (owner_id, agreement_id, purpose, relationship, property_type, address, neighbourhood, bedrooms,
                           asking_amount, legal_fee, caution_pct, service_charge, service_covers, facilities, parking,
                           security, inspection, video_url, description, details)
  values (v_owner.id, v_agreement.id, p ->> 'purpose', p ->> 'relationship', p ->> 'propertyType', p ->> 'address',
          p ->> 'neighbourhood', nullif(p ->> 'bedrooms', '')::int, (p ->> 'askingAmount')::bigint,
          coalesce((p ->> 'legalFee')::bigint, 0), coalesce((p ->> 'cautionPct')::numeric, 0),
          coalesce((p ->> 'serviceCharge')::bigint, 0), coalesce(p ->> 'serviceCovers', ''),
          array(select jsonb_array_elements_text(coalesce(p -> 'facilities', '[]'::jsonb))),
          coalesce(p ->> 'parking', ''), coalesce(p ->> 'security', ''), coalesce(p ->> 'inspection', ''),
          nullif(p ->> 'videoLink', ''), coalesce(p ->> 'description', ''), coalesce(p -> 'details', '{}'::jsonb))
  returning * into v_sub;

  insert into submission_images (submission_id, path, position)
  select v_sub.id, path, pos - 1 from jsonb_array_elements_text(coalesce(p -> 'photos', '[]'::jsonb)) with ordinality as t(path, pos);

  insert into audit (submission_id, actor, action, detail)
  values (v_sub.id, 'Owner', 'Property submitted',
          v_sub.code || '. Listing fee ' || v_agreement.listing_fee || ' paid, reference ' || v_agreement.payment_reference
          || '. Agreement version ' || v_agreement.version || ' accepted.');

  return jsonb_build_object('ok', true, 'code', v_sub.code, 'purpose', v_sub.purpose, 'propertyType', v_sub.property_type);
end $$;

revoke execute on function submit_listing(jsonb) from public, anon, authenticated;
