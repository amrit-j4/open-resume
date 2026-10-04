/**
 * Resume templates. All of them stay single-column (best for ATS); they differ
 * in how the header and the section headings are drawn.
 */
export type TemplateId = "classic" | "modern" | "minimal" | "bold" | "elegant";

export type HeaderVariant = "left" | "band" | "centered" | "bold";
export type HeadingVariant =
  | "bar"
  | "underline"
  | "pill"
  | "ruled"
  | "centered-rule";

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  header: HeaderVariant;
  heading: HeadingVariant;
  /** Colored strip across the top of the page */
  topBar: "none" | "thin" | "thick";
  /** Draw the candidate name in the theme color */
  nameThemed: boolean;
  /** Short accent rule under a centered header */
  headerRule: boolean;
}

export const DEFAULT_TEMPLATE: TemplateId = "classic";

export const TEMPLATES: TemplateConfig[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Top color bar with accent bars before each heading",
    header: "left",
    heading: "bar",
    topBar: "thin",
    nameThemed: true,
    headerRule: false,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Full-width color header with underlined headings",
    header: "band",
    heading: "underline",
    topBar: "none",
    nameThemed: false,
    headerRule: false,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Centered header with thin ruled headings",
    header: "centered",
    heading: "ruled",
    topBar: "none",
    nameThemed: false,
    headerRule: false,
  },
  {
    id: "bold",
    name: "Bold",
    description: "Large name and filled heading labels",
    header: "bold",
    heading: "pill",
    topBar: "thick",
    nameThemed: true,
    headerRule: false,
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Centered, spaced name with centered headings",
    header: "centered",
    heading: "centered-rule",
    topBar: "none",
    nameThemed: true,
    headerRule: true,
  },
];

export const getTemplate = (id?: string): TemplateConfig =>
  TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
