import Link from "next/link";
import { TAILOR_POINTS } from "home/seo-content";

export const TailorResume = () => (
  <section className="mx-auto mt-16 max-w-3xl text-center">
    <h2 className="text-3xl font-bold">Tailor Your Resume to Every Job</h2>
    <p className="mt-3 text-lg font-semibold">
      One resume shouldn&apos;t have to do every job.
    </p>
    <p className="mt-3 text-gray-700">
      Different employers look for different skills, experience and keywords.
      With Job4online Resume Analysis, you can compare your resume against the
      actual job description you&apos;re applying for.
    </p>
    <p className="mt-4 font-semibold">See:</p>
    <ul className="mx-auto mt-2 inline-block list-disc space-y-1 pl-6 text-left text-gray-700">
      {TAILOR_POINTS.map((point) => (
        <li key={point}>{point}</li>
      ))}
    </ul>
    <p className="mt-4 text-gray-700">
      Make targeted improvements instead of rewriting your entire resume every
      time you apply.
    </p>
    <Link href="/resume-analysis" className="btn-primary mt-6">
      Match My Resume to a Job
    </Link>
  </section>
);
