import { useEffect, useRef } from "react";
import {
  GRID_WIDTH,
  GRID_HEIGHT,
  CENTER_ZONE_WIDTH,
  CENTER_ZONE_HEIGHT,
  CENTER_ZONE_X,
  CENTER_ZONE_Y,
} from "@/solana/constants";

interface Ping {
  x: number;
  y: number;
  w: number;
  h: number;
  born: number;
  life: number;
}

const CELL = 10;
const PING_DURATION = 1400;
const PING_INTERVAL_MIN = 180;
const PING_INTERVAL_MAX = 520;

const ComingSoonCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = GRID_WIDTH * CELL * dpr;
    canvas.height = GRID_HEIGHT * CELL * dpr;
    ctx.scale(dpr, dpr);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const pings: Ping[] = [];
    let nextPingAt = 0;
    let raf = 0;

    const spawnPing = (now: number) => {
      const maxSize = 3;
      const w = 1 + Math.floor(Math.random() * maxSize);
      const h = 1 + Math.floor(Math.random() * maxSize);
      const x = Math.floor(Math.random() * (GRID_WIDTH - w));
      const y = Math.floor(Math.random() * (GRID_HEIGHT - h));
      pings.push({ x, y, w, h, born: now, life: PING_DURATION });
      nextPingAt =
        now +
        PING_INTERVAL_MIN +
        Math.random() * (PING_INTERVAL_MAX - PING_INTERVAL_MIN);
    };

    const draw = (now: number) => {
      const width = GRID_WIDTH * CELL;
      const height = GRID_HEIGHT * CELL;

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = "hsl(240 10% 6%)";
      ctx.fillRect(0, 0, width, height);

      // Center zone tint
      ctx.fillStyle = "hsl(40 90% 61% / 0.035)";
      ctx.fillRect(
        CENTER_ZONE_X * CELL,
        CENTER_ZONE_Y * CELL,
        CENTER_ZONE_WIDTH * CELL,
        CENTER_ZONE_HEIGHT * CELL
      );

      // Grid lines
      ctx.strokeStyle = "hsl(240 5% 13%)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= GRID_WIDTH; x++) {
        const px = x * CELL + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
      }
      for (let y = 0; y <= GRID_HEIGHT; y++) {
        const py = y * CELL + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
      }
      ctx.stroke();

      // Center zone border
      ctx.strokeStyle = "hsl(40 90% 61% / 0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        CENTER_ZONE_X * CELL + 0.5,
        CENTER_ZONE_Y * CELL + 0.5,
        CENTER_ZONE_WIDTH * CELL - 1,
        CENTER_ZONE_HEIGHT * CELL - 1
      );

      // Pings
      if (!reducedMotion) {
        for (let i = pings.length - 1; i >= 0; i--) {
          const p = pings[i];
          const t = (now - p.born) / p.life;
          if (t >= 1) {
            pings.splice(i, 1);
            continue;
          }
          const alpha = (1 - t) * 0.75;
          ctx.fillStyle = `hsl(187 100% 45% / ${alpha})`;
          ctx.fillRect(p.x * CELL, p.y * CELL, p.w * CELL, p.h * CELL);
          // Outer glow ring
          const ring = 1 - t;
          ctx.strokeStyle = `hsl(187 100% 55% / ${alpha * 0.6})`;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            p.x * CELL - 2 * ring,
            p.y * CELL - 2 * ring,
            p.w * CELL + 4 * ring,
            p.h * CELL + 4 * ring
          );
        }

        if (now >= nextPingAt && pings.length < 24) {
          spawnPing(now);
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-card/40 shadow-[0_0_60px_-20px_hsl(187_100%_45%/0.35)]">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full h-auto"
        style={{ aspectRatio: `${GRID_WIDTH} / ${GRID_HEIGHT}` }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, hsl(240 10% 5% / 0.55) 100%)",
        }}
      />
    </div>
  );
};

export default ComingSoonCanvas;
