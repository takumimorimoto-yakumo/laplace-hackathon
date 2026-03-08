"use client";

import { useEffect, useState, useCallback } from "react";
import type { OwnerPosition, OwnerTrade } from "@/lib/types";

interface OwnerTradesData {
  positions: OwnerPosition[];
  trades: OwnerTrade[];
}

export function useOwnerTrades(walletAddress: string | null) {
  const [positions, setPositions] = useState<OwnerPosition[]>([]);
  const [trades, setTrades] = useState<OwnerTrade[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTrades = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/user-agents/dashboard/trades?wallet=${walletAddress}`);
      if (res.ok) {
        const json: OwnerTradesData = await res.json();
        setPositions(json.positions);
        setTrades(json.trades);
      }
    } catch (err) {
      console.error("Failed to fetch owner trades:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  return { positions, trades, loading, refetch: fetchTrades };
}
