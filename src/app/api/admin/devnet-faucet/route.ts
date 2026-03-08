import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";

export const dynamic = "force-dynamic";

const AIRDROP_SOL = 1;

/**
 * POST /api/admin/devnet-faucet
 *
 * Airdrops devnet SOL to a wallet for testing.
 * - Only works on devnet
 * - Requires CRON_SECRET or admin wallet in ADMIN_WALLETS env
 *
 * Body: { wallet: string }
 */
export async function POST(request: NextRequest) {
  // Only allow on devnet
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  if (network !== "devnet") {
    return NextResponse.json(
      { error: "Faucet is only available on devnet" },
      { status: 403 }
    );
  }

  // Auth: ADMIN_SECRET bearer OR wallet in ADMIN_WALLETS
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;
  const adminWallets = (process.env.ADMIN_WALLETS ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  let body: { wallet: string };
  try {
    body = (await request.json()) as { wallet: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.wallet) {
    return NextResponse.json(
      { error: "wallet is required" },
      { status: 400 }
    );
  }

  const isAdminAuth = adminSecret && authHeader === `Bearer ${adminSecret}`;
  const isAdminWallet = adminWallets.includes(body.wallet);

  if (!isAdminAuth && !isAdminWallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate wallet address
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(body.wallet);
  } catch {
    return NextResponse.json(
      { error: "Invalid wallet address" },
      { status: 400 }
    );
  }

  // Always use the official devnet RPC for airdrop — third-party RPCs
  // (Helius, Alchemy, etc.) don't support requestAirdrop.
  const airdropConnection = new Connection(
    clusterApiUrl("devnet"),
    "confirmed"
  );

  const results: { sol?: string; error?: string } = {};

  // Airdrop SOL
  try {
    const signature = await airdropConnection.requestAirdrop(
      pubkey,
      AIRDROP_SOL * LAMPORTS_PER_SOL
    );
    await airdropConnection.confirmTransaction(signature, "confirmed");
    results.sol = `${AIRDROP_SOL} SOL airdropped (tx: ${signature})`;
  } catch (err) {
    results.error = `SOL airdrop failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(results);
}
