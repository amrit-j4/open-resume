import { configureStore } from "@reduxjs/toolkit";
import resumeReducer from "lib/redux/resumeSlice";
import settingsReducer from "lib/redux/settingsSlice";
import type { RootState } from "lib/redux/store";

/**
 * A separate, in-memory copy of the builder's store, so the builder's own forms can be shown somewhere else (the analysis page) over a resume
 * of their own. Nothing here is saved: the builder's store, and what is saved in the browser, are never touched.
 */
export const makeStore = (preloadedState: RootState) =>
  configureStore({
    reducer: { resume: resumeReducer, settings: settingsReducer },
    preloadedState,
  });

export type MadeStore = ReturnType<typeof makeStore>;
