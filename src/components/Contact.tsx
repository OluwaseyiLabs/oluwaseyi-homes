import { getSiteContent } from "@/lib/data";
import { waLink } from "@/lib/site";
import { WhatsAppIcon } from "./ButtonIcons";

export async function Contact() {
  const { site } = await getSiteContent();
  return (
    <section id="contact" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-20 sm:px-8">
      <div className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-line bg-surface p-8 sm:p-12 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">
            Prefer to talk now?
          </h2>
          <p className="mt-3 text-lg text-muted">Message us on WhatsApp at {site.whatsappLabel}.</p>
        </div>
        <a
          data-track="whatsapp"
          href={waLink(site.whatsapp, `Hello ${site.name}, I have a property enquiry.`)}
          className="inline-flex min-h-12 shrink-0 items-center rounded-full bg-green px-7 text-base font-semibold text-white icon-btn hover:bg-green-deep"
        >
          <WhatsAppIcon />
          Message on WhatsApp
        </a>
      </div>
    </section>
  );
}
