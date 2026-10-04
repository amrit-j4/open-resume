"use client";
import { useEffect, useRef, useState } from "react";
import { PX_PER_PT } from "lib/constants";

// Getting pdfjs to work is tricky; same setup as lib/parse-resume-from-pdf/read-pdf.ts
// https://stackoverflow.com/a/63486898/7699841
// It is imported lazily (and once) so its size stays out of the builder's first load.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | undefined;
const loadPdfjs = () => {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist");
    // @ts-ignore
    const worker = await import("pdfjs-dist/build/pdf.worker.entry");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  })();
  return pdfjsPromise;
};

// Pages are rasterised once at 2 CSS px per pt-pixel (crisp up to the 150% zoom the
// slider allows) and then scaled with CSS, so dragging the zoom slider never re-renders.
const RENDER_SCALE = PX_PER_PT * 2;

interface PageImage {
  url: string;
  /** Page size in pt */
  widthPt: number;
  heightPt: number;
}

const renderPdfToImages = async (
  pdfUrl: string,
  isStale: () => boolean
): Promise<PageImage[]> => {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument(pdfUrl).promise;
  const pages: PageImage[] = [];
  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      if (isStale()) break;
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) continue;
      await page.render({ canvasContext, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) continue;
      pages.push({
        url: URL.createObjectURL(blob),
        widthPt: base.width,
        heightPt: base.height,
      });
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
};

/**
 * Shows the generated resume PDF page by page, so the preview has the exact same
 * pagination, margins and branding as the downloaded file (including page 2+).
 * The previous render stays on screen until the next one is ready, so editing
 * doesn't flash or lose scroll position.
 */
export const ResumePdfPreview = ({
  pdfUrl,
  scale,
}: {
  pdfUrl: string | null;
  scale: number;
}) => {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [failed, setFailed] = useState(false);
  const latestRequest = useRef(0);
  const currentPages = useRef<PageImage[]>([]);

  useEffect(() => {
    if (!pdfUrl) return;
    const request = ++latestRequest.current;
    const isStale = () => request !== latestRequest.current;

    renderPdfToImages(pdfUrl, isStale)
      .then((next) => {
        if (isStale()) {
          next.forEach((page) => URL.revokeObjectURL(page.url));
          return;
        }
        const previous = currentPages.current;
        currentPages.current = next;
        setPages(next);
        setFailed(false);
        // Free the old images once the new ones are on screen
        setTimeout(
          () => previous.forEach((page) => URL.revokeObjectURL(page.url)),
          1000
        );
      })
      .catch((error) => {
        console.error("Failed to render resume preview", error);
        if (!isStale()) setFailed(true);
      });
  }, [pdfUrl]);

  useEffect(
    () => () => {
      latestRequest.current++;
      currentPages.current.forEach((page) => URL.revokeObjectURL(page.url));
    },
    []
  );

  if (pages.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-gray-500" role="status">
        {failed ? "Couldn't render the preview." : "Preparing preview..."}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      {pages.map((page, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={page.url}
          alt={`Resume page ${idx + 1} of ${pages.length}`}
          draggable={false}
          className="bg-white shadow-lg"
          style={{
            width: `${page.widthPt * PX_PER_PT * scale}px`,
            height: `${page.heightPt * PX_PER_PT * scale}px`,
          }}
        />
      ))}
    </div>
  );
};
