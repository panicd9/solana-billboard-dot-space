import { GRID_COLS, GRID_ROWS } from "@/types/region";

interface Props {
  startX: number;
  startY: number;
  width: number;
  height: number;
  className?: string;
  /** Optional list of other regions to render as faint context dots */
  context?: Array<{ startX: number; startY: number; width: number; height: number }>;
}

const VIEW_W = 96;
const VIEW_H = 54;

const RegionMiniMap = ({ startX, startY, width, height, className, context }: Props) => {
  const sx = (startX / GRID_COLS) * VIEW_W;
  const sy = (startY / GRID_ROWS) * VIEW_H;
  const sw = Math.max(1, (width / GRID_COLS) * VIEW_W);
  const sh = Math.max(1, (height / GRID_ROWS) * VIEW_H);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={className}
      role="img"
      aria-label={`Position on canvas: column ${startX}, row ${startY}, ${width} by ${height}`}
      preserveAspectRatio="none"
    >
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="hsl(var(--secondary))" />
      {context?.map((c, i) => (
        <rect
          key={i}
          x={(c.startX / GRID_COLS) * VIEW_W}
          y={(c.startY / GRID_ROWS) * VIEW_H}
          width={Math.max(0.5, (c.width / GRID_COLS) * VIEW_W)}
          height={Math.max(0.5, (c.height / GRID_ROWS) * VIEW_H)}
          fill="hsl(var(--muted-foreground))"
          opacity={0.18}
        />
      ))}
      <rect
        x={sx}
        y={sy}
        width={sw}
        height={sh}
        fill="hsl(var(--primary))"
        opacity={0.95}
      />
      <rect
        x={sx - 1.5}
        y={sy - 1.5}
        width={sw + 3}
        height={sh + 3}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={0.6}
        opacity={0.5}
      />
    </svg>
  );
};

export default RegionMiniMap;
