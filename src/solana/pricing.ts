import {
  CENTER_ZONE_X,
  CENTER_ZONE_Y,
  CENTER_ZONE_WIDTH,
  CENTER_ZONE_HEIGHT,
  CENTER_PRICE_PER_BLOCK,
  CURVE_START_PRICE,
  CURVE_END_PRICE,
  CURVE_TOTAL_BLOCKS,
  SOL_DECIMALS,
} from "./constants";

export function isCenterZone(x: number, y: number): boolean {
  return (
    x >= CENTER_ZONE_X &&
    x < CENTER_ZONE_X + CENTER_ZONE_WIDTH &&
    y >= CENTER_ZONE_Y &&
    y < CENTER_ZONE_Y + CENTER_ZONE_HEIGHT
  );
}

export function countCenterAndCurveBlocks(
  x: number,
  y: number,
  width: number,
  height: number
): { centerCount: bigint; curveCount: bigint } {
  let centerCount = 0;
  let curveCount = 0;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (isCenterZone(x + dx, y + dy)) {
        centerCount++;
      } else {
        curveCount++;
      }
    }
  }
  return { centerCount: BigInt(centerCount), curveCount: BigInt(curveCount) };
}

// Mirrors the on-chain calculate_region_price function exactly.
export function calculateRegionPrice(
  x: number,
  y: number,
  width: number,
  height: number,
  curveBlocksSold: number
): bigint {
  const { centerCount, curveCount } = countCenterAndCurveBlocks(
    x,
    y,
    width,
    height
  );

  const centerTotal = centerCount * CENTER_PRICE_PER_BLOCK;

  let curveTotal = 0n;
  if (curveCount > 0n) {
    const s = BigInt(curveBlocksSold);
    const divisor = CURVE_TOTAL_BLOCKS - 1n; // 18695

    const base = curveCount * CURVE_START_PRICE;
    const seqSum = curveCount * s + (curveCount * (curveCount - 1n)) / 2n;
    const curvePart = ((CURVE_END_PRICE - CURVE_START_PRICE) * seqSum) / divisor;
    curveTotal = base + curvePart;
  }

  return centerTotal + curveTotal;
}

// Max accepted listing price: 1,000,000 SOL. Rejects Infinity, negatives,
// scientific notation, and precision loss past 9 decimals.
export const MAX_LISTING_LAMPORTS = 1_000_000n * 1_000_000_000n;

export function parseSolInputToLamports(input: string): bigint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;

  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > SOL_DECIMALS) return null;
  const padded = frac.padEnd(SOL_DECIMALS, "0");
  const combined = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  const lamports = BigInt(combined || "0");
  if (lamports <= 0n) return null;
  if (lamports > MAX_LISTING_LAMPORTS) return null;
  return lamports;
}

export function formatSol(lamports: bigint): string {
  const units = Number(lamports) / 10 ** SOL_DECIMALS;
  if (units === 0) return "0";
  if (units < 0.0001) return units.toFixed(6);
  if (units < 0.01) return units.toFixed(5);
  if (units < 1) return units.toFixed(4);
  return units.toFixed(3);
}

export function calculateListingCurrentPrice(
  startPrice: bigint,
  endPrice: bigint,
  startTime: bigint,
  endTime: bigint
): bigint {
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (now <= startTime) return startPrice;
  if (now >= endTime) return endPrice;

  const elapsed = now - startTime;
  const duration = endTime - startTime;

  if (endPrice >= startPrice) {
    // Price going up
    return startPrice + ((endPrice - startPrice) * elapsed) / duration;
  } else {
    // Price going down (Dutch auction)
    return startPrice - ((startPrice - endPrice) * elapsed) / duration;
  }
}
