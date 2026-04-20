import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  isBoostActive,
  type Region,
  type Selection,
} from "@/types/region";
import { calculateRegionPrice, formatSol } from "@/solana/pricing";
import { type AnimatedImage } from "@/hooks/useAnimatedImages";
import { RegionContext, type RegionContextType } from "@/context/RegionContext";
import { PREVIEW_PROJECTS } from "@/data/previewRegions";

const PREVIEW_OWNER = "Preview1111111111111111111111111111111111111";
const PREVIEW_TOAST = () =>
  toast("Preview only", {
    description: "This is a static demo — connect on the live canvas to mint.",
  });

function buildRegions(): Region[] {
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const hourAgo = nowSec - 3600n;
  return PREVIEW_PROJECTS.map((p, i): Region => {
    // Winners get trending; every 4th non-winner gets a boost for visual variety.
    const boosts =
      p.isWinner
        ? { trendingAt: hourAgo, highlightedAt: 0n, glowingAt: 0n }
        : i % 4 === 0
          ? { highlightedAt: hourAgo, glowingAt: 0n, trendingAt: 0n }
          : i % 4 === 1
            ? { glowingAt: hourAgo, highlightedAt: 0n, trendingAt: 0n }
            : { highlightedAt: 0n, glowingAt: 0n, trendingAt: 0n };
    return {
      id: `preview-${p.slug}`,
      startX: p.x,
      startY: p.y,
      width: p.w,
      height: p.h,
      owner: PREVIEW_OWNER,
      imageUrl: p.logoUrl,
      imageUri: p.logoUrl,
      linkUrl: p.linkUrl,
      purchasePrice: 0,
      isListed: false,
      listing: null,
      createdAt: Date.now() - (i + 1) * 60_000,
      ...boosts,
    };
  });
}

export const MockRegionProvider = ({ children }: { children: ReactNode }) => {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(
    new Map()
  );

  const regions = useMemo(() => buildRegions(), []);

  const occupancy = useMemo(() => {
    const s = new Set<string>();
    for (const r of regions) {
      for (let y = r.startY; y < r.startY + r.height; y++) {
        for (let x = r.startX; x < r.startX + r.width; x++) {
          s.add(`${x}:${y}`);
        }
      }
    }
    return s;
  }, [regions]);

  // Preload logos into the canvas image cache. We intentionally omit
  // `loadedImages` from deps — including it would re-run this effect every time
  // a single image loads, firing duplicate requests for every still-pending
  // region and tripping unavatar.io rate limits.
  useEffect(() => {
    for (const r of regions) {
      if (!r.imageUrl) continue;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setLoadedImages((prev) => {
          const next = new Map(prev);
          next.set(r.id, img);
          return next;
        });
      };
      img.src = r.imageUrl;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  const isOccupied = useCallback(
    (col: number, row: number) => occupancy.has(`${col}:${row}`),
    [occupancy]
  );

  const getRegionAt = useCallback(
    (col: number, row: number): Region | undefined =>
      regions.find(
        (r) =>
          col >= r.startX &&
          col < r.startX + r.width &&
          row >= r.startY &&
          row < r.startY + r.height
      ),
    [regions]
  );

  const hasOverlap = useCallback(
    (sel: Selection) => {
      for (let r = sel.row; r < sel.row + sel.height; r++) {
        for (let c = sel.col; c < sel.col + sel.width; c++) {
          if (occupancy.has(`${c}:${r}`)) return true;
        }
      }
      return false;
    },
    [occupancy]
  );

  const calculatePrice = useCallback((sel: Selection) => {
    // Use curve at half-saturation so prices feel representative on the demo.
    const curveBlocksSold = 9000;
    const lamports = calculateRegionPrice(
      sel.col,
      sel.row,
      sel.width,
      sel.height,
      curveBlocksSold
    );
    return { lamports, display: formatSol(lamports) };
  }, []);

  const noop = useCallback(async () => {
    PREVIEW_TOAST();
    throw new Error("preview: writes disabled");
  }, []);

  const nowSec = Math.floor(Date.now() / 1000);
  const trendingRegions = useMemo(
    () => regions.filter((r) => isBoostActive(r.trendingAt, nowSec)),
    [regions, nowSec]
  );

  const animatedImages = useMemo(() => new Map<string, AnimatedImage>(), []);
  const isAssetHidden = useCallback(() => false, []);

  const value: RegionContextType = {
    regions,
    occupancy,
    selectedRegion,
    setSelectedRegion,
    isOccupied,
    getRegionAt,
    hasOverlap,
    purchaseRegion: noop as RegionContextType["purchaseRegion"],
    setRegionImage: noop as RegionContextType["setRegionImage"],
    setRegionLink: noop as RegionContextType["setRegionLink"],
    listRegion: noop as RegionContextType["listRegion"],
    unlistRegion: noop as RegionContextType["unlistRegion"],
    buyListedRegion: noop as RegionContextType["buyListedRegion"],
    buyBoost: noop as RegionContextType["buyBoost"],
    calculatePrice,
    trendingRegions,
    loadedImages,
    animatedImages,
    isAssetHidden,
    imageFit: "contain",
    isLoading: false,
    error: null,
  };

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
};
