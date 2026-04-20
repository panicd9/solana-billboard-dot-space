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
  Loader2,
  Info,
  User,
  Code2,
  ShieldAlert,
  Share2,
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
  isBoostActive,
  boostSecondsRemaining,
  formatBoostCountdown,
} from "@/types/region";
import { BOOST_META_LIST, getBoostDescription } from "@/lib/boosts";
import { useNowSeconds } from "@/hooks/useNow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  calculateListingCurrentPrice,
  formatSol,
  parseSolInputToLamports,
} from "@/solana/pricing";
import { sanitizeExternalUrl } from "@/lib/urls";
import { generateShareImage } from "@/lib/shareImage";
import { uploadToIpfs } from "@/solana/ipfs";
import { useWalletConnection } from "@solana/react-hooks";

const SHARE_BASE_URL = "https://solanabillboard.space";

const TAKEDOWN_URL =
  (import.meta.env.VITE_TAKEDOWN_URL as string | undefined)?.trim() || "";

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
    isAssetHidden,
    regions,
    loadedImages,
    animatedImages,
  } = useRegions();
  const { wallet } = useWalletConnection();
  const nowSec = useNowSeconds(1000);
  const reducedMotion = useReducedMotion();
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
  const hidden = !isBitmapOnly && isAssetHidden(r.id);
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
    const spLamports = parseSolInputToLamports(startPrice);
    const epLamports = parseSolInputToLamports(endPrice);
    if (spLamports === null) {
      toast.error("Enter a valid start price (max 1,000,000 SOL, up to 9 decimals)");
      return;
    }
    if (epLamports === null) {
      toast.error("Enter a valid end price (max 1,000,000 SOL, up to 9 decimals)");
      return;
    }
    const dur = parseInt(duration);
    if (isNaN(dur) || dur <= 0) {
      toast.error("Enter a valid duration");
      return;
    }
    withBusy("list", () => listRegion(r.id, spLamports, epLamports, BigInt(dur)));
  };

  const handleUnlist = () => {
    withBusy("unlist", () => unlistRegion(r.id));
  };

  const handleBuy = () => {
    if (!r.listing || currentListingPrice === null) return;
    withBusy("buy", () => buyListedRegion(r.id, currentListingPrice));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    withBusy("image", () => setRegionImage(r.id, file));
    e.target.value = "";
  };

  const handleSaveLink = () => {
    const trimmed = linkValue.trim();
    if (trimmed && !sanitizeExternalUrl(trimmed)) {
      toast.error("Link must be a valid http:// or https:// URL");
      return;
    }
    withBusy("link", async () => {
      await setRegionLink(r.id, trimmed);
      setEditingLink(false);
    });
  };

  const startEditLink = () => {
    setLinkValue(r.linkUrl || "");
    setEditingLink(true);
  };

  const handleBoost = (flags: number) => {
    withBusy(`boost-${flags}`, () => buyBoost(r.id, flags));
  };

  const buildShareText = () => {
    const coords = `(${r.startX},${r.startY})`;
    const blocks = totalBlocks;
    if (isOwner && r.isListed) {
      return `Listing my region on @solanabillboard — Dutch auction, price drops every block until someone takes it\n\n${blocks} pixels at ${coords}`;
    }
    if (isOwner) {
      return `I planted a flag on @solanabillboard 🪩\n\n${blocks} pixels at ${coords} — pick yours before they fill`;
    }
    return `This region on @solanabillboard 🪩\n\n${blocks} pixels at ${coords}`;
  };

  const handleShare = async () => {
    const text = buildShareText();
    const fallbackUrl = `${SHARE_BASE_URL}/?region=${r.id}`;

    setBusyAction("share");
    try {
      let blob: Blob | null = null;
      try {
        blob = await generateShareImage(r, regions, loadedImages, animatedImages, isAssetHidden);
      } catch (err) {
        console.error("[share] generateShareImage failed:", err);
      }

      let shareUrl = fallbackUrl;
      let usedCardUrl = false;
      if (blob) {
        try {
          const file = new File(
            [blob],
            `solanabillboard-${r.startX}-${r.startY}.png`,
            { type: "image/png" }
          );
          const { gatewayUrl } = await uploadToIpfs(file);
          const params = new URLSearchParams({
            img: gatewayUrl,
            x: String(r.startX),
            y: String(r.startY),
            w: String(r.width),
            h: String(r.height),
          });
          shareUrl = `${SHARE_BASE_URL}/r/${r.id}?${params.toString()}`;
          usedCardUrl = true;
        } catch (err) {
          console.error("[share] Pinata upload failed:", err);
        }
      }

      const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

      if (blob && typeof File !== "undefined") {
        const file = new File(
          [blob],
          `solanabillboard-${r.startX}-${r.startY}.png`,
          { type: "image/png" }
        );
        if (navigator.canShare?.({ files: [file] })) {
          try {
            await navigator.share({ files: [file], text, url: shareUrl });
            return;
          } catch (err) {
            if ((err as DOMException)?.name === "AbortError") return;
            // fall through to intent URL
          }
        }
      }

      window.open(intentUrl, "_blank", "noopener,noreferrer");
      if (usedCardUrl) {
        toast.success("Tweet drafted — Twitter will render the region preview");
      } else {
        toast.warning("Tweet drafted (no card image — check console for upload error)");
      }
    } finally {
      setBusyAction(null);
    }
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

      {hidden ? (
        <div className="p-4 border-b border-border">
          <div className="w-full aspect-video rounded border border-border bg-muted/40 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <ShieldAlert className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs font-semibold text-foreground">
              Image hidden pending review
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              This region's image was reported and is not rendered on solanabillboard.space.
            </p>
            <div className="flex items-center gap-3 pt-1 text-[11px]">
              {TAKEDOWN_URL && (
                <a
                  href={TAKEDOWN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Report
                </a>
              )}
              <RouterLink to="/policy" className="text-primary hover:underline">
                Content policy
              </RouterLink>
            </div>
          </div>
        </div>
      ) : (
        r.imageUrl && (
          <div className="p-4 border-b border-border">
            <img
              src={r.imageUrl}
              alt="Region"
              className="w-full rounded border border-border object-contain"
            />
          </div>
        )
      )}

      {!isBitmapOnly && !hidden && (
        <div className="px-4 pt-3">
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={handleShare}
            disabled={busyAction === "share"}
          >
            {busyAction === "share" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            Share
          </Button>
        </div>
      )}

      {BOOST_META_LIST.some((m) => isBoostActive(m.getAt(r), nowSec)) && (
        <div className="px-4 pt-3 pb-1 flex flex-wrap items-center gap-1.5">
          {BOOST_META_LIST.filter((m) => isBoostActive(m.getAt(r), nowSec)).map((m) => {
            const Icon = m.icon;
            const remaining = formatBoostCountdown(boostSecondsRemaining(m.getAt(r), nowSec));
            return (
              <span
                key={m.kind}
                className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${m.badgeClass}`}
                title={`${m.label} · ${remaining} · ${getBoostDescription(m, reducedMotion)}`}
              >
                <Icon className="w-2.5 h-2.5" aria-hidden="true" /> {m.label} · {remaining}
              </span>
            );
          })}
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="cursor-help inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="What are boosts?"
              >
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] p-3">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold tracking-wider uppercase text-foreground">
                  Boosts
                </p>
                <p className="text-xs text-muted-foreground">
                  Paid visibility upgrades. Each lasts 24&nbsp;hours.
                </p>
                <ul className="space-y-1 pt-0.5">
                  {BOOST_META_LIST.map((m) => {
                    const Icon = m.icon;
                    return (
                      <li
                        key={m.kind}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon className={`w-3 h-3 ${m.iconClass}`} aria-hidden="true" />
                          <span className="text-foreground">{m.label}</span>
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {m.priceSol} SOL
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
                  Active boosts display here with a live countdown.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
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
              ? `Listed @ ${formatSol(currentListingPrice)} SOL`
              : "Not listed"}
          </span>
        </div>
        {r.linkUrl && (() => {
          const safeLink = sanitizeExternalUrl(r.linkUrl);
          return (
            <div className="space-y-1">
              <span className="text-muted-foreground">URL</span>
              {safeLink ? (
                <a
                  href={safeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={safeLink}
                  className="block text-primary hover:underline text-xs truncate"
                >
                  {safeLink}
                </a>
              ) : (
                <span
                  className="block text-muted-foreground text-xs truncate"
                  title="Unsafe URL scheme — not rendered as a link"
                >
                  (unsafe link hidden)
                </span>
              )}
            </div>
          );
        })()}

        {!isBitmapOnly && (
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={`https://solscan.io/account/${r.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              View on Solscan
            </a>
            <button
              type="button"
              onClick={async () => {
                const embed = `<iframe src="${window.location.origin}/embed/r/${r.id}" width="320" height="180" frameborder="0" style="border:0;border-radius:8px"></iframe>`;
                try {
                  await navigator.clipboard.writeText(embed);
                  toast.success("Embed code copied");
                } catch {
                  toast.error("Couldn't copy");
                }
              }}
              className="cursor-pointer flex items-center gap-1 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              aria-label="Copy embed code"
            >
              <Code2 className="w-3 h-3" />
              Copy embed
            </button>
          </div>
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
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">
                  Boosts last 24h each. Re-buying while active extends by another 24h. Paid
                  to the treasury.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          {BOOST_META_LIST.map((m) => {
            const Icon = m.icon;
            const at = m.getAt(r);
            const active = isBoostActive(at, nowSec);
            const remaining = active
              ? formatBoostCountdown(boostSecondsRemaining(at, nowSec))
              : null;
            const busy = busyAction === `boost-${m.flag}`;
            const anyBoostBusy = busyAction?.startsWith("boost-") ?? false;
            return (
              <div key={m.kind} className="space-y-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 justify-start"
                  disabled={anyBoostBusy}
                  onClick={() => handleBoost(m.flag)}
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className={`w-4 h-4 ${m.iconClass}`} />
                  )}
                  <span className="flex-1 text-left">
                    {active
                      ? `Extend ${m.label} 24h`
                      : `${m.label} 24h`}
                  </span>
                  <span className="text-muted-foreground">{m.priceSol} SOL</span>
                </Button>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-1">
                  <span className="truncate pr-2">
                    {getBoostDescription(m, reducedMotion)}
                  </span>
                  {active && (
                    <span className={`${m.iconClass} font-mono shrink-0`}>{remaining}</span>
                  )}
                </div>
              </div>
            );
          })}
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
                Buy for {formatSol(currentListingPrice)} SOL
              </Button>
            )}
          </>
        ) : (
          isOwner && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="listing-start-price" className="sr-only">
                    Start price in SOL
                  </label>
                  <input
                    id="listing-start-price"
                    type="number"
                    step="0.001"
                    placeholder="Start (SOL)"
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="listing-end-price" className="sr-only">
                    End price in SOL
                  </label>
                  <input
                    id="listing-end-price"
                    type="number"
                    step="0.001"
                    placeholder="End (SOL)"
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
