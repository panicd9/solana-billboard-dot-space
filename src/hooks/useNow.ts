import { useEffect, useState } from "react";

/** Re-renders at `intervalMs` and returns `Date.now()` — for countdown timers. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useNowSeconds(intervalMs = 1000): number {
  return Math.floor(useNow(intervalMs) / 1000);
}
