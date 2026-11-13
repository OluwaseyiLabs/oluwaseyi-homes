import { site } from "./site";

/**
 * Every piece of wording on the public site, in one place. The admin
 * "Website content" page edits these; with the database connected they load
 * from it and these become the defaults.
 */
export const content = {
  heroHeading: "Your Next Property, Made Easier.",
  heroText:
    "Whether you want to rent, buy, invest, or list a property, we make it easy to find what you need. Discover verified properties, connect directly with property owners, explore investment opportunities, and enjoy transparent pricing every step of the way.",
  heroButton: "See available properties",
  statement:
    "We make it easy to rent, buy, invest in, or list a property. Find the right property, connect directly with owners, and know exactly what you're paying. No hidden charges or unnecessary middlemen.",
  propertiesHeading: "Check out our available properties",
  listHeading: "Have a property to sell or let?",
  listText: "List it with us. Send the details below. The fees are shown before you submit, and nothing is hidden.",
  howHeading: "How it works.",
  steps: [
    { title: "Choose a property", text: "Browse for free. See the price and every charge, then send an enquiry about the one you want." },
    { title: "Get the landlord's contact", text: "We review your enquiry. Once it is approved, we email you the landlord's WhatsApp number and email address." },
    { title: "Deal directly", text: "You and the landlord agree the terms yourselves. The agency fee is paid by the landlord, not the tenant. Extra help is optional." },
  ],
  enquiryHeading: "Tell us what you need.",
  enquiryText: "Fill in the form. Once we approve your enquiry, we email you the landlord's contact details.",
  footerLine: `${site.name}. Lagos, Nigeria.`,
};
