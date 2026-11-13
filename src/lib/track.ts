/** Shared by the visit tracker (browser) and its server route. No personal data is handled here. */

/** The buttons we count. Anything else sent to the tracker is ignored. */
export const TRACK_EVENTS: Record<string, string> = {
  see_properties: "See available properties",
  whatsapp: "Chat on WhatsApp",
  enquire_property: "Enquire about this property",
  send_enquiry: "Send enquiry",
  submit_property: "Submit property",
  request_inspection: "Request inspection",
};

const apps: [RegExp, string][] = [
  [/(^|\.)(instagram\.com|ig\.me)$/, "Instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/, "Facebook"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/(^|\.)(twitter\.com|t\.co|x\.com)$/, "X"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
];
const tags: Record<string, string> = { instagram: "Instagram", ig: "Instagram", facebook: "Facebook", fb: "Facebook", google: "Google", whatsapp: "WhatsApp", wa: "WhatsApp", twitter: "X", x: "X", tiktok: "TikTok", youtube: "YouTube" };

/** Where a visit came from: a campaign tag on the link if there is one, otherwise the site that sent the visitor. "Internal" is a click from inside this site. */
export function classifySource(referrer: string, utm: string, ownHost: string): string {
  const tag = utm.trim().toLowerCase().replace(/[^a-z0-9 _.-]/g, "").slice(0, 30);
  if (tag) return tags[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "Direct";
  }
  if (!host) return "Direct";
  if (host === ownHost.toLowerCase().replace(/^www\./, "").split(":")[0]) return "Internal";
  return apps.find(([re]) => re.test(host))?.[1] ?? host.slice(0, 40);
}

export const classifyDevice = (userAgent: string) =>
  /ipad|tablet|playbook|silk/i.test(userAgent) || (/android/i.test(userAgent) && !/mobile/i.test(userAgent))
    ? "tablet"
    : /mobi|iphone|ipod|android/i.test(userAgent)
      ? "phone"
      : "desktop";

/** Crawlers and link-preview fetchers are not visitors. */
export const isBot = (userAgent: string) =>
  !userAgent || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios/i.test(userAgent);

/** What the Traffic page shows, as returned by the database function `traffic_summary`. */
export interface Traffic {
  days: { day: string; visits: number; visitors: number }[];
  visits: number;
  previous: number;
  visitors: number;
  sources: [string, number][];
  devices: [string, number][];
  clicks: [string, number][];
  topProperties: [string, number][];
  topPages: [string, number][];
}
export const RANGES = [7, 30, 90] as const;

/** What a customer may see about their own enquiry. Never the owner's contact details or any fees. */
export interface EnquiryProgress {
  code: string;
  kind: "Rent" | "Buy";
  status: string;
  introducedAt: string;
  verifiedAt: string | null;
  releasedAt: string | null;
  inspectionDate: string | null;
  inspectionSlot: string | null;
  inspectionConfirmedFor: string | null;
  property: string | null;
}

export interface ProgressStep {
  label: string;
  /** done: finished. now: what is happening at the moment. later: not reached yet. */
  state: "done" | "now" | "later";
  when?: string;
}

const AFTER_VIEWING = ["Inspection Completed", "Negotiation", "Offer Accepted", "Successfully Rented", "Successfully Sold"];

/** The steps of an enquiry in plain words, with where it has got to. `fmt` formats a date for display. */
export function progressSteps(p: EnquiryProgress, fmt: { day: (iso: string) => string; moment: (iso: string) => string; inspection: (date: string, slot: string | null) => string }) {
  const released = !!p.releasedAt;
  const declined = p.status === "Unsuccessful" && !released;
  const completed = p.status === "Successfully Rented" || p.status === "Successfully Sold";
  const steps: ProgressStep[] = [
    { label: "Enquiry received", state: "done", when: fmt.day(p.introducedAt) },
    { label: "Email verified", state: p.verifiedAt ? "done" : "later", when: p.verifiedAt ? fmt.day(p.verifiedAt) : undefined },
    declined
      ? { label: "We could not take this enquiry forward", state: "done" }
      : { label: released ? "Approved: the owner's contact details were emailed to you" : "We are reviewing your enquiry", state: released ? "done" : "now", when: p.releasedAt ? fmt.day(p.releasedAt) : undefined },
  ];
  if (!declined && (p.inspectionDate || p.inspectionConfirmedFor)) {
    steps.push(
      p.inspectionConfirmedFor
        ? { label: `Inspection confirmed for ${fmt.moment(p.inspectionConfirmedFor)}`, state: AFTER_VIEWING.includes(p.status) ? "done" : "now" }
        : { label: `Inspection requested for ${fmt.inspection(p.inspectionDate!, p.inspectionSlot)}. We will confirm the time`, state: released ? "now" : "later" },
    );
  }
  if (!declined) {
    const verb = p.kind === "Rent" ? "rented" : "bought";
    steps.push({
      label: completed ? `Completed: the property was ${verb}` : AFTER_VIEWING.includes(p.status) ? "You and the owner are talking terms" : "Viewing and agreeing terms with the owner",
      state: completed ? "done" : released ? "now" : "later",
    });
  }
  // Only one step is "now": the first that is not done.
  let seen = false;
  for (const s of steps) {
    if (s.state === "done") continue;
    if (!seen && s.state === "now") seen = true;
    else if (seen) s.state = "later";
  }
  return { steps, declined, closed: p.status === "Unsuccessful" && released, disputed: p.status === "Disputed" };
}
