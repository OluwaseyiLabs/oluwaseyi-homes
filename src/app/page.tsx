import { About } from "@/components/About";
import { Fees } from "@/components/Fees";
import { Contact } from "@/components/Contact";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Properties } from "@/components/Properties";
import { Statement } from "@/components/Statement";
import { Threshold } from "@/components/Threshold";
import { EnquireFromLink } from "@/components/EnquireFromLink";
import { SiteProvider } from "@/components/SiteProvider";
import { getDetailFields, getFacilities, getPricing, getPublishedListings, getSiteContent } from "@/lib/data";

// Rebuilt at most every 5 minutes, and straight away when a property is saved in the dashboard.
export const revalidate = 300;

export default async function Home() {
  const [listings, detailFields, facilities, siteContent, pricing] = await Promise.all([
    getPublishedListings(),
    getDetailFields(),
    getFacilities(),
    getSiteContent(),
    getPricing(),
  ]);
  return (
    <SiteProvider value={{ ...siteContent, pricing }}>
      <EnquireFromLink listings={listings} />
      <Header name={siteContent.site.name} />
      <main>
        <Hero />
        <Statement />
        <Properties listings={listings} detailFields={detailFields} facilities={facilities} />
        <About />
        <Fees />
        <section id="enquire" aria-label="Enquiry">
          <Threshold />
          <div id="enquiry-form" className="mx-auto max-w-3xl scroll-mt-20 px-5 pb-20 sm:px-8">
            <EnquiryForm facilities={facilities} />
          </div>
        </section>
        <Contact />
      </main>
      <Footer />
    </SiteProvider>
  );
}
