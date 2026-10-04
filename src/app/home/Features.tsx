import Image from "next/image";
import featureFreeSrc from "public/assets/feature-free.svg";
import featureUSSrc from "public/assets/feature-us.svg";
import featurePrivacySrc from "public/assets/feature-privacy.svg";
import featureOpenSourceSrc from "public/assets/feature-open-source.svg";
import { Link } from "components/documentation";
import {
  ORIGINAL_PROJECT_NAME,
  ORIGINAL_PROJECT_URL,
  SOURCE_CODE_URL,
} from "lib/site-config";

const FEATURES = [
  {
    src: featureFreeSrc,
    title: "Free to Use",
    text: "Job4online believes everyone should have free and easy access to a modern, professional resume design. Build your resume for free, then sign up for a free Job4online account to download it",
  },
  {
    src: featureUSSrc,
    title: "ATS-Friendly",
    text: "Clean, single-column layouts with consistent formatting that applicant tracking systems can read, so your details are parsed correctly",
  },
  {
    src: featurePrivacySrc,
    title: "Privacy Focus",
    text: "Your resume data is stored locally in your browser, so only you have access to it and you stay in complete control",
  },
  {
    src: featureOpenSourceSrc,
    title: "Open-Source",
    text: (
      <>
        This resume builder is open-source software. You can view its{" "}
        <Link href={SOURCE_CODE_URL}>source code</Link>. It is based on{" "}
        <Link href={ORIGINAL_PROJECT_URL}>{ORIGINAL_PROJECT_NAME}</Link>
      </>
    ),
  },
];

export const Features = () => {
  return (
    <section className="py-16 lg:py-36">
      <div className="mx-auto lg:max-w-4xl">
        <dl className="grid grid-cols-1 justify-items-center gap-y-8 lg:grid-cols-2 lg:gap-x-6 lg:gap-y-16">
          {FEATURES.map(({ src, title, text }) => (
            <div className="px-2" key={title}>
              <div className="relative w-96 self-center pl-16">
                <dt className="text-2xl font-bold">
                  <Image
                    src={src}
                    className="absolute left-0 top-1 h-12 w-12"
                    alt="Feature icon"
                  />
                  {title}
                </dt>
                <dd className="mt-2">{text}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
