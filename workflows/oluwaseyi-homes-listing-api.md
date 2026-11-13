# Oluwaseyi Homes & Properties - Listing API

- **n8n workflow:** `JILrnB7YXeag8oAk`, "Oluwaseyi Homes & Properties". This file covers its **Listing webhook** trigger. Saved copy: `oluwaseyi-homes-and-properties.json`. (The separate workflow `7Lh4KwnJajRMmXLc` it started in is switched off and can be deleted.)
- **Trigger:** Webhook, `POST`, JSON body, Header Auth (same credential as the Lead API), `responseMode: responseNode`
- **Path:** `/webhook/oluwaseyi-homes-listing` (set in `N8N_LISTING_WEBHOOK_URL`)
- **Called by:** `src/app/api/listings/route.ts` only, after it has verified the Paystack payment and found the uploaded photos.
- **Stores in:** Supabase through the database function `submit_listing` (owner, accepted agreement, submission, photo paths, history).
- **Needs:** `supabase/migrations/0003_submissions.sql` applied, and the n8n credential "Oluwaseyi Homes Supabase".

## What happens before n8n is called
1. The owner fills the List Property form and accepts the agreement.
2. The owner pays the listing fee in the Paystack window (public key in the browser).
3. `POST /api/listings { step: "prepare", paymentReference, count }`: the server verifies the payment with Paystack (secret key),
   refuses a reference that was already used, and returns one-time upload links. Photos go straight to the private `submissions` bucket under `sub/<reference>/`.
4. `POST /api/listings { ...form, details, paymentReference }`: the server validates the form, verifies the payment again, lists the uploaded photos, and calls this workflow.

## Request
```json
{
  "purpose": "Rent", "relationship": "Landlord (confirmed)",
  "fullName": "Mr Bello", "email": "bello@example.com", "phone": "08031234567",
  "propertyType": "Apartment", "address": "1 Test Street", "neighbourhood": "Yaba, Lagos", "bedrooms": "2",
  "askingAmount": 1000000, "legalFee": 50000, "cautionPct": 5, "serviceCharge": 100000, "serviceCovers": "Security",
  "facilities": ["Prepaid meter", "CCTV"], "parking": "Two cars", "security": "Gated street", "inspection": "Saturdays",
  "videoLink": "", "description": "…", "details": { "furnishing": "Furnished" },
  "photos": ["sub/<reference>/0.jpg", "sub/<reference>/1.jpg"],
  "paymentReference": "<Paystack reference>", "agreementVersion": "2026-11",
  "listingFee": 5000, "feePct": 10, "feeDue": "Only after a tenant…", "protectionMonths": 12
}
```
Required: purpose (Rent/Sell), fullName, email, phone, propertyType, address, neighbourhood, relationship, paymentReference,
agreementVersion, feeDue; numbers above zero for askingAmount, listingFee, feePct, protectionMonths; 1 to 8 photos.

## Response (always `{ success, data, error }`)
| Case | Status | Body |
|---|---|---|
| Stored | 200 | `{"success":true,"data":{"reference":"OHP-S-000002","message":"Thank you. We have received your property and your listing fee…"},"error":null}` |
| Missing or invalid field | 400 | error lists the fields |
| Payment reference already used | 409 | "This payment has already been used for a property…" |
| Supabase unreachable | 500 | "We could not save your property just now. Your payment is recorded…" |

## Flow
Webhook → Check submission → Valid submission? → Store submission (Supabase function) → Stored? → Respond 200 → Email team.
Invalid → Respond 400. Function says no → Respond 409. Supabase call fails → Respond 500.
The team email says only "new property submission, check the dashboard" with the reference: no personal details. It is sent after the response, so an email problem never changes what the owner sees.

## Config
Team email and dashboard link are in the `CONFIG` object at the top of the "Check submission" Code node.
The Supabase project URL is in the "Store submission" node (the saved JSON has a placeholder instead).
