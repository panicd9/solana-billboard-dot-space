import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  type TransactionSigner,
  type Address,
} from "@solana/kit";
import {
  getMintRegionInstructionAsync,
  getUpdateRegionImageInstructionAsync,
  getUpdateRegionLinkInstructionAsync,
  getCreateListingInstructionAsync,
  getCancelListingInstructionAsync,
  getExecutePurchaseInstructionAsync,
  getBuyBoostInstructionAsync,
} from "@/generated/instructions";
import { COLLECTION_ADDRESS, USDC_MINT, TREASURY_USDC_ATA } from "./constants";
import { getRpc, getRpcSubscriptions } from "./accounts";

async function buildAndSend(
  signer: TransactionSigner,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instructions: readonly any[]
): Promise<string> {
  const rpc = getRpc();
  const rpcSubscriptions = getRpcSubscriptions();
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m)
  );

  const signedTransaction = await signTransactionMessageWithSigners(message);

  // Cluster brand is a phantom type inferred from the URL literal;
  // our configurable URL produces a union the overloads reject.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions } as any);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendAndConfirm(signedTransaction as any, { commitment: "confirmed" });
  } catch (err: unknown) {
    // Walk the cause chain to extract error code and program logs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = err;
    let logs: string[] | undefined;
    let code: number | undefined;
    while (current) {
      if (current.context?.code != null) code = current.context.code;
      if (Array.isArray(current.context?.logs)) logs = current.context.logs;
      current = current.cause;
    }
    console.error(
      "Transaction failed:",
      code != null ? `program error #${code}` : "",
      err
    );
    if (logs?.length) {
      console.error("Program logs:\n" + logs.join("\n"));
      throw new Error(
        `Transaction failed (error #${code ?? "?"}):\n${logs.join("\n")}`
      );
    }
    throw err;
  }

  return getSignatureFromTransaction(signedTransaction);
}

export async function mintRegion(
  signer: TransactionSigner,
  params: {
    x: number;
    y: number;
    width: number;
    height: number;
    imageUri: string;
    link: string;
  }
): Promise<{ signature: string; assetAddress: Address }> {
  const assetSigner = await generateKeyPairSigner();

  const ix = await getMintRegionInstructionAsync({
    payer: signer,
    asset: assetSigner,
    collection: COLLECTION_ADDRESS,
    usdcMint: USDC_MINT,
    treasuryUsdcAta: TREASURY_USDC_ATA,
    x: params.x,
    y: params.y,
    width: params.width,
    height: params.height,
    imageUri: params.imageUri,
    link: params.link,
  });

  const signature = await buildAndSend(signer, [ix]);
  return { signature, assetAddress: assetSigner.address };
}

export async function updateRegionImage(
  signer: TransactionSigner,
  assetAddress: string,
  newImageUri: string
): Promise<string> {
  const ix = await getUpdateRegionImageInstructionAsync({
    owner: signer,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
    payer: signer,
    newImageUri,
  });

  return buildAndSend(signer, [ix]);
}

export async function updateRegionLink(
  signer: TransactionSigner,
  assetAddress: string,
  newLink: string
): Promise<string> {
  const ix = await getUpdateRegionLinkInstructionAsync({
    owner: signer,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
    payer: signer,
    newLink,
  });

  return buildAndSend(signer, [ix]);
}

export async function createListing(
  signer: TransactionSigner,
  assetAddress: string,
  startPrice: bigint,
  endPrice: bigint,
  durationSeconds: bigint
): Promise<string> {
  const ix = await getCreateListingInstructionAsync({
    seller: signer,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
    startPrice,
    endPrice,
    durationSeconds,
  });

  return buildAndSend(signer, [ix]);
}

export async function cancelListing(
  signer: TransactionSigner,
  assetAddress: string
): Promise<string> {
  const ix = await getCancelListingInstructionAsync({
    seller: signer,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
  });

  return buildAndSend(signer, [ix]);
}

export async function executePurchase(
  signer: TransactionSigner,
  sellerAddress: string,
  assetAddress: string
): Promise<string> {
  const TOKEN_PROGRAM =
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
  const ATA_PROGRAM =
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address;

  // Derive seller's USDC ATA: PDA([seller, tokenProgram, usdcMint], ataProgram)
  const [sellerUsdcAta] = await getProgramDerivedAddress({
    programAddress: ATA_PROGRAM,
    seeds: [
      getAddressEncoder().encode(sellerAddress as Address),
      getAddressEncoder().encode(TOKEN_PROGRAM),
      getAddressEncoder().encode(USDC_MINT),
    ],
  });

  const ix = await getExecutePurchaseInstructionAsync({
    buyer: signer,
    seller: sellerAddress as Address,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
    usdcMint: USDC_MINT,
    sellerUsdcAta,
    treasuryUsdcAta: TREASURY_USDC_ATA,
  });

  return buildAndSend(signer, [ix]);
}

export async function buyBoost(
  signer: TransactionSigner,
  assetAddress: string,
  boostFlags: number
): Promise<string> {
  const ix = await getBuyBoostInstructionAsync({
    payer: signer,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
    usdcMint: USDC_MINT,
    treasuryUsdcAta: TREASURY_USDC_ATA,
    boostFlags,
  });

  return buildAndSend(signer, [ix]);
}
