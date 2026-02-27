import { PinataSDK } from "pinata";
import { config } from "@/config/env";

let pinata: PinataSDK | null = null;

function getPinata(): PinataSDK {
  if (!pinata) {
    if (!config.pinataJwt) {
      throw new Error("VITE_PINATA_JWT is not configured");
    }
    pinata = new PinataSDK({
      pinataJwt: config.pinataJwt,
      pinataGateway: config.pinataGateway || undefined,
    });
  }
  return pinata;
}

/**
 * Upload a File to IPFS via Pinata.
 * Returns the IPFS URI for on-chain storage and gateway URL for display.
 */
export async function uploadToIpfs(file: File): Promise<{
  ipfsUri: string;
  gatewayUrl: string;
}> {
  const sdk = getPinata();
  console.log("[IPFS] Starting upload for file:", file.name, "size:", file.size, "type:", file.type);

  const upload = await sdk.upload.public.file(file);
  console.log("[IPFS] Upload response:", JSON.stringify(upload));

  const cid = upload.cid;
  const gatewayUrl = config.pinataGateway
    ? `https://${config.pinataGateway}/ipfs/${cid}`
    : `https://ipfs.io/ipfs/${cid}`;

  console.log("[IPFS] CID:", cid, "Gateway URL:", gatewayUrl);

  return {
    ipfsUri: `ipfs://${cid}`,
    gatewayUrl,
  };
}
