"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSetDefaultScale } from "components/Resume/hooks";
import { SignUpToDownloadModal } from "components/Resume/SignUpToDownloadModal";
import { getAccessToken } from "lib/auth-gate";
import { saveResumeToAccount } from "lib/save-resume";
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  BookmarkIcon,
  CheckIcon,
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

  // Save and Download live in the top nav bar, in the slot TopNavBar renders. The state and handlers stay here.
  const [navSlot, setNavSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavSlot(document.getElementById("nav-actions"));
  }, []);

  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [gateAction, setGateAction] = useState<"download" | "save" | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  // Both actions need a Job4online account. The check runs on every click so a visitor who just signed in in another tab can carry on
  // without reloading. Returns the access token, or null after showing the sign-up prompt.
  const requireAccount = async (action: "download" | "save") => {
    setChecking(true);
    setGateError(null);
    try {
      const token = await getAccessToken();
      if (token) {
        setGateAction(null);
        return token;
      }
      setGateAction(action);
      return null;
    } catch {
      setGateAction(action);
      setGateError(
        "We couldn't verify your sign-in. Check your connection and try again."
      );
      return null;
    } finally {
      setChecking(false);
    }
  };

  // Downloading only saves the PDF to this device. It never uploads anything.
  const handleDownload = async () => {
    if (!pdfUrl || !(await requireAccount("download"))) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    a.click();
  };

  // Saving is a separate, explicit action: it files the PDF under the account's resumes, where it is embedded for job matching.
  const handleSave = async () => {
    if (!pdfUrl) return;
    setSaveError(null);
    const token = await requireAccount("save");
    if (!token) return;
    setSaving(true);
    try {
      await saveResumeToAccount(pdfUrl, fileName, token);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const actions = (
    <>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 focus-visible:bg-gray-100 disabled:opacity-50"
        onClick={handleSave}
        disabled={checking || saving || !pdfUrl}
        aria-label={saved ? "Saved to Job4online" : "Save to Job4online"}
      >
        {saved ? (
          <CheckIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="hidden whitespace-nowrap xl:inline" aria-live="polite">
          {saving ? "Saving…" : saved ? "Saved to Job4online" : "Save to Job4online"}
        </span>
      </button>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 focus-visible:bg-gray-100 disabled:opacity-50"
        onClick={handleDownload}
        disabled={checking || !pdfUrl}
        aria-label="Download"
      >
        <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
        <span className="hidden whitespace-nowrap xl:inline">
          {checking ? "Checking…" : "Download"}
        </span>
      </button>
    </>
  );

  return (
    <div className="sticky bottom-0 left-0 right-0 flex h-[var(--resume-control-bar-height)] items-center justify-center gap-4 px-[var(--resume-padding)] text-gray-600 lg:justify-between">
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
      {saveError && (
        <span className="text-sm text-red-600" role="alert">
          {saveError}
        </span>
      )}
      {/* Save and Download render in the top nav bar. */}
      {navSlot && createPortal(actions, navSlot)}
      {gateAction && (
        <SignUpToDownloadModal
          action={gateAction}
          checking={checking}
          error={gateError}
          onRetry={gateAction === "save" ? handleSave : handleDownload}
          onClose={() => setGateAction(null)}
        />
      )}
    </div>
  );
};

export const ResumeControlBarBorder = () => (
  <div className="absolute bottom-[var(--resume-control-bar-height)] w-full border-t-2 bg-gray-50" />
);
