import { useEffect } from "react";
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from "react-redux";
import { store, type RootState, type AppDispatch } from "lib/redux/store";
import {
  loadStateFromLocalStorage,
  saveStateToLocalStorage,
} from "lib/redux/local-storage";
import {
  changeProfile,
  initialResumeState,
  setResume,
} from "lib/redux/resumeSlice";
import { fetchProfilePrefill } from "lib/profile-prefill";
import {
  initialSettings,
  setSettings,
  type Settings,
} from "lib/redux/settingsSlice";
import { deepMerge } from "lib/deep-merge";
import type { Resume } from "lib/redux/types";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/**
 * Hook to save store to local storage on store change
 */
export const useSaveStateToLocalStorageOnChange = () => {
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      saveStateToLocalStorage(store.getState());
    });
    return unsubscribe;
  }, []);
};

export const useSetInitialStore = () => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const state = loadStateFromLocalStorage();
    if (!state) {
      // First time here, nothing saved: start the resume with what the signed-in account already has. Only fields still empty when the
      // answer arrives are filled, so anything typed in the meantime is kept.
      let cancelled = false;
      void fetchProfilePrefill().then((prefill) => {
        if (cancelled || !prefill) return;
        const current = store.getState().resume.profile;
        for (const field of Object.keys(prefill) as (keyof typeof prefill)[]) {
          const value = prefill[field];
          if (value && !current[field].trim()) {
            dispatch(changeProfile({ field, value }));
          }
        }
      });
      return () => {
        cancelled = true;
      };
    }
    if (state.resume) {
      // We merge the initial state with the stored state to ensure
      // backward compatibility, since new fields might be added to
      // the initial state over time.
      const mergedResumeState = deepMerge(
        initialResumeState,
        state.resume
      ) as Resume;
      dispatch(setResume(mergedResumeState));
    }
    if (state.settings) {
      const mergedSettingsState = deepMerge(
        initialSettings,
        state.settings
      ) as Settings;
      dispatch(setSettings(mergedSettingsState));
    }
  }, []);
};
