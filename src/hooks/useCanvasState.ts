import { useQuery } from "@tanstack/react-query";
import { fetchCanvasState, parseBitmap } from "@/solana/accounts";

export function useCanvasState() {
  return useQuery({
    queryKey: ["canvasState"],
    queryFn: async () => {
      const account = await fetchCanvasState();
      if (!account.exists) return null;

      return {
        authority: account.data.authority,
        treasury: account.data.treasury,
        collection: account.data.collection,
        totalMinted: account.data.totalMinted,
        curveBlocksSold: account.data.curveBlocksSold,
        occupiedBlocks: parseBitmap(account.data.bitmap),
      };
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
