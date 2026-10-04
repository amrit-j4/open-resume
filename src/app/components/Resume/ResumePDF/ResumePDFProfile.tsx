import { View } from "@react-pdf/renderer";
import {
  ResumePDFIcon,
  type IconType,
} from "components/Resume/ResumePDF/common/ResumePDFIcon";
import { styles, spacing } from "components/Resume/ResumePDF/styles";
import {
  ResumePDFLink,
  ResumePDFSection,
  ResumePDFText,
} from "components/Resume/ResumePDF/common";
import { useTemplate } from "components/Resume/ResumePDF/templateContext";
import { DEFAULT_FONT_COLOR } from "lib/redux/settingsSlice";
import type { ResumeProfile } from "lib/redux/types";

const WHITE = "#FFFFFF";

export const ResumePDFProfile = ({
  profile,
  themeColor,
  isPDF,
}: {
  profile: ResumeProfile;
  themeColor: string;
  isPDF: boolean;
}) => {
  const { header, nameThemed, headerRule } = useTemplate();
  const { name, email, phone, url, summary, location } = profile;
  const iconProps = { email, phone, location, url };

  const isBand = header === "band";
  const isCentered = header === "centered";
  const isBold = header === "bold";
  // Text drawn on the colored band is white; elsewhere the theme color is optional
  const textColor = isBand ? WHITE : undefined;
  const nameColor = isBand
    ? WHITE
    : nameThemed
    ? themeColor
    : DEFAULT_FONT_COLOR;
  // Icons are dark gray, so only show them on light backgrounds with left alignment
  const showIcons = header === "left" || isBold;

  const contacts = Object.entries(iconProps).map(([key, value]) => {
    if (!value) return null;

    let iconType = key as IconType;
    if (key === "url") {
      if (value.includes("github")) {
        iconType = "url_github";
      } else if (value.includes("linkedin")) {
        iconType = "url_linkedin";
      }
    }

    const shouldUseLinkWrapper = ["email", "url", "phone"].includes(key);
    const Wrapper = ({ children }: { children: React.ReactNode }) => {
      if (!shouldUseLinkWrapper) return <>{children}</>;

      let src = "";
      switch (key) {
        case "email": {
          src = `mailto:${value}`;
          break;
        }
        case "phone": {
          src = `tel:${value.replace(/[^\d+]/g, "")}`; // Keep only + and digits
          break;
        }
        default: {
          src = value.startsWith("http") ? value : `https://${value}`;
        }
      }

      return (
        <ResumePDFLink src={src} isPDF={isPDF}>
          {children}
        </ResumePDFLink>
      );
    };

    return (
      <View
        key={key}
        style={{
          ...styles.flexRow,
          alignItems: "center",
          gap: spacing["1"],
        }}
      >
        {showIcons && <ResumePDFIcon type={iconType} isPDF={isPDF} />}
        <Wrapper>
          <ResumePDFText themeColor={textColor}>{value}</ResumePDFText>
        </Wrapper>
      </View>
    );
  });

  const contactRow = (
    <View
      style={{
        ...(isCentered || isBand ? styles.flexRow : styles.flexRowBetween),
        flexWrap: "wrap",
        justifyContent: isCentered
          ? "center"
          : isBand
          ? "flex-start"
          : "space-between",
        gap: isCentered || isBand ? spacing["4"] : undefined,
        marginTop: spacing["0.5"],
      }}
    >
      {contacts}
    </View>
  );

  const nameText = (
    <ResumePDFText
      bold={true}
      themeColor={nameColor}
      style={{
        fontSize: isBold ? "26pt" : isBand ? "24pt" : "20pt",
        textAlign: isCentered ? "center" : undefined,
        letterSpacing: isCentered && headerRule ? "1.5pt" : undefined,
      }}
    >
      {name}
    </ResumePDFText>
  );

  const summaryText = summary ? (
    <ResumePDFText
      themeColor={textColor}
      style={{ textAlign: isCentered ? "center" : undefined }}
    >
      {summary}
    </ResumePDFText>
  ) : null;

  const content = (
    <>
      {nameText}
      {isBold && (
        <View
          style={{
            width: "40pt",
            height: "3pt",
            backgroundColor: themeColor,
          }}
        />
      )}
      {isCentered && headerRule && (
        <View
          style={{
            alignSelf: "center",
            width: "48pt",
            height: "1.5pt",
            backgroundColor: themeColor,
          }}
        />
      )}
      {summaryText}
      {contactRow}
    </>
  );

  if (isBand) {
    // Full-bleed colored header; the page content below supplies its own padding
    return (
      <View
        style={{
          ...styles.flexCol,
          gap: spacing["2"],
          backgroundColor: themeColor,
          padding: `${spacing["8"]} ${spacing["20"]}`,
        }}
      >
        {content}
      </View>
    );
  }

  return (
    // Centered headers have no bar above them, so the page's top padding is their only gap
    <ResumePDFSection style={{ marginTop: isCentered ? "0" : spacing["4"] }}>
      {content}
    </ResumePDFSection>
  );
};
