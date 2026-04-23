import { Grid, Tag, Activity as ActivityIcon, ShieldAlert, Flag, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import WalletButton from "@/components/WalletButton";
import WalletBalances from "@/components/WalletBalances";
import logo from "@/assets/logo.png";
import { useRegions } from "@/context/RegionContext";
import { BOOST_META_LIST, getBoostDescription } from "@/lib/boosts";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatSol } from "@/solana/pricing";

const TAKEDOWN_URL =
  (import.meta.env.VITE_TAKEDOWN_URL as string | undefined)?.trim() || "";

interface Props {
  view: "canvas" | "marketplace";
  onViewChange: (v: "canvas" | "marketplace") => void;
}

const CanvasToolbar = ({ view, onViewChange }: Props) => {
  const { isLoading, regions } = useRegions();
  const reducedMotion = useReducedMotion();
  return (
    <header className="flex items-center justify-between gap-3 px-3 sm:px-5 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <img src={logo} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-md shrink-0 ring-1 ring-primary/20" />
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-none truncate">
            <span className="text-primary text-glow">Solana</span>
            <span className="text-foreground">billboard</span>
            <span className="text-muted-foreground hidden sm:inline">.space</span>
          </h1>
          <p
            aria-live="polite"
            className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground tracking-wider uppercase mt-1"
          >
            <span>Own pixels on Solana</span>
            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />
            <span className="inline-flex items-center gap-1 font-mono normal-case tracking-normal">
              <span className="relative flex w-1.5 h-1.5">
                {isLoading && (
                  <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
                )}
                <span
                  className={`relative inline-block w-1.5 h-1.5 rounded-full ${
                    isLoading ? "bg-primary" : "bg-emerald-400"
                  }`}
                />
              </span>
              <span className={isLoading ? "text-primary" : ""}>
                {isLoading ? "Syncing…" : `${regions.length} region${regions.length === 1 ? "" : "s"}`}
              </span>
            </span>
          </p>
        </div>
      </div>

      <div role="tablist" aria-label="View" className="flex items-center gap-1 bg-secondary rounded-md p-0.5 shrink-0">
        <Button
          role="tab"
          aria-selected={view === "canvas"}
          size="sm"
          variant={view === "canvas" ? "default" : "ghost"}
          className="cursor-pointer gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("canvas")}
        >
          <Grid className="w-3.5 h-3.5" aria-hidden="true" />
          Billboard
        </Button>
        <Button
          role="tab"
          aria-selected={view === "marketplace"}
          size="sm"
          variant={view === "marketplace" ? "default" : "ghost"}
          className="cursor-pointer gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("marketplace")}
        >
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          Market
        </Button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-end">
        <div className="flex items-center gap-0.5">
          <Popover>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="cursor-pointer text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                    aria-label="Boost legend"
                  >
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipPrimitive.Portal>
                <TooltipContent side="bottom" className="text-xs">Boost legend</TooltipContent>
              </TooltipPrimitive.Portal>
            </Tooltip>
            <PopoverContent side="bottom" align="end" className="w-72 p-3">
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] font-semibold tracking-wider uppercase text-foreground">
                    Boosts
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Paid visibility upgrades. Each lasts 24 hours.
                  </p>
                </div>
                <ul className="space-y-2 pt-0.5">
                  {BOOST_META_LIST.map((m) => {
                    const Icon = m.icon;
                    return (
                      <li key={m.kind} className="flex items-start gap-2.5 text-xs">
                        <span
                          className={`shrink-0 w-6 h-6 rounded-full inline-flex items-center justify-center ${m.dotClass}`}
                          aria-hidden="true"
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-foreground font-semibold">{m.label}</span>
                            <span className="font-mono text-muted-foreground text-[11px]">
                              {formatSol(m.priceLamports)} SOL
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">
                            {getBoostDescription(m, reducedMotion)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="cursor-pointer text-muted-foreground hover:text-foreground h-8 w-8 p-0"
              >
                <Link to="/activity" aria-label="View recent activity">
                  <ActivityIcon className="w-4 h-4" aria-hidden="true" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
              <TooltipContent side="bottom" className="text-xs">Activity</TooltipContent>
            </TooltipPrimitive.Portal>
          </Tooltip>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="cursor-pointer text-muted-foreground hover:text-foreground h-8 w-8 p-0 hidden sm:inline-flex"
              >
                <Link to="/policy" aria-label="Content policy">
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
              <TooltipContent side="bottom" className="text-xs">Content policy</TooltipContent>
            </TooltipPrimitive.Portal>
          </Tooltip>
          {TAKEDOWN_URL && (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-muted-foreground hover:text-foreground h-8 w-8 p-0 hidden sm:inline-flex"
                >
                  <a
                    href={TAKEDOWN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Report a region"
                  >
                    <Flag className="w-4 h-4" aria-hidden="true" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipPrimitive.Portal>
                <TooltipContent side="bottom" className="text-xs">Report a region</TooltipContent>
              </TooltipPrimitive.Portal>
            </Tooltip>
          )}
        </div>
        <div className="hidden md:block">
          <WalletBalances />
        </div>
        <WalletButton />
      </div>
    </header>
  );
};

export default CanvasToolbar;
