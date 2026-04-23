import { useQuery } from "@tanstack/react-query";
import type { Signature } from "@solana/kit";
import { getRpc } from "@/solana/accounts";
import { SOLANA_SPACE_PROGRAM_ADDRESS } from "@/generated/programs";
import { config } from "@/config/env";
import {
  extractEventsFromTransaction,
  type ActivityEvent,
} from "@/solana/activityEvents";

const SIGNATURE_LIMIT = 50;
const FETCH_CONCURRENCY = 8;
const STORAGE_KEY = `activity-cache-${config.network}-v1`;
const MAX_CACHED_EVENTS = 500;

interface CachedActivity {
  events: ActivityEvent[];
  lastSeenSig: string | null;
}

function loadCache(): CachedActivity {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [], lastSeenSig: null };
    const parsed = JSON.parse(raw) as CachedActivity;
    if (!Array.isArray(parsed.events)) return { events: [], lastSeenSig: null };
    return parsed;
  } catch {
    return { events: [], lastSeenSig: null };
  }
}

function saveCache(cache: CachedActivity) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        events: cache.events.slice(0, MAX_CACHED_EVENTS),
        lastSeenSig: cache.lastSeenSig,
      }),
    );
  } catch {
    // Quota/serialization failure — drop the write silently.
  }
}

async function fetchActivity(): Promise<ActivityEvent[]> {
  const rpc = getRpc();
  const cache = loadCache();

  // With a cursor, paginate backwards until we reach lastSeenSig so bursts of
  // more than SIGNATURE_LIMIT tx between polls don't silently drop events.
  // Without one (initial bootstrap), only pull the most recent SIGNATURE_LIMIT
  // to avoid walking the entire program history on first load.
  type SigPage = Awaited<
    ReturnType<ReturnType<typeof rpc.getSignaturesForAddress>["send"]>
  >;
  type SigInfo = SigPage[number];
  const sigs: SigInfo[] = [];
  const hasCursor = !!cache.lastSeenSig;
  let before: Signature | undefined;

  while (true) {
    const batch = await rpc
      .getSignaturesForAddress(SOLANA_SPACE_PROGRAM_ADDRESS, {
        limit: SIGNATURE_LIMIT,
        ...(cache.lastSeenSig ? { until: cache.lastSeenSig as Signature } : {}),
        ...(before ? { before } : {}),
      })
      .send();

    if (batch.length === 0) break;
    sigs.push(...batch);
    if (batch.length < SIGNATURE_LIMIT) break;
    if (!hasCursor) break;
    before = batch[batch.length - 1].signature as Signature;
  }

  if (sigs.length === 0) return cache.events;

  const successful = sigs.filter((s) => s.err === null);
  const newEvents: ActivityEvent[] = [];

  for (let i = 0; i < successful.length; i += FETCH_CONCURRENCY) {
    const chunk = successful.slice(i, i + FETCH_CONCURRENCY);
    const txs = await Promise.all(
      chunk.map(async (sig) => {
        try {
          const tx = await rpc
            .getTransaction(sig.signature as Signature, {
              encoding: "json",
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed",
            })
            .send();
          return { sig, tx };
        } catch {
          return { sig, tx: null };
        }
      }),
    );

    for (const { sig, tx } of txs) {
      if (!tx) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (tx as any).transaction?.message;
      if (!msg) continue;
      const accountKeys: readonly string[] = msg.accountKeys ?? [];
      const instructions = (msg.instructions ?? []) as readonly {
        programIdIndex: number;
        accounts: readonly number[];
        data: string;
      }[];

      const events = extractEventsFromTransaction({
        signature: sig.signature,
        slot: Number(sig.slot),
        blockTime: sig.blockTime != null ? Number(sig.blockTime) : null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        err: (tx as any).meta?.err ?? null,
        accountKeys,
        instructions,
      });
      newEvents.push(...events);
    }
  }

  const seen = new Set<string>();
  const merged: ActivityEvent[] = [];
  for (const e of [...newEvents, ...cache.events]) {
    const key = `${e.signature}:${e.type}:${e.assetAddress ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(e);
  }
  merged.sort((a, b) => {
    const ta = a.blockTime ?? 0;
    const tb = b.blockTime ?? 0;
    if (tb !== ta) return tb - ta;
    return b.slot - a.slot;
  });

  const trimmed = merged.slice(0, MAX_CACHED_EVENTS);
  // sigs is DESC-ordered by slot, so sigs[0] is the newest cursor value.
  const newestSig = sigs[0]?.signature ?? cache.lastSeenSig;
  saveCache({ events: trimmed, lastSeenSig: newestSig });
  return trimmed;
}

export function useActivityEvents() {
  return useQuery({
    queryKey: ["activity-events", SOLANA_SPACE_PROGRAM_ADDRESS],
    queryFn: fetchActivity,
    staleTime: 30_000,
    refetchInterval: 300_000,
    initialData: () => {
      const cache = loadCache();
      return cache.events.length > 0 ? cache.events : undefined;
    },
    initialDataUpdatedAt: 0,
  });
}
