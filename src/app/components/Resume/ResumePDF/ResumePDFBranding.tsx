import { View, Text, Image } from "@react-pdf/renderer";
import { styles } from "components/Resume/ResumePDF/styles";

const LOGO_SRC = "/logo-small.png";
// Logo is 360x207 (ratio ~1.74); keep it small and unobtrusive
const LOGO_HEIGHT_PT = 17;
const LOGO_WIDTH_PT = Math.round(LOGO_HEIGHT_PT * (360 / 207) * 10) / 10;

/**
 * "Powered by <Job4online logo>" pinned to the bottom-right corner of every page.
 * In the PDF it repeats on each page (`fixed`); in the on-screen preview (not
 * rendered by react-pdf) it is positioned against the page element instead.
 */
export const ResumePDFBranding = ({ isPDF }: { isPDF: boolean }) => (
  <View
    {...(isPDF ? { fixed: true } : {})}
    style={{
      ...styles.flexRow,
      position: "absolute",
      bottom: "14pt",
      right: "24pt",
      alignItems: "center",
    }}
  >
    <Text style={{ fontSize: "7pt", color: "#737373", marginRight: "3pt" }}>
      Powered by
    </Text>
    {isPDF ? (
      // react-pdf's Image has no alt prop; this is not an HTML <img>
      // eslint-disable-next-line jsx-a11y/alt-text
      <Image
        src={LOGO_SRC}
        style={{ height: `${LOGO_HEIGHT_PT}pt`, width: `${LOGO_WIDTH_PT}pt` }}
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt="Job4online"
        style={{
          height: `${LOGO_HEIGHT_PT}pt`,
          width: `${LOGO_WIDTH_PT}pt`,
        }}
      />
    )}
  </View>
);
