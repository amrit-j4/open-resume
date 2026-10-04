"use client";
import { createContext, useContext } from "react";
import { TEMPLATES, type TemplateConfig } from "components/Resume/ResumePDF/templates";

export const TemplateContext = createContext<TemplateConfig>(TEMPLATES[0]);
export const useTemplate = () => useContext(TemplateContext);
