import { useRef, useEffect, useState, useCallback } from "react";

const GRID_COLS = 192;
const GRID_ROWS = 108;
const BLOCK_SIZE = 10;
const CANVAS_W = GRID_COLS * BLOCK_SIZE;
const CANVAS_H = GRID_ROWS * BLOCK_SIZE;

interface PlacedImage {
  col: number;
  row: number;
  width: number;
  height: number;
  image: HTMLImageElement;
}

export interface Selection {
  col: number;
  row: number;
  width: number;
  height: number;
}

interface Props {
  selection: Selection | null;
  onSelectionChange: (sel: Selection | null) => void;
  placedImages: PlacedImage[];
  occupied: boolean[][];
}

const PixelCanvas = ({ selection, onSelectionChange, placedImages, occupied }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ col: number; row: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ col: number; row: number } | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{ col: number; row: number } | null>(null);
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
      const width = Math.abs(end.col - start.col) + 1;
      const height = Math.abs(end.row - start.row) + 1;
      return { col, row, width, height };
    },
    []
  );

  const hasOverlap = useCallback(
    (sel: Selection) => {
      for (let r = sel.row; r < sel.row + sel.height; r++) {
        for (let c = sel.col; c < sel.col + sel.width; c++) {
          if (occupied[r]?.[c]) return true;
        }
      }
      return false;
    },
    [occupied]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      const coords = getBlockCoords(e);
      if (!coords) return;
      if (occupied[coords.row]?.[coords.col]) return;
      setIsDragging(true);
      setDragStart(coords);
      setDragEnd(coords);
      onSelectionChange(null);
    },
    [getBlockCoords, occupied, onSelectionChange]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const coords = getBlockCoords(e);
      if (!coords) return;
      setHoveredBlock(coords);
      if (isDragging && dragStart) {
        setDragEnd(coords);
      }
    },
    [getBlockCoords, isDragging, dragStart]
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
      // Background
      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid lines
      ctx.strokeStyle = "rgba(56, 68, 90, 0.4)";
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

      // Placed images
      for (const img of placedImages) {
        ctx.drawImage(
          img.image,
          img.col * BLOCK_SIZE,
          img.row * BLOCK_SIZE,
          img.width * BLOCK_SIZE,
          img.height * BLOCK_SIZE
        );
      }

      // Occupied blocks overlay
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (occupied[r]?.[c]) {
            ctx.fillStyle = "rgba(120, 80, 200, 0.08)";
            ctx.fillRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          }
        }
      }

      // Hover highlight
      if (hoveredBlock && !isDragging && !occupied[hoveredBlock.row]?.[hoveredBlock.col]) {
        ctx.fillStyle = "rgba(0, 210, 190, 0.15)";
        ctx.fillRect(
          hoveredBlock.col * BLOCK_SIZE,
          hoveredBlock.row * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );
        ctx.strokeStyle = "rgba(0, 210, 190, 0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          hoveredBlock.col * BLOCK_SIZE,
          hoveredBlock.row * BLOCK_SIZE,
          BLOCK_SIZE,
          BLOCK_SIZE
        );
      }

      // Drag selection overlay
      if (isDragging && dragStart && dragEnd) {
        const sel = normalizeSelection(dragStart, dragEnd);
        const overlap = hasOverlap(sel);
        const color = overlap ? "rgba(220, 50, 50, 0.25)" : "rgba(0, 210, 190, 0.2)";
        const border = overlap ? "rgba(220, 50, 50, 0.7)" : "rgba(0, 210, 190, 0.7)";
        ctx.fillStyle = color;
        ctx.fillRect(
          sel.col * BLOCK_SIZE,
          sel.row * BLOCK_SIZE,
          sel.width * BLOCK_SIZE,
          sel.height * BLOCK_SIZE
        );
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.strokeRect(
          sel.col * BLOCK_SIZE,
          sel.row * BLOCK_SIZE,
          sel.width * BLOCK_SIZE,
          sel.height * BLOCK_SIZE
        );
      }

      // Finalized selection
      if (selection && !isDragging) {
        ctx.fillStyle = "rgba(0, 210, 190, 0.15)";
        ctx.fillRect(
          selection.col * BLOCK_SIZE,
          selection.row * BLOCK_SIZE,
          selection.width * BLOCK_SIZE,
          selection.height * BLOCK_SIZE
        );
        ctx.strokeStyle = "rgba(0, 210, 190, 0.9)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(
          selection.col * BLOCK_SIZE,
          selection.row * BLOCK_SIZE,
          selection.width * BLOCK_SIZE,
          selection.height * BLOCK_SIZE
        );
        ctx.setLineDash([]);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [placedImages, occupied, hoveredBlock, isDragging, dragStart, dragEnd, selection, normalizeSelection, hasOverlap]);

  return (
    <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center bg-background p-4">
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
    </div>
  );
};

export default PixelCanvas;
