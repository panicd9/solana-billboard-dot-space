import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWalletSession } from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import type { TransactionSigner } from "@solana/kit";
import * as tx from "@/solana/transactions";
import { uploadToIpfs } from "@/solana/ipfs";
import { toast } from "sonner";
import type { Region } from "@/types/region";
import {
  COLLECTION_ADDRESS,
  BOOST_HIGHLIGHTED,
  BOOST_GLOWING,
  BOOST_TRENDING,
} from "@/solana/constants";
import { BOOST_DURATION_SECONDS, isBoostActive } from "@/types/region";
import { ipfsToGateway } from "@/solana/accounts";

function useWalletSigner(): TransactionSigner | null {
  const session = useWalletSession();
  if (!session) return null;
  const { signer } = createWalletTransactionSigner(session);
  return signer;
}

/** Patch a single region in the regions query cache. */
function patchRegion(
  queryClient: ReturnType<typeof useQueryClient>,
  assetAddress: string,
  updater: (region: Region) => Region
) {
  queryClient.setQueryData<Region[]>(
    ["regions", COLLECTION_ADDRESS],
    (old) => old?.map((r) => (r.id === assetAddress ? updater(r) : r))
  );
}

export function useMintRegion() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      x: number;
      y: number;
      width: number;
      height: number;
      imageFile: File | null;
      link: string;
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      let imageUri = "";
      if (params.imageFile) {
        toast.info("Uploading image to IPFS...");
        const upload = await uploadToIpfs(params.imageFile);
        imageUri = upload.ipfsUri;
      }

      toast.info("Confirm transaction in your wallet...");
      const result = await tx.mintRegion(signer, {
        x: params.x,
        y: params.y,
        width: params.width,
        height: params.height,
        imageUri,
        link: params.link,
      });

      return { ...result, imageUri, owner: signer.address as string };
    },
    onSuccess: (data, variables) => {
      toast.success("Region minted successfully!");

      // Instantly add the new region to cache
      const newRegion: Region = {
        id: data.assetAddress as string,
        startX: variables.x,
        startY: variables.y,
        width: variables.width,
        height: variables.height,
        owner: data.owner,
        imageUrl: ipfsToGateway(data.imageUri),
        imageUri: data.imageUri,
        linkUrl: variables.link,
        purchasePrice: 0,
        isListed: false,
        listing: null,
        createdAt: Date.now(),
        highlightedAt: 0n,
        glowingAt: 0n,
        trendingAt: 0n,
      };
      queryClient.setQueryData<Region[]>(
        ["regions", COLLECTION_ADDRESS],
        (old) => (old ? [...old, newRegion] : [newRegion])
      );

      // Update canvasState occupancy bitmap
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData<any>(["canvasState"], (old: any) => {
        if (!old) return old;
        const next = new Set<string>(old.occupiedBlocks);
        for (let y = variables.y; y < variables.y + variables.height; y++) {
          for (let x = variables.x; x < variables.x + variables.width; x++) {
            next.add(`${x}:${y}`);
          }
        }
        return { ...old, occupiedBlocks: next };
      });

      // Background refetch for eventual consistency
      queryClient.invalidateQueries({ queryKey: ["canvasState"] });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Mint failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}

export function useUpdateRegionImage() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { assetAddress: string; imageFile: File }) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Uploading image to IPFS...");
      const upload = await uploadToIpfs(params.imageFile);

      toast.info("Confirm transaction in your wallet...");
      const signature = await tx.updateRegionImage(signer, params.assetAddress, upload.ipfsUri);
      return { signature, ipfsUri: upload.ipfsUri };
    },
    onSuccess: (data, variables) => {
      toast.success("Image updated!");
      patchRegion(queryClient, variables.assetAddress, (r) => ({
        ...r,
        imageUri: data.ipfsUri,
        imageUrl: ipfsToGateway(data.ipfsUri),
      }));
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Update failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}

export function useUpdateRegionLink() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { assetAddress: string; link: string }) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Confirm transaction in your wallet...");
      return tx.updateRegionLink(signer, params.assetAddress, params.link);
    },
    onSuccess: (_data, variables) => {
      toast.success("Link updated!");
      patchRegion(queryClient, variables.assetAddress, (r) => ({
        ...r,
        linkUrl: variables.link,
      }));
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Update failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}

export function useCreateListing() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      assetAddress: string;
      startPrice: bigint;
      endPrice: bigint;
      durationSeconds: bigint;
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Confirm transaction in your wallet...");
      return tx.createListing(
        signer,
        params.assetAddress,
        params.startPrice,
        params.endPrice,
        params.durationSeconds
      );
    },
    onSuccess: (_data, variables) => {
      toast.success("Region listed!");
      const now = BigInt(Math.floor(Date.now() / 1000));
      patchRegion(queryClient, variables.assetAddress, (r) => ({
        ...r,
        isListed: true,
        listing: {
          seller: (signer?.address ?? "") as string,
          startPrice: variables.startPrice,
          endPrice: variables.endPrice,
          startTime: now,
          endTime: now + variables.durationSeconds,
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Listing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}

export function useCancelListing() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetAddress: string) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Confirm transaction in your wallet...");
      return tx.cancelListing(signer, assetAddress);
    },
    onSuccess: (_data, assetAddress) => {
      toast.success("Listing cancelled!");
      patchRegion(queryClient, assetAddress, (r) => ({
        ...r,
        isListed: false,
        listing: null,
      }));
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Cancel failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}

export function useExecutePurchase() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      sellerAddress: string;
      assetAddress: string;
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Confirm transaction in your wallet...");
      const signature = await tx.executePurchase(
        signer,
        params.sellerAddress,
        params.assetAddress
      );
      return { signature, buyerAddress: signer.address as string };
    },
    onSuccess: (data, variables) => {
      toast.success("Region purchased!");
      patchRegion(queryClient, variables.assetAddress, (r) => ({
        ...r,
        owner: data.buyerAddress,
        isListed: false,
        listing: null,
      }));
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Purchase failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}

export function useBuyBoost() {
  const signer = useWalletSigner();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { assetAddress: string; boostFlags: number }) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Confirm transaction in your wallet...");
      return tx.buyBoost(signer, params.assetAddress, params.boostFlags);
    },
    onSuccess: (_data, variables) => {
      toast.success("Boost activated!");
      patchRegion(queryClient, variables.assetAddress, (r) => {
        // Mirror on-chain extend policy: if still active, advance by one duration; else reset to now.
        const nowSec = Math.floor(Date.now() / 1000);
        const extend = (at: bigint): bigint =>
          isBoostActive(at, nowSec)
            ? at + BigInt(BOOST_DURATION_SECONDS)
            : BigInt(nowSec);
        const f = variables.boostFlags;
        return {
          ...r,
          highlightedAt: f & BOOST_HIGHLIGHTED ? extend(r.highlightedAt) : r.highlightedAt,
          glowingAt: f & BOOST_GLOWING ? extend(r.glowingAt) : r.glowingAt,
          trendingAt: f & BOOST_TRENDING ? extend(r.trendingAt) : r.trendingAt,
        };
      });
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Boost failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}
