export interface ShareMetaInput {
  x: number | null;
  y: number | null;
  w: number | null;
  h: number | null;
}

export interface ShareMeta {
  title: string;
  description: string;
  hasCoords: boolean;
}

export function buildShareMeta(input: ShareMetaInput): ShareMeta {
  const { x, y, w, h } = input;
  const hasCoords = x !== null && y !== null && w !== null && h !== null;

  if (hasCoords) {
    return {
      hasCoords: true,
      title: `Region (${x}, ${y}) · ${w}×${h} — solanabillboard.space`,
      description: `An on-chain pixel region on solanabillboard.space — ${(w as number) * (h as number)} blocks at (${x}, ${y}).`,
    };
  }

  return {
    hasCoords: false,
    title: "Solanabillboard.space",
    description:
      "Solana-integrated pixel marketplace — purchase regions, upload images, and trade on-chain.",
  };
}
