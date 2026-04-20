import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { SolanaSpace } from "../target/types/solana_space";

export const MPL_CORE_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);
export const CANVAS_SEED = Buffer.from("canvas");
export const LISTING_SEED = Buffer.from("listing");
export const BOOSTS_SEED = Buffer.from("boosts");

// Must match programs/solana-space/src/constants.rs
export const FEE_BPS = 400n;
export const BPS_DENOM = 10_000n;
export const CURVE_START_PRICE = 40_000n;
export const CURVE_END_PRICE = 500_000n;
export const CENTER_PRICE_PER_BLOCK = 500_000n;
export const BOOST_HIGHLIGHTED_PRICE = 10_000_000n;
export const BOOST_GLOWING_PRICE = 10_000_000n;
export const BOOST_TRENDING_PRICE = 20_000_000n;
export const MAX_URI_LENGTH = 200;
export const MAX_LINK_LENGTH = 200;

export const canvasPda = (programId: PublicKey) =>
  PublicKey.findProgramAddressSync([CANVAS_SEED], programId)[0];

export const listingPda = (programId: PublicKey, asset: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [LISTING_SEED, asset.toBuffer()],
    programId
  )[0];

export const boostsPda = (programId: PublicKey, asset: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [BOOSTS_SEED, asset.toBuffer()],
    programId
  )[0];

/** SOL amount → lamports (9 decimals). */
export const sol = (n: number) => BigInt(Math.round(n * LAMPORTS_PER_SOL));

export async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  lamports = 10 * LAMPORTS_PER_SOL
) {
  const sig = await connection.requestAirdrop(pubkey, lamports);
  await connection.confirmTransaction(sig, "confirmed");
}

export async function lamportBalance(
  connection: anchor.web3.Connection,
  pubkey: PublicKey
): Promise<bigint> {
  return BigInt(await connection.getBalance(pubkey));
}

export interface TestContext {
  program: Program<SolanaSpace>;
  provider: anchor.AnchorProvider;
  authority: Keypair;
  treasury: Keypair;
  collection: Keypair;
  canvas: PublicKey;
}

/** Full bootstrap: initialize program with a fresh treasury wallet. */
export async function bootstrap(): Promise<TestContext> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.solanaSpace as Program<SolanaSpace>;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const treasury = Keypair.generate();
  const collection = Keypair.generate();

  // Pre-fund treasury above rent-exempt minimum so the first (cheap curve-zone)
  // mint doesn't fail system_program::transfer with "insufficient funds for rent".
  // CURVE_START_PRICE (40k lamports) alone is below the ~890k rent-exempt floor,
  // so a fresh System-owned treasury would otherwise be rejected on creation.
  await airdrop(provider.connection, treasury.publicKey, LAMPORTS_PER_SOL);

  const canvas = canvasPda(program.programId);

  await program.methods
    .initialize({
      treasury: treasury.publicKey,
      collectionUri: "https://example.com/collection.json",
    })
    .accounts({
      authority: authority.publicKey,
      collection: collection.publicKey,
      mplCoreProgram: MPL_CORE_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([collection])
    .rpc();

  return {
    program,
    provider,
    authority,
    treasury,
    collection,
    canvas,
  };
}

export interface MintResult {
  asset: Keypair;
  buyer: Keypair;
}

/** Helper: airdrop a buyer SOL, mint a region NFT to them. */
export async function mintRegion(
  ctx: TestContext,
  args: { x: number; y: number; width: number; height: number },
  opts: {
    buyer?: Keypair;
    fundLamports?: bigint;
    imageUri?: string;
    link?: string;
    collection?: PublicKey;
  } = {}
): Promise<MintResult> {
  const buyer = opts.buyer ?? Keypair.generate();
  const fundLamports = opts.fundLamports ?? BigInt(10 * LAMPORTS_PER_SOL);
  await airdrop(ctx.provider.connection, buyer.publicKey, Number(fundLamports));

  const asset = Keypair.generate();

  await ctx.program.methods
    .mintRegion({
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      imageUri: opts.imageUri ?? "https://example.com/i.png",
      link: opts.link ?? "https://example.com",
    })
    .accounts({
      payer: buyer.publicKey,
      asset: asset.publicKey,
      collection: opts.collection ?? ctx.collection.publicKey,
      treasury: ctx.treasury.publicKey,
      mplCoreProgram: MPL_CORE_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([buyer, asset])
    .rpc();

  return { asset, buyer };
}

/** Extract Anchor-style error name from a thrown RPC error. Returns undefined if none. */
export function extractErrorName(err: unknown): string | undefined {
  const e = err as any;
  if (e?.error?.errorCode?.code) return e.error.errorCode.code as string;
  const msg: string = e?.message ?? String(err);
  const m = msg.match(/Error Code: (\w+)/);
  return m?.[1];
}

export interface ListingArgs {
  startPrice: bigint | number;
  endPrice: bigint | number;
  durationSeconds: bigint | number;
}

export async function createListing(
  ctx: TestContext,
  seller: Keypair,
  asset: PublicKey,
  args: ListingArgs,
  opts: { collection?: PublicKey } = {}
): Promise<string> {
  return await ctx.program.methods
    .createListing({
      startPrice: new anchor.BN(args.startPrice.toString()),
      endPrice: new anchor.BN(args.endPrice.toString()),
      durationSeconds: new anchor.BN(args.durationSeconds.toString()),
    })
    .accounts({
      seller: seller.publicKey,
      asset,
      collection: opts.collection ?? ctx.collection.publicKey,
      mplCoreProgram: MPL_CORE_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([seller])
    .rpc();
}

export async function cancelListing(
  ctx: TestContext,
  seller: Keypair,
  asset: PublicKey,
  opts: { collection?: PublicKey } = {}
): Promise<string> {
  return await ctx.program.methods
    .cancelListing()
    .accounts({
      seller: seller.publicKey,
      asset,
      collection: opts.collection ?? ctx.collection.publicKey,
      mplCoreProgram: MPL_CORE_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([seller])
    .rpc();
}

export interface PurchaseAccounts {
  buyer: Keypair;
  seller: PublicKey;
  asset: PublicKey;
  maxPrice: bigint | number;
  treasury?: PublicKey;
  collection?: PublicKey;
}

export async function executePurchase(
  ctx: TestContext,
  p: PurchaseAccounts
): Promise<string> {
  return await ctx.program.methods
    .executePurchase({ maxPrice: new anchor.BN(p.maxPrice.toString()) })
    .accounts({
      buyer: p.buyer.publicKey,
      seller: p.seller,
      asset: p.asset,
      collection: p.collection ?? ctx.collection.publicKey,
      treasury: p.treasury ?? ctx.treasury.publicKey,
      mplCoreProgram: MPL_CORE_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([p.buyer])
    .rpc();
}

export interface BuyBoostParams {
  payer: Keypair;
  asset: PublicKey;
  flags: number;
  treasury?: PublicKey;
  collection?: PublicKey;
}

export async function buyBoost(
  ctx: TestContext,
  p: BuyBoostParams
): Promise<string> {
  return await ctx.program.methods
    .buyBoost({ boostFlags: p.flags })
    .accounts({
      payer: p.payer.publicKey,
      asset: p.asset,
      collection: p.collection ?? ctx.collection.publicKey,
      boosts: boostsPda(ctx.program.programId, p.asset),
      treasury: p.treasury ?? ctx.treasury.publicKey,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([p.payer])
    .rpc();
}

/** Read the Metaplex Core asset's current owner (bytes 1..33 of the account data). */
export async function readAssetOwner(
  provider: anchor.AnchorProvider,
  asset: PublicKey
): Promise<PublicKey> {
  const info = await provider.connection.getAccountInfo(asset);
  if (!info) throw new Error(`asset ${asset.toBase58()} not found`);
  return new PublicKey(info.data.subarray(1, 33));
}
