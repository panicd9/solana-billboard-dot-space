import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { buildShareMeta } from "@/lib/shareMeta";
import { generateShareImage } from "@/lib/shareImage";
import type { Region } from "@/types/region";

const EXAMPLE_REGION: Region = {
  id: "ExampleAssetId1234567890abcdefgh",
  startX: 66,
  startY: 37,
  width: 8,
  height: 6,
  owner: "So11111111111111111111111111111111111111112",
  imageUrl: "",
  imageUri: "",
  linkUrl: "",
  purchasePrice: 0,
  isListed: false,
  listing: null,
  createdAt: 0,
  highlightedAt: 0n,
  glowingAt: 0n,
  trendingAt: 0n,
};

function clampIntParam(
  raw: string | null,
  min: number,
  max: number
): number | null {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

const PreviewCard = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const assetId = searchParams.get("assetId") || EXAMPLE_REGION.id;
  const img = searchParams.get("img") || "";
  const x = clampIntParam(searchParams.get("x"), 0, 191) ?? EXAMPLE_REGION.startX;
  const y = clampIntParam(searchParams.get("y"), 0, 107) ?? EXAMPLE_REGION.startY;
  const w = clampIntParam(searchParams.get("w"), 1, 192) ?? EXAMPLE_REGION.width;
  const h = clampIntParam(searchParams.get("h"), 1, 108) ?? EXAMPLE_REGION.height;

  const meta = useMemo(() => buildShareMeta({ x, y, w, h }), [x, y, w, h]);

  const [mockImageUrl, setMockImageUrl] = useState<string | null>(null);
  const mockUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (img) return;
    let cancelled = false;
    const region: Region = {
      ...EXAMPLE_REGION,
      id: assetId,
      startX: x,
      startY: y,
      width: w,
      height: h,
    };
    generateShareImage(region, [], new Map(), new Map(), () => false)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        if (mockUrlRef.current) URL.revokeObjectURL(mockUrlRef.current);
        mockUrlRef.current = url;
        setMockImageUrl(url);
      })
      .catch(() => {
        // Ignore — fall back to logo below
      });
    return () => {
      cancelled = true;
    };
  }, [img, assetId, x, y, w, h]);

  useEffect(
    () => () => {
      if (mockUrlRef.current) URL.revokeObjectURL(mockUrlRef.current);
    },
    []
  );

  const [draft, setDraft] = useState({
    assetId,
    img,
    x: x?.toString() ?? "",
    y: y?.toString() ?? "",
    w: w?.toString() ?? "",
    h: h?.toString() ?? "",
  });

  const applyDraft = () => {
    const next = new URLSearchParams();
    if (draft.assetId) next.set("assetId", draft.assetId);
    if (draft.img) next.set("img", draft.img);
    if (draft.x) next.set("x", draft.x);
    if (draft.y) next.set("y", draft.y);
    if (draft.w) next.set("w", draft.w);
    if (draft.h) next.set("h", draft.h);
    setSearchParams(next);
  };

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://solanabillboard.space";
  const shareUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (img) params.set("img", img);
    if (x !== null) params.set("x", String(x));
    if (y !== null) params.set("y", String(y));
    if (w !== null) params.set("w", String(w));
    if (h !== null) params.set("h", String(h));
    const qs = params.toString();
    return `${origin}/r/${assetId}${qs ? `?${qs}` : ""}`;
  }, [origin, assetId, img, x, y, w, h]);

  const cardImage = img || mockImageUrl || `${origin}/logo.png`;
  const cardDomain = "solanabillboard.space";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Share Card Preview</h1>
          <p className="text-sm text-muted-foreground">
            Local mock of the Twitter / Open Graph card rendered by{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/api/share</code>.
            When no <code className="text-xs bg-muted px-1.5 py-0.5 rounded">img</code>{" "}
            is provided, a synthetic share image is generated live using the same{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">generateShareImage()</code>{" "}
            the real Share button uses.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Inputs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <label className="col-span-2 md:col-span-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                assetId
              </span>
              <input
                value={draft.assetId}
                onChange={(e) => setDraft({ ...draft, assetId: e.target.value })}
                className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
              />
            </label>
            <label className="col-span-2 md:col-span-3 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                img (Pinata URL)
              </span>
              <input
                value={draft.img}
                onChange={(e) => setDraft({ ...draft, img: e.target.value })}
                placeholder="https://gateway.pinata.cloud/ipfs/..."
                className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
              />
            </label>
            {(["x", "y", "w", "h"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {k}
                </span>
                <input
                  type="number"
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  className="bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                />
              </label>
            ))}
            <div className="col-span-2 flex items-end">
              <button
                type="button"
                onClick={applyDraft}
                className="w-full bg-primary text-primary-foreground rounded px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tweet URL
          </h2>
          <div className="font-mono text-xs break-all bg-muted/40 border border-border rounded p-3">
            {shareUrl}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            summary_large_image (X / Twitter)
          </h2>
          <div className="max-w-[520px] rounded-2xl overflow-hidden border border-border bg-card">
            <div className="aspect-[1.91/1] bg-black relative">
              {cardImage ? (
                <img
                  src={cardImage}
                  alt="Card preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                {cardDomain}
              </div>
            </div>
            <div className="p-3 space-y-1">
              <div className="text-[11px] text-muted-foreground">{cardDomain}</div>
              <div className="font-semibold text-sm leading-snug">{meta.title}</div>
              <div className="text-xs text-muted-foreground leading-snug line-clamp-2">
                {meta.description}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            summary (fallback, no img)
          </h2>
          <div className="max-w-[520px] flex rounded-2xl overflow-hidden border border-border bg-card">
            <div className="w-32 h-32 bg-black shrink-0 flex items-center justify-center">
              <img
                src={`${origin}/logo.png`}
                alt="logo"
                className="max-w-full max-h-full"
              />
            </div>
            <div className="p-3 space-y-1 flex-1 min-w-0">
              <div className="text-[11px] text-muted-foreground">{cardDomain}</div>
              <div className="font-semibold text-sm leading-snug">{meta.title}</div>
              <div className="text-xs text-muted-foreground leading-snug line-clamp-3">
                {meta.description}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">Verifying the real thing:</strong>{" "}
            on a Vercel preview deploy, paste the tweet URL into{" "}
            <a
              href="https://opengraph.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              opengraph.xyz
            </a>
            {" "}or{" "}
            <a
              href="https://cards-dev.twitter.com/validator"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Twitter's card validator
            </a>
            . Locally, only{" "}
            <code className="bg-muted px-1 py-0.5 rounded">vercel dev</code> runs
            the edge function — plain{" "}
            <code className="bg-muted px-1 py-0.5 rounded">vite dev</code> serves the
            SPA shell.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PreviewCard;
