"use client";

import { useWallet } from "@/components/wallet/wallet-provider";
import { useUserRentals } from "@/hooks/use-user-rentals";

export function useIsRented(agentId: string): boolean {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { rentals } = useUserRentals(walletAddress);

  return rentals.some((r) => r.agentId === agentId && r.isActive);
}
