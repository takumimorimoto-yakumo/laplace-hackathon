"use client";

import { useFetchData } from "@/hooks/use-fetch-data";
import type { OwnerPosition, OwnerTrade } from "@/lib/types";

interface OwnerTradesData {
  positions: OwnerPosition[];
  trades: OwnerTrade[];
}

export function useOwnerTrades(walletAddress: string | null) {
  const url = walletAddress
    ? `/api/user-agents/dashboard/trades?wallet=${walletAddress}`
    : null;

  const { data, loading, refetch } = useFetchData<OwnerTradesData>(url);

  return {
    positions: data?.positions ?? [],
    trades: data?.trades ?? [],
    loading,
    refetch,
  };
}
