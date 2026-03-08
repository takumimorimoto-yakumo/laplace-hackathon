"use client";

import { useEffect, useState, useCallback } from "react";
import type { OwnerDashboardSummary } from "@/lib/types";

export function useOwnerDashboard(walletAddress: string | null) {
  const [data, setData] = useState<OwnerDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user-agents/dashboard?wallet=${walletAddress}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, refetch: fetchDashboard };
}
