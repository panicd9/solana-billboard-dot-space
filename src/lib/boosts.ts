import { Sparkles, Zap, TrendingUp, type LucideIcon } from "lucide-react";
import {
  BOOST_HIGHLIGHTED,
  BOOST_GLOWING,
  BOOST_TRENDING,
} from "@/solana/constants";
import type { Region } from "@/types/region";

export type BoostKind = "highlight" | "glow" | "trending";

export interface BoostMeta {
  kind: BoostKind;
  flag: number;
  label: string;
  /** Animated-motion description (default). */
  description: string;
  /** Description when prefers-reduced-motion is active. */
  descriptionStatic: string;
  icon: LucideIcon;
  // Pre-composed Tailwind class fragments — listed in full so the JIT scanner picks them up.
  badgeClass: string;
  iconClass: string;
  dotClass: string;
  getAt: (r: Region) => bigint;
}

export const BOOST_META: Record<BoostKind, BoostMeta> = {
  highlight: {
    kind: "highlight",
    flag: BOOST_HIGHLIGHTED,
    label: "Highlight",
    description: "Pulsing cyan inner glow draws the eye on the canvas.",
    descriptionStatic: "Cyan inner glow frames the region on the canvas.",
    icon: Sparkles,
    badgeClass:
      "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.35)]",
    iconClass: "text-cyan-400",
    dotClass: "bg-cyan-500/90 text-cyan-50 shadow-[0_0_8px_rgba(34,211,238,0.6)]",
    getAt: (r) => r.highlightedAt,
  },
  glow: {
    kind: "glow",
    flag: BOOST_GLOWING,
    label: "Glow",
    description: "Animated purple border snakes around your region.",
    descriptionStatic: "Bright purple border wraps the region.",
    icon: Zap,
    badgeClass:
      "bg-purple-500/15 text-purple-300 border border-purple-400/30 shadow-[0_0_8px_rgba(153,69,255,0.3)]",
    iconClass: "text-purple-400",
    dotClass:
      "bg-purple-500/90 text-purple-50 shadow-[0_0_8px_rgba(153,69,255,0.6)]",
    getAt: (r) => r.glowingAt,
  },
  trending: {
    kind: "trending",
    flag: BOOST_TRENDING,
    label: "Trending",
    description: "Pins to the Trending sidebar with an arrow badge.",
    descriptionStatic: "Pins to the Trending sidebar with an arrow badge.",
    icon: TrendingUp,
    badgeClass:
      "bg-orange-500/15 text-orange-300 border border-orange-400/30 shadow-[0_0_8px_rgba(255,140,0,0.25)]",
    iconClass: "text-orange-400",
    dotClass:
      "bg-orange-500/90 text-orange-50 shadow-[0_0_8px_rgba(255,140,0,0.6)]",
    getAt: (r) => r.trendingAt,
  },
};

export function getBoostDescription(meta: BoostMeta, reducedMotion: boolean): string {
  return reducedMotion ? meta.descriptionStatic : meta.description;
}

export const BOOST_META_LIST: readonly BoostMeta[] = [
  BOOST_META.highlight,
  BOOST_META.glow,
  BOOST_META.trending,
];
