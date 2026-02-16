import { useState, useCallback } from "react";
import PixelCanvas, { type Selection } from "@/components/PixelCanvas";
import CanvasToolbar from "@/components/CanvasToolbar";
import { toast } from "sonner";

const GRID_COLS = 192;
const GRID_ROWS = 108;

interface PlacedImage {
  col: number;
  row: number;
  width: number;
  height: number;
  image: HTMLImageElement;
}

const Index = () => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [placedImages, setPlacedImages] = useState<PlacedImage[]>([]);
  const [occupied, setOccupied] = useState<boolean[][]>(() =>
    Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false))
  );

  const markOccupied = useCallback(
    (sel: Selection) => {
      setOccupied((prev) => {
        const next = prev.map((row) => [...row]);
        for (let r = sel.row; r < sel.row + sel.height; r++) {
          for (let c = sel.col; c < sel.col + sel.width; c++) {
            next[r][c] = true;
          }
        }
        return next;
      });
    },
    []
  );

  const handleImageUpload = useCallback(
    (file: File) => {
      if (!selection) {
        toast.error("Select an area first");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const placed: PlacedImage = {
            col: selection.col,
            row: selection.row,
            width: selection.width,
            height: selection.height,
            image: img,
          };
          setPlacedImages((prev) => [...prev, placed]);
          markOccupied(selection);
          setSelection(null);
          toast.success(
            `Image placed at (${selection.col}, ${selection.row}) — ${selection.width}×${selection.height} blocks`
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [selection, markOccupied]
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <CanvasToolbar
        selection={selection}
        onClearSelection={() => setSelection(null)}
        onImageUpload={handleImageUpload}
      />
      <PixelCanvas
        selection={selection}
        onSelectionChange={setSelection}
        placedImages={placedImages}
        occupied={occupied}
      />
    </div>
  );
};

export default Index;
