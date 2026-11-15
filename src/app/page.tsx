import type { Metadata } from "next";
import { Hero } from "home/Hero";
import { Features } from "home/Features";
import { ResumeSections } from "home/ResumeSections";
import { TailorResume } from "home/TailorResume";
import { Faq } from "home/Faq";
import { SEO_DESCRIPTION, SEO_TITLE } from "home/seo-content";
import { Footer } from "components/Footer";

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  openGraph: { title: SEO_TITLE, description: SEO_DESCRIPTION },
};

export default function Home() {
  return (
    <>
      <main className="mx-auto max-w-screen-2xl bg-dot px-8 pb-32 text-gray-900 lg:px-12">
        <Hero />
        <Features />
        <ResumeSections />
        <TailorResume />
        <Faq />
      </main>
      {/* Homepage only: keeps the builder/parser pages uncluttered */}
      <Footer />
    </>
  );
}
