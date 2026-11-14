import { getSiteContent } from "@/lib/data";

export async function About() {
  const { content } = await getSiteContent();
  return (
    <section id="about" className="scroll-mt-16 bg-green-deep text-white">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
          {content.howHeading}
        </h2>
        <ol className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {content.steps.map((s, i) => (
            <li key={s.title} className="border-t border-white/20 pt-6">
              <span className="text-sm font-bold text-gold">Step {i + 1}</span>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-lg leading-relaxed text-white/80">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
