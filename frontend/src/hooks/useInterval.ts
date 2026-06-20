import { useEffect, useRef } from "react";

/** Calls `callback` every `delayMs`. Pass `null` to pause. */
export function useInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => saved.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}

/** Re-runs `callback` when the tab/window regains focus. */
export function useRefreshOnFocus(callback: () => void) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    const handler = () => saved.current();
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);
}
