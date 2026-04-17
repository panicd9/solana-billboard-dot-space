import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  createAssociatedTokenAccountIdempotent,
} from "@solana/spl-token";
import { SolanaSpace } from "../target/types/solana_space";

export const MPL_CORE_ID = new PublicKey(
  "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
);
export const CANVAS_SEED = Buffer.from("canvas");
export const LISTING_SEED = Buffer.from("listing");
export const BOOSTS_SEED = Buffer.from("boosts");
export const USDC_DECIMALS = 6;

// Must match programs/solana-space/src/constants.rs
export const FEE_BPS = 400n;
export const BPS_DENOM = 10_000n;
export const CURVE_START_PRICE = 10_000n;
export const CENTER_PRICE_PER_BLOCK = 120_000n;
export const BOOST_PRICE_HIGHLIGHTED = 1_000_000n;
export const BOOST_PRICE_GLOWING = 2_000_000n;
export const BOOST_PRICE_TRENDING = 5_000_000n;
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

/** USDC amount → raw units (6 decimals). */
export const usdc = (n: number) => BigInt(Math.round(n * 1_000_000));

export async function airdrop(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  lamports = 10 * LAMPORTS_PER_SOL
) {
  const sig = await connection.requestAirdrop(pubkey, lamports);
  await connection.confirmTransaction(sig, "confirmed");
}

export interface TestContext {
  program: Program<SolanaSpace>;
  provider: anchor.AnchorProvider;
  authority: Keypair;
  treasury: Keypair;
  usdcMint: PublicKey;
  usdcMintAuthority: Keypair;
  collection: Keypair;
  canvas: PublicKey;
  treasuryAta: PublicKey;
}

/** Creates a fresh USDC-like mint owned by a throw-away authority. */
export async function createUsdcMint(
  provider: anchor.AnchorProvider,
  mintAuthority: Keypair
): Promise<PublicKey> {
  return await createMint(
    provider.connection,
    (provider.wallet as anchor.Wallet).payer,
    mintAuthority.publicKey,
    null,
    USDC_DECIMALS
  );
}

/** Creates (or fetches) an ATA for `owner` of `mint` and mints `amount` USDC into it. */
export async function fundUsdc(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  mintAuthority: Keypair,
  owner: PublicKey,
  amount: bigint
): Promise<PublicKey> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  const ata = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner,
    true
  );
  if (amount > 0n) {
    await mintTo(
      provider.connection,
      payer,
      mint,
      ata.address,
      mintAuthority,
      amount
    );
  }
  return ata.address;
}

/** Creates an ATA (if needed) and returns its address — no minting. */
export async function createAta(
  provider: anchor.AnchorProvider,
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const payer = (provider.wallet as anchor.Wallet).payer;
  return await createAssociatedTokenAccountIdempotent(
    provider.connection,
    payer,
    mint,
    owner,
    undefined,
    TOKEN_PROGRAM_ID
  );
}

export async function usdcBalance(
  provider: anchor.AnchorProvider,
  ata: PublicKey
): Promise<bigint> {
  const acc = await getAccount(provider.connection, ata);
  return acc.amount;
}

/** Full bootstrap: initialize program + create USDC mint + treasury ATA. */
export async function bootstrap(): Promise<TestContext> {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.solanaSpace as Program<SolanaSpace>;

  const authority = (provider.wallet as anchor.Wallet).payer;
  const treasury = Keypair.generate();
  const usdcMintAuthority = Keypair.generate();
  const collection = Keypair.generate();

  const usdcMint = await createUsdcMint(provider, usdcMintAuthority);
  const treasuryAta = await createAta(provider, usdcMint, treasury.publicKey);
  const canvas = canvasPda(program.programId);

  await program.methods
    .initialize({
      treasury: treasury.publicKey,
      usdcMint,
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
    usdcMint,
    usdcMintAuthority,
    collection,
    canvas,
    treasuryAta,
  };
}

export interface MintResult {
  asset: Keypair;
  payerAta: PublicKey;
  buyer: Keypair;
}

/** Helper: fund a buyer, mint a region NFT to them. Returns the asset keypair + ATAs. */
export async function mintRegion(
  ctx: TestContext,
  args: { x: number; y: number; width: number; height: number },
  opts: {
    buyer?: Keypair;
    fundAmount?: bigint;
    imageUri?: string;
    link?: string;
    collection?: PublicKey;
  } = {}
): Promise<MintResult> {
  const buyer = opts.buyer ?? Keypair.generate();
  const fundAmount = opts.fundAmount ?? usdc(1000);
  await airdrop(ctx.provider.connection, buyer.publicKey);

  const payerAta = await fundUsdc(
    ctx.provider,
    ctx.usdcMint,
    ctx.usdcMintAuthority,
    buyer.publicKey,
    fundAmount
  );
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
      usdcMint: ctx.usdcMint,
      payerUsdcAta: payerAta,
      treasuryUsdcAta: ctx.treasuryAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      mplCoreProgram: MPL_CORE_ID,
      systemProgram: SystemProgram.programId,
    } as any)
    .signers([buyer, asset])
    .rpc();

  return { asset, payerAta, buyer };
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
  buyerUsdcAta: PublicKey;
  sellerUsdcAta: PublicKey;
  treasuryUsdcAta?: PublicKey;
  collection?: PublicKey;
  usdcMint?: PublicKey;
}

export async function executePurchase(
  ctx: TestContext,
  p: PurchaseAccounts
): Promise<string> {
  return await ctx.program.methods
    .executePurchase()
    .accounts({
      buyer: p.buyer.publicKey,
      seller: p.seller,
      asset: p.asset,
      collection: p.collection ?? ctx.collection.publicKey,
      usdcMint: p.usdcMint ?? ctx.usdcMint,
      buyerUsdcAta: p.buyerUsdcAta,
      sellerUsdcAta: p.sellerUsdcAta,
      treasuryUsdcAta: p.treasuryUsdcAta ?? ctx.treasuryAta,
      tokenProgram: TOKEN_PROGRAM_ID,
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
  payerUsdcAta?: PublicKey;
  treasuryUsdcAta?: PublicKey;
  collection?: PublicKey;
  usdcMint?: PublicKey;
}

export async function buyBoost(
  ctx: TestContext,
  p: BuyBoostParams
): Promise<string> {
  const payerAta =
    p.payerUsdcAta ??
    (await createAta(ctx.provider, ctx.usdcMint, p.payer.publicKey));
  return await ctx.program.methods
    .buyBoost({ boostFlags: p.flags })
    .accounts({
      payer: p.payer.publicKey,
      asset: p.asset,
      collection: p.collection ?? ctx.collection.publicKey,
      boosts: boostsPda(ctx.program.programId, p.asset),
      usdcMint: p.usdcMint ?? ctx.usdcMint,
      payerUsdcAta: payerAta,
      treasuryUsdcAta: p.treasuryUsdcAta ?? ctx.treasuryAta,
      tokenProgram: TOKEN_PROGRAM_ID,
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
