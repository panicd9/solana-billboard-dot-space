import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface ModerationEntry {
  reason?: string;
  date?: string;
}

interface ModerationFile {
  version: number;
  hidden: Record<string, ModerationEntry>;
}

const MODERATION_URL =
  (import.meta.env.VITE_MODERATION_URL as string | undefined)?.trim() ||
  "/moderation.json";

const EMPTY_HIDDEN: Record<string, ModerationEntry> = {};

export interface UseModerationListResult {
  hiddenIds: Set<string>;
  entries: Record<string, ModerationEntry>;
  isHidden: (assetId: string) => boolean;
  isLoading: boolean;
}

export const useModerationList = (): UseModerationListResult => {
  const query = useQuery<ModerationFile>({
    queryKey: ["moderation-list", MODERATION_URL],
    queryFn: async () => {
      const res = await fetch(MODERATION_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`moderation fetch ${res.status}`);
      const json = (await res.json()) as ModerationFile;
      if (typeof json !== "object" || json === null || typeof json.hidden !== "object") {
        throw new Error("moderation payload malformed");
      }
      return json;
    },
    // Short stale time so takedowns propagate quickly once the JSON/Edge Config updates.
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    // Fail-open on network error: rather than hiding nothing OR breaking the
    // UI, we keep the last-known hide set and retry in the background.
    retry: 1,
  });

  const entries = query.data?.hidden ?? EMPTY_HIDDEN;
  const hiddenIds = useMemo(() => new Set(Object.keys(entries)), [entries]);
  const isHidden = useMemo(
    () => (assetId: string) => hiddenIds.has(assetId),
    [hiddenIds]
  );

  return { hiddenIds, entries, isHidden, isLoading: query.isLoading };
};
