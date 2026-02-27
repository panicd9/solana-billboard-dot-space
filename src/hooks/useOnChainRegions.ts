import { useQuery } from "@tanstack/react-query";
import type { Address } from "@solana/kit";
import type { Region } from "@/types/region";
import {
  fetchAllCoreAssets,
  parseRegionAttributes,
  ipfsToGateway,
  fetchAllListingsAndBoosts,
} from "@/solana/accounts";
import {
  BOOST_HIGHLIGHTED,
  BOOST_GLOWING,
  BOOST_TRENDING,
  COLLECTION_ADDRESS,
} from "@/solana/constants";

/**
 * Decode a Metaplex Core V1 asset's raw data to extract owner and name.
 * Layout:
 *   byte 0: key (1)
 *   bytes 1-32: owner (32)
 *   byte 33: updateAuthority type
 *   bytes 34-65: updateAuthority address
 *   bytes 66-69: name length (u32 LE)
 *   variable: name bytes
 *   then: uri length (u32 LE) + uri bytes
 *   then: plugins...
 */
function decodeOwnerFromCoreAsset(data: Uint8Array): string {
  // Owner is at bytes 1-32
  const ownerBytes = data.slice(1, 33);
  // Convert to base58 — use a simple approach
  return bytesToBase58(ownerBytes);
}

// Minimal base58 encoding for 32-byte pubkeys
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function bytesToBase58(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let result = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    result += "1";
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }
  return result;
}

/**
 * Try to extract the Attributes plugin key-value pairs from raw Core asset data.
 * This is a best-effort parser. Core assets store plugins in a registry at the
 * end of the account data. The Attributes plugin (type=12) contains a vector
 * of (String, String) key-value pairs.
 */
function tryParseAttributesPlugin(
  data: Uint8Array
): Array<{ key: string; value: string }> | null {
  // Scan for the borsh-encoded attribute list in Core V1 plugin data.
  // Layout: u32 count, then for each: (u32 + key_bytes, u32 + value_bytes)
  // We look for any reasonable count and validate that known keys ("x", "y", etc.) are present.

  try {
    const textDecoder = new TextDecoder();

    for (let offset = 66; offset < data.length - 12; offset++) {
      const count =
        data[offset] |
        (data[offset + 1] << 8) |
        (data[offset + 2] << 16) |
        (data[offset + 3] << 24);

      // Accept any reasonable attribute count (our program writes 4-10)
      if (count < 4 || count > 20) continue;

      const attrs: Array<{ key: string; value: string }> = [];
      let pos = offset + 4;
      let valid = true;

      for (let i = 0; i < count && pos < data.length - 4; i++) {
        const keyLen =
          data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
        pos += 4;
        if (keyLen === 0 || keyLen > 200 || pos + keyLen > data.length) {
          valid = false;
          break;
        }
        const key = textDecoder.decode(data.slice(pos, pos + keyLen));
        pos += keyLen;

        if (pos + 4 > data.length) {
          valid = false;
          break;
        }
        const valLen =
          data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
        pos += 4;
        if (valLen > 500 || pos + valLen > data.length) {
          valid = false;
          break;
        }
        const value = textDecoder.decode(data.slice(pos, pos + valLen));
        pos += valLen;

        attrs.push({ key, value });
      }

      if (!valid) continue;

      // Validate by checking for required region keys instead of exact count
      const keys = new Set(attrs.map((a) => a.key));
      if (keys.has("x") && keys.has("y") && keys.has("width") && keys.has("height")) {
        return attrs;
      }
    }
  } catch (err) {
    console.warn("[useOnChainRegions] Attribute parsing error:", err);
  }
  return null;
}

export function useOnChainRegions() {
  return useQuery({
    queryKey: ["regions", COLLECTION_ADDRESS],
    queryFn: async (): Promise<Region[]> => {
      if (!COLLECTION_ADDRESS) {
        console.warn("[useOnChainRegions] No COLLECTION_ADDRESS configured");
        return [];
      }

      const accounts = await fetchAllCoreAssets(COLLECTION_ADDRESS);
      console.log(`[useOnChainRegions] Fetched ${accounts.length} Core assets`);

      // Parse all account data synchronously first
      const parsed: Array<{
        address: string;
        owner: string;
        attrs: ReturnType<typeof parseRegionAttributes>;
      }> = [];

      for (const account of accounts) {
        const address = account.pubkey;
        const rawData = account.account.data;

        let data: Uint8Array;
        if (typeof rawData === "string") {
          data = Uint8Array.from(atob(rawData), (c) => c.charCodeAt(0));
        } else if (Array.isArray(rawData)) {
          data = Uint8Array.from(atob(rawData[0] as string), (c) => c.charCodeAt(0));
        } else {
          console.warn(`[useOnChainRegions] Skipping ${address}: unknown data format`);
          continue;
        }

        const owner = decodeOwnerFromCoreAsset(data);
        const attrList = tryParseAttributesPlugin(data);

        if (!attrList) {
          console.warn(`[useOnChainRegions] Skipping ${address}: could not parse attributes (data length: ${data.length})`);
          continue;
        }

        parsed.push({
          address: address as string,
          owner,
          attrs: parseRegionAttributes(attrList),
        });
      }

      if (parsed.length === 0) return [];

      // Batch-fetch all listings + boosts in 2 RPC calls (getMultipleAccounts)
      const assetAddresses = parsed.map((p) => p.address as Address);
      const { listings, boosts } = await fetchAllListingsAndBoosts(assetAddresses);

      return parsed.map((p, i) => {
        const listingAccount = listings[i];
        const boostsAccount = boosts[i];

        const listing =
          listingAccount?.exists
            ? {
                seller: listingAccount.data.seller as string,
                startPrice: listingAccount.data.startPrice as bigint,
                endPrice: listingAccount.data.endPrice as bigint,
                startTime: listingAccount.data.startTime as bigint,
                endTime: listingAccount.data.endTime as bigint,
              }
            : null;

        const boostFlags =
          boostsAccount?.exists ? (boostsAccount.data.flags as number) : 0;

        return {
          id: p.address,
          startX: p.attrs.x,
          startY: p.attrs.y,
          width: p.attrs.width,
          height: p.attrs.height,
          owner: p.owner,
          imageUrl: ipfsToGateway(p.attrs.imageUri),
          imageUri: p.attrs.imageUri,
          linkUrl: p.attrs.link,
          purchasePrice: 0,
          isListed: listing !== null,
          listing,
          createdAt: Date.now(),
          boostFlags,
          isHighlighted: (boostFlags & BOOST_HIGHLIGHTED) !== 0,
          hasGlowBorder: (boostFlags & BOOST_GLOWING) !== 0,
          isTrending: (boostFlags & BOOST_TRENDING) !== 0,
        };
      });
    },
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}
