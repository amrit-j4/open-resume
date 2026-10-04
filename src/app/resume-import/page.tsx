"use client";
import { getHasUsedAppBefore } from "lib/redux/local-storage";
import { ResumeDropzone } from "components/ResumeDropzone";
import { useState, useEffect } from "react";
import Link from "next/link";
import { StartResumeButton } from "components/StartResumeButton";

export default function ImportResume() {
  const [hasUsedAppBefore, setHasUsedAppBefore] = useState(false);
  const [hasAddedResume, setHasAddedResume] = useState(false);
  const onFileUrlChange = (fileUrl: string) => {
    setHasAddedResume(Boolean(fileUrl));
  };

  useEffect(() => {
    setHasUsedAppBefore(getHasUsedAppBefore());
  }, []);

  return (
    <main>
      <div className="mx-auto mt-14 max-w-3xl rounded-md border border-gray-200 px-10 py-10 text-center shadow-md">
        {!hasUsedAppBefore ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">
              Import data from an existing resume
            </h1>
            <ResumeDropzone
              onFileUrlChange={onFileUrlChange}
              className="mt-5"
            />
            {!hasAddedResume && (
              <>
                <OrDivider />
                <SectionWithHeadingAndCreateButton
                  heading="Don't have a resume yet?"
                  buttonText="Create from scratch"
                />
                <SampleOption />
              </>
            )}
          </>
        ) : (
          <>
            {!hasAddedResume && (
              <>
                <SectionWithHeadingAndCreateButton
                  heading="You have data saved in browser from prior session"
                  buttonText="Continue where I left off"
                />
                <OrDivider />
              </>
            )}
            <h1 className="font-semibold text-gray-900">
              Override data with a new resume
            </h1>
            <ResumeDropzone
              onFileUrlChange={onFileUrlChange}
              className="mt-5"
            />
            {!hasAddedResume && (
              <>
                <OrDivider />
                <p className="font-semibold text-gray-900">
                  Start over with something new
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <StartResumeButton kind="blank" className={SECONDARY_BUTTON}>
                    Start from scratch
                  </StartResumeButton>
                  <StartResumeButton kind="sample" className={SECONDARY_BUTTON}>
                    Try a sample resume
                  </StartResumeButton>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const SECONDARY_BUTTON =
  "rounded-lg border border-gray-300 px-6 pb-2 pt-1.5 text-base font-semibold text-gray-800 hover:bg-gray-100";

const SampleOption = () => (
  <div className="mt-6 border-t border-gray-100 pt-6">
    <p className="font-semibold text-gray-900">Want to see what it looks like?</p>
    <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
      Open a complete sample resume that uses every section, then edit it with
      your own details.
    </p>
    <div className="mt-4">
      <StartResumeButton kind="sample" className={SECONDARY_BUTTON}>
        Try a sample resume
      </StartResumeButton>
    </div>
  </div>
);

const OrDivider = () => (
  <div className="mx-[-2.5rem] flex items-center pb-6 pt-8" aria-hidden="true">
    <div className="flex-grow border-t border-gray-200" />
    <span className="mx-2 mt-[-2px] flex-shrink text-lg text-gray-400">or</span>
    <div className="flex-grow border-t border-gray-200" />
  </div>
);

const SectionWithHeadingAndCreateButton = ({
  heading,
  buttonText,
}: {
  heading: string;
  buttonText: string;
}) => {
  return (
    <>
      <p className="font-semibold text-gray-900">{heading}</p>
      <div className="mt-5">
        <Link
          href="/resume-builder"
          className="outline-theme-blue rounded-lg bg-primary px-6 pb-2 pt-1.5 text-base font-semibold"
        >
          {buttonText}
        </Link>
      </div>
    </>
  );
};
