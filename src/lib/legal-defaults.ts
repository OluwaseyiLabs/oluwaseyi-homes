import type { LegalSlug } from "./legal";

// Starter text, shown until a page is edited under Legal pages in the dashboard.
// Formatting: "## " heading, "### " smaller heading, "- " list item, **bold**. A blank line starts a new paragraph.
// These are plain-language drafts, not legal advice: have a Nigerian lawyer review them before launch.

export const LEGAL_DEFAULTS: Record<LegalSlug, { title: string; body: string }> = {
  privacy: {
    title: "Privacy Policy",
    body: `{company} ("we", "us") connects people who want to rent or buy property with property owners in Lagos, Nigeria. This policy explains what personal information we collect, why, who sees it, and your rights under the Nigeria Data Protection Act 2023.

## What we collect
**If you enquire about a property:**
- your name, email address and phone number;
- what you are looking for: type of property, area, budget, move-in date, facilities, any note you write, and an inspection date and time of day if you ask for one;
- where you came from on the internet (for example "Instagram"), so we know which channels work.

**If you list a property:**
- your name, phone number and email address, and whether you are the owner or a middleman;
- the property's address, details, price and photos;
- the payment reference of your listing fee, and your acceptance of our agreement with the date and version.

**When you visit the website:** we count visits without cookies. We keep the page visited, the kind of device, the website you came from, and a visitor mark that changes every day. We do not store your IP address, and nobody can be followed from one day to the next.

## Why we use it
- to send you a 6-digit code to confirm your email, so that nobody enquires in your name;
- to review your enquiry or listing and, once it is approved, introduce you to the other side;
- to send the follow-up emails and links that belong to your enquiry or listing, and to keep a record of each introduction;
- to issue invoices and receipts, and to confirm that fees owed to us are paid;
- to keep the website safe and stop spam;
- to meet our legal and accounting duties.

Our lawful bases are your consent (when you tick the box and send a form), performing the service you asked for, our legitimate interest in running and protecting the business, and legal obligation.

## Who sees it
- **The other party.** When we approve an enquiry, the owner's contact details are sent to the customer, and the owner is told the customer's name and enquiry. That is the whole purpose of the service. We do this only after the steps in our Terms of Use are complete.
- **Our team**, through a password-protected dashboard, according to each person's role.
- **Companies that help us run the service:** Supabase (database and file storage), Paystack (payments; we never see or store your card details), Google (the Gmail account and spreadsheet that send and record our emails) and our hosting provider. They process information only for us.
- Authorities, when the law requires it.

We do not sell your information.

## How long we keep it
Records of introductions, agreements, invoices and their history are kept permanently by design, because they prove who introduced whom and what was agreed, and we may owe them to you, to a customer or to a tax authority. Other information, such as visit counts, is kept only as long as it is useful.

## Your rights
You can ask us to give you a copy of your information, correct it, stop using it for a purpose, or delete it. We delete what we are allowed to; records we must keep (see above) are kept, but we restrict how they are used. You can withdraw your consent at any time, though this does not undo what already happened. If you are unhappy with how we handled your information, you can complain to the Nigeria Data Protection Commission.

To use any of these rights, message us on WhatsApp at {whatsapp}.

## Security
Sensitive links in our emails work once and expire quickly, the database stores only a scrambled version of them, dashboard accounts are protected by passwords and short-lived sign-ins, and we limit repeated attempts on our forms. No system is perfectly safe, so please tell us at once if you think something went wrong.

## Children
This service is for adults. We do not knowingly collect information from anyone under 18.

## Changes
We may update this policy. The date at the top of this page shows when it last changed.`,
  },

  terms: {
    title: "Terms of Use",
    body: `By using the {company} website you agree to these terms. If you do not agree, please do not use it.

## What we do
We are a go-between. We show properties, we introduce customers to the people who own them, and we help both sides reach a deal. We are not the owner, landlord or seller of any property listed, and we are not a party to a tenancy or sale between a customer and an owner.

## For customers
- Fill in the enquiry form truthfully. We send a 6-digit code to your email address to confirm it is yours.
- The owner's contact details are released to you only after your email is confirmed, you have acknowledged that the introduction comes from us, the owner has accepted our agreement and acknowledged you, and our team has approved your enquiry.
- **You are not charged by us for being introduced.** Any rent, deposit or other payment under a tenancy or sale is between you and the owner. Never pay anyone before inspecting the property and checking their documents.
- Do not use an introduction from us to deal with the owner behind our back to avoid the fees the owner owes us.

## For owners and agents
- You may list a property only if you are the owner or are authorised by the owner. Listing details and photos must be true and must be yours to share.
- Listing fee: {listingFee}, paid when you list. Our Refund Policy says when it is returned.
- Agency fee on a rental: {agencyFeePct} of the annual rent, paid by the landlord, only after a tenant we introduced is secured. Nothing is due if no tenant is secured.
- Commission on a sale: {saleCommissionPct} of the final price, paid by the seller.
- Protection period: if a customer we introduced rents or buys the property within {protectionMonths} months of the introduction, the fee is due even if the deal is completed away from us.
- You confirm each introduction before contact details are released, and tell us when the property is rented or sold. The full terms are in the Property Listing and Agency Agreement you accept when you list.

## What you may not do
- give false information, or use another person's name or email;
- send spam, malicious code or messages meant to harm or trick people or our systems;
- try to get into the dashboard or other areas that are not public;
- copy our listings in bulk, or use the website for anything unlawful.

## Properties and information
We try to keep listings accurate, but we rely on owners for the details. Photos and descriptions are not a promise. Please inspect a property and check the documents yourself before you commit to anything.

## Our responsibility
We do our best to run a reliable service, but we do not promise that it will always be available or free of mistakes. To the extent the law allows, we are not responsible for deals between customers and owners, for loss that comes from the information of a third party, or for indirect losses. Nothing here limits anything that cannot lawfully be limited.

## Privacy
How we use personal information is explained in our Privacy Policy.

## Changes and law
We may update these terms, and the date at the top of the page shows the latest change. Using the website after a change means you accept it. These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Lagos State have jurisdiction.

## Contact
Message us on WhatsApp at {whatsapp}.`,
  },

  refunds: {
    title: "Refund Policy",
    body: `This policy covers the listing fee of {listingFee} that an owner pays when listing a property with {company}.

## What the listing fee pays for
The fee pays for us to review your submission, create and publish your property page with its photos, and promote it on the website. It is not a deposit and is not part of any agency fee or commission, which are charged separately and only when a deal is done.

## You get a full refund if
- we decline your submission, or ask for changes you cannot reasonably make, and your property is not published;
- your property is not published within 7 days of your payment, for a reason on our side;
- you paid twice for the same property, or the amount charged was wrong.

## The fee is not refunded if
- your property has been published, and you later decide to remove it or to deal with the property another way;
- we could not publish it because the information or photos you gave were false, or you were not the owner or an authorised agent;
- the same property is listed again by you and rejected as a duplicate.

## Agency fee and commission
These are never taken in advance. Nothing is due on a rental unless a tenant we introduced is secured, and nothing on a sale unless the property is sold to a customer we introduced. If no deal is done, there is nothing to refund.

## How to ask
Message us on WhatsApp at {whatsapp} within 7 days of your payment with your payment reference and the property address. We reply within 3 working days.

## How you are paid back
Approved refunds go back to the card or account you paid with, through Paystack, normally within 5 to 10 working days of approval. Your bank may take longer to show it.`,
  },

  agreement: {
    title: "Property Listing and Agency Agreement",
    body: `This agreement is between {company} ("we") and the person who lists a property with us ("you"), and takes effect when you tick the box to accept it on the List Property form. Each acceptance is recorded with its date and the version of the agreement, together with the fees as they stood at that time.

## 1. What we do for you
We publish your property on our website, receive enquiries from customers, confirm each customer's email address, introduce suitable customers to you, and help you reach a deal. We do not become a party to the rental or sale itself.

## 2. What you promise
- You are the owner of the property or are authorised by the owner to list it, and you will give us proof if we ask.
- All information and photos you give us are true and you may share them.
- You will tell us promptly when the property is rented, sold or taken off the market.
- You will confirm that you have received each customer we introduce before we release your contact details to them.

## 3. Fees
- **Listing fee:** {listingFee}, paid by you through Paystack when you list. The Refund Policy says when it is returned.
- **Rentals:** {agencyFeePct} of the annual rent, paid by the landlord, only after a tenant introduced by us is secured. Tenants are not charged this fee.
- **Sales:** {saleCommissionPct} of the final agreed price, paid by the seller.
- The fee is worked out from the final agreed rent or price.
- Tenant assistance, where offered, is optional and the price is confirmed before you agree to it.

## 4. Introductions and protection period
Every customer we introduce to you is recorded with a Lead ID. If that customer rents or buys this property within {protectionMonths} months of the introduction, the fee in section 3 is due even if the deal is completed away from us, directly or through another person.

## 5. Reporting and payment
We follow up by email with you and the customer to ask whether the inspection took place and whether the deal was completed. If you report a completed deal, we check the details and, once checked, send an invoice. The invoice is paid through Paystack, and we issue a receipt when we have verified the payment.

## 6. Contact details
We release your contact details only to customers who have confirmed their email, acknowledged that the introduction comes from us, and whom our team has approved. We handle personal information as described in our Privacy Policy.

## 7. Records
Introductions, agreements, invoices and their history are kept permanently and cannot be deleted. They are our evidence if a question arises about who introduced whom.

## 8. Ending the arrangement
You may remove your property at any time. Sections 3, 4, 5 and 7 continue to apply to customers we introduced before you removed it.

## 9. Disputes and law
We will first try to settle any disagreement by talking to you. If we cannot, the laws of the Federal Republic of Nigeria apply and the courts of Lagos State have jurisdiction.

## 10. Changes
If we change fees or this agreement, the version number changes. A change applies to properties you list after it, and the terms you accepted earlier stay as they were when you accepted them.`,
  },
};
