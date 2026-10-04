import { Page, View, Document } from "@react-pdf/renderer";
import { styles, spacing } from "components/Resume/ResumePDF/styles";
import { ResumePDFProfile } from "components/Resume/ResumePDF/ResumePDFProfile";
import { ResumePDFWorkExperience } from "components/Resume/ResumePDF/ResumePDFWorkExperience";
import { ResumePDFEducation } from "components/Resume/ResumePDF/ResumePDFEducation";
import { ResumePDFProject } from "components/Resume/ResumePDF/ResumePDFProject";
import { ResumePDFSkills } from "components/Resume/ResumePDF/ResumePDFSkills";
import { ResumePDFCustom } from "components/Resume/ResumePDF/ResumePDFCustom";
import { DEFAULT_FONT_COLOR } from "lib/redux/settingsSlice";
import type { Settings, ShowForm } from "lib/redux/settingsSlice";
import type { Resume } from "lib/redux/types";
import { SuppressResumePDFErrorMessage } from "components/Resume/ResumePDF/common/SuppressResumePDFErrorMessage";
import { getTemplate } from "components/Resume/ResumePDF/templates";
import { TemplateContext } from "components/Resume/ResumePDF/templateContext";
import { ResumePDFBranding } from "components/Resume/ResumePDF/ResumePDFBranding";

// Page heights in pt, used to anchor the branding to the bottom of the on-screen preview
const LETTER_HEIGHT_PT = 792;
const A4_HEIGHT_PT = 842;

/**
 * Note: ResumePDF is supposed to be rendered inside PDFViewer. However,
 * PDFViewer is rendered too slow and has noticeable delay as you enter
 * the resume form, so we render it without PDFViewer to make it render
 * instantly. There are 2 drawbacks with this approach:
 * 1. Not everything works out of box if not rendered inside PDFViewer,
 *    e.g. svg doesn't work, so it takes in a isPDF flag that maps react
 *    pdf element to the correct dom element.
 * 2. It throws a lot of errors in console log, e.g. "<VIEW /> is using incorrect
 *    casing. Use PascalCase for React components, or lowercase for HTML elements."
 *    in development, causing a lot of noises. We can possibly workaround this by
 *    mapping every react pdf element to a dom element, but for now, we simply
 *    suppress these messages in <SuppressResumePDFErrorMessage />.
 *    https://github.com/diegomura/react-pdf/issues/239#issuecomment-487255027
 */
export const ResumePDF = ({
  resume,
  settings,
  isPDF = false,
}: {
  resume: Resume;
  settings: Settings;
  isPDF?: boolean;
}) => {
  const { profile, workExperiences, educations, projects, skills, custom } =
    resume;
  const { name } = profile;
  const {
    fontFamily,
    fontSize,
    documentSize,
    formToHeading,
    formToShow,
    formsOrder,
    showBulletPoints,
  } = settings;
  const themeColor = settings.themeColor || DEFAULT_FONT_COLOR;
  const template = getTemplate(settings.template);
  const isBand = template.header === "band";
  const topBarHeight =
    template.topBar === "thick"
      ? spacing[5]
      : template.topBar === "thin"
      ? spacing[3.5]
      : null;

  const showFormsOrder = formsOrder.filter((form) => formToShow[form]);

  const formTypeToComponent: { [type in ShowForm]: () => JSX.Element } = {
    workExperiences: () => (
      <ResumePDFWorkExperience
        heading={formToHeading["workExperiences"]}
        workExperiences={workExperiences}
        themeColor={themeColor}
      />
    ),
    educations: () => (
      <ResumePDFEducation
        heading={formToHeading["educations"]}
        educations={educations}
        themeColor={themeColor}
        showBulletPoints={showBulletPoints["educations"]}
      />
    ),
    projects: () => (
      <ResumePDFProject
        heading={formToHeading["projects"]}
        projects={projects}
        themeColor={themeColor}
      />
    ),
    skills: () => (
      <ResumePDFSkills
        heading={formToHeading["skills"]}
        skills={skills}
        themeColor={themeColor}
        showBulletPoints={showBulletPoints["skills"]}
      />
    ),
    custom: () => (
      <ResumePDFCustom
        heading={formToHeading["custom"]}
        custom={custom}
        themeColor={themeColor}
        showBulletPoints={showBulletPoints["custom"]}
      />
    ),
  };

  const profileSection = (
    <ResumePDFProfile profile={profile} themeColor={themeColor} isPDF={isPDF} />
  );

  return (
    <TemplateContext.Provider value={template}>
      <Document title={`${name} Resume`} author={name} producer={"Job4online"}>
        <Page
          size={documentSize === "A4" ? "A4" : "LETTER"}
          style={{
            ...styles.flexCol,
            color: DEFAULT_FONT_COLOR,
            fontFamily,
            fontSize: fontSize + "pt",
            // Room for the "Powered by Job4online" mark at the bottom of every page
            paddingBottom: spacing[8],
            // Preview only (the PDF paginates itself): make the element exactly one page
            // tall so the branding sits at the bottom of the visible page. border-box keeps
            // the bottom padding inside that height; longer content is clipped like the
            // preview frame already does, and the full resume is in the downloaded PDF.
            ...(isPDF
              ? {}
              : {
                  position: "relative",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  height: `${
                    documentSize === "A4" ? A4_HEIGHT_PT : LETTER_HEIGHT_PT
                  }pt`,
                }),
          }}
        >
          {topBarHeight && Boolean(settings.themeColor) && (
            <View
              style={{
                width: spacing["full"],
                height: topBarHeight,
                backgroundColor: themeColor,
              }}
            />
          )}
          {isBand && profileSection}
          <View
            style={{
              ...styles.flexCol,
              padding: `${spacing[0]} ${spacing[20]}`,
            }}
          >
            {!isBand && profileSection}
            {showFormsOrder.map((form) => {
              const Component = formTypeToComponent[form];
              return <Component key={form} />;
            })}
          </View>
          <ResumePDFBranding isPDF={isPDF} />
        </Page>
      </Document>
      <SuppressResumePDFErrorMessage />
    </TemplateContext.Provider>
  );
};
