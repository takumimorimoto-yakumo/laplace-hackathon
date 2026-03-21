"use client";

import { useFetchData } from "@/hooks/use-fetch-data";
import type { PortfolioSnapshot } from "@/lib/types";

interface OwnerSnapshotsData {
  snapshots: PortfolioSnapshot[];
}

export function useOwnerSnapshots(walletAddress: string | null, days = 30) {
  const url = walletAddress
    ? `/api/user-agents/dashboard/snapshots?wallet=${walletAddress}&days=${days}`
    : null;

  const { data, loading, refetch } = useFetchData<OwnerSnapshotsData>(url);

  return {
    snapshots: data?.snapshots ?? [],
    loading,
    refetch,
  };
}
