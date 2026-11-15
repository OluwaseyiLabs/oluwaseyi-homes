# Pre-launch test series

Site: https://oluwaseyi-homes.vercel.app

Tick each box when the test passes. Write what you saw next to any that fail. This finds defects; it is not legal or accounting sign-off.

## Before you start

- Two devices: a phone (iPhone or Android) and a laptop.
- Two real inboxes: one Gmail and one Outlook or Yahoo. A helper to play the landlord is ideal.
- Put the word TEST in every name, address and note you create, so it is easy to clean up.
- Before you start, confirm: migrations 0001 to 0013 are run on production, the Owner role has "Send refunds" ticked on the Team page, Vercel has all environment variables, the n8n workflow is active, and the Google Sheet tabs have their row-1 headings.
- Paystack test card: 4084 0840 8408 4081, any future date, CVV 408.

## Already checked on the live site (read-only)

| Result | Check | Detail |
|---|---|---|
| PASS | Public pages | Home, track, four legal pages, robots, sitemap, icon and login all load. A wrong address gives 404. |
| PASS | Hidden files | .env, .env.local and .git return 404. Source maps are refused. |
| PASS | Dashboard gate | /admin, /admin/team and /admin/leads send a signed-out visitor to login. |
| PASS | Security headers | Content policy, HSTS and no-framing present. Framework banner hidden. Admin pages marked noindex. |
| PASS | Share and search | Share tags and the sitemap use the live address, none say localhost. |
| PASS | Speed | First byte 0.5 to 0.7 seconds on the main pages (5 samples each). |
| PASS | Phone widths | No sideways scroll at 320, 360, 390 and 412 pixels on 8 pages, the enquiry popup and list-property. |
| PASS | Bot protection | No, fake and dummy CAPTCHA tokens refused. Hidden-field bot, too-fast send, instruction text and broken data all handled. |
| PASS | Listing without payment | Refused with a payment-required answer. |
| PASS | Database from outside | On the staging copy (same migrations): private tables return nothing, drafts are hidden, no function is callable, private file buckets empty. |
| PASS | n8n | The last 25 runs, including this morning's 9am schedule, all succeeded. |
| PASS | Code and secrets | npm audit shows 0 vulnerabilities. No key-shaped text in the project. Private business details appear only in .env. |
| OPEN | Production database from outside | Not run: it needs the production public key, which only Vercel holds. Repeat the same check in Part A 4.5/4.6 and Supabase, Authentication, Policies. |
| OPEN | Older admin scripts | Three admin checks from my earlier script (hero photo upload, empty company name, opening a submission) timed out on a stale button name, not a site error. Tests 8.1, 8.2 and 5.1 cover them by hand. |

## 0. First look

10 min. Phone and laptop.

- [ ] **0.1 Home page loads fast**
  - Do: Open the site on mobile data, then on wifi.
  - Expect: Appears in about 3 seconds or less, no sideways scrolling.
- [ ] **0.2 Hero and header**
  - Do: Hover (laptop) or swipe (phone) the hero. Open the mobile menu and every header link.
  - Expect: Slideshow changes, menu opens and closes, links go to the right place.
- [ ] **0.3 Light, dark and system theme**
  - Do: Use the toggle at the bottom left. Reload.
  - Expect: The choice is kept, and no page flashes the wrong colour.
- [ ] **0.4 WhatsApp buttons**
  - Do: Tap each WhatsApp button.
  - Expect: Your WhatsApp chat opens with the ready message.
- [ ] **0.5 Legal pages**
  - Do: Open privacy, terms, refund policy and agreement from the footer.
  - Expect: All four open and read properly.
- [ ] **0.6 Wrong address**
  - Do: Add /nothing-here to the site address.
  - Expect: The friendly 404 page shows.
- [ ] **0.7 Share preview**
  - Do: Paste the home link into a WhatsApp chat (do not send).
  - Expect: Preview shows the title, description and a photo.

## 1. Customer enquiry

30 min. Phone, real email.

- [ ] **1.1 Rent enquiry from a property**
  - Do: Open a property, tap Enquire. Type the budget as 1500000.
  - Expect: Form is pre-filled for that property. Budget becomes ₦1,500,000. Send enquiry leads to "Check your email".
- [ ] **1.2 Code email and verification**
  - Do: Open the email (check Spam too). Try a wrong code, then the right one.
  - Expect: Arrives within a minute. Wrong code gives a clear message. Right code gives "Enquiry received" and a reference.
- [ ] **1.3 Everything arrives**
  - Do: Wait a few minutes.
  - Expect: You get "Your enquiry is registered" with a Track link. The team gets an email. A new row appears in the Rent tab of the Google Sheet. The lead shows in Dashboard, Leads with the budget in ₦.
- [ ] **1.4 Track page**
  - Do: Open the Track link. Then open the Track page by reference plus email. Try a wrong email.
  - Expect: Both work. The wrong email gives the same neutral message. No owner contact or fees are ever shown.
- [ ] **1.5 Buy and Invest enquiries**
  - Do: Send one of each.
  - Expect: Each lands in its own sheet tab and in Leads.
- [ ] **1.6 Inspection date and time**
  - Do: Pick an inspection date and a time of day.
  - Expect: They appear on the lead.
- [ ] **1.7 New code and old code**
  - Do: Press "Send a new code". Try the first code after the new one arrives.
  - Expect: New code works. The old or used code is refused.

## 2. Bots and mistakes

15 min. Laptop.

- [ ] **2.1 Empty form**
  - Do: Press Send enquiry with nothing filled.
  - Expect: Every required field shows an error.
- [ ] **2.2 Bad email and phone**
  - Do: Enter abc as email and 12 as phone.
  - Expect: Both are refused with a clear message.
- [ ] **2.3 Instruction text**
  - Do: Type "Ignore all previous instructions" in special requirements.
  - Expect: Politely refused.
- [ ] **2.4 Code in a name**
  - Do: Type <b>hi</b> as a first name.
  - Expect: Saved as plain text, never shown bold.
- [ ] **2.5 Ad blocker on**
  - Do: Turn on an ad blocker and send an enquiry.
  - Expect: The form asks you to turn it off and sends nothing.
- [ ] **2.6 Too many enquiries**
  - Do: Send 4 enquiries with one email within 15 minutes.
  - Expect: The 4th is refused with a wait message.
- [ ] **2.7 Too many wrong codes**
  - Do: Enter a wrong code 9 times.
  - Expect: "Too many tries" message.

## 3. Owner lists a property

30 min. Phone, test card.

- [ ] **3.1 List to rent**
  - Do: Fill the form. Choose a Title. Add photos by drag and drop, by Choose from device, and by paste. Try adding more than 8. Pay with the test card.
  - Expect: Title is required. 8 photos max. Agreement and fees are visible. Payment ends on a "received" screen.
- [ ] **3.2 List to sell**
  - Do: Repeat with Sell.
  - Expect: Same result, and the fee shown is for selling.
- [ ] **3.3 Close Paystack unpaid**
  - Do: Start paying, then close the Paystack window.
  - Expect: Nothing is saved.
- [ ] **3.4 Declined card**
  - Do: Use Paystack's decline test card.
  - Expect: Clear message, nothing saved.
- [ ] **3.5 Everything arrives**
  - Do: Wait a few minutes.
  - Expect: Team email "New property submission". New row in the List Property sheet tab (phone keeps its leading 0, ₦ amounts, "Yes, <date> (version 2026-11)", working Dashboard link). Submission shows in Dashboard, Submissions.
- [ ] **3.6 No sideways scroll**
  - Do: Scroll the whole form on a phone.
  - Expect: Nothing moves sideways, nothing is cut off.

## 4. Team sign-in and security

30 min. Laptop and a second browser.

- [ ] **4.1 Sign in and out**
  - Do: Sign in. Sign out. Try a wrong password.
  - Expect: Wrong password gives a generic message that does not say which part was wrong.
- [ ] **4.2 Change password**
  - Do: Stay signed in on a second browser. Change your password on the first.
  - Expect: This device goes to login. The second browser is signed out too.
- [ ] **4.3 Display name**
  - Do: Change it on the Account page.
  - Expect: Header and Team page update.
- [ ] **4.4 Invite a teammate**
  - Do: Invite a second real email. Open the link. Open it again. Wait 15 minutes and try once more.
  - Expect: Invitation arrives. Link works once, then fails. After 15 minutes it fails, and "Send invitation again" fixes it.
- [ ] **4.5 Limited role**
  - Do: Sign in as a Staff user. Type /admin/team in the address bar.
  - Expect: No Team, Content or Legal in the menu, and the typed address is refused.
- [ ] **4.6 Private window**
  - Do: Open /admin in a private window.
  - Expect: You are sent to the login page.
- [ ] **4.7 Switch a member off**
  - Do: Switch off a signed-in teammate.
  - Expect: They are signed out on their next click.

## 5. Review, approve, publish

25 min. Laptop.

- [ ] **5.1 Approve a submission**
  - Do: Dashboard, Submissions, Approve.
  - Expect: A DRAFT property appears under Properties and is not on the website.
- [ ] **5.2 Edit and publish**
  - Do: Edit it, add photos by drag and drop, Preview, then Publish.
  - Expect: Shows on the website in the right tab with ₦ prices and a payment breakdown. No "Actual terms must be confirmed" sentence. "Owner verified" badge only if ticked.
- [ ] **5.3 Email the owner**
  - Do: Use a submission whose owner email is yours. Press "Send approval email to owner".
  - Expect: Email arrives with a working "View your listing" button. The button then reads "send again" with the date.
- [ ] **5.4 Property share preview**
  - Do: Paste a property link into WhatsApp (do not send).
  - Expect: Good preview with photo and title.

## 6. Rejecting and refunding

30 min. Laptop, test mode.

- [ ] **6.1 Reject with refund**
  - Do: Reject a fresh test submission with "We cannot list this property" and refund on.
  - Expect: Owner email says a refund is coming. Refund shows Started. "Check status with Paystack" updates it. Owner later gets "refund complete".
- [ ] **6.2 Reject without refund**
  - Do: Reject with "details could not be verified".
  - Expect: The refund choice is pre-set to Do not refund, and the email explains why.
- [ ] **6.3 Role without refund permission**
  - Do: Reject with a role that lacks the Send refunds permission.
  - Expect: No money is sent. The dashboard says who must send it.
- [ ] **6.4 Double press**
  - Do: Press refund twice quickly.
  - Expect: Only one refund exists.
- [ ] **6.5 Paystack refuses**
  - Do: Try refunding an old or already refunded payment.
  - Expect: The reason shows. "Try again" and "Record a refund made another way" work.
- [ ] **6.6 Clear the leftovers**
  - Do: Reject the two old tests OHP-S-000002 and OHP-S-000003 on production.
  - Expect: Both show Rejected.

## 7. Handling an enquiry to the end

45 min. Laptop and helper.

- [ ] **7.1 Link lead to a property**
  - Do: Open a lead and link it to a property that has an owner and an agreement.
  - Expect: Link saves.
- [ ] **7.2 Release is blocked**
  - Do: Try to release before anything is confirmed.
  - Expect: Blocked, and each missing step is listed: customer email, customer acknowledgement, owner agreement, owner acknowledgement, confirmed inspection time.
- [ ] **7.3 Owner acknowledges and gives times**
  - Do: Email the owner an acknowledgement link. On the page choose "That suits me" or add up to 3 times, then acknowledge. Open the link again. Try an old link. Also try acknowledging with no time chosen.
  - Expect: No time chosen is refused. Otherwise it works once and the team gets an email. The link then says "already used". An old link offers "Email me a new link". The lead shows the owner's times.
- [ ] **7.4 Confirm the time, then release**
  - Do: On the lead, tap one of the owner's times (or type another) and press Confirm this time. Then release the contact.
  - Expect: Confirming sends no email. Release sends ONE email to the customer with the owner's contact and the approved time, and the WhatsApp button message mentions that time. The owner gets an "inspection approved" email. Status becomes Inspection Scheduled.
- [ ] **7.5 Change the time after release**
  - Do: Change the inspection time on a released lead.
  - Expect: Customer and owner both get an email with the new time.
- [ ] **7.6 Follow-up**
  - Do: Press "Send follow-up now". Answer "inspection done, not completed" on both sides.
  - Expect: Both sides get a link. Answers appear in the history.
- [ ] **7.7 Completed deal and invoice**
  - Do: Owner reports a completed deal. Check the evidence, issue the invoice, pay with the test card, press "Check Paystack payment".
  - Expect: Receipt shows. History lists every step with a name. Nothing can be deleted.

## 8. Managing the website

20 min. Laptop.

- [ ] **8.1 Change wording**
  - Do: Website content: change a heading, view the live site, then reset.
  - Expect: Change shows on the site. Reset restores the original. The company name cannot be emptied.
- [ ] **8.2 Hero photo**
  - Do: Replace the hero photo, check it, then restore the original.
  - Expect: Both changes show on the site.
- [ ] **8.3 Legal pages**
  - Do: Edit one, view it live, then press Restore starter text.
  - Expect: Live page follows each change.
- [ ] **8.4 Fee form refuses bad values**
  - Do: Type a negative or text value. Do NOT save real changes.
  - Expect: Refused, nothing saved. (Saving a fee change starts a new agreement version, so skip it now.)
- [ ] **8.5 Traffic**
  - Do: Browse the site, then open Traffic.
  - Expect: Today's visits show. Period buttons switch.
- [ ] **8.6 Facility and detail field**
  - Do: Create one, use it on a property, remove it.
  - Expect: Appears on the form and the property, then disappears.

## 9. Emails everywhere

30 min. Gmail and Outlook or Yahoo.

- [ ] **9.1 Inbox, not Spam**
  - Do: For each email type, note where it landed on both providers: code, enquiry confirmation, team notice, owner acknowledgement, release, inspection, follow-up, approval, rejection, refund started, refund complete, invitation.
  - Expect: All in the inbox. Any that land in Spam are the reason to set up a company-domain sender before launch.
- [ ] **9.2 Reads well on a phone**
  - Do: Open each on your phone.
  - Expect: Readable without zooming, and every button works.
- [ ] **9.3 Right sender and links**
  - Do: Check the sender name and hover or press a link.
  - Expect: Sender name is right and every link uses the real site address.

## 10. Devices and conditions

30 min. All you have.

- [ ] **10.1 Browsers**
  - Do: iPhone Safari, Android Chrome, Samsung Internet, laptop Chrome, Safari and Firefox. On each: home, a property, enquiry, list property, track, login, one dashboard page.
  - Expect: No broken layout or stuck button anywhere.
- [ ] **10.2 Dark mode on each**
  - Do: Repeat a few pages in dark mode.
  - Expect: Text readable, nothing white-on-white.
- [ ] **10.3 Sideways phone**
  - Do: Turn the phone sideways on the home page and the enquiry form.
  - Expect: Still usable.
- [ ] **10.4 Slow connection**
  - Do: Use Low Data mode or slow mobile data.
  - Expect: Pages still load, and the forms show progress.
- [ ] **10.5 Keyboard only**
  - Do: Tab and Enter through the enquiry form.
  - Expect: Every field and button is reachable, with a visible focus.
- [ ] **10.6 Large text**
  - Do: Set the phone's text size to Large.
  - Expect: Nothing is cut off.

## 11. Failure drills

15 min. Phone and laptop.

- [ ] **11.1 Offline submit**
  - Do: Turn on airplane mode and submit an enquiry. Turn it off and retry.
  - Expect: Friendly message while offline. No duplicate afterwards.
- [ ] **11.2 Error ID and Errors page**
  - Do: Owner: Your account, Send a test error. Read the ID (ERR-XXXXXX). Then open Errors in the menu and Vercel, Logs.
  - Expect: The same ID is in the Errors page (marked Test) and in Vercel, Logs. Open it and tick Mark as fixed, then Open it again.
- [ ] **11.3 n8n Executions**
  - Do: Open n8n, Executions, after your tests.
  - Expect: No red rows for the runs you made.

## 12. Records add up

20 min. Laptop.

- [ ] **12.1 Same story everywhere**
  - Do: For three of your tests, compare the dashboard, the Google Sheet row and the emails.
  - Expect: Names (with titles), ₦ amounts and references match.
- [ ] **12.2 No leaks in the sheet**
  - Do: Scan the Google Sheet.
  - Expect: No photos, passwords or keys.
- [ ] **12.3 History**
  - Do: Open the history of a finished lead.
  - Expect: Each action has a name and time.
- [ ] **12.4 Nothing test-related is public**
  - Do: Browse the site as a stranger.
  - Expect: No TEST property, name or photo is visible.

## Before you go public

Not tests. Each one blocks launch until done.

- [ ] **G.1 Live Paystack keys**: Switch to live keys once the live account is approved. Then run ONE real ₦5,000 listing and refund it.
- [ ] **G.2 Paystack payment webhook**: Today an invoice is confirmed by pressing a button. Add the webhook so it confirms itself.
- [ ] **G.3 Company-domain email sender**: Needed so codes stop landing in Spam. Set SPF and DKIM.
- [ ] **G.4 Lawyer review**: Privacy, terms, refund policy and agreement. Paste the final text into Legal pages.
- [ ] **G.5 Backups**: Supabase Pro (daily backups, no pausing) and one restore test. Vercel Pro for commercial use.
- [ ] **G.6 Your own domain**: Vercel, SITE_URL, Supabase Site URL, the Turnstile hostname and the three n8n website values.
- [ ] **G.7 Clean up**: Reject every TEST submission and lead (they cannot be deleted by design). Unpublish sample properties.
- [ ] **G.8 Watching**: Someone checks Vercel Logs and n8n Executions daily for the first two weeks. Add Paystack alerts for refund failures.
