import Link from "next/link";
import { FEATURES } from "home/seo-content";

export const Features = () => (
  <section className="mx-auto mt-8 rounded-2xl bg-neutral-100 bg-dot px-8 pb-12 pt-10 lg:mt-2">
    <h2 className="text-center text-3xl font-bold">
      More Than Just a Resume Builder
    </h2>
    <ol className="mx-auto mt-8 grid max-w-5xl gap-6 md:grid-cols-2">
      {FEATURES.map(({ title, text, cta }, idx) => (
        <li
          key={title}
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-bold">
            <span className="text-primary mr-2">{idx + 1}.</span>
            {title}
          </h3>
          <p className="mt-2 grow text-gray-700">{text}</p>
          {cta && (
            <Link
              href={cta.href}
              className="btn-primary mt-4 self-start text-center"
            >
              {cta.label}
            </Link>
          )}
        </li>
      ))}
    </ol>
  </section>
);
