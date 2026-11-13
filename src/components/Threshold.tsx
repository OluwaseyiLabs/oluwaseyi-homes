import { getSiteContent } from "@/lib/data";

/**
 * The enquiry heading fades in, zooms out and drops down as you scroll, settling directly above the form.
 * The motion is a CSS scroll-driven animation (see globals.css), so it costs the page no JavaScript.
 */
export async function Threshold() {
  const { content } = await getSiteContent();
  return (
    <div className="overflow-x-clip px-5 pt-32 pb-10 sm:px-8 sm:pt-44">
      <div className="threshold-in text-center">
        <h2 className="text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
          {content.enquiryHeading}
        </h2>
        <p className="mt-5 text-lg text-muted">{content.enquiryText}</p>
      </div>
    </div>
  );
}
