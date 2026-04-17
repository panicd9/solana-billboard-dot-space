import { useState, useRef, useEffect } from "react";
import {
  X,
  ShoppingCart,
  Image as ImageIcon,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selection, BLOCK_SIZE } from "@/types/region";
import { useRegions } from "@/context/RegionContext";
import { toast } from "sonner";
import { countCenterAndCurveBlocks, formatUsdc } from "@/solana/pricing";
import {
  CENTER_PRICE_PER_BLOCK,
  CURVE_START_PRICE,
  CURVE_END_PRICE,
  USDC_DECIMALS,
} from "@/solana/constants";

interface Props {
  selection: Selection | null;
  onClearSelection: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  showPricingOverlay: boolean;
  onTogglePricingOverlay: () => void;
}

const PurchasePanel = ({ selection, onClearSelection, collapsed, onToggleCollapse, showPricingOverlay, onTogglePricingOverlay }: Props) => {
  const { purchaseRegion, calculatePrice } = useRegions();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [linkValue, setLinkValue] = useState("");
  const [isPurchasing, setIsPurchasing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset preview when a new (different) selection is finalized
  const prevSelectionRef = useRef<Selection | null>(null);
  useEffect(() => {
    if (
      selection &&
      prevSelectionRef.current &&
      (selection.col !== prevSelectionRef.current.col ||
        selection.row !== prevSelectionRef.current.row ||
        selection.width !== prevSelectionRef.current.width ||
        selection.height !== prevSelectionRef.current.height)
    ) {
      setPreviewUrl(null);
      setPendingFile(null);
      setImageNaturalSize(null);
    }
    if (selection) {
      prevSelectionRef.current = selection;
    }
  }, [selection]);

  const totalBlocks = selection ? selection.width * selection.height : 0;
  const price = selection ? calculatePrice(selection) : null;

  const regionPixelW = selection ? selection.width * BLOCK_SIZE : 0;
  const regionPixelH = selection ? selection.height * BLOCK_SIZE : 0;
  const regionRatio = regionPixelW && regionPixelH ? regionPixelW / regionPixelH : 0;
  const imageRatio = imageNaturalSize ? imageNaturalSize.w / imageNaturalSize.h : 0;

  const ratioMatch =
    regionRatio && imageRatio ? Math.abs(regionRatio - imageRatio) / regionRatio : null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new window.Image();
    img.onload = () => {
      setImageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
    e.target.value = "";
  };

  const handleBuy = async () => {
    if (!selection) return;
    setIsPurchasing(true);
    try {
      await purchaseRegion(selection, pendingFile, linkValue);
      handleClose();
    } catch (err) {
      // Error toast is shown by the mutation hook
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setPendingFile(null);
    setImageNaturalSize(null);
    setLinkValue("");
    onClearSelection();
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setPendingFile(null);
    setImageNaturalSize(null);
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="cursor-pointer absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-card/95 backdrop-blur-md border border-border border-r-0 rounded-l-lg p-2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Show purchase panel"
        aria-expanded={false}
      >
        <ChevronRight className="w-4 h-4 rotate-180" aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      aria-label="Purchase region panel"
      className="w-full sm:w-72 bg-gradient-to-b from-card via-card to-card/80 border-l border-border flex flex-col h-full overflow-y-auto shrink-0"
    >
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
        <h3 className="text-sm font-semibold text-foreground">Purchase Region</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="cursor-pointer text-muted-foreground hover:text-foreground p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Hide panel"
            aria-expanded={true}
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer text-muted-foreground hover:text-foreground p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close purchase panel"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Region info */}
      {selection ? (
        <div className="p-4 space-y-2 text-sm font-mono border-b border-border">
          <div className="flex justify-between text-muted-foreground">
            <span>Position</span>
            <span className="text-foreground">
              ({selection.col}, {selection.row})
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Size</span>
            <span className="text-primary">
              {selection.width}x{selection.height}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Pixels</span>
            <span className="text-foreground">
              {regionPixelW}x{regionPixelH}px
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Blocks</span>
            <span className="text-foreground">{totalBlocks}</span>
          </div>
          <div className="border-t border-border pt-2 space-y-2">
            <div className="flex justify-between font-semibold items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-foreground">Total</span>
                <button
                  type="button"
                  onClick={onTogglePricingOverlay}
                  className={`cursor-pointer p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showPricingOverlay ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  aria-label="How pricing works"
                  aria-pressed={showPricingOverlay}
                >
                  <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <span className="text-accent">{price?.display ?? "..."} USDC</span>
            </div>
            {showPricingOverlay && selection && <PricingBreakdown selection={selection} />}
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground text-center">Selecting region...</p>
        </div>
      )}

      {/* Image preview section */}
      <div className="p-4 space-y-3 border-b border-border">
        <label
          htmlFor="purchase-image-file"
          className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider"
        >
          Image Preview (optional)
        </label>
        <input
          id="purchase-image-file"
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        {previewUrl ? (
          <div className="space-y-3">
            <div
              className="border border-border rounded overflow-hidden bg-background relative"
              style={{
                aspectRatio: `${selection?.width ?? 1} / ${selection?.height ?? 1}`,
              }}
            >
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Preview shows how the image will look in the region
            </p>

            {imageNaturalSize && selection && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Image</span>
                  <span className="text-foreground">
                    {imageNaturalSize.w}x{imageNaturalSize.h}px ({imageRatio.toFixed(2)})
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Region</span>
                  <span className="text-foreground">
                    {regionPixelW}x{regionPixelH}px ({regionRatio.toFixed(2)})
                  </span>
                </div>
                {ratioMatch !== null && (
                  <div
                    role="status"
                    className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded ${
                      ratioMatch < 0.1
                        ? "bg-green-500/10 text-green-400"
                        : ratioMatch < 0.3
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {ratioMatch < 0.1 ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Good match ({Math.round(ratioMatch * 100)}% off)
                      </>
                    ) : ratioMatch < 0.3 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Slight stretch ({Math.round(ratioMatch * 100)}% off)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        Heavy stretch ({Math.round(ratioMatch * 100)}% off)
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => fileRef.current?.click()}
              >
                Change
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleRemoveImage}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <ImageIcon className="w-4 h-4" />
            Select Image
          </Button>
        )}
      </div>

      {/* Link input */}
      <div className="p-4 space-y-2 border-b border-border">
        <label
          htmlFor="purchase-link"
          className="block text-xs text-muted-foreground font-semibold uppercase tracking-wider"
        >
          Link (optional)
        </label>
        <input
          id="purchase-link"
          type="url"
          placeholder="https://..."
          value={linkValue}
          onChange={(e) => setLinkValue(e.target.value)}
          className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Buy button */}
      <div className="p-4 mt-auto">
        <Button
          onClick={handleBuy}
          className="w-full gap-2"
          size="sm"
          disabled={!selection || isPurchasing}
        >
          {isPurchasing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4" />
              {pendingFile ? "Buy & Place Image" : "Buy Region"}
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};

const PricingBreakdown = ({ selection }: { selection: Selection }) => {
  const { centerCount, curveCount } = countCenterAndCurveBlocks(
    selection.col,
    selection.row,
    selection.width,
    selection.height
  );
  const centerPrice = formatUsdc(centerCount * CENTER_PRICE_PER_BLOCK);
  const curveStartDisplay = (Number(CURVE_START_PRICE) / 10 ** USDC_DECIMALS).toFixed(2);
  const curveEndDisplay = (Number(CURVE_END_PRICE) / 10 ** USDC_DECIMALS).toFixed(2);
  const centerPriceDisplay = (Number(CENTER_PRICE_PER_BLOCK) / 10 ** USDC_DECIMALS).toFixed(2);

  return (
    <div className="rounded-md bg-muted/50 border border-border p-2.5 space-y-2 text-xs">
      <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">How pricing works</p>

      {/* Center zone */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-amber-400/80 shrink-0" />
          <span className="text-muted-foreground">Center zone</span>
          <span className="ml-auto text-foreground font-mono">{centerPriceDisplay} USDC/block</span>
        </div>
        <p className="text-muted-foreground/70 text-[10px] pl-3.5">
          60x34 premium area — fixed price
        </p>
      </div>

      {/* Bonding curve */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-primary/80 shrink-0" />
          <span className="text-muted-foreground">Outer zone</span>
          <span className="ml-auto text-foreground font-mono">{curveStartDisplay}–{curveEndDisplay}</span>
        </div>
        <p className="text-muted-foreground/70 text-[10px] pl-3.5">
          Linear bonding curve — price rises as more blocks are sold
        </p>
      </div>

      {/* Selection breakdown */}
      {(centerCount > 0n || curveCount > 0n) && (
        <div className="border-t border-border pt-1.5 space-y-0.5">
          <p className="text-muted-foreground/70 text-[10px] uppercase tracking-wider">Your selection</p>
          {centerCount > 0n && (
            <div className="flex justify-between text-muted-foreground">
              <span>{centerCount.toString()} center block{centerCount > 1n ? "s" : ""}</span>
              <span className="text-foreground font-mono">{centerPrice} USDC</span>
            </div>
          )}
          {curveCount > 0n && (
            <div className="flex justify-between text-muted-foreground">
              <span>{curveCount.toString()} outer block{curveCount > 1n ? "s" : ""}</span>
              <span className="text-foreground font-mono">bonding curve</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PurchasePanel;
