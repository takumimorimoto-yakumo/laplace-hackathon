"use client";

import { useState, useCallback } from "react";

export function useRetireAgent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const retire = useCallback(
    async (agentId: string, walletAddress: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/user-agents/${agentId}?wallet_address=${encodeURIComponent(walletAddress)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          setError(
            (body as { error?: string }).error ?? "Failed to retire agent"
          );
          return false;
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { retire, loading, error };
}
