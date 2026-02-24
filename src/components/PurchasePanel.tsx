import { useState, useRef } from "react";
import { X, ShoppingCart, Upload, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Selection, PRICE_PER_BLOCK } from "@/types/region";
import { useRegions } from "@/context/RegionContext";
import { toast } from "sonner";

interface Props {
  selection: Selection | null;
  onClearSelection: () => void;
}

const PurchasePanel = ({ selection, onClearSelection }: Props) => {
  const { purchaseRegion, setRegionImage } = useRegions();
  const [purchasedId, setPurchasedId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!selection && !purchasedId) return null;

  const totalBlocks = selection ? selection.width * selection.height : 0;
  const totalCost = totalBlocks * PRICE_PER_BLOCK;

  const handleBuy = () => {
    if (!selection) return;
    const region = purchaseRegion(selection);
    setPurchasedId(region.id);
    toast.success(`Purchased ${totalBlocks} blocks for ${totalCost.toFixed(4)} SOL`);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleConfirmUpload = () => {
    if (!purchasedId || !pendingFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setRegionImage(purchasedId, e.target?.result as string);
      toast.success("Image placed on canvas");
      // Reset
      setPurchasedId(null);
      setPreviewUrl(null);
      setPendingFile(null);
      onClearSelection();
    };
    reader.readAsDataURL(pendingFile);
  };

  const handleClose = () => {
    setPurchasedId(null);
    setPreviewUrl(null);
    setPendingFile(null);
    onClearSelection();
  };

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-card/95 backdrop-blur-md border border-border rounded-lg shadow-xl p-4 min-w-[320px]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {purchasedId ? "Upload Image" : "Purchase Region"}
        </h3>
        <button onClick={handleClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {!purchasedId && selection && (
        <>
          <div className="space-y-2 text-sm font-mono mb-4">
            <div className="flex justify-between text-muted-foreground">
              <span>Position</span>
              <span className="text-foreground">({selection.col}, {selection.row})</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Size</span>
              <span className="text-primary">{selection.width}×{selection.height}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total blocks</span>
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
          <Button onClick={handleBuy} className="w-full gap-2" size="sm">
            <ShoppingCart className="w-4 h-4" />
            Buy Region
          </Button>
        </>
      )}

      {purchasedId && (
        <>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          {previewUrl ? (
            <div className="space-y-3">
              <div className="border border-border rounded overflow-hidden bg-background">
                <img src={previewUrl} alt="Preview" className="w-full h-32 object-contain" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
                  Change
                </Button>
                <Button size="sm" className="flex-1 gap-1" onClick={handleConfirmUpload}>
                  <Upload className="w-3.5 h-3.5" />
                  Confirm
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2" size="sm" onClick={() => fileRef.current?.click()}>
              <ImageIcon className="w-4 h-4" />
              Select Image
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default PurchasePanel;
