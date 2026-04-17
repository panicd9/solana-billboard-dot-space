import { useState, useRef, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  X,
  ExternalLink,
  Tag,
  XCircle,
  ShoppingCart,
  Image,
  Link,
  Sparkles,
  Zap,
  TrendingUp,
  Loader2,
  Info,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegions } from "@/context/RegionContext";
import { toast } from "sonner";
import {
  BLOCK_SIZE,
  HIGHLIGHT_COST_USDC,
  GLOW_COST_USDC,
  TRENDING_COST_USDC,
} from "@/types/region";
import { BOOST_HIGHLIGHTED, BOOST_GLOWING, BOOST_TRENDING } from "@/solana/constants";
import { calculateListingCurrentPrice, formatUsdc } from "@/solana/pricing";
import { USDC_DECIMALS } from "@/solana/constants";
import { useWalletConnection } from "@solana/react-hooks";

const RegionSidebar = () => {
  const {
    selectedRegion,
    setSelectedRegion,
    listRegion,
    unlistRegion,
    buyListedRegion,
    setRegionImage,
    setRegionLink,
    buyBoost,
  } = useRegions();
  const { wallet } = useWalletConnection();
  const [startPrice, setStartPrice] = useState("");
  const [endPrice, setEndPrice] = useState("");
  const [duration, setDuration] = useState("86400"); // 24h default
  const [editingLink, setEditingLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedRegion) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedRegion(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRegion, setSelectedRegion]);

  if (!selectedRegion) return null;

  const r = selectedRegion;
  const isBitmapOnly = r.id.startsWith("bitmap-");
  const shortOwner = r.owner ? `${r.owner.slice(0, 4)}...${r.owner.slice(-4)}` : "Unknown";
  const totalBlocks = r.width * r.height;
  const walletAddr = wallet?.account?.address;
  const isOwner =
    !isBitmapOnly &&
    !!walletAddr &&
    (walletAddr === r.owner || (r.isListed && walletAddr === r.listing?.seller));

  const currentListingPrice =
    r.isListed && r.listing
      ? calculateListingCurrentPrice(
          r.listing.startPrice,
          r.listing.endPrice,
          r.listing.startTime,
          r.listing.endTime
        )
      : null;

  const withBusy = async (action: string, fn: () => Promise<void>) => {
    setBusyAction(action);
    try {
      await fn();
    } catch {
      // Error toast is shown by mutation hooks
    } finally {
      setBusyAction(null);
    }
  };

  const handleList = () => {
    const sp = parseFloat(startPrice);
    const ep = parseFloat(endPrice);
    const dur = parseInt(duration);
    if (isNaN(sp) || sp <= 0) {
      toast.error("Enter a valid start price");
      return;
    }
    if (isNaN(ep) || ep <= 0) {
      toast.error("Enter a valid end price");
      return;
    }
    if (isNaN(dur) || dur <= 0) {
      toast.error("Enter a valid duration");
      return;
    }
    const spLamports = BigInt(Math.round(sp * 10 ** USDC_DECIMALS));
    const epLamports = BigInt(Math.round(ep * 10 ** USDC_DECIMALS));
    withBusy("list", () => listRegion(r.id, spLamports, epLamports, BigInt(dur)));
  };

  const handleUnlist = () => {
    withBusy("unlist", () => unlistRegion(r.id));
  };

  const handleBuy = () => {
    if (!r.listing) return;
    withBusy("buy", () => buyListedRegion(r.id, r.listing!.seller));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    withBusy("image", () => setRegionImage(r.id, file));
    e.target.value = "";
  };

  const handleSaveLink = () => {
    withBusy("link", async () => {
      await setRegionLink(r.id, linkValue);
      setEditingLink(false);
    });
  };

  const startEditLink = () => {
    setLinkValue(r.linkUrl || "");
    setEditingLink(true);
  };

  const handleBoost = (flags: number, name: string) => {
    withBusy(`boost-${flags}`, () => buyBoost(r.id, flags));
  };

  return (
    <aside
      aria-label="Region details panel"
      className="w-full sm:w-72 bg-gradient-to-b from-card via-card to-card/80 border-l border-border flex flex-col h-full overflow-y-auto"
    >
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <h3 className="text-sm font-semibold text-foreground">Region Details</h3>
        <button
          type="button"
          onClick={() => setSelectedRegion(null)}
          className="cursor-pointer text-muted-foreground hover:text-foreground p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close region details"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {r.imageUrl && (
        <div className="p-4 border-b border-border">
          <img
            src={r.imageUrl}
            alt="Region"
            className="w-full rounded border border-border object-contain"
          />
        </div>
      )}

      {(r.isHighlighted || r.hasGlowBorder || r.isTrending) && (
        <div className="px-4 pt-3 pb-1 flex flex-wrap gap-1.5">
          {r.isHighlighted && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shadow-[0_0_8px_rgba(41,234,196,0.25)]">
              <Sparkles className="w-2.5 h-2.5" aria-hidden="true" /> Highlighted
            </span>
          )}
          {r.hasGlowBorder && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30 shadow-[0_0_8px_rgba(153,69,255,0.3)]">
              <Zap className="w-2.5 h-2.5" aria-hidden="true" /> Glowing
            </span>
          )}
          {r.isTrending && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-400/30 shadow-[0_0_8px_rgba(255,140,0,0.25)]">
              <TrendingUp className="w-2.5 h-2.5" aria-hidden="true" /> Trending
            </span>
          )}
        </div>
      )}

      <div className="p-4 space-y-3 text-sm font-mono">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Owner</span>
          <div className="flex items-center gap-1.5">
            {r.owner && (
              <RouterLink
                to={`/u/${r.owner}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
                title="View profile"
                aria-label={`View profile for ${r.owner}`}
              >
                <User className="w-3 h-3" aria-hidden="true" />
                {shortOwner}
              </RouterLink>
            )}
            {!r.owner && <span className="text-muted-foreground">{shortOwner}</span>}
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position</span>
          <span className="text-foreground">
            ({r.startX}, {r.startY})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Size</span>
          <span className="text-primary">
            {r.width}x{r.height}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Blocks</span>
          <span className="text-foreground">{totalBlocks}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className={r.isListed ? "text-accent" : "text-muted-foreground"}>
            {currentListingPrice !== null
              ? `Listed @ ${formatUsdc(currentListingPrice)} USDC`
              : "Not listed"}
          </span>
        </div>
        {r.linkUrl && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">URL</span>
            <a
              href={r.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-xs truncate max-w-[140px]"
            >
              {r.linkUrl}
            </a>
          </div>
        )}

        {!isBitmapOnly && (
          <a
            href={`https://solscan.io/account/${r.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            View on Solscan
          </a>
        )}
        {isBitmapOnly && (
          <p className="text-xs text-muted-foreground italic">
            Full region data is loading...
          </p>
        )}
      </div>

      {/* Owner actions: change image & URL */}
      {isOwner && (
        <div className="px-4 pb-2 space-y-2 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
            Owner Actions
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={busyAction === "image"}
          >
            {busyAction === "image" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Image className="w-4 h-4" />
            )}
            {r.imageUrl ? "Change Image" : "Upload Image"}
          </Button>

          {editingLink ? (
            <div className="flex gap-2">
              <label htmlFor="region-link" className="sr-only">
                Region link URL
              </label>
              <input
                id="region-link"
                type="url"
                placeholder="https://..."
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                className="flex-1 bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveLink}
                disabled={busyAction === "link"}
              >
                {busyAction === "link" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={startEditLink}
            >
              <Link className="w-4 h-4" />
              {r.linkUrl ? "Edit URL" : "Add URL"}
            </Button>
          )}
        </div>
      )}

      {/* Premium Boosts */}
      {isOwner && (
        <div className="px-4 pb-2 space-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
              Premium Boosts
            </p>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">Boosts last 24 hours</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={r.isHighlighted || busyAction === `boost-${BOOST_HIGHLIGHTED}`}
            onClick={() => handleBoost(BOOST_HIGHLIGHTED, "Highlight")}
          >
            {busyAction === `boost-${BOOST_HIGHLIGHTED}` ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-yellow-400" />
            )}
            {r.isHighlighted
              ? "Highlighted"
              : `Highlight (${HIGHLIGHT_COST_USDC} USDC)`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={r.hasGlowBorder || busyAction === `boost-${BOOST_GLOWING}`}
            onClick={() => handleBoost(BOOST_GLOWING, "Glow")}
          >
            {busyAction === `boost-${BOOST_GLOWING}` ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 text-cyan-400" />
            )}
            {r.hasGlowBorder
              ? "Glowing"
              : `Border Glow (${GLOW_COST_USDC} USDC)`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={r.isTrending || busyAction === `boost-${BOOST_TRENDING}`}
            onClick={() => handleBoost(BOOST_TRENDING, "Trending")}
          >
            {busyAction === `boost-${BOOST_TRENDING}` ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TrendingUp className="w-4 h-4 text-orange-400" />
            )}
            {r.isTrending
              ? "Trending"
              : `Pin Trending (${TRENDING_COST_USDC} USDC)`}
          </Button>
        </div>
      )}

      {/* Listing / Purchase */}
      <div className="p-4 border-t border-border space-y-2 mt-auto">
        {r.isListed ? (
          <>
            {isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={handleUnlist}
                disabled={busyAction === "unlist"}
              >
                {busyAction === "unlist" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Cancel Listing
              </Button>
            )}
            {!isOwner && currentListingPrice !== null && (
              <Button
                size="sm"
                className="w-full gap-2"
                onClick={handleBuy}
                disabled={busyAction === "buy"}
              >
                {busyAction === "buy" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4" />
                )}
                Buy for {formatUsdc(currentListingPrice)} USDC
              </Button>
            )}
          </>
        ) : (
          isOwner && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="listing-start-price" className="sr-only">
                    Start price in USDC
                  </label>
                  <input
                    id="listing-start-price"
                    type="number"
                    step="0.01"
                    placeholder="Start (USDC)"
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="listing-end-price" className="sr-only">
                    End price in USDC
                  </label>
                  <input
                    id="listing-end-price"
                    type="number"
                    step="0.01"
                    placeholder="End (USDC)"
                    value={endPrice}
                    onChange={(e) => setEndPrice(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="listing-duration" className="sr-only">
                  Listing duration
                </label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="listing-duration" className="h-9 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3600">1 hour</SelectItem>
                    <SelectItem value="21600">6 hours</SelectItem>
                    <SelectItem value="86400">24 hours</SelectItem>
                    <SelectItem value="259200">3 days</SelectItem>
                    <SelectItem value="604800">7 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1 cursor-pointer"
                onClick={handleList}
                disabled={busyAction === "list"}
              >
                {busyAction === "list" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Tag className="w-3.5 h-3.5" />
                )}
                List for Sale
              </Button>
            </div>
          )
        )}
      </div>
    </aside>
  );
};

export default RegionSidebar;
