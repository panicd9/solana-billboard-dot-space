import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory,
  getSignatureFromTransaction,
  compileTransaction,
  getBase64EncodedWireTransaction,
  generateKeyPairSigner,
  type TransactionSigner,
  type Address,
  type Instruction,
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
import { COLLECTION_ADDRESS, TREASURY } from "./constants";
import { getRpc, getRpcSubscriptions } from "./accounts";

const COMPUTE_BUDGET_PROGRAM =
  "ComputeBudget111111111111111111111111111111" as Address;

// Compute-unit limits. MAX_CU is Solana's hard ceiling; we use it as the
// simulation sandbox so `unitsConsumed` reflects the tx's true cost, not
// a guessed budget. FALLBACK_CU is used only when simulation is unusable
// (RPC outage, validator that doesn't support replaceRecentBlockhash).
const MAX_CU = 1_400_000;
const MIN_CU = 10_000;
const FALLBACK_CU = 400_000;
const CU_MARGIN = 1.1; // 10% headroom over simulated usage

// Priority fee bounds (microLamports per CU). Floor keeps us above "free"
// so we don't starve in light contention; ceiling caps per-tx cost even
// when the network sees a fee-spike outlier.
const PRIORITY_FEE_FLOOR: bigint = 10_000n;
const PRIORITY_FEE_CEILING: bigint = 1_000_000n;
const PRIORITY_FEE_CACHE_MS = 10_000;

function getSetComputeUnitLimitInstruction(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2; // SetComputeUnitLimit discriminator
  new DataView(data.buffer).setUint32(1, units, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM,
    accounts: [],
    data,
  };
}

function getSetComputeUnitPriceInstruction(microLamports: bigint): Instruction {
  const data = new Uint8Array(9);
  data[0] = 3; // SetComputeUnitPrice discriminator
  new DataView(data.buffer).setBigUint64(1, microLamports, true);
  return {
    programAddress: COMPUTE_BUDGET_PROGRAM,
    accounts: [],
    data,
  };
}

let priorityFeeCache: { value: bigint; at: number } | null = null;

async function estimatePriorityFeeMicroLamports(
  rpc: ReturnType<typeof getRpc>
): Promise<bigint> {
  const now = Date.now();
  if (priorityFeeCache && now - priorityFeeCache.at < PRIORITY_FEE_CACHE_MS) {
    return priorityFeeCache.value;
  }
  let fee = PRIORITY_FEE_FLOOR;
  try {
    const samples = await rpc.getRecentPrioritizationFees().send();
    const nonZero = samples
      .map((s) => BigInt(s.prioritizationFee))
      .filter((f) => f > 0n)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    if (nonZero.length > 0) {
      // 75th percentile balances cost vs. landing probability. p50 loses to
      // anyone paying above median; p99 overpays during isolated spikes.
      const idx = Math.min(Math.floor(nonZero.length * 0.75), nonZero.length - 1);
      fee = nonZero[idx];
    }
  } catch (err) {
    console.warn("getRecentPrioritizationFees failed, using floor:", err);
  }
  if (fee < PRIORITY_FEE_FLOOR) fee = PRIORITY_FEE_FLOOR;
  if (fee > PRIORITY_FEE_CEILING) fee = PRIORITY_FEE_CEILING;
  priorityFeeCache = { value: fee, at: now };
  return fee;
}

async function simulateAndSizeCuLimit(
  rpc: ReturnType<typeof getRpc>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: any
): Promise<number> {
  let wireTx: ReturnType<typeof getBase64EncodedWireTransaction>;
  try {
    wireTx = getBase64EncodedWireTransaction(compileTransaction(message));
  } catch (err) {
    console.warn("Could not compile tx for simulation, using fallback CU:", err);
    return FALLBACK_CU;
  }
  try {
    const { value: sim } = await rpc
      .simulateTransaction(wireTx, {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: "confirmed",
      })
      .send();
    if (sim.err) {
      // Simulation explicitly failed — surface the on-chain error BEFORE
      // prompting the wallet, so users don't sign a doomed transaction.
      const logs = sim.logs?.join("\n") ?? JSON.stringify(sim.err);
      throw new Error(`Transaction would fail on-chain:\n${logs}`);
    }
    const consumed = sim.unitsConsumed;
    if (consumed == null) return FALLBACK_CU;
    const sized = Math.ceil(Number(consumed) * CU_MARGIN);
    return Math.max(MIN_CU, Math.min(MAX_CU, sized));
  } catch (err) {
    // Re-throw our own "would fail on-chain" errors; swallow transport /
    // unsupported-method failures (some validators reject the config).
    if (err instanceof Error && err.message.startsWith("Transaction would fail on-chain")) {
      throw err;
    }
    console.warn("simulateTransaction failed, using fallback CU:", err);
    return FALLBACK_CU;
  }
}

async function buildAndSend(
  signer: TransactionSigner,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instructions: readonly any[]
): Promise<string> {
  const rpc = getRpc();
  const rpcSubscriptions = getRpcSubscriptions();
  const [{ value: blockhash }, priorityFee] = await Promise.all([
    rpc.getLatestBlockhash({ commitment: "confirmed" }).send(),
    estimatePriorityFeeMicroLamports(rpc),
  ]);

  // First pass: build with MAX_CU so simulation measures real usage.
  const simMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction(MAX_CU),
          getSetComputeUnitPriceInstruction(priorityFee),
          ...instructions,
        ],
        m
      ),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m)
  );

  const cuLimit = await simulateAndSizeCuLimit(rpc, simMessage);

  // Second pass: rebuild with the tight CU limit — priority fee = CU × price,
  // so sizing down directly reduces what the user pays.
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(signer.address, m),
    (m) =>
      appendTransactionMessageInstructions(
        [
          getSetComputeUnitLimitInstruction(cuLimit),
          getSetComputeUnitPriceInstruction(priorityFee),
          ...instructions,
        ],
        m
      ),
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
    treasury: TREASURY,
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
  assetAddress: string,
  maxPrice: bigint
): Promise<string> {
  const ix = await getExecutePurchaseInstructionAsync({
    buyer: signer,
    seller: sellerAddress as Address,
    asset: assetAddress as Address,
    collection: COLLECTION_ADDRESS,
    treasury: TREASURY,
    maxPrice,
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
    treasury: TREASURY,
    boostFlags,
  });

  return buildAndSend(signer, [ix]);
}
