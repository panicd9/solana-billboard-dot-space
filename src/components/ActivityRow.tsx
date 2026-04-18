import { Link } from "react-router-dom";
import {
  Plus,
  Tag,
  XCircle,
  ArrowRightLeft,
  Sparkles,
  Image as ImageIcon,
  Link as LinkIcon,
  PencilLine,
} from "lucide-react";
import RegionMiniMap from "@/components/RegionMiniMap";
import { BOOST_META_LIST } from "@/lib/boosts";
import type { ActivityEvent, ActivityType } from "@/solana/activityEvents";
import type { Region } from "@/types/region";

interface Props {
  event: ActivityEvent;
  region: Region | null;
}

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

const TYPE_VISUAL: Record<
  ActivityType,
  {
    Icon: typeof Plus;
    verb: string;
    color: string;
    bg: string;
  }
> = {
  mint:         { Icon: Plus,           verb: "minted",        color: "text-emerald-400",        bg: "bg-emerald-400/10 border-emerald-400/30" },
  list:         { Icon: Tag,            verb: "listed",        color: "text-primary",            bg: "bg-primary/10 border-primary/30" },
  cancel:       { Icon: XCircle,        verb: "unlisted",      color: "text-muted-foreground",   bg: "bg-muted/30 border-border" },
  buy:          { Icon: ArrowRightLeft, verb: "bought",        color: "text-accent",             bg: "bg-accent/10 border-accent/30" },
  boost:        { Icon: Sparkles,       verb: "boosted",       color: "text-accent",             bg: "bg-accent/10 border-accent/30" },
  update_image: { Icon: ImageIcon,      verb: "updated image", color: "text-muted-foreground",   bg: "bg-muted/30 border-border" },
  update_link:  { Icon: LinkIcon,       verb: "updated link",  color: "text-muted-foreground",   bg: "bg-muted/30 border-border" },
  update_region:{ Icon: PencilLine,     verb: "edited region", color: "text-muted-foreground",   bg: "bg-muted/30 border-border" },
};

const relativeTime = (blockTime: number | null): string => {
  if (!blockTime) return "—";
  const diff = Math.floor(Date.now() / 1000 - blockTime);
  if (diff < 60) return `${Math.max(1, diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days < 30) return `${days}d ago`;
  return new Date(blockTime * 1000).toLocaleDateString();
};

const ActivityRow = ({ event, region }: Props) => {
  const v = TYPE_VISUAL[event.type];
  const Icon = v.Icon;
  const rowHref = event.assetAddress ? `/?region=${event.assetAddress}` : undefined;

  const body = (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60 hover:bg-card hover:border-primary/30 transition-colors">
      <div
        className={`inline-flex items-center justify-center w-9 h-9 rounded-md border shrink-0 ${v.bg}`}
        aria-hidden="true"
      >
        <Icon className={`w-4 h-4 ${v.color}`} />
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-foreground truncate">
            <Link
              to={`/u/${event.actor}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-primary hover:underline"
            >
              {shortAddr(event.actor)}
            </Link>{" "}
            <span className="text-muted-foreground">{v.verb}</span>
            {event.type === "boost" && event.boostFlags != null && event.boostFlags > 0 && (
              <>
                {" "}
                <span className="inline-flex flex-wrap items-center gap-1 align-middle">
                  {BOOST_META_LIST.filter((m) => (event.boostFlags! & m.flag) !== 0).map((m) => {
                    const BoostIcon = m.icon;
                    return (
                      <span
                        key={m.kind}
                        className={`inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${m.badgeClass}`}
                        title={`${m.label} boost`}
                      >
                        <BoostIcon className="w-2.5 h-2.5" aria-hidden="true" />
                        {m.label}
                      </span>
                    );
                  })}
                </span>
              </>
            )}
            {event.type === "buy" && event.seller && (
              <>
                {" "}
                <span className="text-muted-foreground">from</span>{" "}
                <Link
                  to={`/u/${event.seller}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-primary hover:underline"
                >
                  {shortAddr(event.seller)}
                </Link>
              </>
            )}
            {region && (
              <>
                {" "}
                <span className="text-muted-foreground">·</span>{" "}
                <span className="text-foreground">
                  {region.width}×{region.height}
                </span>{" "}
                <span className="text-muted-foreground text-xs">
                  @ ({region.startX}, {region.startY})
                </span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {relativeTime(event.blockTime)}
          </div>
        </div>

        {region ? (
          <div className="w-20 h-11 rounded border border-border overflow-hidden shrink-0">
            <RegionMiniMap
              startX={region.startX}
              startY={region.startY}
              width={region.width}
              height={region.height}
              className="w-full h-full"
            />
          </div>
        ) : event.assetAddress ? (
          <div className="font-mono text-[10px] text-muted-foreground shrink-0 hidden sm:block">
            {shortAddr(event.assetAddress)}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (rowHref) {
    return (
      <Link to={rowHref} className="block cursor-pointer">
        {body}
      </Link>
    );
  }
  return body;
};

export default ActivityRow;
