"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentEarningsSummary } from "@/lib/types";

export function useAgentEarningsSummary(agentId: string) {
  const [data, setData] = useState<AgentEarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user-agents/${agentId}/earnings`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        setError((body as { error?: string }).error ?? "Failed to load earnings");
        return;
      }
      const summary = (await res.json()) as AgentEarningsSummary;
      setData(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

interface WithdrawParams {
  amount: number;
  destinationWallet: string;
  message: string;
  signature: string;
}

export function useWithdrawEarnings(agentId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (params: WithdrawParams): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/user-agents/${agentId}/withdraw`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: params.amount,
            destination_wallet: params.destinationWallet,
            message: params.message,
            signature: params.signature,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Unknown error" }));
          setError((body as { error?: string }).error ?? "Withdrawal failed");
          return false;
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [agentId]
  );

  return { mutate, loading, error };
}
