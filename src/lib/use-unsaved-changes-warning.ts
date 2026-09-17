"use client";

import { useEffect } from "react";

// Warns before closing/navigating away from the tab while there are unsaved edits.
// Does not intercept in-app client-side navigation (browsers limit that to the native beforeunload prompt).
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    function handler(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
