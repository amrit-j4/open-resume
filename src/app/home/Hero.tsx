import Link from "next/link";
import { FlexboxSpacer } from "components/FlexboxSpacer";
import { AutoTypingResume } from "home/AutoTypingResume";
import { StartResumeButton } from "components/StartResumeButton";

export const Hero = () => {
  return (
    <section className="lg:flex lg:h-[825px] lg:justify-center">
      <FlexboxSpacer maxWidth={75} minWidth={0} className="hidden lg:block" />
      <div className="mx-auto max-w-xl pt-8 text-center lg:mx-0 lg:grow lg:pt-32 lg:text-left">
        <h1 className="text-primary pb-2 text-4xl font-bold lg:text-5xl">
          Create a professional
          <br />
          resume easily
        </h1>
        <p className="mt-3 text-lg lg:mt-5 lg:text-xl">
          With the free Job4online resume builder, built to be read by employers and ATS
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:mt-14 lg:justify-start">
          <Link href="/resume-import" className="btn-primary">
            Create Resume <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/import-resume"
            className="outline-theme-purple inline-block rounded-lg border border-gray-300 bg-white px-6 py-2 font-semibold text-gray-900 shadow-sm"
          >
            Import Resume
          </Link>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Not sure where to start?{" "}
          <StartResumeButton
            kind="sample"
            className="underline underline-offset-2"
          >
            Try a sample resume
          </StartResumeButton>
        </p>
        <p className="mt-3 text-sm text-gray-600 lg:mt-24">
          Already have a resume? Test its ATS readability with the{" "}
          <Link href="/resume-parser" className="underline underline-offset-2">
            ATS checker
          </Link>
        </p>
      </div>
      <FlexboxSpacer maxWidth={100} minWidth={50} className="hidden lg:block" />
      <div className="mt-6 flex justify-center lg:mt-4 lg:block lg:grow">
        <AutoTypingResume />
      </div>
    </section>
  );
};
