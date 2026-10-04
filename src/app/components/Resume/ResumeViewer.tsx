"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePDF } from "@react-pdf/renderer";
import { ResumePdfPreview } from "components/Resume/ResumePdfPreview";
import { ResumeControlBar } from "components/Resume/ResumeControlBar";

/**
 * Generates the resume PDF once and uses it for both the on-screen preview and the
 * download, so what people see (every page, margins, branding) is what they get.
 */
const ResumeViewer = ({
  document,
  scale,
  setScale,
  documentSize,
  fileName,
}: {
  document: JSX.Element;
  scale: number;
  setScale: (scale: number) => void;
  documentSize: string;
  fileName: string;
}) => {
  const [instance, update] = usePDF({ document });

  // Regenerate the pdf whenever the resume or settings change
  useEffect(() => {
    update();
  }, [update, document]);

  return (
    <>
      <section className="h-[calc(100vh-var(--top-nav-bar-height)-var(--resume-control-bar-height))] overflow-y-auto overflow-x-hidden md:p-[var(--resume-padding)]">
        <ResumePdfPreview pdfUrl={instance.url} scale={scale} />
      </section>
      <ResumeControlBar
        scale={scale}
        setScale={setScale}
        documentSize={documentSize}
        pdfUrl={instance.url}
        fileName={fileName}
      />
    </>
  );
};

/**
 * Load client side only: usePDF is a web-specific API, and pdf.js needs the browser
 */
export const ResumeViewerCSR = dynamic(() => Promise.resolve(ResumeViewer), {
  ssr: false,
});
