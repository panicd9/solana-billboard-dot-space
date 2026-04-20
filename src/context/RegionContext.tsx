import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { GRID_COLS, GRID_ROWS, isBoostActive, type Region, type Selection } from "@/types/region";
import { useCanvasState } from "@/hooks/useCanvasState";
import { useOnChainRegions } from "@/hooks/useOnChainRegions";
import { useAnimatedImages, type AnimatedImage } from "@/hooks/useAnimatedImages";
import { useModerationList } from "@/hooks/useModerationList";
import {
  useMintRegion,
  useUpdateRegionImage,
  useUpdateRegionLink,
  useCreateListing,
  useCancelListing,
  useExecutePurchase,
  useBuyBoost,
} from "@/hooks/useProgramTransactions";
import { calculateRegionPrice, formatSol } from "@/solana/pricing";
import { ipfsToGateway } from "@/solana/accounts";

export interface RegionContextType {
  regions: Region[];
  occupancy: Set<string>; // "x:y"
  selectedRegion: Region | null;
  setSelectedRegion: (r: Region | null) => void;
  isOccupied: (col: number, row: number) => boolean;
  getRegionAt: (col: number, row: number) => Region | undefined;
  hasOverlap: (sel: Selection) => boolean;
  purchaseRegion: (sel: Selection, imageFile: File | null, link: string) => Promise<Region>;
  setRegionImage: (assetAddress: string, imageFile: File) => Promise<void>;
  setRegionLink: (assetAddress: string, link: string) => Promise<void>;
  listRegion: (
    assetAddress: string,
    startPrice: bigint,
    endPrice: bigint,
    durationSeconds: bigint
  ) => Promise<void>;
  unlistRegion: (assetAddress: string) => Promise<void>;
  buyListedRegion: (
    assetAddress: string,
    expectedPrice: bigint
  ) => Promise<void>;
  buyBoost: (assetAddress: string, boostFlags: number) => Promise<void>;
  calculatePrice: (sel: Selection) => { lamports: bigint; display: string };
  trendingRegions: Region[];
  loadedImages: Map<string, HTMLImageElement>;
  animatedImages: Map<string, AnimatedImage>;
  isAssetHidden: (assetId: string) => boolean;
  imageFit: "fill" | "cover" | "contain";
  isLoading: boolean;
  error: Error | null;
}

export const RegionContext = createContext<RegionContextType | null>(null);

export const useRegions = () => {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegions must be inside RegionProvider");
  return ctx;
};

export const RegionProvider = ({ children }: { children: ReactNode }) => {
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // On-chain data hooks
  const canvasState = useCanvasState();
  const regionsQuery = useOnChainRegions();

  // Transaction mutations
  const mintMutation = useMintRegion();
  const updateImageMutation = useUpdateRegionImage();
  const updateLinkMutation = useUpdateRegionLink();
  const createListingMutation = useCreateListing();
  const cancelListingMutation = useCancelListing();
  const executePurchaseMutation = useExecutePurchase();
  const buyBoostMutation = useBuyBoost();

  const regions = useMemo(() => regionsQuery.data ?? [], [regionsQuery.data]);
  const occupancy = useMemo(
    () => canvasState.data?.occupiedBlocks ?? new Set<string>(),
    [canvasState.data?.occupiedBlocks]
  );

  const moderation = useModerationList();
  const { hiddenIds, isHidden } = moderation;

  const animatedImages = useAnimatedImages(regions, hiddenIds);

  // Preload images for canvas rendering. Hidden regions are skipped entirely so
  // the browser never fetches disallowed content from Pinata / IPFS gateways.
  useEffect(() => {
    for (const region of regions) {
      if (!region.imageUrl) continue;
      if (hiddenIds.has(region.id)) continue;
      const existing = loadedImages.get(region.id);
      if (existing && existing.src === region.imageUrl) continue;
      const img = new Image();
      // crossOrigin must be set before .src so the browser sends the CORS
      // request. Without it the canvas becomes tainted and toBlob() fails,
      // which breaks share-image generation.
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setLoadedImages((prev) => {
          const next = new Map(prev);
          next.set(region.id, img);
          return next;
        });
      };
      img.src = region.imageUrl;
    }
  }, [regions, loadedImages, hiddenIds]);

  // If a region is hidden after its image was already cached, drop the cached
  // bitmap so PixelCanvas falls through to the placeholder render path.
  useEffect(() => {
    if (hiddenIds.size === 0) return;
    setLoadedImages((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of hiddenIds) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [hiddenIds]);

  // Keep selectedRegion in sync when regions cache updates (optimistic or refetch)
  useEffect(() => {
    if (!selectedRegion || selectedRegion.id.startsWith("bitmap-")) return;
    const updated = regions.find((r) => r.id === selectedRegion.id);
    if (updated) setSelectedRegion(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions]);

  const isOccupied = useCallback(
    (col: number, row: number) => occupancy.has(`${col}:${row}`),
    [occupancy]
  );

  const getRegionAt = useCallback(
    (col: number, row: number): Region | undefined => {
      // First try to find a fully-loaded region whose bounds contain this grid cell
      const found = regions.find(
        (r) =>
          col >= r.startX &&
          col < r.startX + r.width &&
          row >= r.startY &&
          row < r.startY + r.height
      );
      if (found) return found;

      // Fallback: if bitmap says occupied but no Region object loaded,
      // reconstruct region bounds by scanning connected occupied blocks
      if (!occupancy.has(`${col}:${row}`)) return undefined;

      // Expand outward from clicked block to find the rectangular extent
      let minX = col, maxX = col, minY = row, maxY = row;
      // Expand left
      while (minX > 0 && occupancy.has(`${minX - 1}:${row}`)) minX--;
      // Expand right
      while (maxX < GRID_COLS - 1 && occupancy.has(`${maxX + 1}:${row}`)) maxX++;
      // Expand up — only keep rows where the full width is occupied
      while (minY > 0) {
        let fullRow = true;
        for (let x = minX; x <= maxX; x++) {
          if (!occupancy.has(`${x}:${minY - 1}`)) { fullRow = false; break; }
        }
        if (!fullRow) break;
        minY--;
      }
      // Expand down
      while (maxY < GRID_ROWS - 1) {
        let fullRow = true;
        for (let x = minX; x <= maxX; x++) {
          if (!occupancy.has(`${x}:${maxY + 1}`)) { fullRow = false; break; }
        }
        if (!fullRow) break;
        maxY++;
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      return {
        id: `bitmap-${minX}-${minY}-${w}-${h}`,
        startX: minX,
        startY: minY,
        width: w,
        height: h,
        owner: "",
        imageUrl: "",
        imageUri: "",
        linkUrl: "",
        purchasePrice: 0,
        isListed: false,
        listing: null,
        createdAt: 0,
        highlightedAt: 0n,
        glowingAt: 0n,
        trendingAt: 0n,
      };
    },
    [regions, occupancy]
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

  const calculatePrice = useCallback(
    (sel: Selection) => {
      const curveBlocksSold = canvasState.data?.curveBlocksSold ?? 0;
      const lamports = calculateRegionPrice(
        sel.col,
        sel.row,
        sel.width,
        sel.height,
        curveBlocksSold
      );
      return { lamports, display: formatSol(lamports) };
    },
    [canvasState.data?.curveBlocksSold]
  );

  const purchaseRegion = useCallback(
    async (sel: Selection, imageFile: File | null, link: string): Promise<Region> => {
      const result = await mintMutation.mutateAsync({
        x: sel.col,
        y: sel.row,
        width: sel.width,
        height: sel.height,
        imageFile,
        link,
      });

      // Cache was already updated optimistically by the mutation hook;
      // return matching Region so callers have immediate data.
      return {
        id: result.assetAddress as string,
        startX: sel.col,
        startY: sel.row,
        width: sel.width,
        height: sel.height,
        owner: result.owner,
        imageUrl: ipfsToGateway(result.imageUri),
        imageUri: result.imageUri,
        linkUrl: link,
        purchasePrice: 0,
        isListed: false,
        listing: null,
        createdAt: Date.now(),
        highlightedAt: 0n,
        glowingAt: 0n,
        trendingAt: 0n,
      };
    },
    [mintMutation]
  );

  const setRegionImage = useCallback(
    async (assetAddress: string, imageFile: File) => {
      await updateImageMutation.mutateAsync({ assetAddress, imageFile });
    },
    [updateImageMutation]
  );

  const setRegionLink = useCallback(
    async (assetAddress: string, link: string) => {
      await updateLinkMutation.mutateAsync({ assetAddress, link });
    },
    [updateLinkMutation]
  );

  const listRegion = useCallback(
    async (
      assetAddress: string,
      startPrice: bigint,
      endPrice: bigint,
      durationSeconds: bigint
    ) => {
      await createListingMutation.mutateAsync({
        assetAddress,
        startPrice,
        endPrice,
        durationSeconds,
      });
    },
    [createListingMutation]
  );

  const unlistRegion = useCallback(
    async (assetAddress: string) => {
      await cancelListingMutation.mutateAsync(assetAddress);
    },
    [cancelListingMutation]
  );

  const buyListedRegion = useCallback(
    async (assetAddress: string, expectedPrice: bigint) => {
      await executePurchaseMutation.mutateAsync({
        assetAddress,
        expectedPrice,
      });
    },
    [executePurchaseMutation]
  );

  const buyBoost = useCallback(
    async (assetAddress: string, boostFlags: number) => {
      await buyBoostMutation.mutateAsync({ assetAddress, boostFlags });
    },
    [buyBoostMutation]
  );

  // Re-evaluate Trending membership every 30s so expired boosts drop off without a refetch.
  const [trendingTick, setTrendingTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTrendingTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const trendingRegions = useMemo(
    () => {
      const nowSec = Math.floor(Date.now() / 1000);
      return regions.filter((r) => isBoostActive(r.trendingAt, nowSec));
    },
    [regions, trendingTick]
  );

  const isLoading = canvasState.isLoading || regionsQuery.isLoading;
  const error = (canvasState.error ?? regionsQuery.error) as Error | null;

  return (
    <RegionContext.Provider
      value={{
        regions,
        occupancy,
        selectedRegion,
        setSelectedRegion,
        isOccupied,
        getRegionAt,
        hasOverlap,
        purchaseRegion,
        setRegionImage,
        setRegionLink,
        listRegion,
        unlistRegion,
        buyListedRegion,
        buyBoost,
        calculatePrice,
        trendingRegions,
        loadedImages,
        animatedImages,
        isAssetHidden: isHidden,
        imageFit: "fill",
        isLoading,
        error,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};
