"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import logoSrc from "public/logo.png";
import { cx } from "lib/cx";
import { DASHBOARD_URL, JOB_BOARD_URL, SITE_NAME } from "lib/site-config";
import { getInitials, useSessionUser } from "lib/use-session-user";

export const TopNavBar = () => {
  const pathName = usePathname();
  const user = useSessionUser();
  const isHomePage = pathName === "/";

  return (
    <header
      aria-label="Site Header"
      className={cx(
        "flex h-[var(--top-nav-bar-height)] items-center border-b-2 border-gray-100 px-3 lg:px-12",
        isHomePage && "bg-dot"
      )}
    >
      <div className="flex h-10 w-full items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="justify-self-start">
          <span className="sr-only">{SITE_NAME}</span>
          <Image
            src={logoSrc}
            alt={`${SITE_NAME} Logo`}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <nav
          aria-label="Site Nav Bar"
          className="flex items-center justify-center gap-2 text-sm font-medium"
        >
          {[
            ["/resume-builder", "Resume Builder"],
            ["/resume-parser", "Resume Checker"],
          ].map(([href, text]) => (
            <Link
              key={text}
              className="rounded-md px-1.5 py-2 text-gray-500 hover:bg-gray-100 focus-visible:bg-gray-100 lg:px-4"
              href={href}
            >
              {text}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-2 text-sm font-medium">
          {/* The resume builder fills this slot with its Save and Download actions (see ResumeControlBar). */}
          <div id="nav-actions" className="flex items-center gap-2" />
          {user && (
            <a
              href={DASHBOARD_URL}
              className="hidden rounded-md px-1.5 py-2 text-gray-500 hover:bg-gray-100 focus-visible:bg-gray-100 lg:inline-block lg:px-4"
            >
              Dashboard
            </a>
          )}
          <a
            href={JOB_BOARD_URL}
            className="bg-primary ml-1 rounded-lg px-3 py-2 hover:opacity-80 lg:px-4"
          >
            Job Board
          </a>
          {user && (
            <a
              href={DASHBOARD_URL}
              title={`${user.name}${user.email ? ` (${user.email})` : ""}`}
              aria-label={`Signed in as ${user.name}. Go to dashboard`}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              {getInitials(user.name)}
            </a>
          )}
        </div>
      </div>
    </header>
  );
};
