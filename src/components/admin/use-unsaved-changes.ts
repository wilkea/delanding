"use client";

import { useEffect } from "react";

export function useUnsavedChanges(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) {
      return;
    }

    function beforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function click(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank" || event.defaultPrevented) {
        return;
      }

      const url = new URL(link.getAttribute("href")!, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname && !window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, message]);
}
