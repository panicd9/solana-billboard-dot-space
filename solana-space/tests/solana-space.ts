import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  BOOST_PRICE_HIGHLIGHTED,
  BPS_DENOM,
  CENTER_PRICE_PER_BLOCK,
  CURVE_START_PRICE,
  FEE_BPS,
  MAX_LINK_LENGTH,
  MAX_URI_LENGTH,
  MPL_CORE_ID,
  TestContext,
  airdrop,
  bootstrap,
  boostsPda,
  buyBoost,
  canvasPda,
  cancelListing,
  createAta,
  createListing,
  createUsdcMint,
  executePurchase,
  extractErrorName,
  fundUsdc,
  listingPda,
  mintRegion,
  readAssetOwner,
  usdc,
  usdcBalance,
} from "./helpers";

describe("solana-space", () => {
  let ctx: TestContext;

  before("bootstrap canvas + usdc + collection", async () => {
    ctx = await bootstrap();
  });

  // ========================================================================
  // initialize
  // ========================================================================
  describe("initialize", () => {
    it("sets canvas_state fields", async () => {
      const state = await ctx.program.account.canvasState.fetch(ctx.canvas);
      expect(state.authority.toBase58()).to.equal(ctx.authority.publicKey.toBase58());
      expect(state.treasury.toBase58()).to.equal(ctx.treasury.publicKey.toBase58());
      expect(state.usdcMint.toBase58()).to.equal(ctx.usdcMint.toBase58());
      expect(state.collection.toBase58()).to.equal(ctx.collection.publicKey.toBase58());
      expect(state.totalMinted).to.equal(0);
      expect(state.curveBlocksSold).to.equal(0);
    });

    it("cannot be initialized twice", async () => {
      const collection2 = Keypair.generate();
      try {
        await ctx.program.methods
          .initialize({
            treasury: ctx.treasury.publicKey,
            usdcMint: ctx.usdcMint,
            collectionUri: "https://x.com/c.json",
          })
          .accounts({
            authority: ctx.authority.publicKey,
            collection: collection2.publicKey,
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .signers([collection2])
          .rpc();
        expect.fail("re-init should fail");
      } catch (e) {
        // PDA already in use — generic tx error from Anchor/System
        expect((e as Error).message.toLowerCase()).to.match(
          /already in use|0x0|custom program error/
        );
      }
    });
  });

  // ========================================================================
  // mint_region
  // ========================================================================
  describe("mint_region", () => {
    it("mints a 1x1 bonding-curve region and charges USDC", async () => {
      const before = await usdcBalance(ctx.provider, ctx.treasuryAta);
      const { asset, payerAta } = await mintRegion(ctx, { x: 0, y: 0, width: 1, height: 1 });
      const [after, assetInfo, state] = await Promise.all([
        usdcBalance(ctx.provider, ctx.treasuryAta),
        ctx.provider.connection.getAccountInfo(asset.publicKey),
        ctx.program.account.canvasState.fetch(ctx.canvas),
      ]);

      expect(after - before).to.equal(CURVE_START_PRICE);
      expect(assetInfo).to.not.equal(null);
      expect(assetInfo!.owner.toBase58()).to.equal(MPL_CORE_ID.toBase58());
      expect(state.totalMinted).to.be.greaterThan(0);
      expect(state.curveBlocksSold).to.be.greaterThan(0);
      expect(payerAta).to.not.equal(null);
    });

    it("mints a 2x2 region in the center zone at fixed price", async () => {
      // CENTER_ZONE origin is (66, 37).
      const before = await usdcBalance(ctx.provider, ctx.treasuryAta);
      await mintRegion(ctx, { x: 66, y: 37, width: 2, height: 2 });
      const after = await usdcBalance(ctx.provider, ctx.treasuryAta);
      expect(after - before).to.equal(4n * CENTER_PRICE_PER_BLOCK);
    });

    it("rejects overlapping regions", async () => {
      await mintRegion(ctx, { x: 10, y: 10, width: 2, height: 2 });
      try {
        await mintRegion(ctx, { x: 11, y: 11, width: 2, height: 2 });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("RegionOccupied");
      }
    });

    it("rejects regions out of bounds", async () => {
      try {
        await mintRegion(ctx, { x: 190, y: 0, width: 5, height: 1 });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("RegionOutOfBounds");
      }
    });

    it("rejects width/height of 0", async () => {
      try {
        await mintRegion(ctx, { x: 5, y: 5, width: 0, height: 1 });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidWidth");
      }
    });

    it("rejects image URI over max length", async () => {
      try {
        await mintRegion(ctx, { x: 40, y: 0, width: 1, height: 1 }, {
          imageUri: "x".repeat(MAX_URI_LENGTH + 1),
        });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("UriTooLong");
      }
    });

    it("rejects link over max length", async () => {
      try {
        await mintRegion(ctx, { x: 40, y: 0, width: 1, height: 1 }, {
          link: "x".repeat(MAX_LINK_LENGTH + 1),
        });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("LinkTooLong");
      }
    });

    it("rejects wrong collection pubkey", async () => {
      try {
        await mintRegion(ctx, { x: 40, y: 0, width: 1, height: 1 }, {
          collection: Keypair.generate().publicKey,
        });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidCollection");
      }
    });

    it("bonding curve: second curve mint costs more than first", async () => {
      const t0 = await usdcBalance(ctx.provider, ctx.treasuryAta);
      await mintRegion(ctx, { x: 2, y: 0, width: 1, height: 1 });
      const t1 = await usdcBalance(ctx.provider, ctx.treasuryAta);
      await mintRegion(ctx, { x: 3, y: 0, width: 1, height: 1 });
      const t2 = await usdcBalance(ctx.provider, ctx.treasuryAta);

      const firstCost = t1 - t0;
      const secondCost = t2 - t1;
      expect(secondCost > firstCost).to.equal(true);
    });

    it("mixed region straddling center + curve zone", async () => {
      // 2x1 region where x=65 is curve, x=66 is first center column.
      // Use y=40 to avoid the 2x2 center region already minted at (66, 37).
      const before = await usdcBalance(ctx.provider, ctx.treasuryAta);
      await mintRegion(ctx, { x: 65, y: 40, width: 2, height: 1 });
      const after = await usdcBalance(ctx.provider, ctx.treasuryAta);
      const paid = after - before;
      // 1 center block = 120_000. 1 curve block ≥ 10_000. So paid > 120_000 and < 1 USDC.
      expect(paid > 120_000n).to.equal(true);
      expect(paid < 1_000_000n).to.equal(true);
    });

    it("rejects unknown USDC mint", async () => {
      const bogusMintAuth = Keypair.generate();
      const bogusMint = await createUsdcMint(ctx.provider, bogusMintAuth);
      const buyer = Keypair.generate();
      await airdrop(ctx.provider.connection, buyer.publicKey);
      const payerAta = await fundUsdc(
        ctx.provider,
        bogusMint,
        bogusMintAuth,
        buyer.publicKey,
        usdc(100)
      );
      const treasuryAta = await createAta(ctx.provider, bogusMint, ctx.treasury.publicKey);
      const asset = Keypair.generate();

      try {
        await ctx.program.methods
          .mintRegion({ x: 20, y: 0, width: 1, height: 1, imageUri: "a", link: "b" })
          .accounts({
            payer: buyer.publicKey,
            asset: asset.publicKey,
            collection: ctx.collection.publicKey,
            usdcMint: bogusMint,
            payerUsdcAta: payerAta,
            treasuryUsdcAta: treasuryAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .signers([buyer, asset])
          .rpc();
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidUsdcMint");
      }
    });

    it("BLOCKS free-mint exploit: attacker-controlled treasury ATA", async () => {
      const attacker = Keypair.generate();
      await airdrop(ctx.provider.connection, attacker.publicKey);
      const attackerAta = await fundUsdc(
        ctx.provider,
        ctx.usdcMint,
        ctx.usdcMintAuthority,
        attacker.publicKey,
        usdc(100)
      );
      const asset = Keypair.generate();

      try {
        await ctx.program.methods
          .mintRegion({ x: 30, y: 0, width: 1, height: 1, imageUri: "a", link: "b" })
          .accounts({
            payer: attacker.publicKey,
            asset: asset.publicKey,
            collection: ctx.collection.publicKey,
            usdcMint: ctx.usdcMint,
            payerUsdcAta: attackerAta,
            // Attacker passes their own ATA as the treasury destination.
            treasuryUsdcAta: attackerAta,
            tokenProgram: TOKEN_PROGRAM_ID,
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .signers([attacker, asset])
          .rpc();
        expect.fail("exploit should have been blocked");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidTreasury");
      }
    });
  });

  // ========================================================================
  // update_region / update_region_image / update_region_link
  // ========================================================================
  describe("update_region*", () => {
    let owner: Keypair;
    let asset: Keypair;

    before("mint a region to update", async () => {
      const res = await mintRegion(ctx, { x: 50, y: 50, width: 1, height: 1 });
      owner = res.buyer;
      asset = res.asset;
    });

    it("owner updates image + link via update_region", async () => {
      await ctx.program.methods
        .updateRegion({ newImageUri: "https://x.com/new.png", newLink: "https://x.com" })
        .accounts({
          owner: owner.publicKey,
          asset: asset.publicKey,
          collection: ctx.collection.publicKey,
          mplCoreProgram: MPL_CORE_ID,
          systemProgram: SystemProgram.programId,
          payer: ctx.authority.publicKey,
        } as any)
        .signers([owner])
        .rpc();
    });

    it("owner updates only image via update_region_image", async () => {
      await ctx.program.methods
        .updateRegionImage({ newImageUri: "https://x.com/image-only.png" })
        .accounts({
          owner: owner.publicKey,
          asset: asset.publicKey,
          collection: ctx.collection.publicKey,
          mplCoreProgram: MPL_CORE_ID,
          systemProgram: SystemProgram.programId,
          payer: ctx.authority.publicKey,
        } as any)
        .signers([owner])
        .rpc();
    });

    it("owner updates only link via update_region_link", async () => {
      await ctx.program.methods
        .updateRegionLink({ newLink: "https://x.com/link-only" })
        .accounts({
          owner: owner.publicKey,
          asset: asset.publicKey,
          collection: ctx.collection.publicKey,
          mplCoreProgram: MPL_CORE_ID,
          systemProgram: SystemProgram.programId,
          payer: ctx.authority.publicKey,
        } as any)
        .signers([owner])
        .rpc();
    });

    it("rejects non-owner update", async () => {
      const stranger = Keypair.generate();
      await airdrop(ctx.provider.connection, stranger.publicKey);
      try {
        await ctx.program.methods
          .updateRegion({ newImageUri: "x", newLink: "y" })
          .accounts({
            owner: stranger.publicKey,
            asset: asset.publicKey,
            collection: ctx.collection.publicKey,
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
            payer: ctx.authority.publicKey,
          } as any)
          .signers([stranger])
          .rpc();
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("UnauthorizedOwner");
      }
    });

    it("rejects wrong collection pubkey", async () => {
      try {
        await ctx.program.methods
          .updateRegion({ newImageUri: "x", newLink: "y" })
          .accounts({
            owner: owner.publicKey,
            asset: asset.publicKey,
            collection: Keypair.generate().publicKey,
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
            payer: ctx.authority.publicKey,
          } as any)
          .signers([owner])
          .rpc();
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidCollection");
      }
    });

    it("rejects image URI over max length", async () => {
      const longUri = "x".repeat(MAX_URI_LENGTH + 1);
      try {
        await ctx.program.methods
          .updateRegionImage({ newImageUri: longUri })
          .accounts({
            owner: owner.publicKey,
            asset: asset.publicKey,
            collection: ctx.collection.publicKey,
            mplCoreProgram: MPL_CORE_ID,
            systemProgram: SystemProgram.programId,
            payer: ctx.authority.publicKey,
          } as any)
          .signers([owner])
          .rpc();
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("UriTooLong");
      }
    });
  });

  // ========================================================================
  // buy_boost
  // ========================================================================
  describe("buy_boost", () => {
    let owner: Keypair;
    let asset: Keypair;
    let boosts: PublicKey;

    before("mint region + fund owner for boosts", async () => {
      const res = await mintRegion(ctx, { x: 70, y: 0, width: 1, height: 1 });
      owner = res.buyer;
      asset = res.asset;
      boosts = boostsPda(ctx.program.programId, asset.publicKey);
      await fundUsdc(
        ctx.provider,
        ctx.usdcMint,
        ctx.usdcMintAuthority,
        owner.publicKey,
        usdc(20)
      );
    });

    it("buys Highlighted boost (1 USDC)", async () => {
      const before = await usdcBalance(ctx.provider, ctx.treasuryAta);
      await buyBoost(ctx, { payer: owner, asset: asset.publicKey, flags: 1 });
      const [after, state] = await Promise.all([
        usdcBalance(ctx.provider, ctx.treasuryAta),
        ctx.program.account.boosts.fetch(boosts),
      ]);
      expect(after - before).to.equal(BOOST_PRICE_HIGHLIGHTED);
      expect(state.flags).to.equal(1);
    });

    it("rejects re-buying an already-active boost", async () => {
      try {
        await buyBoost(ctx, { payer: owner, asset: asset.publicKey, flags: 1 });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("BoostAlreadyActive");
      }
    });

    it("rejects unknown flag bit (8)", async () => {
      try {
        await buyBoost(ctx, { payer: owner, asset: asset.publicKey, flags: 8 });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidBoostType");
      }
    });

    it("rejects zero flags", async () => {
      try {
        await buyBoost(ctx, { payer: owner, asset: asset.publicKey, flags: 0 });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidBoostType");
      }
    });

    it("buys all three boosts at once (flags = 7, 8 USDC)", async () => {
      const { asset: a2, buyer: b2 } = await mintRegion(ctx, {
        x: 72, y: 0, width: 1, height: 1,
      });
      await fundUsdc(ctx.provider, ctx.usdcMint, ctx.usdcMintAuthority, b2.publicKey, usdc(20));

      const before = await usdcBalance(ctx.provider, ctx.treasuryAta);
      await buyBoost(ctx, { payer: b2, asset: a2.publicKey, flags: 7 });
      const [after, state] = await Promise.all([
        usdcBalance(ctx.provider, ctx.treasuryAta),
        ctx.program.account.boosts.fetch(boostsPda(ctx.program.programId, a2.publicKey)),
      ]);
      // 1 + 2 + 5 = 8 USDC
      expect(after - before).to.equal(8_000_000n);
      expect(state.flags).to.equal(7);
    });

    it("rejects wrong collection pubkey", async () => {
      try {
        await buyBoost(ctx, {
          payer: owner,
          asset: asset.publicKey,
          flags: 1,
          collection: Keypair.generate().publicKey,
        });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidCollection");
      }
    });

    it("BLOCKS free-boost exploit: attacker-controlled treasury ATA", async () => {
      // Fresh region so boosts PDA is uninitialized.
      const { asset: a2, buyer: b2 } = await mintRegion(ctx, { x: 80, y: 0, width: 1, height: 1 });
      await fundUsdc(ctx.provider, ctx.usdcMint, ctx.usdcMintAuthority, b2.publicKey, usdc(10));
      const attackerAta = await createAta(ctx.provider, ctx.usdcMint, b2.publicKey);

      try {
        await buyBoost(ctx, {
          payer: b2,
          asset: a2.publicKey,
          flags: 1,
          payerUsdcAta: attackerAta,
          treasuryUsdcAta: attackerAta,
        });
        expect.fail("exploit should have been blocked");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidTreasury");
      }
    });
  });

  // ========================================================================
  // create_listing / cancel_listing
  // ========================================================================
  describe("create_listing / cancel_listing", () => {
    it("seller lists an NFT and then cancels", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 100, y: 0, width: 1, height: 1,
      });
      const listing = listingPda(ctx.program.programId, asset.publicKey);

      await createListing(ctx, seller, asset.publicKey, {
        startPrice: 1_000_000,
        endPrice: 500_000,
        durationSeconds: 3600,
      });

      const [listingState, escrowOwner] = await Promise.all([
        ctx.program.account.listing.fetch(listing),
        readAssetOwner(ctx.provider, asset.publicKey),
      ]);
      expect(listingState.seller.toBase58()).to.equal(seller.publicKey.toBase58());
      expect(listingState.asset.toBase58()).to.equal(asset.publicKey.toBase58());
      expect(escrowOwner.toBase58()).to.equal(listing.toBase58());

      await cancelListing(ctx, seller, asset.publicKey);

      const [closed, returnedOwner] = await Promise.all([
        ctx.program.account.listing.fetchNullable(listing),
        readAssetOwner(ctx.provider, asset.publicKey),
      ]);
      expect(closed).to.equal(null);
      expect(returnedOwner.toBase58()).to.equal(seller.publicKey.toBase58());
    });

    const zeroArgCases = [
      { name: "start_price", args: { startPrice: 0, endPrice: 1, durationSeconds: 60 }, err: "InvalidStartPrice", x: 110 },
      { name: "end_price", args: { startPrice: 1, endPrice: 0, durationSeconds: 60 }, err: "InvalidEndPrice", x: 112 },
      { name: "duration", args: { startPrice: 1, endPrice: 1, durationSeconds: 0 }, err: "InvalidDuration", x: 114 },
    ];
    for (const tc of zeroArgCases) {
      it(`rejects zero ${tc.name}`, async () => {
        const { asset, buyer: seller } = await mintRegion(ctx, {
          x: tc.x, y: 0, width: 1, height: 1,
        });
        try {
          await createListing(ctx, seller, asset.publicKey, tc.args);
          expect.fail("should have failed");
        } catch (e) {
          expect(extractErrorName(e)).to.equal(tc.err);
        }
      });
    }

    it("rejects wrong collection pubkey", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 116, y: 0, width: 1, height: 1,
      });
      try {
        await createListing(
          ctx, seller, asset.publicKey,
          { startPrice: 1_000_000, endPrice: 1_000_000, durationSeconds: 3600 },
          { collection: Keypair.generate().publicKey }
        );
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidCollection");
      }
    });

    it("rejects double-listing (asset already escrowed)", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 118, y: 0, width: 1, height: 1,
      });
      const args = { startPrice: 1_000_000, endPrice: 1_000_000, durationSeconds: 3600 };
      await createListing(ctx, seller, asset.publicKey, args);
      try {
        await createListing(ctx, seller, asset.publicKey, args);
        expect.fail("should have failed");
      } catch (e) {
        // PDA already exists → init constraint / System allocate error
        expect((e as Error).message.toLowerCase()).to.match(
          /already in use|custom program error|0x0/
        );
      }
    });

    it("supports re-listing after cancel", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 119, y: 0, width: 1, height: 1,
      });
      const args = { startPrice: 1_000_000, endPrice: 1_000_000, durationSeconds: 3600 };
      await createListing(ctx, seller, asset.publicKey, args);
      await cancelListing(ctx, seller, asset.publicKey);
      await createListing(ctx, seller, asset.publicKey, args);

      const state = await ctx.program.account.listing.fetch(
        listingPda(ctx.program.programId, asset.publicKey)
      );
      expect(state.seller.toBase58()).to.equal(seller.publicKey.toBase58());
    });

    it("rejects non-owner listing attempts", async () => {
      const { asset } = await mintRegion(ctx, { x: 120, y: 0, width: 1, height: 1 });
      const stranger = Keypair.generate();
      await airdrop(ctx.provider.connection, stranger.publicKey);
      try {
        await createListing(ctx, stranger, asset.publicKey, {
          startPrice: 1000, endPrice: 1000, durationSeconds: 60,
        });
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("NotAssetOwner");
      }
    });

    it("rejects non-seller cancellation", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 130, y: 0, width: 1, height: 1,
      });
      await createListing(ctx, seller, asset.publicKey, {
        startPrice: 1_000_000, endPrice: 1_000_000, durationSeconds: 3600,
      });

      const stranger = Keypair.generate();
      await airdrop(ctx.provider.connection, stranger.publicKey);
      try {
        await cancelListing(ctx, stranger, asset.publicKey);
        expect.fail("should have failed");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("UnauthorizedCancel");
      }
    });
  });

  // ========================================================================
  // execute_purchase
  // ========================================================================
  describe("execute_purchase", () => {
    it("buyer pays; seller + treasury get split; NFT transfers", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 140, y: 0, width: 1, height: 1,
      });
      const price = 10_000_000n;
      const fee = (price * FEE_BPS) / BPS_DENOM;
      const sellerAmount = price - fee;

      await createListing(ctx, seller, asset.publicKey, {
        startPrice: price, endPrice: price, durationSeconds: 3600,
      });

      const buyer = Keypair.generate();
      await airdrop(ctx.provider.connection, buyer.publicKey);
      const [buyerAta, sellerAta] = await Promise.all([
        fundUsdc(ctx.provider, ctx.usdcMint, ctx.usdcMintAuthority, buyer.publicKey, price),
        createAta(ctx.provider, ctx.usdcMint, seller.publicKey),
      ]);

      const [treasuryBefore, sellerBefore] = await Promise.all([
        usdcBalance(ctx.provider, ctx.treasuryAta),
        usdcBalance(ctx.provider, sellerAta),
      ]);

      await executePurchase(ctx, {
        buyer, seller: seller.publicKey, asset: asset.publicKey, buyerUsdcAta: buyerAta, sellerUsdcAta: sellerAta,
      });

      const listing = listingPda(ctx.program.programId, asset.publicKey);
      const [treasuryAfter, sellerAfter, buyerAfter, nftOwner, closed] = await Promise.all([
        usdcBalance(ctx.provider, ctx.treasuryAta),
        usdcBalance(ctx.provider, sellerAta),
        usdcBalance(ctx.provider, buyerAta),
        readAssetOwner(ctx.provider, asset.publicKey),
        ctx.program.account.listing.fetchNullable(listing),
      ]);
      expect(treasuryAfter - treasuryBefore).to.equal(fee);
      expect(sellerAfter - sellerBefore).to.equal(sellerAmount);
      expect(buyerAfter).to.equal(0n);
      expect(nftOwner.toBase58()).to.equal(buyer.publicKey.toBase58());
      expect(closed).to.equal(null);
    });

    it("BLOCKS NFT-theft exploit: attacker-controlled seller_usdc_ata", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 150, y: 0, width: 1, height: 1,
      });
      await createListing(ctx, seller, asset.publicKey, {
        startPrice: 5_000_000, endPrice: 5_000_000, durationSeconds: 3600,
      });

      const attacker = Keypair.generate();
      await airdrop(ctx.provider.connection, attacker.publicKey);
      const attackerAta = await fundUsdc(
        ctx.provider, ctx.usdcMint, ctx.usdcMintAuthority, attacker.publicKey, usdc(50)
      );

      try {
        await executePurchase(ctx, {
          buyer: attacker,
          seller: seller.publicKey,
          asset: asset.publicKey,
          buyerUsdcAta: attackerAta,
          sellerUsdcAta: attackerAta,
        });
        expect.fail("exploit should have been blocked");
      } catch (e) {
        // The token::authority = seller constraint raises ConstraintTokenOwner.
        expect(extractErrorName(e)).to.equal("ConstraintTokenOwner");
      }
    });

    it("BLOCKS NFT-theft exploit: attacker-controlled treasury_usdc_ata", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 160, y: 0, width: 1, height: 1,
      });
      await createListing(ctx, seller, asset.publicKey, {
        startPrice: 5_000_000, endPrice: 5_000_000, durationSeconds: 3600,
      });

      const attacker = Keypair.generate();
      await airdrop(ctx.provider.connection, attacker.publicKey);
      const [attackerAta, realSellerAta] = await Promise.all([
        fundUsdc(ctx.provider, ctx.usdcMint, ctx.usdcMintAuthority, attacker.publicKey, usdc(50)),
        createAta(ctx.provider, ctx.usdcMint, seller.publicKey),
      ]);

      try {
        await executePurchase(ctx, {
          buyer: attacker,
          seller: seller.publicKey,
          asset: asset.publicKey,
          buyerUsdcAta: attackerAta,
          sellerUsdcAta: realSellerAta,
          treasuryUsdcAta: attackerAta,
        });
        expect.fail("exploit should have been blocked");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidTreasury");
      }
    });

    it("rejects wrong usdc_mint", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 170, y: 0, width: 1, height: 1,
      });
      await createListing(ctx, seller, asset.publicKey, {
        startPrice: 5_000_000, endPrice: 5_000_000, durationSeconds: 3600,
      });

      const fakeMintAuthority = Keypair.generate();
      const fakeMint = await createUsdcMint(ctx.provider, fakeMintAuthority);

      const buyer = Keypair.generate();
      await airdrop(ctx.provider.connection, buyer.publicKey);
      const [buyerAta, sellerAta, treasuryFakeAta] = await Promise.all([
        fundUsdc(ctx.provider, fakeMint, fakeMintAuthority, buyer.publicKey, usdc(50)),
        createAta(ctx.provider, fakeMint, seller.publicKey),
        createAta(ctx.provider, fakeMint, ctx.treasury.publicKey),
      ]);

      try {
        await executePurchase(ctx, {
          buyer,
          seller: seller.publicKey,
          asset: asset.publicKey,
          buyerUsdcAta: buyerAta,
          sellerUsdcAta: sellerAta,
          treasuryUsdcAta: treasuryFakeAta,
          usdcMint: fakeMint,
        });
        expect.fail("should have rejected wrong usdc_mint");
      } catch (e) {
        expect(extractErrorName(e)).to.equal("InvalidUsdcMint");
      }
    });

    it("charges a mid-curve price on a descending auction", async () => {
      const { asset, buyer: seller } = await mintRegion(ctx, {
        x: 180, y: 0, width: 1, height: 1,
      });

      const startPrice = 30_000_000n;
      const endPrice = 10_000_000n;

      await createListing(ctx, seller, asset.publicKey, {
        startPrice, endPrice, durationSeconds: 60,
      });

      // Advance the validator clock; stay well before end_time.
      await new Promise((r) => setTimeout(r, 2500));

      const buyer = Keypair.generate();
      await airdrop(ctx.provider.connection, buyer.publicKey);
      const [buyerAta, sellerAta] = await Promise.all([
        fundUsdc(ctx.provider, ctx.usdcMint, ctx.usdcMintAuthority, buyer.publicKey, startPrice),
        createAta(ctx.provider, ctx.usdcMint, seller.publicKey),
      ]);

      const [treasuryBefore, sellerBefore, buyerBefore] = await Promise.all([
        usdcBalance(ctx.provider, ctx.treasuryAta),
        usdcBalance(ctx.provider, sellerAta),
        usdcBalance(ctx.provider, buyerAta),
      ]);

      await executePurchase(ctx, {
        buyer, seller: seller.publicKey, asset: asset.publicKey, buyerUsdcAta: buyerAta, sellerUsdcAta: sellerAta,
      });

      const [buyerAfter, treasuryAfter, sellerAfter] = await Promise.all([
        usdcBalance(ctx.provider, buyerAta),
        usdcBalance(ctx.provider, ctx.treasuryAta),
        usdcBalance(ctx.provider, sellerAta),
      ]);

      const paid = buyerBefore - buyerAfter;
      const feeCollected = treasuryAfter - treasuryBefore;
      const sellerGained = sellerAfter - sellerBefore;

      expect(paid > endPrice).to.equal(true);
      expect(paid < startPrice).to.equal(true);
      expect(feeCollected + sellerGained).to.equal(paid);
      expect(feeCollected).to.equal((paid * FEE_BPS) / BPS_DENOM);
    });
  });
});
