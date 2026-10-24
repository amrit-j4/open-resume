"use client";
import { useEffect, useRef, useState } from "react";
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

  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) setAccountOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen]);

  return (
    <header
      aria-label="Site Header"
      className={cx(
        "flex h-[var(--top-nav-bar-height)] items-center border-b-2 border-gray-100 px-3 lg:px-12",
        isHomePage && "bg-dot"
      )}
    >
      <div className="flex h-10 w-full items-center justify-between ">
        <Link href="/" className="shrink-0">
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
          className="flex items-center justify-start gap-2 text-sm font-medium lg:ml-8"
        >
          {[
            ["/resume-builder", "Resume Builder"],
            ["/resume-analysis", "Resume Analysis"],
            ["/resume-parser", "ATS Checker"],
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
        <div className="ml-auto flex items-center justify-end gap-2 text-sm font-medium">
          {/* The resume builder fills this slot with its Save and Download actions (see ResumeControlBar). */}
          <div id="nav-actions" className="flex items-center gap-2" />
          {user && (
            <a
              href={DASHBOARD_URL}
              target="_blank"
              rel="noopener"
              className="hidden rounded-md px-1.5 py-2 text-gray-500 hover:bg-gray-100 focus-visible:bg-gray-100 lg:inline-block lg:px-4"
            >
              Dashboard
            </a>
          )}
          <a
            href={JOB_BOARD_URL}
            target="_blank"
            rel="noopener"
            className="bg-primary ml-1 rounded-lg px-3 py-2 hover:opacity-80 lg:px-4"
          >
            Job Board
          </a>
          {user && (
            <div ref={accountRef} className="relative ml-1">
              <button
                type="button"
                aria-label="Account"
                aria-haspopup="true"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700 hover:bg-gray-200 focus-visible:bg-gray-200"
              >
                {getInitials(user.name)}
              </button>
              {accountOpen && (
                <div
                  role="dialog"
                  aria-label="Account details"
                  className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
                >
                  <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                  {user.email && (
                    <p className="truncate text-sm font-normal text-gray-500">{user.email}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
