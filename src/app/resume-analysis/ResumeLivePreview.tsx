"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePDF } from "@react-pdf/renderer";
import { ResumePDF } from "components/Resume/ResumePDF";
import { ResumePdfPreview } from "components/Resume/ResumePdfPreview";
import { useRegisterReactPDFFont, useRegisterReactPDFHyphenationCallback } from "components/fonts/hooks";
import { NonEnglishFontsCSSLazyLoader } from "components/fonts/NonEnglishFontsCSSLoader";
import { A4_WIDTH_PX, LETTER_WIDTH_PX } from "lib/constants";
import type { Settings } from "lib/redux/settingsSlice";
import type { Resume } from "lib/redux/types";

/** How long to wait after the last change before building a new PDF, so ticking through suggestions quickly builds one, not many. */
const REBUILD_DELAY_MS = 250;

/** Until the width is known, so the preview doesn't flash at full size. */
const FALLBACK_SCALE = 0.6;

const ResumeLivePreviewInner = ({ resume, settings }: { resume: Resume; settings: Settings }) => {
  useRegisterReactPDFFont();
  useRegisterReactPDFHyphenationCallback(settings.fontFamily);

  const document = useMemo(() => <ResumePDF resume={resume} settings={settings} isPDF={true} />, [resume, settings]);
  const [instance, update] = usePDF({ document });

  useEffect(() => {
    const timer = setTimeout(update, REBUILD_DELAY_MS);
    return () => clearTimeout(timer);
  }, [update, document]);

  // Fit the page to the width the preview has, whatever the screen.
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const pageWidth = settings.documentSize === "A4" ? A4_WIDTH_PX : LETTER_WIDTH_PX;
  const scale = width > 0 ? Math.min(1.2, width / pageWidth) : FALLBACK_SCALE;

  return (
    <div ref={container} className="w-full">
      <NonEnglishFontsCSSLazyLoader />
      <ResumePdfPreview pdfUrl={instance.url} scale={scale} />
    </div>
  );
};

/** The resume as the PDF the builder would download, rebuilt as the resume changes. It needs the browser, so it is never rendered on the server. */
export const ResumeLivePreview = dynamic(() => Promise.resolve(ResumeLivePreviewInner), { ssr: false });
