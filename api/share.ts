/**
 * Edge function that returns an HTML bounce page for /r/:assetId share links.
 *
 * Twitterbot and other social-card crawlers read the OG/Twitter meta tags
 * embedded here to render a rich preview (including the per-region share PNG
 * passed as ?img=<pinata-gateway-url>). Human visitors get an immediate JS
 * + meta-refresh redirect to /?region=:assetId, which the SPA handles.
 *
 * The SPA cannot serve OG tags on its own because Vite produces a static
 * index.html with no per-route metadata — this endpoint fills that gap.
 */

import { buildShareMeta } from "../src/lib/shareMeta";

// Vercel's edge runtime exposes env vars on `process.env` but doesn't ship
// @types/node by default; declare just what we need to keep this file dep-free.
declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: "edge" };

const STATIC_ALLOWED_IMG_HOSTS = [
  "gateway.pinata.cloud",
  "ipfs.io",
  "cloudflare-ipfs.com",
  "dweb.link",
  "nftstorage.link",
];
const ALLOWED_IMG_HOST_SUFFIXES = [".mypinata.cloud"];

/**
 * Build the host allowlist at request time, including the configured Pinata
 * gateway from env (exposed to Vercel functions via VITE_PINATA_GATEWAY).
 * That way a custom gateway domain works out of the box without editing code.
 */
function getAllowedHosts(): Set<string> {
  const hosts = new Set<string>(STATIC_ALLOWED_IMG_HOSTS);
  const pinataGateway = (process.env.VITE_PINATA_GATEWAY ?? "").trim().toLowerCase();
  if (pinataGateway) hosts.add(pinataGateway);
  return hosts;
}

const ASSET_ID_RE = /^[A-Za-z0-9]{32,48}$/;

function sanitizeAssetId(raw: string | null): string {
  if (!raw) return "";
  return ASSET_ID_RE.test(raw) ? raw : "";
}

function sanitizeImgUrl(raw: string | null): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  if (getAllowedHosts().has(host)) return u.toString();
  if (ALLOWED_IMG_HOST_SUFFIXES.some((s) => host.endsWith(s))) return u.toString();
  return null;
}

function clampInt(raw: string | null, min: number, max: number): number | null {
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export default function handler(request: Request): Response {
  const url = new URL(request.url);
  const assetId = sanitizeAssetId(url.searchParams.get("assetId"));
  const img = sanitizeImgUrl(url.searchParams.get("img"));
  const x = clampInt(url.searchParams.get("x"), 0, 191);
  const y = clampInt(url.searchParams.get("y"), 0, 107);
  const w = clampInt(url.searchParams.get("w"), 1, 192);
  const h = clampInt(url.searchParams.get("h"), 1, 108);

  const origin = `${url.protocol}//${url.host}`;
  const canonicalPath = assetId ? `/?region=${assetId}` : "/";
  const canonicalUrl = `${origin}${canonicalPath}`;

  const { title, description } = buildShareMeta({ x, y, w, h });

  const ogImage = img || `${origin}/logo.png`;
  const cardType = img ? "summary_large_image" : "summary";

  const eTitle = escapeHtml(title);
  const eDesc = escapeHtml(description);
  const eImg = escapeHtml(ogImage);
  const eUrl = escapeHtml(canonicalUrl);
  const ePath = escapeHtml(canonicalPath);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, follow" />
<title>${eTitle}</title>
<meta name="description" content="${eDesc}" />
<link rel="canonical" href="${eUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="solanabillboard.space" />
<meta property="og:title" content="${eTitle}" />
<meta property="og:description" content="${eDesc}" />
<meta property="og:image" content="${eImg}" />
<meta property="og:url" content="${eUrl}" />
<meta name="twitter:card" content="${cardType}" />
<meta name="twitter:title" content="${eTitle}" />
<meta name="twitter:description" content="${eDesc}" />
<meta name="twitter:image" content="${eImg}" />
<meta http-equiv="refresh" content="0; url=${ePath}" />
<script>window.location.replace(${JSON.stringify(canonicalPath)});</script>
</head>
<body>
<p>Redirecting to <a href="${ePath}">${eUrl}</a>&hellip;</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
