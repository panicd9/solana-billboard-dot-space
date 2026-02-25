import { useState, useRef, useEffect } from "react";
import { X, ShoppingCart, Upload, Image as ImageIcon, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selection, PRICE_PER_BLOCK, BLOCK_SIZE } from "@/types/region";
import { useRegions } from "@/context/RegionContext";
import { toast } from "sonner";

interface Props {
  selection: Selection | null;
  onClearSelection: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const PurchasePanel = ({ selection, onClearSelection, collapsed, onToggleCollapse }: Props) => {
  const { purchaseRegion, setRegionImage } = useRegions();
  const [purchasedId, setPurchasedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset preview when a new (different) selection is finalized
  const prevSelectionRef = useRef<Selection | null>(null);
  useEffect(() => {
    if (selection && prevSelectionRef.current && !purchasedId &&
      (selection.col !== prevSelectionRef.current.col ||
       selection.row !== prevSelectionRef.current.row ||
       selection.width !== prevSelectionRef.current.width ||
       selection.height !== prevSelectionRef.current.height)) {
      setPreviewUrl(null);
      setPendingFile(null);
      setImageNaturalSize(null);
    }
    if (selection) {
      prevSelectionRef.current = selection;
    }
  }, [selection, purchasedId]);

  const totalBlocks = selection ? selection.width * selection.height : 0;
  const totalCost = totalBlocks * PRICE_PER_BLOCK;

  const regionPixelW = selection ? selection.width * BLOCK_SIZE : 0;
  const regionPixelH = selection ? selection.height * BLOCK_SIZE : 0;
  const regionRatio = regionPixelW && regionPixelH ? (regionPixelW / regionPixelH) : 0;
  const imageRatio = imageNaturalSize ? (imageNaturalSize.w / imageNaturalSize.h) : 0;

  const ratioMatch = regionRatio && imageRatio
    ? Math.abs(regionRatio - imageRatio) / regionRatio
    : null;

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

  const handleBuy = () => {
    if (!selection) return;
    const region = purchaseRegion(selection);
    setPurchasedId(region.id);

    // If image was already selected before buying, apply it immediately
    if (pendingFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setRegionImage(region.id, e.target?.result as string);
        toast.success(`Purchased ${totalBlocks} blocks & image placed!`);
        handleClose();
      };
      reader.readAsDataURL(pendingFile);
    } else {
      toast.success(`Purchased ${totalBlocks} blocks for ${totalCost.toFixed(4)} SOL`);
      handleClose();
    }
  };

  const handleClose = () => {
    setPurchasedId(null);
    setPreviewUrl(null);
    setPendingFile(null);
    setImageNaturalSize(null);
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
        onClick={onToggleCollapse}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-card/95 backdrop-blur-md border border-border border-r-0 rounded-l-lg p-2 text-muted-foreground hover:text-foreground transition-colors"
        title="Show purchase panel"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
      </button>
    );
  }

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full overflow-y-auto shrink-0">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Purchase Region</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground p-0.5"
            title="Hide panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Region info */}
      {selection ? (
        <div className="p-4 space-y-2 text-sm font-mono border-b border-border">
          <div className="flex justify-between text-muted-foreground">
            <span>Position</span>
            <span className="text-foreground">({selection.col}, {selection.row})</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Size</span>
            <span className="text-primary">{selection.width}×{selection.height}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Pixels</span>
            <span className="text-foreground">{regionPixelW}×{regionPixelH}px</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Blocks</span>
            <span className="text-foreground">{totalBlocks}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Price/block</span>
            <span className="text-foreground">{PRICE_PER_BLOCK} SOL</span>
          </div>
          <div className="border-t border-border pt-2 flex justify-between font-semibold">
            <span className="text-foreground">Total</span>
            <span className="text-accent">{totalCost.toFixed(4)} SOL</span>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-border">
          <p className="text-sm text-muted-foreground text-center">Selecting region...</p>
        </div>
      )}

      {/* Image preview section */}
      <div className="p-4 space-y-3 border-b border-border">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
          Image Preview (optional)
        </p>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        {previewUrl ? (
          <div className="space-y-3">
            {/* Preview with region aspect ratio overlay */}
            <div
              className="border border-border rounded overflow-hidden bg-background relative"
              style={{ aspectRatio: `${selection?.width ?? 1} / ${selection?.height ?? 1}` }}
            >
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Preview shows how the image will look in the region
            </p>

            {/* Ratio match indicator */}
            {imageNaturalSize && selection && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Image</span>
                  <span className="text-foreground">{imageNaturalSize.w}×{imageNaturalSize.h}px ({imageRatio.toFixed(2)})</span>
                </div>
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Region</span>
                  <span className="text-foreground">{regionPixelW}×{regionPixelH}px ({regionRatio.toFixed(2)})</span>
                </div>
                {ratioMatch !== null && (
                  <div className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded ${
                    ratioMatch < 0.1
                      ? "bg-green-500/10 text-green-400"
                      : ratioMatch < 0.3
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-red-500/10 text-red-400"
                  }`}>
                    {ratioMatch < 0.1 ? (
                      <><CheckCircle className="w-3.5 h-3.5 shrink-0" /> Good aspect ratio match</>
                    ) : ratioMatch < 0.3 ? (
                      <><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Slight stretch — consider adjusting</>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Image will be stretched significantly</>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                Change
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleRemoveImage}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full gap-2" size="sm" onClick={() => fileRef.current?.click()}>
            <ImageIcon className="w-4 h-4" />
            Select Image
          </Button>
        )}
      </div>

      {/* Buy button */}
      <div className="p-4 mt-auto">
        <Button onClick={handleBuy} className="w-full gap-2" size="sm" disabled={!selection}>
          <ShoppingCart className="w-4 h-4" />
          {pendingFile ? "Buy & Place Image" : "Buy Region"}
        </Button>
      </div>
    </div>
  );
};

export default PurchasePanel;
