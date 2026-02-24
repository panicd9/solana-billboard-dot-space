import { useState } from "react";
import { X, ExternalLink, Tag, XCircle, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegions } from "@/context/RegionContext";
import { toast } from "sonner";

const RegionSidebar = () => {
  const { selectedRegion, setSelectedRegion, listRegion, unlistRegion, buyListedRegion } = useRegions();
  const [listPrice, setListPrice] = useState("");

  if (!selectedRegion) return null;

  const r = selectedRegion;
  const shortOwner = `${r.owner.slice(0, 4)}...${r.owner.slice(-4)}`;
  const totalBlocks = r.width * r.height;

  const handleList = () => {
    const price = parseFloat(listPrice);
    if (isNaN(price) || price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    listRegion(r.id, price);
    toast.success(`Listed for ${price} SOL`);
    setListPrice("");
  };

  const handleBuy = () => {
    buyListedRegion(r.id, "buyer" + Math.random().toString(36).slice(2, 10));
    toast.success("Region purchased!");
  };

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Region Details</h3>
        <button onClick={() => setSelectedRegion(null)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Image preview */}
      {r.imageUrl && (
        <div className="p-4 border-b border-border">
          <img src={r.imageUrl} alt="Region" className="w-full rounded border border-border object-contain" />
        </div>
      )}

      <div className="p-4 space-y-3 text-sm font-mono">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Owner</span>
          <span className="text-foreground" title={r.owner}>{shortOwner}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position</span>
          <span className="text-foreground">({r.startX}, {r.startY})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Size</span>
          <span className="text-primary">{r.width}×{r.height}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Blocks</span>
          <span className="text-foreground">{totalBlocks}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cost</span>
          <span className="text-accent">{r.purchasePrice.toFixed(4)} SOL</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={r.isListed ? "text-accent" : "text-muted-foreground"}>
            {r.isListed ? `Listed @ ${r.listingPrice} SOL` : "Not listed"}
          </span>
        </div>

        <a
          href="#"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={(e) => e.preventDefault()}
        >
          <ExternalLink className="w-3 h-3" />
          View on Explorer
        </a>
      </div>

      <div className="p-4 border-t border-border space-y-2 mt-auto">
        {r.isListed ? (
          <>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => { unlistRegion(r.id); toast.success("Unlisted"); }}>
              <XCircle className="w-4 h-4" />
              Unlist
            </Button>
            <Button size="sm" className="w-full gap-2" onClick={handleBuy}>
              <ShoppingCart className="w-4 h-4" />
              Buy for {r.listingPrice} SOL
            </Button>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                placeholder="Price (SOL)"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" variant="outline" className="gap-1" onClick={handleList}>
                <Tag className="w-3.5 h-3.5" />
                List
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionSidebar;
