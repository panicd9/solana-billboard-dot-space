import { BLOCK_SIZE, GRID_COLS, GRID_ROWS, type Region } from "@/types/region";
import type { AnimatedImage } from "@/hooks/useAnimatedImages";

const TARGET_WIDTH = 1200;
const FOOTER_PX = 56;
const MIN_CONTEXT_BLOCKS = 32;

/**
 * Renders a cropped-canvas-with-highlight PNG for sharing a region on social.
 * Frames the target region inside ~32 blocks of canvas context so viewers see
 * both the region and its neighborhood; adds a teal border on the region and a
 * bottom strip with the domain + coordinates.
 */
export async function generateShareImage(
  region: Region,
  allRegions: Region[],
  loadedImages: Map<string, HTMLImageElement>,
  animatedImages: Map<string, AnimatedImage>,
  isHidden: (id: string) => boolean
): Promise<Blob> {
  const cropW = Math.min(
    GRID_COLS,
    Math.max(region.width + 8, MIN_CONTEXT_BLOCKS)
  );
  const cropH = Math.min(
    GRID_ROWS,
    Math.max(region.height + 8, Math.round((cropW * 9) / 16))
  );

  const centerCol = region.startX + region.width / 2;
  const centerRow = region.startY + region.height / 2;
  const cropCol = Math.max(
    0,
    Math.min(GRID_COLS - cropW, Math.round(centerCol - cropW / 2))
  );
  const cropRow = Math.max(
    0,
    Math.min(GRID_ROWS - cropH, Math.round(centerRow - cropH / 2))
  );

  const cropPxW = cropW * BLOCK_SIZE;
  const cropPxH = cropH * BLOCK_SIZE;
  const scale = TARGET_WIDTH / cropPxW;
  const outW = Math.round(cropPxW * scale);
  const outH = Math.round(cropPxH * scale) + FOOTER_PX;

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-cropCol * BLOCK_SIZE, -cropRow * BLOCK_SIZE);

  ctx.fillStyle = "#0E0E11";
  ctx.fillRect(cropCol * BLOCK_SIZE, cropRow * BLOCK_SIZE, cropPxW, cropPxH);

  ctx.strokeStyle = "rgba(31, 31, 36, 0.7)";
  ctx.lineWidth = 0.5 / scale;
  const c0 = cropCol;
  const c1 = cropCol + cropW;
  const r0 = cropRow;
  const r1 = cropRow + cropH;
  for (let c = c0; c <= c1; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK_SIZE, r0 * BLOCK_SIZE);
    ctx.lineTo(c * BLOCK_SIZE, r1 * BLOCK_SIZE);
    ctx.stroke();
  }
  for (let r = r0; r <= r1; r++) {
    ctx.beginPath();
    ctx.moveTo(c0 * BLOCK_SIZE, r * BLOCK_SIZE);
    ctx.lineTo(c1 * BLOCK_SIZE, r * BLOCK_SIZE);
    ctx.stroke();
  }

  for (const rg of allRegions) {
    if (rg.startX + rg.width <= cropCol) continue;
    if (rg.startY + rg.height <= cropRow) continue;
    if (rg.startX >= cropCol + cropW) continue;
    if (rg.startY >= cropRow + cropH) continue;

    const rx = rg.startX * BLOCK_SIZE;
    const ry = rg.startY * BLOCK_SIZE;
    const rw = rg.width * BLOCK_SIZE;
    const rh = rg.height * BLOCK_SIZE;

    if (isHidden(rg.id)) {
      ctx.fillStyle = "rgba(120, 120, 130, 0.22)";
      ctx.fillRect(rx, ry, rw, rh);
      continue;
    }
    const anim = animatedImages.get(rg.id);
    const img = loadedImages.get(rg.id);
    if (anim && anim.frames[0]) {
      ctx.drawImage(anim.frames[0], rx, ry, rw, rh);
    } else if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, rx, ry, rw, rh);
    } else {
      ctx.fillStyle = "rgba(100, 70, 180, 0.25)";
      ctx.fillRect(rx, ry, rw, rh);
    }
    ctx.strokeStyle = "rgba(100, 70, 180, 0.4)";
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(rx, ry, rw, rh);
  }

  const tx = region.startX * BLOCK_SIZE;
  const ty = region.startY * BLOCK_SIZE;
  const tw = region.width * BLOCK_SIZE;
  const th = region.height * BLOCK_SIZE;
  ctx.save();
  ctx.shadowColor = "rgba(0, 210, 190, 0.9)";
  ctx.shadowBlur = 10 / scale;
  ctx.strokeStyle = "rgba(0, 210, 190, 1)";
  ctx.lineWidth = 2.5 / scale;
  ctx.strokeRect(tx, ty, tw, th);
  ctx.restore();

  ctx.restore();

  const footerY = outH - FOOTER_PX;
  ctx.fillStyle = "#0E0E11";
  ctx.fillRect(0, footerY, outW, FOOTER_PX);
  ctx.fillStyle = "rgba(0, 210, 190, 0.85)";
  ctx.fillRect(0, footerY, outW, 2);

  ctx.fillStyle = "rgba(240, 240, 245, 0.95)";
  ctx.font = "bold 20px 'Space Grotesk', system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("solanabillboard.space", 20, footerY + FOOTER_PX / 2);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(0, 210, 190, 0.95)";
  ctx.font = "500 14px 'JetBrains Mono', ui-monospace, monospace";
  const meta = `(${region.startX}, ${region.startY}) · ${region.width}×${region.height}`;
  ctx.fillText(meta, outW - 20, footerY + FOOTER_PX / 2);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png"
    );
  });
}
