"use client";

import { useState, useCallback } from "react";
import { useFetchData } from "@/hooks/use-fetch-data";

interface AnalysisRequest {
  id: string;
  agentId: string;
  tokenSymbol: string;
  status: string;
  resultPostId: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface AnalysisRequestsResponse {
  requests: AnalysisRequest[];
}

interface UseAnalysisRequestsReturn {
  requests: AnalysisRequest[];
  submit: (tokenSymbol: string, tokenAddress?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useAnalysisRequests(
  agentId: string,
  walletAddress: string | null
): UseAnalysisRequestsReturn {
  const url = walletAddress
    ? `/api/analysis/request?wallet=${encodeURIComponent(walletAddress)}&agentId=${encodeURIComponent(agentId)}`
    : null;

  const { data, refetch } = useFetchData<AnalysisRequestsResponse>(url, {
    transform: (json) => {
      const parsed = json as { requests?: AnalysisRequest[] };
      return { requests: Array.isArray(parsed.requests) ? parsed.requests : [] };
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (tokenSymbol: string, tokenAddress?: string) => {
      if (!walletAddress) {
        setError("Wallet not connected");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/analysis/request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            userWallet: walletAddress,
            tokenSymbol,
            tokenAddress,
          }),
        });

        const responseData = await res.json();

        if (!res.ok) {
          setError(responseData.error ?? "Failed to submit request");
          return;
        }

        // Refetch to get updated list
        await refetch();
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [agentId, walletAddress, refetch]
  );

  return { requests: data?.requests ?? [], submit, loading, error };
}
