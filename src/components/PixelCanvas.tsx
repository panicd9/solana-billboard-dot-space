import { useRef, useEffect, useState, useCallback, memo } from "react";
import { GRID_COLS, GRID_ROWS, BLOCK_SIZE, CANVAS_W, CANVAS_H, isBoostActive, type Selection, type Region } from "@/types/region";
import { CENTER_ZONE_X, CENTER_ZONE_Y, CENTER_ZONE_WIDTH, CENTER_ZONE_HEIGHT } from "@/solana/constants";
import { useRegions } from "@/context/RegionContext";
import { ZoomIn, ZoomOut, Maximize, MousePointer2, Coins, X, Loader2 } from "lucide-react";

interface Props {
  selection: Selection | null;
  onSelectionChange: (sel: Selection | null) => void;
  onRegionClick: (region: Region) => void;
  showPricingOverlay?: boolean;
  heroDismissed: boolean;
  onDismissHero: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

// Center-cropped source rect that preserves aspect ratio ("object-fit: cover").
function coverSourceRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): [number, number, number, number] {
  if (!srcW || !srcH) return [0, 0, srcW, srcH];
  const srcAR = srcW / srcH;
  const dstAR = dstW / dstH;
  if (srcAR > dstAR) {
    const sw = srcH * dstAR;
    return [(srcW - sw) / 2, 0, sw, srcH];
  }
  const sh = srcW / dstAR;
  return [0, (srcH - sh) / 2, srcW, sh];
}

const PixelCanvas = memo(({ selection, onSelectionChange, onRegionClick, showPricingOverlay, heroDismissed, onDismissHero }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { regions, occupancy, isOccupied, hasOverlap, getRegionAt, loadedImages, animatedImages, isAssetHidden, imageFit, isLoading } = useRegions();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ col: number; row: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ col: number; row: number } | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{ col: number; row: number } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const animRef = useRef<number>(0);

  // Pan & Zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Keyboard navigation state
  const [kbCursor, setKbCursor] = useState<{ col: number; row: number } | null>(null);
  const [kbAnchor, setKbAnchor] = useState<{ col: number; row: number } | null>(null);

  // Reduced motion preference
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const clampPan = useCallback((px: number, py: number, z: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: px, y: py };
    const minX = Math.min(0, canvas.width - CANVAS_W * z);
    const minY = Math.min(0, canvas.height - CANVAS_H * z);
    return {
      x: Math.min(0, Math.max(minX, px)),
      y: Math.min(0, Math.max(minY, py)),
    };
  }, []);

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((clientX - rect.left) * scaleX - pan.x) / zoom;
    const y = ((clientY - rect.top) * scaleY - pan.y) / zoom;
    return { x, y };
  }, [pan, zoom]);

  const getBlockCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (!pos) return null;
    const col = Math.floor(pos.x / BLOCK_SIZE);
    const row = Math.floor(pos.y / BLOCK_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }, [screenToCanvas]);

  const normalizeSelection = useCallback(
    (start: { col: number; row: number }, end: { col: number; row: number }): Selection => {
      const col = Math.min(start.col, end.col);
      const row = Math.min(start.row, end.row);
      return { col, row, width: Math.abs(end.col - start.col) + 1, height: Math.abs(end.row - start.row) + 1 };
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        return;
      }
      if (e.button !== 0) return;
      const coords = getBlockCoords(e);
      if (!coords) return;

      const region = getRegionAt(coords.col, coords.row);
      if (region) {
        onRegionClick(region);
        return;
      }

      setIsDragging(true);
      setDragStart(coords);
      setDragEnd(coords);
      onSelectionChange(null);
    },
    [getBlockCoords, getRegionAt, onRegionClick, onSelectionChange, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setPan(clampPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy, zoom));
        return;
      }

      const coords = getBlockCoords(e);
      if (!coords) return;
      setHoveredBlock(coords);

      const region = getRegionAt(coords.col, coords.row);
      if (region && !isDragging) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        setTooltipInfo({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          text: `${region.owner.slice(0, 4)}...${region.owner.slice(-4)} | ${region.width}x${region.height}`,
        });
      } else {
        setTooltipInfo(null);
      }

      if (isDragging && dragStart) {
        setDragEnd(coords);
      }
    },
    [getBlockCoords, isDragging, dragStart, getRegionAt, isPanning, clampPan, zoom]
  );

  const handleMouseUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (isDragging && dragStart && dragEnd) {
      const sel = normalizeSelection(dragStart, dragEnd);
      if (!hasOverlap(sel)) {
        onSelectionChange(sel);
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isPanning, isDragging, dragStart, dragEnd, normalizeSelection, hasOverlap, onSelectionChange]);

  const handleMouseLeave = useCallback(() => {
    setHoveredBlock(null);
    setTooltipInfo(null);
    if (isPanning) setIsPanning(false);
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  }, [isDragging, isPanning]);

  // Wheel handler — must be non-passive to call preventDefault.
  // React's synthetic onWheel is passive by default.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * zoomFactor));
      const scale = newZoom / zoom;
      const newPanX = mouseX - scale * (mouseX - pan.x);
      const newPanY = mouseY - scale * (mouseY - pan.y);

      setZoom(newZoom);
      setPan(clampPan(newPanX, newPanY, newZoom));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [zoom, pan, clampPan]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(z => Math.min(MAX_ZOOM, z * 1.3));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(z => Math.max(MIN_ZOOM, z * 0.7));
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      const moveKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (moveKeys.includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const cur = kbCursor ?? { col: 0, row: 0 };
        let { col, row } = cur;
        if (e.key === "ArrowUp") row = Math.max(0, row - step);
        if (e.key === "ArrowDown") row = Math.min(GRID_ROWS - 1, row + step);
        if (e.key === "ArrowLeft") col = Math.max(0, col - step);
        if (e.key === "ArrowRight") col = Math.min(GRID_COLS - 1, col + step);
        setKbCursor({ col, row });
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!kbCursor) {
          setKbCursor({ col: 0, row: 0 });
          return;
        }
        if (kbAnchor) {
          const sel = normalizeSelection(kbAnchor, kbCursor);
          if (!hasOverlap(sel)) onSelectionChange(sel);
          setKbAnchor(null);
        } else {
          const region = getRegionAt(kbCursor.col, kbCursor.row);
          if (region) {
            onRegionClick(region);
          } else {
            setKbAnchor(kbCursor);
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setKbAnchor(null);
        if (selection) onSelectionChange(null);
        else setKbCursor(null);
      }
    },
    [kbCursor, kbAnchor, normalizeSelection, hasOverlap, onSelectionChange, getRegionAt, onRegionClick, selection]
  );

  // Detect whether any animated boost is visible
  const nowSecForBoosts = Math.floor(Date.now() / 1000);
  const hasAnimatedBoost =
    !reducedMotion &&
    regions.some(
      (r) =>
        isBoostActive(r.highlightedAt, nowSecForBoosts) ||
        isBoostActive(r.glowingAt, nowSecForBoosts)
    );
  // Detect whether any animated GIF region is present
  const hasAnimatedGif = !reducedMotion && animatedImages.size > 0;

  // Accessible summary: active boost counts for screen readers (canvas itself is inert SR-wise).
  const boostCounts = regions.reduce(
    (acc, r) => {
      if (isBoostActive(r.highlightedAt, nowSecForBoosts)) acc.highlight++;
      if (isBoostActive(r.glowingAt, nowSecForBoosts)) acc.glow++;
      if (isBoostActive(r.trendingAt, nowSecForBoosts)) acc.trending++;
      return acc;
    },
    { highlight: 0, glow: 0, trending: 0 }
  );
  const boostSummary = [
    boostCounts.highlight && `${boostCounts.highlight} highlighted`,
    boostCounts.glow && `${boostCounts.glow} glowing`,
    boostCounts.trending && `${boostCounts.trending} trending`,
  ]
    .filter(Boolean)
    .join(", ");
  const canvasSummary = `Pixel billboard: ${regions.length} region${regions.length === 1 ? "" : "s"} placed${boostSummary ? `; ${boostSummary}` : ""}.`;

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0E0E11";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Apply pan and zoom
      ctx.setTransform(zoom, 0, 0, zoom, pan.x, pan.y);

      // Grid lines
      ctx.strokeStyle = "rgba(31, 31, 36, 0.7)";
      ctx.lineWidth = 0.5 / zoom;
      for (let c = 0; c <= GRID_COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, CANVAS_H);
        ctx.stroke();
      }
      for (let r = 0; r <= GRID_ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK_SIZE);
        ctx.lineTo(CANVAS_W, r * BLOCK_SIZE);
        ctx.stroke();
      }

      // Center zone pricing overlay
      if (showPricingOverlay) {
        const czX = CENTER_ZONE_X * BLOCK_SIZE;
        const czY = CENTER_ZONE_Y * BLOCK_SIZE;
        const czW = CENTER_ZONE_WIDTH * BLOCK_SIZE;
        const czH = CENTER_ZONE_HEIGHT * BLOCK_SIZE;

        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(0, 0, CANVAS_W, czY);
        ctx.fillRect(0, czY, czX, czH);
        ctx.fillRect(czX + czW, czY, CANVAS_W - czX - czW, czH);
        ctx.fillRect(0, czY + czH, CANVAS_W, CANVAS_H - czY - czH);

        ctx.fillStyle = "rgba(255, 200, 55, 0.10)";
        ctx.fillRect(czX, czY, czW, czH);
        ctx.strokeStyle = "rgba(255, 200, 55, 0.6)";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(czX, czY, czW, czH);
        ctx.setLineDash([]);

        const label = "Center Zone — 0.0005 SOL/block";
        const fontSize = 18 / zoom;
        ctx.font = `bold ${fontSize}px 'Space Grotesk', sans-serif`;
        const tm = ctx.measureText(label);
        const lx = czX + czW / 2 - tm.width / 2;
        const ly = czY - 10 / zoom;
        ctx.fillStyle = "rgba(14, 14, 17, 0.85)";
        ctx.fillRect(lx - 8 / zoom, ly - fontSize - 3 / zoom, tm.width + 16 / zoom, fontSize + 8 / zoom);
        ctx.fillStyle = "rgba(255, 200, 55, 0.95)";
        ctx.fillText(label, lx, ly);

        const outerLabel = "Outer Zone — bonding curve 0.00004–0.0005 SOL";
        const outerFontSize = 16 / zoom;
        ctx.font = `bold ${outerFontSize}px 'Space Grotesk', sans-serif`;
        const otm = ctx.measureText(outerLabel);
        const olx = 12 / zoom;
        const oly = 26 / zoom;
        ctx.fillStyle = "rgba(14, 14, 17, 0.85)";
        ctx.fillRect(olx - 6 / zoom, oly - outerFontSize - 2 / zoom, otm.width + 12 / zoom, outerFontSize + 8 / zoom);
        ctx.fillStyle = "rgba(0, 210, 190, 0.9)";
        ctx.fillText(outerLabel, olx, oly);
      }

      // Render occupied blocks from bitmap
      if (occupancy.size > 0) {
        ctx.fillStyle = "rgba(100, 70, 180, 0.3)";
        for (const key of occupancy) {
          const sep = key.indexOf(":");
          const bx = parseInt(key.slice(0, sep), 10);
          const by = parseInt(key.slice(sep + 1), 10);
          ctx.fillRect(bx * BLOCK_SIZE, by * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }

      // Render regions
      const now = Date.now();
      const nowSec = Math.floor(now / 1000);
      for (const region of regions) {
        const hl = isBoostActive(region.highlightedAt, nowSec);
        const gl = isBoostActive(region.glowingAt, nowSec);
        const tr = isBoostActive(region.trendingAt, nowSec);
        const rx = region.startX * BLOCK_SIZE;
        const ry = region.startY * BLOCK_SIZE;
        const rw = region.width * BLOCK_SIZE;
        const rh = region.height * BLOCK_SIZE;

        const hidden = isAssetHidden(region.id);
        const anim = hidden ? undefined : animatedImages.get(region.id);
        const img = hidden ? undefined : loadedImages.get(region.id);
        if (hidden) {
          // Neutral gray tile instead of the rendered image. Owner address and
          // any boosts still render on top (handled below); the region stays
          // fully interactive so owners/moderators can find it.
          ctx.fillStyle = "rgba(120, 120, 130, 0.22)";
          ctx.fillRect(rx, ry, rw, rh);

          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();
          ctx.strokeStyle = "rgba(170, 170, 180, 0.25)";
          ctx.lineWidth = 1 / zoom;
          const step = 10;
          for (let d = -rh; d < rw; d += step) {
            ctx.beginPath();
            ctx.moveTo(rx + d, ry);
            ctx.lineTo(rx + d + rh, ry + rh);
            ctx.stroke();
          }
          ctx.restore();

          const label = "HIDDEN";
          const fontSize = Math.min(14, Math.min(rw, rh) * 0.35);
          if (fontSize >= 5) {
            ctx.font = `bold ${fontSize / zoom}px 'Space Grotesk', sans-serif`;
            const tm = ctx.measureText(label);
            const lx = rx + rw / 2 - tm.width / 2;
            const ly = ry + rh / 2 + fontSize / zoom / 3;
            ctx.fillStyle = "rgba(14, 14, 17, 0.8)";
            ctx.fillRect(lx - 3 / zoom, ly - fontSize / zoom - 1 / zoom, tm.width + 6 / zoom, fontSize / zoom + 4 / zoom);
            ctx.fillStyle = "rgba(200, 200, 210, 0.95)";
            ctx.fillText(label, lx, ly);
          }
        } else if (anim) {
          // Pick active frame based on wall-clock time modulo total duration.
          // For reduced-motion, always show the first frame.
          let frameIdx = 0;
          if (!reducedMotion && anim.totalDuration > 0) {
            let t = now % anim.totalDuration;
            for (let i = 0; i < anim.delays.length; i++) {
              if (t < anim.delays[i]) { frameIdx = i; break; }
              t -= anim.delays[i];
            }
          }
          const frame = anim.frames[frameIdx];
          if (imageFit === "cover") {
            const [sx, sy, sw, sh] = coverSourceRect(frame.width, frame.height, rw, rh);
            ctx.drawImage(frame, sx, sy, sw, sh, rx, ry, rw, rh);
          } else {
            ctx.drawImage(frame, rx, ry, rw, rh);
          }
        } else if (img) {
          if (imageFit === "cover") {
            const nw = img.naturalWidth || img.width;
            const nh = img.naturalHeight || img.height;
            const [sx, sy, sw, sh] = coverSourceRect(nw, nh, rw, rh);
            ctx.drawImage(img, sx, sy, sw, sh, rx, ry, rw, rh);
          } else {
            ctx.drawImage(img, rx, ry, rw, rh);
          }
        } else {
          ctx.fillStyle = "rgba(100, 70, 180, 0.25)";
          ctx.fillRect(rx, ry, rw, rh);

          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();
          ctx.strokeStyle = "rgba(100, 70, 180, 0.18)";
          ctx.lineWidth = 1 / zoom;
          const step = 8;
          for (let d = -rh; d < rw; d += step) {
            ctx.beginPath();
            ctx.moveTo(rx + d, ry);
            ctx.lineTo(rx + d + rh, ry + rh);
            ctx.stroke();
          }
          ctx.restore();

          const label = `${region.owner.slice(0, 4)}..${region.owner.slice(-4)}`;
          const fontSize = Math.min(20, Math.min(rw, rh) * 0.6);
          if (fontSize >= 4) {
            ctx.font = `${fontSize / zoom}px 'JetBrains Mono', monospace`;
            const tm = ctx.measureText(label);
            const lx = rx + rw / 2 - tm.width / 2;
            const ly = ry + rh / 2 + fontSize / zoom / 3;
            ctx.fillStyle = "rgba(14, 14, 17, 0.7)";
            ctx.fillRect(lx - 2 / zoom, ly - fontSize / zoom - 1 / zoom, tm.width + 4 / zoom, fontSize / zoom + 4 / zoom);
            ctx.fillStyle = "rgba(160, 130, 220, 0.9)";
            ctx.fillText(label, lx, ly);
          }
        }

        // Highlight boost — pulsing cyan inner glow (matches cyan-500 badge)
        if (hl) {
          const hPulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 400);
          const inset = Math.max(rw, rh) * (0.15 + hPulse * 0.20);
          const glowAlpha = 0.2 + hPulse * 0.2;

          // Ramp from cyan-400 (34,211,238) to cyan-300 (103,232,249) — matches BOOST_META.highlight.
          const r = Math.round(34 + (103 - 34) * hPulse);
          const g = Math.round(211 + (232 - 211) * hPulse);
          const b = Math.round(238 + (249 - 238) * hPulse);

          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();

          const gTop = ctx.createLinearGradient(rx, ry, rx, ry + inset);
          gTop.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
          gTop.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gTop;
          ctx.fillRect(rx, ry, rw, inset);

          const gBot = ctx.createLinearGradient(rx, ry + rh, rx, ry + rh - inset);
          gBot.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
          gBot.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gBot;
          ctx.fillRect(rx, ry + rh - inset, rw, inset);

          const gLeft = ctx.createLinearGradient(rx, ry, rx + inset, ry);
          gLeft.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
          gLeft.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gLeft;
          ctx.fillRect(rx, ry, inset, rh);

          const gRight = ctx.createLinearGradient(rx + rw, ry, rx + rw - inset, ry);
          gRight.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
          gRight.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = gRight;
          ctx.fillRect(rx + rw - inset, ry, inset, rh);

          ctx.restore();

          ctx.save();
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.4 + hPulse * 0.3})`;
          ctx.shadowBlur = (8 + hPulse * 8) / zoom;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.7 + hPulse * 0.3})`;
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.restore();
        }

        // Glow boost — rotating snake border (static when reduced motion)
        if (gl) {
          const perimeter = 2 * (rw + rh);
          const snakeLen = perimeter * 0.3;
          const gapLen = perimeter - snakeLen;
          const speed = reducedMotion ? 0 : now * 0.08;
          const dashOffset = -(speed % perimeter);

          ctx.save();
          ctx.strokeStyle = "rgba(153, 69, 255, 0.2)";
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.restore();

          ctx.save();
          ctx.shadowColor = "rgba(153, 69, 255, 0.9)";
          ctx.shadowBlur = 14 / zoom;
          ctx.strokeStyle = "rgba(153, 69, 255, 0.95)";
          ctx.lineWidth = 2.5 / zoom;
          ctx.setLineDash([snakeLen, gapLen]);
          ctx.lineDashOffset = dashOffset;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.setLineDash([]);
          ctx.restore();

          if (!reducedMotion) {
            ctx.save();
            const headLen = snakeLen * 0.15;
            ctx.strokeStyle = "rgba(200, 170, 255, 0.7)";
            ctx.lineWidth = 1.5 / zoom;
            ctx.setLineDash([headLen, perimeter - headLen]);
            ctx.lineDashOffset = dashOffset;
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);
            ctx.restore();
          }
        } else {
          ctx.strokeStyle = region.isListed ? "rgba(255, 200, 50, 0.7)" : "rgba(100, 70, 180, 0.6)";
          ctx.lineWidth = 1.5 / zoom;
          ctx.strokeRect(rx, ry, rw, rh);
        }

        if (tr) {
          // Trending badge — rounded orange disc with a TrendingUp-style arrow,
          // top-right corner. Matches the BoostDot used in the marketplace.
          const badge = Math.max(10, Math.min(16, Math.min(rw, rh) * 0.28));
          const inset = Math.max(2, badge * 0.18);
          const bx = rx + rw - badge - inset;
          const by = ry + inset;
          const cx = bx + badge / 2;
          const cy = by + badge / 2;
          const br = badge / 2;

          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
          ctx.shadowBlur = 3 / zoom;
          ctx.shadowOffsetY = 1 / zoom;
          ctx.fillStyle = "rgba(255, 140, 0, 0.95)";
          ctx.beginPath();
          ctx.arc(cx, cy, br, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Arrow: diagonal stroke pointing up-right + arrowhead at top-right.
          ctx.save();
          ctx.strokeStyle = "rgba(28, 14, 0, 0.92)";
          ctx.lineWidth = Math.max(1.2 / zoom, badge * 0.12);
          ctx.lineJoin = "round";
          ctx.lineCap = "round";
          const pad = badge * 0.28;
          const x0 = bx + pad;
          const y0 = by + badge - pad;
          const x1 = bx + badge - pad;
          const y1 = by + pad;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          const head = badge * 0.28;
          ctx.beginPath();
          ctx.moveTo(x1 - head, y1);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x1, y1 + head);
          ctx.stroke();
          ctx.restore();
        }
      }

      // Hover highlight (mouse)
      if (hoveredBlock && !isDragging && !isOccupied(hoveredBlock.col, hoveredBlock.row)) {
        ctx.fillStyle = "rgba(0, 224, 255, 0.15)";
        ctx.fillRect(hoveredBlock.col * BLOCK_SIZE, hoveredBlock.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = "rgba(0, 224, 255, 0.5)";
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(hoveredBlock.col * BLOCK_SIZE, hoveredBlock.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }

      if (hoveredBlock && isOccupied(hoveredBlock.col, hoveredBlock.row)) {
        const region = getRegionAt(hoveredBlock.col, hoveredBlock.row);
        if (region) {
          ctx.strokeStyle = "rgba(0, 224, 255, 0.8)";
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(region.startX * BLOCK_SIZE, region.startY * BLOCK_SIZE, region.width * BLOCK_SIZE, region.height * BLOCK_SIZE);
        }
      }

      // Keyboard cursor + anchored selection preview
      if (kbCursor) {
        if (kbAnchor) {
          const sel = normalizeSelection(kbAnchor, kbCursor);
          const overlap = hasOverlap(sel);
          ctx.fillStyle = overlap ? "rgba(220, 50, 50, 0.25)" : "rgba(0, 224, 255, 0.20)";
          ctx.fillRect(sel.col * BLOCK_SIZE, sel.row * BLOCK_SIZE, sel.width * BLOCK_SIZE, sel.height * BLOCK_SIZE);
          ctx.strokeStyle = overlap ? "rgba(220, 50, 50, 0.8)" : "rgba(0, 224, 255, 0.8)";
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(sel.col * BLOCK_SIZE, sel.row * BLOCK_SIZE, sel.width * BLOCK_SIZE, sel.height * BLOCK_SIZE);
        } else {
          ctx.strokeStyle = "rgba(0, 224, 255, 0.9)";
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(kbCursor.col * BLOCK_SIZE, kbCursor.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      }

      // Drag selection
      if (isDragging && dragStart && dragEnd) {
        const sel = normalizeSelection(dragStart, dragEnd);
        const overlap = hasOverlap(sel);
        ctx.fillStyle = overlap ? "rgba(220, 50, 50, 0.25)" : "rgba(0, 224, 255, 0.20)";
        ctx.fillRect(sel.col * BLOCK_SIZE, sel.row * BLOCK_SIZE, sel.width * BLOCK_SIZE, sel.height * BLOCK_SIZE);
        ctx.strokeStyle = overlap ? "rgba(220, 50, 50, 0.8)" : "rgba(0, 224, 255, 0.8)";
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(sel.col * BLOCK_SIZE, sel.row * BLOCK_SIZE, sel.width * BLOCK_SIZE, sel.height * BLOCK_SIZE);

        const text = `${sel.width}x${sel.height} (${sel.width * sel.height})`;
        const labelSize = 14 / zoom;
        ctx.font = `bold ${labelSize}px 'Space Grotesk', sans-serif`;
        const metrics = ctx.measureText(text);
        const lx = sel.col * BLOCK_SIZE + (sel.width * BLOCK_SIZE) / 2 - metrics.width / 2;
        const ly = sel.row * BLOCK_SIZE - 8 / zoom;
        ctx.fillStyle = "rgba(14, 14, 17, 0.9)";
        ctx.fillRect(lx - 5 / zoom, ly - labelSize - 2 / zoom, metrics.width + 10 / zoom, labelSize + 8 / zoom);
        ctx.fillStyle = overlap ? "#dc3232" : "#00E0FF";
        ctx.fillText(text, lx, ly);
      }

      // Finalized selection
      if (selection && !isDragging) {
        ctx.fillStyle = "rgba(0, 224, 255, 0.10)";
        ctx.fillRect(selection.col * BLOCK_SIZE, selection.row * BLOCK_SIZE, selection.width * BLOCK_SIZE, selection.height * BLOCK_SIZE);
        ctx.strokeStyle = "rgba(0, 224, 255, 0.9)";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.strokeRect(selection.col * BLOCK_SIZE, selection.row * BLOCK_SIZE, selection.width * BLOCK_SIZE, selection.height * BLOCK_SIZE);
        ctx.setLineDash([]);
      }
    };

    // Always draw at least once on state change
    draw();

    // Loop only when something is animating (boosts, GIFs) or actively dragging
    if (hasAnimatedBoost || hasAnimatedGif || isDragging) {
      const tick = () => {
        draw();
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [
    regions, occupancy, loadedImages, animatedImages, isAssetHidden, hoveredBlock, isDragging, dragStart, dragEnd,
    selection, normalizeSelection, hasOverlap, isOccupied, getRegionAt, zoom, pan,
    showPricingOverlay, kbCursor, kbAnchor, hasAnimatedBoost, hasAnimatedGif, reducedMotion,
  ]);

  const cursorLabel = kbCursor
    ? `Cursor at column ${kbCursor.col}, row ${kbCursor.row}${kbAnchor ? ", selecting" : ""}`
    : "";

  const showLoading = isLoading && regions.length === 0 && occupancy.size === 0;
  const showHero = !showLoading && !heroDismissed && !selection && !isDragging && !kbCursor;

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden flex items-center justify-center bg-background p-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        role="application"
        aria-label="Pixel canvas grid. Drag with mouse to select a region, or use arrow keys to move the cursor and Enter to start or finish a selection. Press Escape to cancel."
        tabIndex={0}
        className={`max-w-full max-h-full border border-border rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
        style={{ imageRendering: "pixelated" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
      />

      {/* Live region for screen reader keyboard feedback */}
      <div className="sr-only" aria-live="polite">{cursorLabel}</div>

      {/* Accessible summary of canvas state (region count + active boosts) for SR users. */}
      <div className="sr-only" aria-live="polite">{canvasSummary}</div>

      {/* Loading state — initial chain fetch */}
      {showLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none p-4"
          aria-live="polite"
        >
          <div className="bg-card/85 backdrop-blur-md border border-border rounded-xl shadow-2xl shadow-primary/10 px-5 py-4 text-center flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" aria-hidden="true" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Loading the billboard…</p>
              <p className="text-xs text-muted-foreground">Fetching regions from Solana</p>
            </div>
          </div>
        </div>
      )}

      {/* Hero / empty-state callout */}
      {showHero && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none p-4 animate-in fade-in duration-500"
          aria-hidden="true"
        >
          <div className="pointer-events-auto max-w-sm w-full bg-card/85 backdrop-blur-md border border-border rounded-xl shadow-2xl shadow-primary/10 p-5 text-center relative">
            <button
              type="button"
              onClick={onDismissHero}
              className="cursor-pointer absolute top-2 right-2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-3 rounded-full bg-primary/10 text-primary">
              <MousePointer2 className="w-6 h-6" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1.5">
              Click and drag to claim pixels
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select any empty area on the canvas, upload an image, and own a piece of the billboard forever.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-accent bg-accent/10 px-2.5 py-1 rounded-full">
              <Coins className="w-3 h-3" aria-hidden="true" />
              From 0.00004 SOL per block
            </div>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card/90 border border-border rounded-md backdrop-blur-sm p-1">
        <button
          type="button"
          onClick={zoomOut}
          className="cursor-pointer p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" aria-hidden="true" />
        </button>
        <span className="text-xs font-mono text-muted-foreground w-12 text-center" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          className="cursor-pointer p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          type="button"
          onClick={resetView}
          className="cursor-pointer p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Reset view"
        >
          <Maximize className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Coord overlay */}
      {hoveredBlock && !isDragging && (
        <div className="absolute bottom-4 left-4 px-2 py-1 rounded bg-card/90 border border-border text-xs font-mono text-muted-foreground backdrop-blur-sm">
          ({hoveredBlock.col}, {hoveredBlock.row})
        </div>
      )}
      {/* Region tooltip */}
      {tooltipInfo && (
        <div
          className="absolute px-2 py-1 rounded bg-card/95 border border-border text-xs font-mono text-foreground backdrop-blur-sm pointer-events-none"
          style={{ left: tooltipInfo.x + 12, top: tooltipInfo.y - 8 }}
        >
          {tooltipInfo.text}
        </div>
      )}
    </div>
  );
});

PixelCanvas.displayName = "PixelCanvas";
export default PixelCanvas;
