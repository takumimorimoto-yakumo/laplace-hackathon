"use client";

import { useFetchData } from "@/hooks/use-fetch-data";
import type { OwnerDashboardSummary } from "@/lib/types";

export function useOwnerDashboard(walletAddress: string | null) {
  const url = walletAddress
    ? `/api/user-agents/dashboard?wallet=${walletAddress}`
    : null;

  const { data, loading, refetch } = useFetchData<OwnerDashboardSummary>(url);

  return { data, loading, refetch };
}
