import { useRef, useEffect, useState, useCallback, memo } from "react";
import { GRID_COLS, GRID_ROWS, BLOCK_SIZE, CANVAS_W, CANVAS_H, type Selection, type Region } from "@/types/region";
import { CENTER_ZONE_X, CENTER_ZONE_Y, CENTER_ZONE_WIDTH, CENTER_ZONE_HEIGHT } from "@/solana/constants";
import { useRegions } from "@/context/RegionContext";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";

interface Props {
  selection: Selection | null;
  onSelectionChange: (sel: Selection | null) => void;
  onRegionClick: (region: Region) => void;
  showPricingOverlay?: boolean;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

const PixelCanvas = memo(({ selection, onSelectionChange, onRegionClick, showPricingOverlay }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { regions, occupancy, isOccupied, hasOverlap, getRegionAt, loadedImages } = useRegions();
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

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
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

        // Dim the outer zone
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(0, 0, CANVAS_W, czY); // top
        ctx.fillRect(0, czY, czX, czH); // left
        ctx.fillRect(czX + czW, czY, CANVAS_W - czX - czW, czH); // right
        ctx.fillRect(0, czY + czH, CANVAS_W, CANVAS_H - czY - czH); // bottom

        // Highlight center zone
        ctx.fillStyle = "rgba(255, 200, 55, 0.10)";
        ctx.fillRect(czX, czY, czW, czH);
        ctx.strokeStyle = "rgba(255, 200, 55, 0.6)";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(czX, czY, czW, czH);
        ctx.setLineDash([]);

        // Label
        const label = "Center Zone — 0.12 USDC/block";
        const fontSize = 18 / zoom;
        ctx.font = `bold ${fontSize}px 'Space Grotesk', sans-serif`;
        const tm = ctx.measureText(label);
        const lx = czX + czW / 2 - tm.width / 2;
        const ly = czY - 10 / zoom;
        ctx.fillStyle = "rgba(14, 14, 17, 0.85)";
        ctx.fillRect(lx - 8 / zoom, ly - fontSize - 3 / zoom, tm.width + 16 / zoom, fontSize + 8 / zoom);
        ctx.fillStyle = "rgba(255, 200, 55, 0.95)";
        ctx.fillText(label, lx, ly);

        // Outer zone label
        const outerLabel = "Outer Zone — bonding curve 0.01–0.10 USDC";
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

      // Render occupied blocks from bitmap (visible even if region objects didn't load)
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
      for (const region of regions) {
        const rx = region.startX * BLOCK_SIZE;
        const ry = region.startY * BLOCK_SIZE;
        const rw = region.width * BLOCK_SIZE;
        const rh = region.height * BLOCK_SIZE;

        const img = loadedImages.get(region.id);
        if (img) {
          ctx.drawImage(img, rx, ry, rw, rh);
        } else {
          // Solid fill for claimed regions without an image
          ctx.fillStyle = "rgba(100, 70, 180, 0.25)";
          ctx.fillRect(rx, ry, rw, rh);

          // Diagonal hatching pattern to make them clearly "taken"
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

          // Owner label centered in region
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

        // Highlight boost (permanent on-chain)
        if (region.isHighlighted) {
          const hPulse = 0.5 + 0.5 * Math.sin(now / 400);
          // Inset pulses between 15% and 35% of region size
          const inset = Math.max(rw, rh) * (0.15 + hPulse * 0.20);
          const glowAlpha = 0.2 + hPulse * 0.2;

          // Color shifts between #4284DB and #29EAC4
          const r = Math.round(66 + (41 - 66) * hPulse);
          const g = Math.round(132 + (234 - 132) * hPulse);
          const b = Math.round(219 + (196 - 219) * hPulse);

          // Pulsing inner shadow — four edge gradients
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

          // Border stroke with smaller glow
          ctx.save();
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.4 + hPulse * 0.3})`;
          ctx.shadowBlur = (8 + hPulse * 8) / zoom;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${0.7 + hPulse * 0.3})`;
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.restore();
        }

        // Glow boost (permanent on-chain) — rotating snake border
        if (region.hasGlowBorder) {
          const perimeter = 2 * (rw + rh);
          const snakeLen = perimeter * 0.3;
          const gapLen = perimeter - snakeLen;
          const speed = now * 0.08;
          const dashOffset = -(speed % perimeter);

          // Dim base border so the full outline is faintly visible
          ctx.save();
          ctx.strokeStyle = "rgba(153, 69, 255, 0.2)";
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.restore();

          // Bright snake segment with glow
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

          // Second pass — white-hot core for the snake head area
          ctx.save();
          const headLen = snakeLen * 0.15;
          ctx.strokeStyle = "rgba(200, 170, 255, 0.7)";
          ctx.lineWidth = 1.5 / zoom;
          ctx.setLineDash([headLen, perimeter - headLen]);
          ctx.lineDashOffset = dashOffset;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          ctx.strokeStyle = region.isListed ? "rgba(255, 200, 50, 0.7)" : "rgba(100, 70, 180, 0.6)";
          ctx.lineWidth = 1.5 / zoom;
          ctx.strokeRect(rx, ry, rw, rh);
        }

        // Trending indicator (permanent on-chain)
        if (region.isTrending) {
          ctx.fillStyle = "rgba(255, 140, 0, 0.9)";
          ctx.fillRect(rx, ry, 6, 6);
        }
      }

      // Hover highlight
      if (hoveredBlock && !isDragging && !isOccupied(hoveredBlock.col, hoveredBlock.row)) {
        ctx.fillStyle = "rgba(0, 224, 255, 0.15)";
        ctx.fillRect(hoveredBlock.col * BLOCK_SIZE, hoveredBlock.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = "rgba(0, 224, 255, 0.5)";
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(hoveredBlock.col * BLOCK_SIZE, hoveredBlock.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }

      // Hover on occupied block
      if (hoveredBlock && isOccupied(hoveredBlock.col, hoveredBlock.row)) {
        const region = getRegionAt(hoveredBlock.col, hoveredBlock.row);
        if (region) {
          ctx.strokeStyle = "rgba(0, 224, 255, 0.8)";
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(region.startX * BLOCK_SIZE, region.startY * BLOCK_SIZE, region.width * BLOCK_SIZE, region.height * BLOCK_SIZE);
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

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [regions, occupancy, loadedImages, hoveredBlock, isDragging, dragStart, dragEnd, selection, normalizeSelection, hasOverlap, isOccupied, getRegionAt, zoom, pan, showPricingOverlay]);

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden flex items-center justify-center bg-background p-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className={`max-w-full max-h-full border border-border rounded-sm ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
        style={{ imageRendering: "pixelated" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-card/90 border border-border rounded-md backdrop-blur-sm p-1">
        <button onClick={zoomOut} className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground" title="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-mono text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn} className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground" title="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-border" />
        <button onClick={resetView} className="p-1.5 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground" title="Reset view">
          <Maximize className="w-4 h-4" />
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
