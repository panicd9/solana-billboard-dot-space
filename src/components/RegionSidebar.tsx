import { useState, useRef } from "react";
import { X, ExternalLink, Tag, XCircle, ShoppingCart, Image, Link, Sparkles, Zap, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegions } from "@/context/RegionContext";
import { toast } from "sonner";
import { BLOCK_SIZE, HIGHLIGHT_COST, GLOW_COST, TRENDING_COST } from "@/types/region";

const RegionSidebar = () => {
  const { selectedRegion, setSelectedRegion, listRegion, unlistRegion, buyListedRegion, setRegionImage, setRegionLink, highlightRegion, glowRegion, trendRegion } = useRegions();
  const [listPrice, setListPrice] = useState("");
  const [editingLink, setEditingLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Resize to fit region
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = r.width * BLOCK_SIZE;
        canvas.height = r.height * BLOCK_SIZE;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const resized = canvas.toDataURL("image/png");
        setRegionImage(r.id, resized);
        toast.success("Image updated");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSaveLink = () => {
    setRegionLink(r.id, linkValue);
    setEditingLink(false);
    toast.success("Link updated");
  };

  const startEditLink = () => {
    setLinkValue(r.linkUrl || "");
    setEditingLink(true);
  };

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full overflow-y-auto">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Region Details</h3>
        <button onClick={() => setSelectedRegion(null)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

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
        {r.linkUrl && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">URL</span>
            <a href={r.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs truncate max-w-[140px]">
              {r.linkUrl}
            </a>
          </div>
        )}

        <a href="#" className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={(e) => e.preventDefault()}>
          <ExternalLink className="w-3 h-3" />
          View on Explorer
        </a>
      </div>

      {/* Owner actions: change image & URL */}
      <div className="px-4 pb-2 space-y-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Owner Actions</p>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
          <Image className="w-4 h-4" />
          {r.imageUrl ? "Change Image" : "Upload Image"}
        </Button>

        {editingLink ? (
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" variant="outline" onClick={handleSaveLink}>Save</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={startEditLink}>
            <Link className="w-4 h-4" />
            {r.linkUrl ? "Edit URL" : "Add URL"}
          </Button>
        )}
      </div>

      {/* Premium Actions */}
      <div className="px-4 pb-2 space-y-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Premium Boosts</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={r.isHighlighted}
          onClick={() => { highlightRegion(r.id); toast.success(`Region highlighted for 24h! (${HIGHLIGHT_COST} SOL)`); }}
        >
          <Sparkles className="w-4 h-4 text-yellow-400" />
          {r.isHighlighted ? "Highlighted ✓" : `Highlight (${HIGHLIGHT_COST} SOL)`}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={r.hasGlowBorder}
          onClick={() => { glowRegion(r.id); toast.success(`Glow border active for 24h! (${GLOW_COST} SOL)`); }}
        >
          <Zap className="w-4 h-4 text-cyan-400" />
          {r.hasGlowBorder ? "Glowing ✓" : `Border Glow (${GLOW_COST} SOL)`}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          disabled={r.isTrending}
          onClick={() => { trendRegion(r.id); toast.success(`Pinned to Trending for 24h! (${TRENDING_COST} SOL)`); }}
        >
          <TrendingUp className="w-4 h-4 text-orange-400" />
          {r.isTrending ? "Trending ✓" : `Pin Trending (${TRENDING_COST} SOL)`}
        </Button>
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
