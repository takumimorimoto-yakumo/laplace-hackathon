"use client";

import { useMemo } from "react";
import { useWallet } from "@/components/wallet/wallet-provider";

const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? "")
  .split(",")
  .map((w) => w.trim())
  .filter(Boolean);

export function useIsAdmin(): boolean {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;

  return useMemo(
    () => !!walletAddress && adminWallets.includes(walletAddress),
    [walletAddress],
  );
}
