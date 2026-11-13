import { content as defaultContent } from "./content";
import { site as defaultSite } from "./site";

/** The company details and wording shown on the website. The live values are in the database (edited under Website content). */
export interface SiteContent {
  site: { name: string; description: string; whatsapp: string; whatsappLabel: string; heroImage: string };
  content: typeof defaultContent;
}

export interface ContentField {
  key: string;
  label: string;
  long?: boolean;
  section: "Company" | "Top of the page" | "Animated statement" | "Properties section" | "How it works" | "Enquiry and footer";
}

/** Every editable piece of wording, in the order the admin form shows them. */
export const CONTENT_FIELDS: ContentField[] = [
  { key: "name", label: "Company name (the logo text)", section: "Company" },
  { key: "description", label: "Short description for Google and link previews", long: true, section: "Company" },
  { key: "whatsapp", label: "WhatsApp number, digits only with country code (for example 2348012345678)", section: "Company" },
  { key: "whatsappLabel", label: "WhatsApp number as shown to visitors", section: "Company" },
  { key: "heroHeading", label: "Heading", section: "Top of the page" },
  { key: "heroText", label: "Text under the heading", long: true, section: "Top of the page" },
  { key: "heroButton", label: "Main button", section: "Top of the page" },
  { key: "statement", label: "Statement", long: true, section: "Animated statement" },
  { key: "propertiesHeading", label: "Heading", section: "Properties section" },
  { key: "listHeading", label: "List Property heading", section: "Properties section" },
  { key: "listText", label: "List Property text", long: true, section: "Properties section" },
  { key: "howHeading", label: "Heading", section: "How it works" },
  ...[1, 2, 3].flatMap((n) => [
    { key: `step${n}Title`, label: `Step ${n} title`, section: "How it works" as const },
    { key: `step${n}Text`, label: `Step ${n} text`, long: true, section: "How it works" as const },
  ]),
  { key: "enquiryHeading", label: "Enquiry heading", section: "Enquiry and footer" },
  { key: "enquiryText", label: "Enquiry text", section: "Enquiry and footer" },
  { key: "footerLine", label: "Footer line", section: "Enquiry and footer" },
];

/** The built-in wording, flattened to the same keys the database uses. */
export function defaultValues(): Record<string, string> {
  const d = defaultContent;
  return {
    name: defaultSite.name,
    description: defaultSite.description,
    whatsapp: defaultSite.whatsapp,
    whatsappLabel: defaultSite.whatsappLabel,
    heroImage: "/images/hero.jpg",
    heroHeading: d.heroHeading,
    heroText: d.heroText,
    heroButton: d.heroButton,
    statement: d.statement,
    propertiesHeading: d.propertiesHeading,
    listHeading: d.listHeading,
    listText: d.listText,
    howHeading: d.howHeading,
    step1Title: d.steps[0].title, step1Text: d.steps[0].text,
    step2Title: d.steps[1].title, step2Text: d.steps[1].text,
    step3Title: d.steps[2].title, step3Text: d.steps[2].text,
    enquiryHeading: d.enquiryHeading,
    enquiryText: d.enquiryText,
    footerLine: "",
  };
}

/** Database rows laid over the built-in wording. A key with no row, or an empty one, keeps the built-in text. */
export function mergeSiteContent(rows: { key: string; value: string }[]): SiteContent {
  const v = defaultValues();
  for (const r of rows) if (r.key in v && r.value.trim()) v[r.key] = r.value;
  // The footer follows the company name unless it has been written out.
  const footerLine = v.footerLine || `${v.name}. Lagos, Nigeria.`;
  return {
    site: { name: v.name, description: v.description, whatsapp: v.whatsapp, whatsappLabel: v.whatsappLabel, heroImage: v.heroImage },
    content: {
      heroHeading: v.heroHeading, heroText: v.heroText, heroButton: v.heroButton, statement: v.statement,
      propertiesHeading: v.propertiesHeading, listHeading: v.listHeading, listText: v.listText, howHeading: v.howHeading,
      steps: [1, 2, 3].map((n) => ({ title: v[`step${n}Title`], text: v[`step${n}Text`] })),
      enquiryHeading: v.enquiryHeading, enquiryText: v.enquiryText, footerLine,
    },
  };
}
