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
import { ConfirmModal } from "components/ConfirmModal";

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

  const start = () => {
    const state =
      kind === "sample"
        ? { resume: getSampleResume(), settings: getSampleSettings() }
        : {
            resume: deepClone(initialResumeState),
            settings: deepClone(initialSettings),
          };
    saveStateToLocalStorage(state);
    router.push("/resume-builder");
  };

  const onClick = () => {
    if (getHasUsedAppBefore()) {
      setConfirming(true);
    } else {
      start();
    }
  };

  const onCancel = useCallback(() => setConfirming(false), []);

  return (
    <>
      <button type="button" onClick={onClick} className={className}>
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
            start();
          }}
          onCancel={onCancel}
        />
      )}
    </>
  );
};
