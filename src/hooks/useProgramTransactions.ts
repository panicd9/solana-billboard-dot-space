import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWalletSession } from "@solana/react-hooks";
import { createWalletTransactionSigner } from "@solana/client";
import type { TransactionSigner } from "@solana/kit";
import * as tx from "@/solana/transactions";
import { uploadToIpfs } from "@/solana/ipfs";
import { toast } from "sonner";

function useWalletSigner(): TransactionSigner | null {
  const session = useWalletSession();
  if (!session) return null;
  const { signer } = createWalletTransactionSigner(session);
  return signer;
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

      return result;
    },
    onSuccess: () => {
      toast.success("Region minted successfully!");
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
      return tx.updateRegionImage(signer, params.assetAddress, upload.ipfsUri);
    },
    onSuccess: () => {
      toast.success("Image updated!");
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
    onSuccess: () => {
      toast.success("Link updated!");
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
    onSuccess: () => {
      toast.success("Region listed!");
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
    onSuccess: () => {
      toast.success("Listing cancelled!");
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
      sellerUsdcAta: string;
    }) => {
      if (!signer) throw new Error("Wallet not connected");

      toast.info("Confirm transaction in your wallet...");
      return tx.executePurchase(
        signer,
        params.sellerAddress,
        params.assetAddress,
        params.sellerUsdcAta
      );
    },
    onSuccess: () => {
      toast.success("Region purchased!");
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
    onSuccess: () => {
      toast.success("Boost activated!");
      queryClient.invalidateQueries({ queryKey: ["regions"] });
    },
    onError: (err) => {
      toast.error(`Boost failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });
}
