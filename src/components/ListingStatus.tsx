import { TrendingDown, TrendingUp } from "lucide-react";
import {
  calculateListingCurrentPrice,
  formatListingTimeLeft,
  formatSol,
  getListingMode,
  type ListingMode,
} from "@/solana/pricing";
import type { ListingInfo } from "@/types/region";

interface Props {
  listing: ListingInfo | null | undefined;
  isListed: boolean;
  unlistedLabel?: string;
  className?: string;
}

const MODE_LABEL: Record<ListingMode, string> = {
  fixed: "Fixed",
  falling: "Falling",
  rising: "Rising",
};

export function ListingStatus({
  listing,
  isListed,
  unlistedLabel = "Unlisted",
  className,
}: Props) {
  if (!isListed || !listing) {
    return <span className={className ?? "text-muted-foreground"}>{unlistedLabel}</span>;
  }

  const mode = getListingMode(listing.startPrice, listing.endPrice);
  const price = formatSol(
    calculateListingCurrentPrice(
      listing.startPrice,
      listing.endPrice,
      listing.startTime,
      listing.endTime
    )
  );
  const color = mode === "fixed" ? "text-primary" : "text-accent";
  const Icon = mode === "falling" ? TrendingDown : mode === "rising" ? TrendingUp : null;
  const tooltip =
    mode === "fixed"
      ? `Fixed price · ${price} SOL`
      : `Price ${mode === "falling" ? "falls" : "rises"} from ${formatSol(
          listing.startPrice
        )} → ${formatSol(listing.endPrice)} SOL · ${formatListingTimeLeft(listing.endTime)}`;

  return (
    <span
      className={`inline-flex items-center gap-1 ${color} ${className ?? ""}`}
      title={tooltip}
    >
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      <span>
        {MODE_LABEL[mode]} · {price} SOL
      </span>
    </span>
  );
}

export default ListingStatus;
