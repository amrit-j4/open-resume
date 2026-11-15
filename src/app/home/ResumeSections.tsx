import { RESUME_SECTIONS } from "home/seo-content";

export const ResumeSections = () => (
  <section className="mx-auto mt-16 max-w-5xl">
    <h2 className="text-center text-3xl font-bold">
      Create a Resume That’s Ready for Australian Jobs
    </h2>
    <p className="mx-auto mt-3 max-w-3xl text-center text-lg text-gray-700">
      Build a professional, easy-to-read resume that highlights your skills,
      experience and qualifications clearly for Australian employers.
    </p>
    <h3 className="mt-8 text-center text-xl font-semibold">
      Your resume can include:
    </h3>
    <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {RESUME_SECTIONS.map(({ title, text }) => (
        <div key={title} className="rounded-xl border border-gray-200 p-5">
          <dt className="font-bold">{title}</dt>
          <dd className="mt-1 text-gray-700">{text}</dd>
        </div>
      ))}
    </dl>
  </section>
);
