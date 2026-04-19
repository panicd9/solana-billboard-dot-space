import { config } from "@/config/env";

const SAFE_SCHEMES = new Set(["http:", "https:"]);

export function sanitizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!SAFE_SCHEMES.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function sanitizeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("ipfs://")) {
    const cid = trimmed.slice(7);
    if (!/^[A-Za-z0-9./_-]+$/.test(cid)) return null;
    const gateway = config.pinataGateway || "ipfs.io";
    return `https://${gateway}/ipfs/${cid}`;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (config.pinataGateway && url.hostname === config.pinataGateway) {
      return url.toString();
    }
    if (url.hostname === "ipfs.io" || url.hostname.endsWith(".ipfs.io")) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}
