import { Text, View, Link } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { styles, spacing } from "components/Resume/ResumePDF/styles";
import { DEBUG_RESUME_PDF_FLAG } from "lib/constants";
import { DEFAULT_FONT_COLOR } from "lib/redux/settingsSlice";
import {
  useTemplate,
  useKeepTogether,
  useKeepWithNext,
} from "components/Resume/ResumePDF/templateContext";

const RULE_GRAY = "#d4d4d4";
// Keep a heading together with at least this much of the content that follows it (pt)
const HEADING_MIN_PRESENCE_AHEAD = 48;

const ResumePDFHeading = ({
  heading,
  themeColor,
}: {
  heading: string;
  themeColor?: string;
}) => {
  const { heading: variant } = useTemplate();
  const keepWithNext = useKeepWithNext(HEADING_MIN_PRESENCE_AHEAD);
  const accent = themeColor || DEFAULT_FONT_COLOR;
  const baseText = { fontWeight: "bold", letterSpacing: "0.3pt" } as const;

  switch (variant) {
    case "underline":
      return (
        <View
          {...keepWithNext}
          style={{
            borderBottomWidth: "1.5pt",
            borderBottomStyle: "solid",
            borderBottomColor: accent,
            paddingBottom: spacing["1"],
          }}
        >
          <Text
            style={{ ...baseText, color: accent }}
            debug={DEBUG_RESUME_PDF_FLAG}
          >
            {heading}
          </Text>
        </View>
      );
    case "pill":
      return (
        <View
          {...keepWithNext}
          style={{ ...styles.flexRow }}
        >
          <Text
            style={{
              ...baseText,
              color: "#FFFFFF",
              backgroundColor: accent,
              borderRadius: "3pt",
              padding: `${spacing["1"]} ${spacing["2.5"]}`,
            }}
            debug={DEBUG_RESUME_PDF_FLAG}
          >
            {heading}
          </Text>
        </View>
      );
    case "ruled":
      return (
        <View
          {...keepWithNext}
          style={{ ...styles.flexRow, alignItems: "center" }}
        >
          <Text
            style={{ ...baseText, letterSpacing: "1pt" }}
            debug={DEBUG_RESUME_PDF_FLAG}
          >
            {heading}
          </Text>
          <View
            style={{
              flexGrow: 1,
              height: "0.75pt",
              backgroundColor: RULE_GRAY,
              marginLeft: spacing["3"],
            }}
          />
        </View>
      );
    case "centered-rule":
      return (
        <View
          {...keepWithNext}
          style={{
            ...styles.flexRow,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              flexGrow: 1,
              height: "0.75pt",
              backgroundColor: accent,
              marginRight: spacing["3"],
            }}
          />
          <Text
            style={{ ...baseText, letterSpacing: "1.5pt" }}
            debug={DEBUG_RESUME_PDF_FLAG}
          >
            {heading}
          </Text>
          <View
            style={{
              flexGrow: 1,
              height: "0.75pt",
              backgroundColor: accent,
              marginLeft: spacing["3"],
            }}
          />
        </View>
      );
    default:
      // "bar" (classic)
      return (
        <View
          {...keepWithNext}
          style={{ ...styles.flexRow, alignItems: "center" }}
        >
          {themeColor && (
            <View
              style={{
                height: "3.75pt",
                width: "30pt",
                backgroundColor: themeColor,
                marginRight: spacing["3.5"],
              }}
              debug={DEBUG_RESUME_PDF_FLAG}
            />
          )}
          <Text style={baseText} debug={DEBUG_RESUME_PDF_FLAG}>
            {heading}
          </Text>
        </View>
      );
  }
};

export const ResumePDFSection = ({
  themeColor,
  heading,
  style = {},
  children,
}: {
  themeColor?: string;
  heading?: string;
  style?: Style;
  children: React.ReactNode;
}) => (
  <View
    style={{
      ...styles.flexCol,
      gap: spacing["2"],
      marginTop: spacing["5"],
      ...style,
    }}
  >
    {heading && <ResumePDFHeading heading={heading} themeColor={themeColor} />}
    {children}
  </View>
);

export const ResumePDFText = ({
  bold = false,
  themeColor,
  style = {},
  children,
}: {
  bold?: boolean;
  themeColor?: string;
  style?: Style;
  children: React.ReactNode;
}) => {
  return (
    <Text
      style={{
        color: themeColor || DEFAULT_FONT_COLOR,
        fontWeight: bold ? "bold" : "normal",
        ...style,
      }}
      debug={DEBUG_RESUME_PDF_FLAG}
    >
      {children}
    </Text>
  );
};

export const ResumePDFBulletList = ({
  items,
  showBulletPoints = true,
}: {
  items: string[];
  showBulletPoints?: boolean;
}) => {
  const keepTogether = useKeepTogether();
  return (
    <>
      {items.map((item, idx) => (
        <View style={{ ...styles.flexRow }} key={idx} {...keepTogether}>
          {showBulletPoints && (
            <ResumePDFText
              style={{
                paddingLeft: spacing["2"],
                paddingRight: spacing["2"],
                lineHeight: "1.3",
              }}
              bold={true}
            >
              {"•"}
            </ResumePDFText>
          )}
          {/* A breaking change was introduced causing text layout to be wider than node's width
              https://github.com/diegomura/react-pdf/issues/2182. flexGrow & flexBasis fixes it */}
          <ResumePDFText
            style={{ lineHeight: "1.3", flexGrow: 1, flexBasis: 0 }}
          >
            {item}
          </ResumePDFText>
        </View>
      ))}
    </>
  );
};

export const ResumePDFLink = ({
  src,
  isPDF,
  children,
}: {
  src: string;
  isPDF: boolean;
  children: React.ReactNode;
}) => {
  if (isPDF) {
    return (
      <Link src={src} style={{ textDecoration: "none" }}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={src}
      style={{ textDecoration: "none" }}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  );
};

export const ResumeFeaturedSkill = ({
  skill,
  rating,
  themeColor,
  style = {},
}: {
  skill: string;
  rating: number;
  themeColor: string;
  style?: Style;
}) => {
  const numCircles = 5;

  return (
    <View style={{ ...styles.flexRow, alignItems: "center", ...style }}>
      <ResumePDFText style={{ marginRight: spacing[0.5] }}>
        {skill}
      </ResumePDFText>
      {[...Array(numCircles)].map((_, idx) => (
        <View
          key={idx}
          style={{
            height: "9pt",
            width: "9pt",
            marginLeft: "2.25pt",
            backgroundColor: rating >= idx ? themeColor : "#d9d9d9",
            borderRadius: "100%",
          }}
        />
      ))}
    </View>
  );
};
