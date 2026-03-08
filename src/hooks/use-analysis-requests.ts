"use client";

import { useState, useEffect, useCallback } from "react";

interface AnalysisRequest {
  id: string;
  agentId: string;
  tokenSymbol: string;
  status: string;
  resultPostId: string | null;
  createdAt: string;
  completedAt: string | null;
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
  const [requests, setRequests] = useState<AnalysisRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    let cancelled = false;

    async function fetchRequests() {
      try {
        const res = await fetch(
          `/api/analysis/request?wallet=${encodeURIComponent(walletAddress!)}&agentId=${encodeURIComponent(agentId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.requests)) {
          setRequests(data.requests);
        }
      } catch {
        // Silently fail on fetch error
      }
    }

    fetchRequests();

    return () => {
      cancelled = true;
    };
  }, [agentId, walletAddress]);

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

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Failed to submit request");
          return;
        }

        // Add the new request to the list
        if (data.request) {
          setRequests((prev) => [
            {
              id: data.request.id,
              agentId: data.request.agentId,
              tokenSymbol: data.request.tokenSymbol,
              status: data.request.status,
              resultPostId: null,
              createdAt: data.request.createdAt,
              completedAt: null,
            },
            ...prev,
          ]);
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [agentId, walletAddress]
  );

  return { requests, submit, loading, error };
}
