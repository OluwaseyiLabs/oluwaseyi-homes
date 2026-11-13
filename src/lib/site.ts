/** The WhatsApp number comes from NEXT_PUBLIC_WHATSAPP (digits with country code), so it is not in the code. */
const whatsapp = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "");
/** "2347012345678" shown as "+234 701 234 5678". Set NEXT_PUBLIC_WHATSAPP_LABEL to show it differently. */
const prettyNumber = (n: string) => (n.length === 13 && n.startsWith("234") ? `+234 ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : n ? `+${n}` : "");

export const site = {
  name: "Oluwaseyi Homes & Properties",
  whatsapp,
  whatsappLabel: process.env.NEXT_PUBLIC_WHATSAPP_LABEL || prettyNumber(whatsapp),
  description:
    "Oluwaseyi Homes & Properties connects clients directly to landlords in Lagos. Search for free, see every charge up front, and rent, buy, invest or list a property.",
};

/** A WhatsApp chat link for any number (a leading 0 means Nigeria), optionally opening with a ready-written message. */
export const waLink = (number: string, text?: string) =>
  `https://wa.me/${number.replace(/\D/g, "").replace(/^0/, "234")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

