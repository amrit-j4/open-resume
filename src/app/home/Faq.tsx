import { FAQS } from "home/seo-content";

export const Faq = () => {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <section className="mx-auto mt-16 max-w-3xl">
      <h2 className="text-center text-3xl font-bold">
        Frequently Asked Questions
      </h2>
      <div className="mt-8 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <h3 className="inline">{q}</h3>
            </summary>
            <p className="mt-2 text-gray-700">{a}</p>
          </details>
        ))}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
};
