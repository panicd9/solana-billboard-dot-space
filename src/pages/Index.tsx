import { useState, useCallback } from "react";
import { Selection } from "@/types/region";
import { RegionProvider, useRegions } from "@/context/RegionContext";
import PixelCanvas from "@/components/PixelCanvas";
import CanvasToolbar from "@/components/CanvasToolbar";
import PurchasePanel from "@/components/PurchasePanel";
import RegionSidebar from "@/components/RegionSidebar";
import MarketplaceView from "@/components/MarketplaceView";

const IndexInner = () => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<"canvas" | "marketplace">("canvas");
  const { regions, setSelectedRegion, selectedRegion } = useRegions();

  const handleRegionClick = useCallback(
    (regionId: string) => {
      const region = regions.find((r) => r.id === regionId);
      if (region) {
        setSelectedRegion(region);
        setSelection(null);
      }
    },
    [regions, setSelectedRegion]
  );

  const handleMarketplaceHighlight = useCallback(
    (regionId: string) => {
      setView("canvas");
    },
    []
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <CanvasToolbar view={view} onViewChange={setView} />
      <div className="flex flex-1 overflow-hidden relative">
        {view === "canvas" ? (
          <>
            <div className="flex-1 flex relative overflow-hidden">
              <PixelCanvas
                selection={selection}
                onSelectionChange={setSelection}
                onRegionClick={handleRegionClick}
              />
              <PurchasePanel
                selection={selection}
                onClearSelection={() => setSelection(null)}
              />
            </div>
            {selectedRegion && <RegionSidebar />}
          </>
        ) : (
          <>
            <MarketplaceView onHighlightRegion={handleMarketplaceHighlight} />
            {selectedRegion && <RegionSidebar />}
          </>
        )}
      </div>
    </div>
  );
};

const Index = () => (
  <RegionProvider>
    <IndexInner />
  </RegionProvider>
);

export default Index;
