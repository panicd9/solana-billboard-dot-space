import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Region, Selection, GRID_COLS, GRID_ROWS, PRICE_PER_BLOCK } from "@/types/region";

interface RegionContextType {
  regions: Region[];
  occupancy: Map<string, string>; // "x:y" -> regionId
  selectedRegion: Region | null;
  setSelectedRegion: (r: Region | null) => void;
  isOccupied: (col: number, row: number) => boolean;
  getRegionAt: (col: number, row: number) => Region | undefined;
  hasOverlap: (sel: Selection) => boolean;
  purchaseRegion: (sel: Selection) => Region;
  setRegionImage: (regionId: string, imageUrl: string) => void;
  setRegionLink: (regionId: string, linkUrl: string) => void;
  listRegion: (regionId: string, price: number) => void;
  unlistRegion: (regionId: string) => void;
  buyListedRegion: (regionId: string, buyerAddress: string) => void;
  loadedImages: Map<string, HTMLImageElement>;
}

const RegionContext = createContext<RegionContextType | null>(null);

export const useRegions = () => {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegions must be inside RegionProvider");
  return ctx;
};

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function generateMockAddress() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let addr = "";
  for (let i = 0; i < 44; i++) addr += chars[Math.floor(Math.random() * chars.length)];
  return addr;
}

export const RegionProvider = ({ children }: { children: ReactNode }) => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [occupancy, setOccupancy] = useState<Map<string, string>>(new Map());
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  const isOccupied = useCallback((col: number, row: number) => occupancy.has(`${col}:${row}`), [occupancy]);

  const getRegionAt = useCallback(
    (col: number, row: number) => {
      const id = occupancy.get(`${col}:${row}`);
      return id ? regions.find((r) => r.id === id) : undefined;
    },
    [occupancy, regions]
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

  const purchaseRegion = useCallback(
    (sel: Selection): Region => {
      const id = generateId();
      const totalBlocks = sel.width * sel.height;
      const region: Region = {
        id,
        startX: sel.col,
        startY: sel.row,
        width: sel.width,
        height: sel.height,
        owner: generateMockAddress(),
        imageUrl: "",
        linkUrl: "",
        purchasePrice: totalBlocks * PRICE_PER_BLOCK,
        isListed: false,
        createdAt: Date.now(),
      };
      setRegions((prev) => [...prev, region]);
      setOccupancy((prev) => {
        const next = new Map(prev);
        for (let r = sel.row; r < sel.row + sel.height; r++) {
          for (let c = sel.col; c < sel.col + sel.width; c++) {
            next.set(`${c}:${r}`, id);
          }
        }
        return next;
      });
      return region;
    },
    []
  );

  const setRegionImage = useCallback((regionId: string, imageUrl: string) => {
    setRegions((prev) => prev.map((r) => (r.id === regionId ? { ...r, imageUrl } : r)));
    // Preload image
    const img = new Image();
    img.onload = () => {
      setLoadedImages((prev) => {
        const next = new Map(prev);
        next.set(regionId, img);
        return next;
      });
    };
    img.src = imageUrl;
  }, []);

  const setRegionLink = useCallback((regionId: string, linkUrl: string) => {
    setRegions((prev) => prev.map((r) => (r.id === regionId ? { ...r, linkUrl } : r)));
  }, []);

  const listRegion = useCallback((regionId: string, price: number) => {
    setRegions((prev) => prev.map((r) => (r.id === regionId ? { ...r, isListed: true, listingPrice: price } : r)));
  }, []);

  const unlistRegion = useCallback((regionId: string) => {
    setRegions((prev) => prev.map((r) => (r.id === regionId ? { ...r, isListed: false, listingPrice: undefined } : r)));
  }, []);

  const buyListedRegion = useCallback((regionId: string, buyerAddress: string) => {
    setRegions((prev) =>
      prev.map((r) =>
        r.id === regionId ? { ...r, owner: buyerAddress, isListed: false, listingPrice: undefined } : r
      )
    );
  }, []);

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
        loadedImages,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
};
