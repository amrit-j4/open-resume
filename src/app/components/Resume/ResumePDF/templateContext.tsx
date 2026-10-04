"use client";
import { createContext, useContext } from "react";
import { TEMPLATES, type TemplateConfig } from "components/Resume/ResumePDF/templates";

export const TemplateContext = createContext<TemplateConfig>(TEMPLATES[0]);
export const useTemplate = () => useContext(TemplateContext);

/** True while rendering the real PDF; false for the plain-DOM demo on the homepage */
export const PdfModeContext = createContext(false);
const useIsPdf = () => useContext(PdfModeContext);

/**
 * Page-break hints only mean something to react-pdf. Spreading them onto the DOM
 * elements used by the homepage demo would trigger React "unknown prop" warnings.
 */
export const useKeepTogether = () => (useIsPdf() ? { wrap: false as const } : {});
export const useKeepWithNext = (pt: number) =>
  useIsPdf() ? { minPresenceAhead: pt } : {};
