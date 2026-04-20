import { useEffect, useRef, useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import type { Region } from "@/types/region";

export interface AnimatedImage {
  frames: HTMLCanvasElement[];
  delays: number[]; // ms per frame (>= 20)
  totalDuration: number; // ms
  width: number;
  height: number;
}

const isGifBytes = (u8: Uint8Array): boolean =>
  u8.length >= 6 &&
  u8[0] === 0x47 && // G
  u8[1] === 0x49 && // I
  u8[2] === 0x46 && // F
  u8[3] === 0x38; // 8

const isLikelyGifUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".gif");
  } catch {
    return false;
  }
};

/**
 * Decode an animated GIF into pre-rendered canvas frames for fast canvas playback.
 * Returns null for single-frame GIFs, so callers fall back to the static <img> path.
 */
const decodeGif = async (url: string): Promise<AnimatedImage | null> => {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (!isGifBytes(u8)) return null;

  const gif = parseGIF(buf);
  const frames = decompressFrames(gif, true);
  if (frames.length < 2) return null;

  const width = gif.lsd.width;
  const height = gif.lsd.height;

  // Compose each frame onto a full-size canvas, honoring disposal methods.
  const composited = document.createElement("canvas");
  composited.width = width;
  composited.height = height;
  const cctx = composited.getContext("2d");
  if (!cctx) return null;

  const output: HTMLCanvasElement[] = [];
  const delays: number[] = [];
  let prev: ImageData | null = null;

  for (const frame of frames) {
    const { dims, patch, disposalType, delay } = frame;

    // Disposal 3: restore previous. Save current canvas state before overwrite.
    const saved =
      disposalType === 3 ? cctx.getImageData(0, 0, width, height) : null;

    // Paint the frame patch at its dims.
    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = dims.width;
    patchCanvas.height = dims.height;
    const pctx = patchCanvas.getContext("2d");
    if (!pctx) continue;
    const imageData = pctx.createImageData(dims.width, dims.height);
    imageData.data.set(patch);
    pctx.putImageData(imageData, 0, 0);
    cctx.drawImage(patchCanvas, dims.left, dims.top);

    // Snapshot the composited frame.
    const snap = document.createElement("canvas");
    snap.width = width;
    snap.height = height;
    const sctx = snap.getContext("2d");
    if (!sctx) continue;
    sctx.drawImage(composited, 0, 0);
    output.push(snap);
    // Browsers clamp delays < 20ms to 100ms; match that behavior.
    delays.push(delay < 20 ? 100 : delay);

    if (disposalType === 2) {
      // Restore to background — clear to transparent.
      cctx.clearRect(dims.left, dims.top, dims.width, dims.height);
    } else if (disposalType === 3 && saved) {
      cctx.putImageData(saved, 0, 0);
    }
    prev = null;
  }

  if (output.length < 2) return null;

  return {
    frames: output,
    delays,
    totalDuration: delays.reduce((a, b) => a + b, 0),
    width,
    height,
  };
};

/**
 * Load animated GIF frames for regions whose imageUrl points to an animated GIF.
 * Non-GIF and single-frame images are ignored (canvas falls back to static path).
 *
 * `hiddenIds` are region asset IDs that moderation has flagged — we must not
 * fetch or decode their GIFs, otherwise the frontend still pulls disallowed
 * content from Pinata even though the UI renders a placeholder.
 */
export const useAnimatedImages = (
  regions: Region[],
  hiddenIds: Set<string>
): Map<string, AnimatedImage> => {
  const [animated, setAnimated] = useState<Map<string, AnimatedImage>>(new Map());
  // Persist across renders: region IDs whose decode has started. Prevents
  // duplicate fetches if `regions` reference changes before decode completes.
  const inflightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    for (const region of regions) {
      if (!region.imageUrl) continue;
      if (hiddenIds.has(region.id)) continue;
      if (animated.has(region.id)) continue;
      if (inflightRef.current.has(region.id)) continue;
      // Heuristic filter: only try GIF decode when URL hints at a GIF. Avoids
      // a round-trip fetch for every static PNG/JPG region.
      if (!isLikelyGifUrl(region.imageUrl) && !region.imageUrl.toLowerCase().includes(".gif")) {
        continue;
      }
      inflightRef.current.add(region.id);

      decodeGif(region.imageUrl)
        .then((result) => {
          if (cancelled || !result) return;
          setAnimated((prev) => {
            if (prev.has(region.id)) return prev;
            const next = new Map(prev);
            next.set(region.id, result);
            return next;
          });
        })
        .catch(() => {
          // Ignore decode failures — static <img> path handles it.
        })
        .finally(() => {
          inflightRef.current.delete(region.id);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [regions, animated, hiddenIds]);

  return animated;
};
