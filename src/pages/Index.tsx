import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { type Selection, type Region } from "@/types/region";
import { useRegions } from "@/context/RegionContext";
import PixelCanvas from "@/components/PixelCanvas";
import CanvasToolbar from "@/components/CanvasToolbar";
import PurchasePanel from "@/components/PurchasePanel";
import RegionSidebar from "@/components/RegionSidebar";
import MarketplaceView from "@/components/MarketplaceView";
import TrendingSidebar from "@/components/TrendingSidebar";

const HERO_KEY = "billboard:hero-dismissed";

const Index = () => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState<"canvas" | "marketplace">("canvas");
  const [purchasePanelOpen, setPurchasePanelOpen] = useState(false);
  const [purchasePanelCollapsed, setPurchasePanelCollapsed] = useState(false);
  const [trendingCollapsed, setTrendingCollapsed] = useState(false);
  const [showPricingOverlay, setShowPricingOverlay] = useState(false);
  const [heroDismissed, setHeroDismissed] = useState(() => {
    try { return localStorage.getItem(HERO_KEY) === "1"; } catch { return false; }
  });
  const { setSelectedRegion, locateRegion, selectedRegion, regions } = useRegions();
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link: /?region=<assetId> opens that region once regions load.
  useEffect(() => {
    const wanted = searchParams.get("region");
    if (!wanted) return;
    const match = regions.find((r) => r.id === wanted);
    if (match) {
      locateRegion(match);
      setView("canvas");
      const next = new URLSearchParams(searchParams);
      next.delete("region");
      setSearchParams(next, { replace: true });
    }
  }, [regions, searchParams, locateRegion, setSearchParams]);

  const handleDismissHero = useCallback(() => {
    setHeroDismissed(true);
    try { localStorage.setItem(HERO_KEY, "1"); } catch { /* ignore */ }
  }, []);

  const handleRegionClick = useCallback(
    (region: Region) => {
      setSelectedRegion(region);
      setSelection(null);
      setPurchasePanelOpen(false);
    },
    [setSelectedRegion]
  );

  // Region selected from outside the canvas (trending sidebar, etc.) — also
  // wayfind on-canvas so the user can see where it is.
  const handleRegionLocate = useCallback(
    (region: Region) => {
      locateRegion(region);
      setSelection(null);
      setPurchasePanelOpen(false);
    },
    [locateRegion]
  );

  const handleMarketplaceHighlight = useCallback(
    (regionId: string) => {
      setView("canvas");
    },
    []
  );

  const handleClearSelection = () => {
    setSelection(null);
    setPreviewImage(null);
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
            <TrendingSidebar
              onSelectRegion={handleRegionLocate}
              collapsed={trendingCollapsed}
              onToggleCollapse={() => setTrendingCollapsed((c) => !c)}
            />
            <div className="flex-1 flex relative overflow-hidden">
              <PixelCanvas
                selection={selection}
                onSelectionChange={handleSelectionChange}
                onRegionClick={handleRegionClick}
                showPricingOverlay={showPricingOverlay}
                heroDismissed={heroDismissed}
                onDismissHero={handleDismissHero}
                previewImage={previewImage}
              />
            </div>
            {purchasePanelOpen && !selectedRegion && (
              <PurchasePanel
                selection={selection}
                onClearSelection={handleClearSelection}
                onSelectionChange={setSelection}
                onPreviewImageChange={setPreviewImage}
                collapsed={purchasePanelCollapsed}
                onToggleCollapse={() => setPurchasePanelCollapsed((c) => !c)}
                showPricingOverlay={showPricingOverlay}
                onTogglePricingOverlay={() => setShowPricingOverlay((v) => !v)}
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

export default Index;
