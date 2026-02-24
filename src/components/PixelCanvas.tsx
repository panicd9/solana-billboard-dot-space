import { useRef, useEffect, useState, useCallback, memo } from "react";
import { GRID_COLS, GRID_ROWS, BLOCK_SIZE, CANVAS_W, CANVAS_H, Selection } from "@/types/region";
import { useRegions } from "@/context/RegionContext";

interface Props {
  selection: Selection | null;
  onSelectionChange: (sel: Selection | null) => void;
  onRegionClick: (regionId: string) => void;
}

const PixelCanvas = memo(({ selection, onSelectionChange, onRegionClick }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { regions, occupancy, isOccupied, hasOverlap, getRegionAt, loadedImages } = useRegions();
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ col: number; row: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ col: number; row: number } | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{ col: number; row: number } | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{ x: number; y: number; text: string } | null>(null);
  const animRef = useRef<number>(0);

  const getBlockCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / BLOCK_SIZE);
    const row = Math.floor(y / BLOCK_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }, []);

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
      if (e.button !== 0) return;
      const coords = getBlockCoords(e);
      if (!coords) return;

      // Check if clicking on a region
      const region = getRegionAt(coords.col, coords.row);
      if (region) {
        onRegionClick(region.id);
        return;
      }

      setIsDragging(true);
      setDragStart(coords);
      setDragEnd(coords);
      onSelectionChange(null);
    },
    [getBlockCoords, getRegionAt, onRegionClick, onSelectionChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getBlockCoords(e);
      if (!coords) return;
      setHoveredBlock(coords);

      // Tooltip for occupied regions
      const region = getRegionAt(coords.col, coords.row);
      if (region && !isDragging) {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        setTooltipInfo({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          text: `${region.owner.slice(0, 4)}...${region.owner.slice(-4)} | ${region.width}×${region.height}`,
        });
      } else {
        setTooltipInfo(null);
      }

      if (isDragging && dragStart) {
        setDragEnd(coords);
      }
    },
    [getBlockCoords, isDragging, dragStart, getRegionAt]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging && dragStart && dragEnd) {
      const sel = normalizeSelection(dragStart, dragEnd);
      if (!hasOverlap(sel)) {
        onSelectionChange(sel);
      }
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  }, [isDragging, dragStart, dragEnd, normalizeSelection, hasOverlap, onSelectionChange]);

  const handleMouseLeave = useCallback(() => {
    setHoveredBlock(null);
    setTooltipInfo(null);
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  }, [isDragging]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.fillStyle = "#0a0e17";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid lines
      ctx.strokeStyle = "rgba(40, 50, 70, 0.5)";
      ctx.lineWidth = 0.5;
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

      // Render regions with images
      for (const region of regions) {
        const img = loadedImages.get(region.id);
        if (img) {
          ctx.drawImage(
            img,
            region.startX * BLOCK_SIZE,
            region.startY * BLOCK_SIZE,
            region.width * BLOCK_SIZE,
            region.height * BLOCK_SIZE
          );
        }
        // Occupied tint for regions without image
        if (!img) {
          ctx.fillStyle = "rgba(100, 70, 180, 0.15)";
          ctx.fillRect(
            region.startX * BLOCK_SIZE,
            region.startY * BLOCK_SIZE,
            region.width * BLOCK_SIZE,
            region.height * BLOCK_SIZE
          );
        }
        // Region border
        ctx.strokeStyle = region.isListed ? "rgba(255, 200, 50, 0.6)" : "rgba(100, 70, 180, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          region.startX * BLOCK_SIZE,
          region.startY * BLOCK_SIZE,
          region.width * BLOCK_SIZE,
          region.height * BLOCK_SIZE
        );
      }

      // Hover highlight
      if (hoveredBlock && !isDragging && !isOccupied(hoveredBlock.col, hoveredBlock.row)) {
        ctx.fillStyle = "rgba(0, 210, 190, 0.18)";
        ctx.fillRect(hoveredBlock.col * BLOCK_SIZE, hoveredBlock.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = "rgba(0, 210, 190, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hoveredBlock.col * BLOCK_SIZE, hoveredBlock.row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }

      // Hover on occupied block - glow
      if (hoveredBlock && isOccupied(hoveredBlock.col, hoveredBlock.row)) {
        const region = getRegionAt(hoveredBlock.col, hoveredBlock.row);
        if (region) {
          ctx.strokeStyle = "rgba(0, 210, 190, 0.8)";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            region.startX * BLOCK_SIZE,
            region.startY * BLOCK_SIZE,
            region.width * BLOCK_SIZE,
            region.height * BLOCK_SIZE
          );
        }
      }

      // Drag selection
      if (isDragging && dragStart && dragEnd) {
        const sel = normalizeSelection(dragStart, dragEnd);
        const overlap = hasOverlap(sel);
        ctx.fillStyle = overlap ? "rgba(220, 50, 50, 0.25)" : "rgba(0, 210, 190, 0.2)";
        ctx.fillRect(sel.col * BLOCK_SIZE, sel.row * BLOCK_SIZE, sel.width * BLOCK_SIZE, sel.height * BLOCK_SIZE);
        ctx.strokeStyle = overlap ? "rgba(220, 50, 50, 0.8)" : "rgba(0, 210, 190, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sel.col * BLOCK_SIZE, sel.row * BLOCK_SIZE, sel.width * BLOCK_SIZE, sel.height * BLOCK_SIZE);

        // Dimension label
        const text = `${sel.width}×${sel.height} (${sel.width * sel.height})`;
        ctx.font = "bold 11px 'Space Grotesk', sans-serif";
        const metrics = ctx.measureText(text);
        const lx = sel.col * BLOCK_SIZE + (sel.width * BLOCK_SIZE) / 2 - metrics.width / 2;
        const ly = sel.row * BLOCK_SIZE - 6;
        ctx.fillStyle = "rgba(10, 14, 23, 0.85)";
        ctx.fillRect(lx - 4, ly - 11, metrics.width + 8, 16);
        ctx.fillStyle = overlap ? "#dc3232" : "#00d2be";
        ctx.fillText(text, lx, ly);
      }

      // Finalized selection
      if (selection && !isDragging) {
        ctx.fillStyle = "rgba(0, 210, 190, 0.12)";
        ctx.fillRect(selection.col * BLOCK_SIZE, selection.row * BLOCK_SIZE, selection.width * BLOCK_SIZE, selection.height * BLOCK_SIZE);
        ctx.strokeStyle = "rgba(0, 210, 190, 0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(selection.col * BLOCK_SIZE, selection.row * BLOCK_SIZE, selection.width * BLOCK_SIZE, selection.height * BLOCK_SIZE);
        ctx.setLineDash([]);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [regions, loadedImages, hoveredBlock, isDragging, dragStart, dragEnd, selection, normalizeSelection, hasOverlap, isOccupied, getRegionAt]);

  return (
    <div className="relative flex-1 overflow-auto flex items-center justify-center bg-background p-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="max-w-full max-h-full border border-border rounded-sm cursor-crosshair"
        style={{ imageRendering: "pixelated" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
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
