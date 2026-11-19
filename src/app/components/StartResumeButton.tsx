"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getHasUsedAppBefore,
  saveStateToLocalStorage,
} from "lib/redux/local-storage";
import { getSampleResume, getSampleSettings } from "lib/sample-resume";
import { initialResumeState } from "lib/redux/resumeSlice";
import { initialSettings } from "lib/redux/settingsSlice";
import { deepClone } from "lib/deep-clone";
import { clearEditingResume } from "lib/editing-resume";
import { ConfirmModal } from "components/ConfirmModal";
import { applyProfilePrefill, fetchProfilePrefill } from "lib/profile-prefill";

type Kind = "sample" | "blank";

/**
 * Loads a sample resume (to explore and edit) or a blank one into the builder.
 * Asks first, in an in-app dialog, if it would replace data saved in this browser.
 */
export const StartResumeButton = ({
  kind,
  className,
  children,
}: {
  kind: Kind;
  className?: string;
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      // A blank resume starts with whatever the signed-in account already has (name, email, phone, location, summary).
      const state =
        kind === "sample"
          ? { resume: getSampleResume(), settings: getSampleSettings() }
          : {
              resume: applyProfilePrefill(
                deepClone(initialResumeState),
                await fetchProfilePrefill()
              ),
              settings: deepClone(initialSettings),
            };
      saveStateToLocalStorage(state);
      // A sample or blank resume is not the account resume being edited.
      clearEditingResume();
      router.push("/resume-builder");
    } finally {
      setStarting(false);
    }
  };

  const onClick = () => {
    if (getHasUsedAppBefore()) {
      setConfirming(true);
    } else {
      void start();
    }
  };

  const onCancel = useCallback(() => setConfirming(false), []);

  return (
    <>
      <button type="button" onClick={onClick} disabled={starting} className={className}>
        {children}
      </button>
      {confirming && (
        <ConfirmModal
          title="Replace your saved resume?"
          message={`This will replace the resume currently saved in this browser with ${
            kind === "sample" ? "a sample resume" : "a blank resume"
          }. This can't be undone.`}
          confirmLabel={
            kind === "sample" ? "Replace with sample" : "Start from scratch"
          }
          onConfirm={() => {
            setConfirming(false);
            void start();
          }}
          onCancel={onCancel}
        />
      )}
    </>
  );
};
