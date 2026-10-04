"use client";
import { useRouter } from "next/navigation";
import {
  getHasUsedAppBefore,
  saveStateToLocalStorage,
} from "lib/redux/local-storage";
import { getSampleResume, getSampleSettings } from "lib/sample-resume";
import { initialResumeState } from "lib/redux/resumeSlice";
import { initialSettings } from "lib/redux/settingsSlice";
import { deepClone } from "lib/deep-clone";

type Kind = "sample" | "blank";

/**
 * Loads a sample resume (to explore and edit) or a blank one into the builder.
 * Asks first if it would replace data saved in this browser.
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

  const onClick = () => {
    if (
      getHasUsedAppBefore() &&
      !window.confirm(
        "This will replace the resume currently saved in this browser. Continue?"
      )
    ) {
      return;
    }
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

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
};
