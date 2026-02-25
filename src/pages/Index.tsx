import { useState, useCallback } from "react";
import { Selection } from "@/types/region";
import { RegionProvider, useRegions } from "@/context/RegionContext";
import PixelCanvas from "@/components/PixelCanvas";
import CanvasToolbar from "@/components/CanvasToolbar";
import PurchasePanel from "@/components/PurchasePanel";
import RegionSidebar from "@/components/RegionSidebar";
import MarketplaceView from "@/components/MarketplaceView";
import TrendingSidebar from "@/components/TrendingSidebar";

const IndexInner = () => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [view, setView] = useState<"canvas" | "marketplace">("canvas");
  const [purchasePanelOpen, setPurchasePanelOpen] = useState(false);
  const [purchasePanelCollapsed, setPurchasePanelCollapsed] = useState(false);
  const { regions, setSelectedRegion, selectedRegion } = useRegions();

  const handleRegionClick = useCallback(
    (regionId: string) => {
      const region = regions.find((r) => r.id === regionId);
      if (region) {
        setSelectedRegion(region);
        setSelection(null);
        setPurchasePanelOpen(false);
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

  const handleClearSelection = () => {
    setSelection(null);
    setPurchasePanelOpen(false);
    setPurchasePanelCollapsed(false);
  };

  // When user starts or completes a selection, keep panel open
  const handleSelectionChange = (sel: Selection | null) => {
    setSelection(sel);
    if (sel) {
      setSelectedRegion(null);
      setPurchasePanelOpen(true);
      setPurchasePanelCollapsed(false);
    }
    // When sel is null (drag start), keep purchasePanelOpen as-is
    // so the sidebar doesn't unmount and cause layout shift
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <CanvasToolbar view={view} onViewChange={setView} />
      <div className="flex flex-1 overflow-hidden relative">
        {view === "canvas" ? (
          <>
            <TrendingSidebar onSelectRegion={handleRegionClick} />
            <div className="flex-1 flex relative overflow-hidden">
              <PixelCanvas
                selection={selection}
                onSelectionChange={handleSelectionChange}
                onRegionClick={handleRegionClick}
              />
            </div>
            {purchasePanelOpen && !selectedRegion && (
              <PurchasePanel
                selection={selection}
                onClearSelection={handleClearSelection}
                collapsed={purchasePanelCollapsed}
                onToggleCollapse={() => setPurchasePanelCollapsed((c) => !c)}
              />
            )}
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
