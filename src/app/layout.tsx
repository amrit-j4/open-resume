import "globals.css";
import { TopNavBar } from "components/TopNavBar";

export const metadata = {
  title: "Job4online Resume Builder - Free Resume Builder and Parser",
  description:
    "Job4online Resume Builder is a free and powerful resume builder that lets you create a modern professional resume in 3 simple steps. Already have a resume? The built-in resume parser helps you test and confirm its ATS readability.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TopNavBar />
        {children}
      </body>
    </html>
  );
}
