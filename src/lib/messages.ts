/** The first message a customer sends the owner, written for them when they tap the WhatsApp button in the contact email. */
export const ownerChatMessage = (m: { company: string; customerName: string; ownerName: string; property: string; leadCode: string; inspection?: string; confirmed?: string }) =>
  `Hello ${m.ownerName}, my name is ${m.customerName}. ${m.company} introduced me to you for ${m.property}. ` +
  `Our reference number is ${m.leadCode}. ` +
  (m.confirmed ? `Our inspection is confirmed for ${m.confirmed} (Lagos time).` : `I would like to arrange an inspection${m.inspection ? `, ideally on ${m.inspection}` : ""}.`);

/** The first message to the company from a property's "Chat on WhatsApp" button. `code` is the property's reference, when it has a real one. */
export const propertyChatMessage = (p: { company: string; title: string; location: string; code?: string }) =>
  `Hello ${p.company}, I am interested in ${p.title}, ${p.location}${p.code ? ` (property reference ${p.code})` : ""}.`;
