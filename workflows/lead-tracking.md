# Lead Introduction and Transaction Tracking - n8n backend (PLAN, not built yet)

Status: **partly built.** Storage is Supabase (not n8n data tables, as first planned): see `supabase/migrations/`.

Built and live:
- Lead API (`oluwaseyi-homes-lead-api.md`): enquiry with 6-digit code, lead registration, contact-release email.
- Listing API (`oluwaseyi-homes-listing-api.md`): paid owner submissions.
- Dashboard: Leads and transactions, Submissions and Properties read and write Supabase directly; the release gate,
  status order, invoice order and append-only history are enforced by database triggers.

Also built: owner acknowledgement by emailed one-time link (`/r/<token>`), automatic and on-demand follow-ups with conflict and
unreported-deal flags, owners reporting a completion by link, and invoice and receipt emails with Paystack payment checking.
Migrations 0001 to 0008 hold the schema.

Agreements come from two places: an owner accepting online when listing (`accepted_via = 'online form'`), or a team member recording one for a
property the company sourced itself (`accepted_via = 'recorded by team'`, with who recorded it and a note and optional file as proof; function
`attach_owner`). Both satisfy the release gate; the second is an attestation recorded under the team member's name in the history.

Also built: a customer can ask to inspect a chosen property (date and time of day); the team confirms a time after the contact is released
(`confirm_inspection`: status moves to Inspection Scheduled, customer and owner are both emailed); customers follow their enquiry on
`/track/<private link>` or with reference and email on `/track`, which never show owner contact details or fees. The dashboard Team,
Website content (with Fees) and Traffic pages are real (migration 0007).

Not built yet: The sections below are the original design and still apply, reading "Supabase tables" wherever they say "n8n Data Tables".

## Storage: n8n Data Tables
| Table | One row per | Key columns |
|---|---|---|
| `owners` | owner account | ownerId, name, email, whatsapp |
| `agreements` | accepted agreement | ownerId, listingId, version, acceptedAt, listingFee, feePct, feeDue, protectionMonths, paymentReference |
| `listings` | property | listingId, ownerId, purpose, status, submitted fields |
| `leads` | introduction | leadId, kind, customer name/email/phone, emailVerifiedAt, listingId, ownerId, source, introducedAt, customerAckAt, ownerAckAt, releasedAt, status, completion fields, invoice status, receipt |
| `email_codes` | pending verification | email, codeHash, expiresAt, attempts |
| `audit` | event | leadId, at, actor, action, detail. **Append only: no workflow updates or deletes rows here.** |

## Workflows
1. **Lead API** (extends the existing `JILrnB7YXeag8oAk`)
   - `request-code`: validate enquiry, email a 6-digit code (10 minute expiry, 5 attempts).
   - `register`: check the code, create the Lead ID, write `leads` + `audit`, keep writing the Google Sheet row, email the team. Returns `{ leadId, message }`.
   - New input fields (today they travel inside `specialRequirement`): `listingId`, `source`, `acknowledged`, `moveInDate`, `facilities`, `assistance`.
2. **Listing API**: receives the List Property form after the listing fee is verified; writes `owners`, `agreements`, `listings`; emails the team "new property submission, check the dashboard".
3. **Admin API** (called only by authenticated dashboard routes)
   - `list-leads` (filters: property, owner, customer, dates, type, status), `get-lead` (with audit).
   - `request-owner-ack`: emails the owner a one-time link to acknowledge the introduced customer.
   - `release-contact`: **refuses unless** email verified, customer acknowledgement, accepted agreement, owner acknowledgement and a linked property all exist. Then emails the owner's WhatsApp and email to the customer and records `releasedAt`.
   - `set-status`, `report-completion`, `verify-completion`, `issue-invoice`, `confirm-payment` (issues the receipt). A success status needs a verified completion; an invoice needs a verified completion; the fee is `final price × feePct` from the lead's stored agreement.
4. **Party API** (links in emails, signed one-time tokens): owner acknowledgement, follow-up answers, owner completion report with evidence.
5. **Follow-ups** (Schedule trigger, daily): after release and after inspection, email both sides asking whether the inspection took place and whether the deal completed; remind them to update; write answers to `audit`; flag conflicting answers; flag "possible unreported deal" when contact was released, follow-ups go unanswered and the listing is withdrawn or marked taken.

Every workflow ends in Respond to Webhook with the contract shape on every path, including errors.

## Not decided / needed before go-live
- Dashboard login (the admin has no login yet; Admin API must not be reachable without one).
- Evidence file storage (n8n data tables hold text, not files).
- The full legal text of the Property Listing and Agency Agreement (the site shows a summary of key terms only).
- Data-protection notice and retention period for customer records.
