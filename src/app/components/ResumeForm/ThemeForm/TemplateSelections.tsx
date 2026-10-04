import {
  TEMPLATES,
  type HeaderVariant,
  type HeadingVariant,
  type TemplateConfig,
} from "components/Resume/ResumePDF/templates";
import type { GeneralSetting } from "lib/redux/settingsSlice";

const GRAY = "#d4d4d4";

/** Miniature, purely decorative preview of a template's header and headings */
const TemplateThumbnail = ({
  template,
  themeColor,
}: {
  template: TemplateConfig;
  themeColor: string;
}) => {
  const line = (width: string, color = GRAY) => (
    <div style={{ height: 2, width, backgroundColor: color, borderRadius: 1 }} />
  );

  const heading = (variant: HeadingVariant) => {
    switch (variant) {
      case "underline":
        return (
          <div
            style={{ borderBottom: `2px solid ${themeColor}`, paddingBottom: 1 }}
          >
            <div style={{ height: 3, width: "45%", backgroundColor: themeColor }} />
          </div>
        );
      case "pill":
        return (
          <div
            style={{
              height: 6,
              width: "45%",
              backgroundColor: themeColor,
              borderRadius: 2,
            }}
          />
        );
      case "ruled":
        return (
          <div className="flex items-center gap-1">
            <div style={{ height: 3, width: "30%", backgroundColor: "#525252" }} />
            <div style={{ height: 1, flexGrow: 1, backgroundColor: GRAY }} />
          </div>
        );
      case "centered-rule":
        return (
          <div className="flex items-center gap-1">
            <div style={{ height: 1, flexGrow: 1, backgroundColor: themeColor }} />
            <div style={{ height: 3, width: "26%", backgroundColor: "#525252" }} />
            <div style={{ height: 1, flexGrow: 1, backgroundColor: themeColor }} />
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1">
            <div style={{ height: 3, width: "28%", backgroundColor: themeColor }} />
            <div style={{ height: 3, width: "30%", backgroundColor: "#525252" }} />
          </div>
        );
    }
  };

  const header = (variant: HeaderVariant) => {
    switch (variant) {
      case "band":
        return (
          <div
            className="-mx-1.5 -mt-1.5 mb-1 flex flex-col gap-0.5 px-1.5 py-1.5"
            style={{ backgroundColor: themeColor }}
          >
            <div style={{ height: 4, width: "55%", backgroundColor: "#fff" }} />
            {line("80%", "rgba(255,255,255,0.7)")}
          </div>
        );
      case "centered":
        return (
          <div className="mb-1 flex flex-col items-center gap-0.5">
            <div
              style={{
                height: 4,
                width: "55%",
                backgroundColor: template.nameThemed ? themeColor : "#262626",
              }}
            />
            {line("70%")}
          </div>
        );
      case "bold":
        return (
          <div className="mb-1 flex flex-col gap-0.5">
            <div style={{ height: 6, width: "65%", backgroundColor: themeColor }} />
            <div style={{ height: 2, width: "22%", backgroundColor: themeColor }} />
            {line("85%")}
          </div>
        );
      default:
        return (
          <div className="mb-1 flex flex-col gap-0.5">
            <div style={{ height: 5, width: "50%", backgroundColor: themeColor }} />
            {line("85%")}
          </div>
        );
    }
  };

  return (
    <div
      className="flex h-[88px] w-[66px] flex-col overflow-hidden rounded-sm border border-gray-200 bg-white p-1.5"
      aria-hidden="true"
    >
      {template.topBar !== "none" && (
        <div
          className="-mx-1.5 -mt-1.5 mb-1.5"
          style={{
            height: template.topBar === "thick" ? 5 : 3,
            backgroundColor: themeColor,
          }}
        />
      )}
      {header(template.header)}
      <div className="mt-1 flex flex-col gap-1">
        {heading(template.heading)}
        {line("100%")}
        {line("90%")}
        {line("95%")}
        <div className="mt-0.5">{heading(template.heading)}</div>
        {line("100%")}
        {line("80%")}
      </div>
    </div>
  );
};

export const TemplateSelections = ({
  selectedTemplate,
  themeColor,
  handleSettingsChange,
}: {
  selectedTemplate: string;
  themeColor: string;
  handleSettingsChange: (field: GeneralSetting, value: string) => void;
}) => (
  <div
    className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3"
    role="radiogroup"
    aria-label="Resume template"
  >
    {TEMPLATES.map((template) => {
      const isSelected = (selectedTemplate || TEMPLATES[0].id) === template.id;
      return (
        <button
          key={template.id}
          type="button"
          role="radio"
          aria-checked={isSelected}
          title={template.description}
          onClick={() => handleSettingsChange("template", template.id)}
          className="flex flex-col items-center gap-1.5 rounded-md border bg-white p-2 shadow-sm hover:border-gray-400 hover:bg-gray-50"
          style={
            isSelected
              ? { borderColor: themeColor, boxShadow: `0 0 0 1px ${themeColor}` }
              : { borderColor: "#d1d5db" }
          }
        >
          <TemplateThumbnail template={template} themeColor={themeColor} />
          <span
            className="text-sm font-medium"
            style={isSelected ? { color: themeColor } : { color: "#374151" }}
          >
            {template.name}
          </span>
        </button>
      );
    })}
  </div>
);
