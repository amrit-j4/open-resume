"use client";
import { useState } from "react";
import { useSetDefaultScale } from "components/Resume/hooks";
import { SignUpToDownloadModal } from "components/Resume/SignUpToDownloadModal";
import { isSignedIn } from "lib/auth-gate";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

export const ResumeControlBar = ({
  scale,
  setScale,
  documentSize,
  pdfUrl,
  fileName,
}: {
  scale: number;
  setScale: (scale: number) => void;
  documentSize: string;
  /** Object URL of the generated PDF; null while it is being generated */
  pdfUrl: string | null;
  fileName: string;
}) => {
  const { scaleOnResize, setScaleOnResize } = useSetDefaultScale({
    setScale,
    documentSize,
  });

  const [checking, setChecking] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  // Downloads require a Job4online account. The check runs on every click so a
  // user who just signed up in another tab can continue without reloading.
  const handleDownload = async () => {
    if (!pdfUrl) return;
    setChecking(true);
    setGateError(null);
    try {
      if (await isSignedIn()) {
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = fileName;
        a.click();
        setShowSignUp(false);
      } else {
        setShowSignUp(true);
      }
    } catch {
      setShowSignUp(true);
      setGateError(
        "We couldn't verify your sign-in. Check your connection and try again."
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="sticky bottom-0 left-0 right-0 flex h-[var(--resume-control-bar-height)] items-center justify-center px-[var(--resume-padding)] text-gray-600 lg:justify-between">
      <div className="flex items-center gap-2">
        <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.01}
          value={scale}
          onChange={(e) => {
            setScaleOnResize(false);
            setScale(Number(e.target.value));
          }}
        />
        <div className="w-10">{`${Math.round(scale * 100)}%`}</div>
        <label className="hidden items-center gap-1 lg:flex">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4"
            checked={scaleOnResize}
            onChange={() => setScaleOnResize((prev) => !prev)}
          />
          <span className="select-none">Autoscale</span>
        </label>
      </div>
      <button
        type="button"
        className="ml-1 flex items-center gap-1 rounded-md border border-gray-300 px-3 py-0.5 hover:bg-gray-100 disabled:opacity-50 lg:ml-8"
        onClick={handleDownload}
        disabled={checking || !pdfUrl}
      >
        <ArrowDownTrayIcon className="h-4 w-4" />
        <span className="whitespace-nowrap">
          {checking ? "Checking..." : "Download Resume"}
        </span>
      </button>
      {showSignUp && (
        <SignUpToDownloadModal
          checking={checking}
          error={gateError}
          onRetry={handleDownload}
          onClose={() => setShowSignUp(false)}
        />
      )}
    </div>
  );
};

export const ResumeControlBarBorder = () => (
  <div className="absolute bottom-[var(--resume-control-bar-height)] w-full border-t-2 bg-gray-50" />
);
